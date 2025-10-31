"""
Data Export API Endpoints

This module defines the REST API endpoints for data export operations
in the Watershed Disturbance Mapping System.

Endpoints:
- POST /api/v1/exports/ - Create new export request
- GET /api/v1/exports/ - List export requests
- GET /api/v1/exports/{id}/ - Get export request details
- GET /api/v1/exports/{id}/download/ - Download exported file
- DELETE /api/v1/exports/{id}/ - Cancel export request
- GET /api/v1/exports/templates/ - Get export format templates

Author: Watershed Disturbance Mapping System
Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union
import json
import uuid
import csv
import io
from pathlib import Path

from django.db import transaction
from django.db.models import Q, Count, Sum, Avg
from django.utils import timezone
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

from rest_framework import status
from rest_framework.decorators import api_view, action
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import (
    ExportRequest, Watershed, ChangeDetection, SatelliteData,
    TimeSeriesData, ValidationFeedback
)
from .serializers import ExportRequestSerializer
from .permissions import IsWatershedViewerOrAbove
from .utils.export_utils import (
    create_export_job, get_export_templates, validate_export_config,
    generate_geojson_export, generate_csv_export, generate_shapefile_export,
    create_signed_download_url
)
from .utils.s3_utils import upload_to_s3, generate_presigned_url


class ExportEndpoints:
    """Endpoint definitions for data export"""
    
    # Base path for export endpoints
    base_path = "/api/v1/exports"
    
    # Supported export formats
    EXPORT_FORMATS = {
        'geojson': {
            'name': 'GeoJSON',
            'description': 'Geographic JSON format for web mapping',
            'extension': '.geojson',
            'mime_type': 'application/geo+json',
            'max_features': 10000,
            'supports_crs': ['EPSG:4326', 'EPSG:3857']
        },
        'csv': {
            'name': 'CSV',
            'description': 'Comma-separated values for spreadsheet applications',
            'extension': '.csv',
            'mime_type': 'text/csv',
            'max_records': 100000,
            'supports_crs': ['EPSG:4326']
        },
        'shapefile': {
            'name': 'Shapefile',
            'description': 'ESRI Shapefile format for GIS applications',
            'extension': '.zip',
            'mime_type': 'application/zip',
            'max_features': 50000,
            'supports_crs': ['EPSG:4326', 'EPSG:3857', 'EPSG:32633']
        },
        'json': {
            'name': 'JSON',
            'description': 'Structured JSON format with metadata',
            'extension': '.json',
            'mime_type': 'application/json',
            'max_records': 100000,
            'supports_crs': ['EPSG:4326']
        }
    }
    
    # Export data types
    EXPORT_DATA_TYPES = {
        'detections': {
            'name': 'Change Detections',
            'description': 'Export change detection results',
            'default_fields': ['id', 'detection_date', 'confidence_score', 'disturbance_type', 'area_hectares'],
            'geometry_required': True
        },
        'timeseries': {
            'name': 'Time Series Data',
            'description': 'Export spectral index time series',
            'default_fields': ['observation_date', 'index_name', 'index_value'],
            'geometry_required': False
        },
        'watershed_summary': {
            'name': 'Watershed Summary',
            'description': 'Export watershed statistics and metadata',
            'default_fields': ['name', 'area_km2', 'total_detections'],
            'geometry_required': False
        },
        'validation_data': {
            'name': 'Validation Data',
            'description': 'Export validation feedback and ground truth',
            'default_fields': ['validation_type', 'comments', 'ground_truth_type'],
            'geometry_required': False
        }
    }
    
    # Rate limiting per user tier
    rate_limits = {
        "free": "5/hour",
        "analyst": "20/hour",
        "admin": "100/hour"
    }
    
    # Maximum file sizes (in MB)
    MAX_FILE_SIZES = {
        'geojson': 100,
        'csv': 200,
        'shapefile': 500,
        'json': 150
    }
    
    @staticmethod
    def create_export(request) -> Response:
        """
        POST /api/v1/exports/
        
        Create a new data export request.
        
        Request Body:
        {
            "export_type": "detections",
            "format": "geojson",
            "watershed_id": "ws_123",
            "filters": {
                "start_date": "2023-01-01",
                "end_date": "2023-12-31",
                "min_confidence": 0.6,
                "disturbance_type": ["fire", "harvest"],
                "bbox": [-122.5, 45.5, -122.0, 46.0]
            },
            "options": {
                "include_metadata": true,
                "coordinate_system": "EPSG:4326",
                "fields": ["id", "detection_date", "confidence_score", "disturbance_type"],
                "sort_by": "detection_date",
                "sort_order": "desc"
            },
            "email_notification": true
        }
        
        Responses:
        - 201: Created - Export request created successfully
        - 400: Bad Request - Invalid request data
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Watershed not found
        """
        
        # Validate request data
        data = request.data
        
        required_fields = ['export_type', 'format', 'watershed_id']
        for field in required_fields:
            if not data.get(field):
                raise ValidationError({field: f"{field} is required"})
        
        export_type = data['export_type']
        export_format = data['format']
        watershed_id = data['watershed_id']
        
        # Validate export type
        if export_type not in ExportEndpoints.EXPORT_DATA_TYPES:
            raise ValidationError({
                "export_type": f"Invalid export type. "
                f"Supported: {list(ExportEndpoints.EXPORT_DATA_TYPES.keys())}"
            })
        
        # Validate export format
        if export_format not in ExportEndpoints.EXPORT_FORMATS:
            raise ValidationError({
                "format": f"Invalid export format. "
                f"Supported: {list(ExportEndpoints.EXPORT_FORMATS.keys())}"
            })
        
        # Validate watershed access
        try:
            watershed = Watershed.objects.get(id=watershed_id)
            
            # Check permissions
            if not request.user.is_superuser:
                if (watershed.owner != request.user and 
                    request.user not in watershed.analysts.all() and
                    request.user not in watershed.viewers.all()):
                    raise PermissionDenied("Access denied to this watershed")
        
        except Watershed.DoesNotExist:
            raise NotFound(f"Watershed '{watershed_id}' not found")
        
        # Validate filters and options
        filters = data.get('filters', {})
        options = data.get('options', {})
        
        try:
            validate_export_config(export_type, filters, options)
        except ValidationError as e:
            raise ValidationError(str(e))
        
        # Calculate estimated file size and processing time
        estimated_size_mb = ExportEndpoints.estimate_export_size(
            export_type, export_format, filters, watershed_id
        )
        
        if estimated_size_mb > ExportEndpoints.MAX_FILE_SIZES[export_format]:
            raise ValidationError({
                "estimated_size": f"Export size ({estimated_size_mb}MB) exceeds limit "
                f"({ExportEndpoints.MAX_FILE_SIZES[export_format]}MB) for {export_format} format"
            })
        
        try:
            with transaction.atomic():
                # Create export request
                export_data = {
                    'id': f"export_{uuid.uuid4().hex[:8]}",
                    'user': request.user,
                    'watershed': watershed,
                    'export_type': export_type,
                    'export_format': export_format,
                    'filters': filters,
                    'options': options,
                    'email_notification': data.get('email_notification', False),
                    'status': 'pending',
                    'estimated_size_mb': estimated_size_mb,
                    'created_at': timezone.now(),
                    'updated_at': timezone.now()
                }
                
                export_request = ExportRequest.objects.create(**export_data)
                
                # Start async export job
                from .tasks import process_export_request_task
                process_export_request_task.delay(export_request.id)
                
                # Log export request
                import logging
                logger = logging.getLogger(__name__)
                logger.info(
                    f"Export request created: {export_request.id} "
                    f"({export_type} in {export_format} format) "
                    f"for watershed {watershed.id} by user {request.user.id}"
                )
                
                # Return export request details
                serializer = ExportRequestSerializer(export_request)
                
                response_data = {
                    "data": serializer.data,
                    "message": "Export request created successfully",
                    "estimated_processing_time_minutes": export_request.estimated_processing_time(),
                    "estimated_size_mb": estimated_size_mb,
                    "timestamp": timezone.now().isoformat()
                }
                
                return Response(response_data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error creating export request: {str(e)}")
            raise
    
    @staticmethod
    def list_exports(request) -> Response:
        """
        GET /api/v1/exports/
        
        List export requests for the authenticated user.
        
        Query Parameters:
        - page (int): Page number (default: 1)
        - page_size (int): Items per page (default: 20, max: 100)
        - watershed_id (string): Filter by watershed
        - status (string): Filter by status (pending, processing, completed, failed, cancelled)
        - export_type (string): Filter by export type
        - export_format (string): Filter by export format
        - start_date (string): Start date filter (YYYY-MM-DD)
        - end_date (string): End date filter (YYYY-MM-DD)
        
        Responses:
        - 200: Success - Returns paginated list of exports
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        """
        
        # Validate pagination parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        if page_size > 100:
            raise ValidationError("Page size cannot exceed 100 items")
        
        # Get user's export requests
        queryset = ExportRequest.objects.filter(user=request.user)
        
        # Apply filters
        filters = request.GET
        
        # Watershed filter
        watershed_id = filters.get('watershed_id')
        if watershed_id:
            # Check if user has access to watershed
            try:
                watershed = Watershed.objects.get(id=watershed_id)
                if not request.user.is_superuser and watershed.owner != request.user:
                    if request.user not in watershed.analysts.all() and request.user not in watershed.viewers.all():
                        raise PermissionDenied("Access denied to this watershed")
                queryset = queryset.filter(watershed_id=watershed_id)
            except Watershed.DoesNotExist:
                queryset = queryset.none()
        
        # Status filter
        status_filter = filters.get('status')
        if status_filter:
            valid_statuses = ['pending', 'processing', 'completed', 'failed', 'cancelled']
            if status_filter not in valid_statuses:
                raise ValidationError({
                    "status": f"Invalid status. Supported: {valid_statuses}"
                })
            queryset = queryset.filter(status=status_filter)
        
        # Export type filter
        export_type = filters.get('export_type')
        if export_type:
            if export_type not in ExportEndpoints.EXPORT_DATA_TYPES:
                raise ValidationError({
                    "export_type": f"Invalid export type. "
                    f"Supported: {list(ExportEndpoints.EXPORT_DATA_TYPES.keys())}"
                })
            queryset = queryset.filter(export_type=export_type)
        
        # Export format filter
        export_format = filters.get('export_format')
        if export_format:
            if export_format not in ExportEndpoints.EXPORT_FORMATS:
                raise ValidationError({
                    "export_format": f"Invalid export format. "
                    f"Supported: {list(ExportEndpoints.EXPORT_FORMATS.keys())}"
                })
            queryset = queryset.filter(export_format=export_format)
        
        # Date range filters
        start_date = filters.get('start_date')
        end_date = filters.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__lte=end_date)
        
        # Order by creation date (newest first)
        queryset = queryset.order_by('-created_at')
        
        # Paginate results
        total_count = queryset.count()
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        exports = queryset[start_index:end_index]
        
        # Serialize data
        serializer = ExportRequestSerializer(exports, many=True)
        
        # Calculate pagination metadata
        total_pages = (total_count + page_size - 1) // page_size
        
        response_data = {
            "data": serializer.data,
            "pagination": {
                "current_page": page,
                "total_pages": total_pages,
                "total_items": total_count,
                "items_per_page": page_size,
                "has_next": page < total_pages,
                "has_previous": page > 1
            },
            "filters_applied": {
                "watershed_id": watershed_id,
                "status": status_filter,
                "export_type": export_type,
                "export_format": export_format,
                "start_date": start_date,
                "end_date": end_date
            },
            "available_export_types": list(ExportEndpoints.EXPORT_DATA_TYPES.keys()),
            "available_export_formats": list(ExportEndpoints.EXPORT_FORMATS.keys()),
            "timestamp": timezone.now().isoformat()
        }
        
        return Response(response_data)
    
    @staticmethod
    def get_export(request, export_id: str) -> Response:
        """
        GET /api/v1/exports/{id}/
        
        Retrieve detailed information about a specific export request.
        
        Path Parameters:
        - id (string): Export request identifier
        
        Responses:
        - 200: Success - Returns export request details
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Export request not found
        """
        
        try:
            # Get export request
            export_request = ExportRequest.objects.select_related(
                'watershed', 'user'
            ).get(id=export_id)
            
            # Check permissions
            if export_request.user != request.user and not request.user.is_superuser:
                raise PermissionDenied("Access denied to this export request")
            
            # Get additional information
            completion_percentage = export_request.get_completion_percentage()
            processing_stats = export_request.get_processing_stats()
            
            # Serialize data
            serializer = ExportRequestSerializer(export_request)
            
            response_data = {
                "data": serializer.data,
                "completion_percentage": completion_percentage,
                "processing_stats": processing_stats,
                "download_url": export_request.file_url if export_request.status == 'completed' else None,
                "expires_at": export_request.expires_at.isoformat() if export_request.expires_at else None,
                "timestamp": timezone.now().isoformat()
            }
            
            return Response(response_data)
        
        except ExportRequest.DoesNotExist:
            raise NotFound(f"Export request with ID '{export_id}' not found")
    
    @staticmethod
    def download_export(request, export_id: str) -> Response:
        """
        GET /api/v1/exports/{id}/download/
        
        Get download URL for completed export file.
        
        Path Parameters:
        - id (string): Export request identifier
        
        Responses:
        - 200: Success - Returns download URL
        - 400: Bad Request - Export not completed
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Export request not found
        """
        
        try:
            # Get export request
            export_request = ExportRequest.objects.select_related('user').get(id=export_id)
            
            # Check permissions
            if export_request.user != request.user and not request.user.is_superuser:
                raise PermissionDenied("Access denied to this export request")
            
            # Check if export is completed
            if export_request.status != 'completed':
                raise ValidationError({
                    "status": f"Export is not completed. Current status: {export_request.status}"
                })
            
            # Check if file still exists
            if not export_request.file_url:
                raise ValidationError({
                    "file": "Export file not available"
                })
            
            # Generate signed URL for download
            download_url = create_signed_download_url(export_request)
            
            response_data = {
                "download_url": download_url,
                "filename": export_request.filename,
                "file_size_bytes": export_request.file_size,
                "expires_at": export_request.expires_at.isoformat(),
                "format": export_request.export_format,
                "content_type": ExportEndpoints.EXPORT_FORMATS[export_request.export_format]['mime_type'],
                "timestamp": timezone.now().isoformat()
            }
            
            return Response(response_data)
        
        except ExportRequest.DoesNotExist:
            raise NotFound(f"Export request with ID '{export_id}' not found")
    
    @staticmethod
    def cancel_export(request, export_id: str) -> Response:
        """
        DELETE /api/v1/exports/{id}/
        
        Cancel a pending or processing export request.
        
        Path Parameters:
        - id (string): Export request identifier
        
        Responses:
        - 200: Success - Export request cancelled
        - 400: Bad Request - Cannot cancel completed/failed export
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Export request not found
        """
        
        try:
            # Get export request
            export_request = ExportRequest.objects.select_related('user').get(id=export_id)
            
            # Check permissions
            if export_request.user != request.user and not request.user.is_superuser:
                raise PermissionDenied("Access denied to this export request")
            
            # Check if export can be cancelled
            if export_request.status not in ['pending', 'processing']:
                raise ValidationError({
                    "status": f"Cannot cancel export with status '{export_request.status}'. "
                    "Only pending or processing exports can be cancelled."
                })
            
            # Cancel export
            export_request.status = 'cancelled'
            export_request.completed_at = timezone.now()
            export_request.error_message = "Cancelled by user"
            export_request.save()
            
            # Log cancellation
            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                f"Export request cancelled: {export_id} by user {request.user.id}"
            )
            
            return Response({
                "message": "Export request cancelled successfully",
                "status": export_request.status,
                "cancelled_at": export_request.completed_at.isoformat(),
                "timestamp": timezone.now().isoformat()
            })
        
        except ExportRequest.DoesNotExist:
            raise NotFound(f"Export request with ID '{export_id}' not found")
    
    @staticmethod
    def get_export_templates(request) -> Response:
        """
        GET /api/v1/exports/templates/
        
        Get available export format templates and configurations.
        
        Responses:
        - 200: Success - Returns export templates
        """
        
        templates = {}
        
        # Get templates for each data type
        for data_type, config in ExportEndpoints.EXPORT_DATA_TYPES.items():
            templates[data_type] = {
                **config,
                "supported_formats": []
            }
            
            # Add compatible formats
            for format_name, format_config in ExportEndpoints.EXPORT_FORMATS.items():
                if data_type == 'timeseries' and format_name == 'shapefile':
                    continue  # Time series doesn't support shapefile
                
                if data_type == 'detections' or data_type == 'validation_data':
                    templates[data_type]["supported_formats"].append(format_name)
        
        response_data = {
            "export_data_types": ExportEndpoints.EXPORT_DATA_TYPES,
            "export_formats": ExportEndpoints.EXPORT_FORMATS,
            "templates": templates,
            "max_file_sizes_mb": ExportEndpoints.MAX_FILE_SIZES,
            "rate_limits": ExportEndpoints.rate_limits,
            "recommended_usage": {
                "small_datasets": "CSV or JSON formats for datasets < 10,000 records",
                "medium_datasets": "GeoJSON or Shapefile for datasets 10,000-50,000 records",
                "large_datasets": "Consider splitting into multiple exports"
            },
            "timestamp": timezone.now().isoformat()
        }
        
        return Response(response_data)
    
    @staticmethod
    def estimate_export_size(export_type: str, export_format: str, 
                           filters: Dict, watershed_id: str) -> float:
        """Estimate export file size in MB"""
        
        # Base estimates per record (rough approximation)
        base_sizes = {
            'geojson': 0.1,  # KB per feature
            'csv': 0.05,     # KB per record
            'shapefile': 0.15,  # KB per feature
            'json': 0.08     # KB per record
        }
        
        base_size_kb = base_sizes.get(export_format, 0.1)
        
        # Count estimated records based on filters
        try:
            watershed = Watershed.objects.get(id=watershed_id)
            
            if export_type == 'detections':
                queryset = ChangeDetection.objects.filter(watershed=watershed)
                
                # Apply filters
                if filters.get('start_date'):
                    queryset = queryset.filter(detection_date__gte=filters['start_date'])
                if filters.get('end_date'):
                    queryset = queryset.filter(detection_date__lte=filters['end_date'])
                if filters.get('min_confidence'):
                    queryset = queryset.filter(confidence_score__gte=filters['min_confidence'])
                if filters.get('disturbance_type'):
                    queryset = queryset.filter(disturbance_type__in=filters['disturbance_type'])
                
                estimated_records = queryset.count()
            
            elif export_type == 'timeseries':
                # Estimate based on detections with time series data
                queryset = ChangeDetection.objects.filter(
                    watershed=watershed,
                    timeseries_data__isnull=False
                )
                estimated_records = queryset.count() * 12  # Rough estimate of 12 time points per detection
            
            elif export_type == 'watershed_summary':
                estimated_records = 1
            
            elif export_type == 'validation_data':
                queryset = ValidationFeedback.objects.filter(
                    detection__watershed=watershed
                )
                estimated_records = queryset.count()
            
            else:
                estimated_records = 100  # Default estimate
            
        except Watershed.DoesNotExist:
            estimated_records = 100
        
        # Calculate size in MB
        size_mb = (estimated_records * base_size_kb) / 1024
        
        # Add metadata overhead
        if export_format == 'shapefile':
            size_mb *= 1.5  # Shapefiles have overhead for multiple files
        
        return round(size_mb, 2)


# API endpoint registry
EXPORT_ENDPOINT_PATHS = {
    'create': '/api/v1/exports/',
    'list': '/api/v1/exports/',
    'detail': '/api/v1/exports/{id}/',
    'download': '/api/v1/exports/{id}/download/',
    'cancel': '/api/v1/exports/{id}/',
    'templates': '/api/v1/exports/templates/'
}


class ExportAPIViewSet(ModelViewSet):
    """Django REST Framework ViewSet for Export endpoints"""
    
    serializer_class = ExportRequestSerializer
    permission_classes = [IsWatershedViewerOrAbove]
    
    def get_queryset(self):
        """Get export requests based on user permissions"""
        if self.request.user.is_superuser:
            return ExportRequest.objects.select_related('watershed', 'user').all()
        else:
            return ExportRequest.objects.filter(
                user=self.request.user
            ).select_related('watershed', 'user')
    
    def perform_create(self, serializer):
        """Create export request with user association"""
        serializer.save(user=self.request.user)
    
    @action(detail=False, methods=['get'])
    def templates(self, request):
        """Handle export templates request"""
        return ExportEndpoints.get_export_templates(request)
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Handle export download request"""
        return ExportEndpoints.download_export(request, pk)