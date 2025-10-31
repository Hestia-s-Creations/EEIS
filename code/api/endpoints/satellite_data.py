"""
Satellite Data Processing API Endpoints

This module defines the REST API endpoints for managing satellite data processing
and data acquisition in the Watershed Disturbance Mapping System.

Endpoints:
- POST /api/v1/satellite-data/ingest/ - Initiate data ingestion
- POST /api/v1/satellite-data/process/ - Process satellite data
- GET /api/v1/satellite-data/ - List satellite data products
- GET /api/v1/satellite-data/{id}/ - Get data product details
- POST /api/v1/satellite-data/{id}/quality-check/ - Perform quality assessment
- GET /api/v1/satellite-data/{id}/indices/ - Get spectral indices
- POST /api/v1/satellite-data/bulk-process/ - Bulk processing operations

Author: Watershed Disturbance Mapping System
Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import json
import uuid

from django.db import transaction
from django.utils import timezone
from django.contrib.gis.geos import Point, Polygon

from rest_framework import status
from rest_framework.decorators import api_view, action
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import (
    SatelliteData, Watershed, ProcessingJob, JobStatus,
    SpectralIndex, QualityMetric
)
from .serializers import SatelliteDataSerializer, ProcessingJobSerializer
from .permissions import IsWatershedOwnerOrAnalyst
from .utils.gis_utils import validate_bbox, clip_geometry
from .utils.satellite_utils import (
    get_available_sensors, validate_satellite_config,
    calculate_cloud_coverage, process_spectral_indices
)
from .utils.earth_engine import (
    ingest_satellite_data, process_landsat_data, process_sentinel_data,
    calculate_quality_metrics
)


class SatelliteDataEndpoints:
    """Endpoint definitions for satellite data processing"""
    
    # Base path for satellite data endpoints
    base_path = "/api/v1/satellite-data"
    
    # Supported satellite sensors
    SUPPORTED_SENSORS = {
        'landsat8': {
            'name': 'Landsat 8 OLI',
            'resolution': 30,
            'bands': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2'],
            'bands_range': (1984, None)  # Present since 1984
        },
        'landsat9': {
            'name': 'Landsat 9 OLI-2',
            'resolution': 30,
            'bands': ['blue', 'green', 'red', 'nir', 'swir1', 'swir2'],
            'bands_range': (2021, None)  # Present since 2021
        },
        'sentinel2': {
            'name': 'Sentinel-2 MSI',
            'resolution': 10,
            'bands': ['blue', 'green', 'red', 'rededge1', 'rededge2', 'rededge3', 'nir', 'swir1', 'swir2'],
            'bands_range': (2015, None)  # Present since 2015
        }
    }
    
    # Rate limiting per user tier
    rate_limits = {
        "free": "20/hour",
        "analyst": "100/hour",
        "admin": "500/hour"
    }
    
    @staticmethod
    def ingest_satellite_data(request) -> Response:
        """
        POST /api/v1/satellite-data/ingest/
        
        Initiate satellite data ingestion for a watershed over a specified time period.
        
        Request Body:
        {
            "watershed_id": "string (required)",
            "date_range": {
                "start_date": "2023-01-01",
                "end_date": "2023-12-31"
            },
            "sensors": ["sentinel2", "landsat8"],
            "spatial_extent": {
                "bbox": [minx, miny, maxx, maxy],
                "buffer_km": 5
            },
            "processing_options": {
                "cloud_threshold": 30,
                "minimum_observations": 3,
                "atmospheric_correction": true,
                "output_format": "gtiff"
            }
        }
        
        Responses:
        - 201: Created - Ingestion job created successfully
        - 400: Bad Request - Invalid request parameters
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Watershed not found
        """
        
        # Validate request data
        data = request.data
        
        required_fields = ['watershed_id', 'date_range']
        for field in required_fields:
            if not data.get(field):
                raise ValidationError({field: f"{field} is required"})
        
        # Validate watershed access
        try:
            watershed = Watershed.objects.get(id=data['watershed_id'])
            
            # Check permissions
            if not request.user.is_superuser:
                if (watershed.owner != request.user and 
                    request.user not in watershed.analysts.all()):
                    raise PermissionDenied("Access denied to this watershed")
        
        except Watershed.DoesNotExist:
            raise NotFound(f"Watershed '{data['watershed_id']}' not found")
        
        # Validate date range
        date_range = data['date_range']
        try:
            start_date = datetime.strptime(date_range['start_date'], '%Y-%m-%d').date()
            end_date = datetime.strptime(date_range['end_date'], '%Y-%m-%d').date()
            
            if end_date <= start_date:
                raise ValidationError({"date_range": "End date must be after start date"})
            
            if (end_date - start_date).days > 365 * 10:  # Max 10 years
                raise ValidationError({"date_range": "Date range cannot exceed 10 years"})
        
        except (ValueError, KeyError) as e:
            raise ValidationError({"date_range": "Invalid date format. Use YYYY-MM-DD"})
        
        # Validate sensors
        sensors = data.get('sensors', ['sentinel2'])
        for sensor in sensors:
            if sensor not in SatelliteDataEndpoints.SUPPORTED_SENSORS:
                raise ValidationError({
                    "sensors": f"Unsupported sensor: {sensor}. "
                    f"Supported: {list(SatelliteDataEndpoints.SUPPORTED_SENSORS.keys())}"
                })
        
        # Validate spatial extent
        spatial_extent = data.get('spatial_extent', {})
        bbox = spatial_extent.get('bbox')
        if bbox:
            try:
                validate_bbox(bbox)
            except ValidationError as e:
                raise ValidationError({"spatial_extent.bbox": str(e)})
        
        try:
            with transaction.atomic():
                # Create processing job
                job_data = {
                    'id': f"ingest_{uuid.uuid4().hex[:8]}",
                    'job_type': 'data_ingestion',
                    'watershed': watershed,
                    'user': request.user,
                    'status': 'pending',
                    'parameters': {
                        'watershed_id': data['watershed_id'],
                        'date_range': data['date_range'],
                        'sensors': sensors,
                        'spatial_extent': spatial_extent,
                        'processing_options': data.get('processing_options', {})
                    },
                    'created_at': timezone.now(),
                    'updated_at': timezone.now()
                }
                
                job = ProcessingJob.objects.create(**job_data)
                
                # Start async processing
                from .tasks import ingest_satellite_data_task
                ingest_satellite_data_task.delay(job.id)
                
                # Log job creation
                import logging
                logger = logging.getLogger(__name__)
                logger.info(
                    f"Satellite data ingestion job created: {job.id} "
                    f"for watershed {watershed.id} by user {request.user.id}"
                )
                
                # Return job details
                serializer = ProcessingJobSerializer(job)
                
                response_data = {
                    "data": serializer.data,
                    "message": "Satellite data ingestion job created successfully",
                    "estimated_duration_minutes": job.estimated_duration(),
                    "timestamp": timezone.now().isoformat()
                }
                
                return Response(response_data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error creating ingestion job: {str(e)}")
            raise
    
    @staticmethod
    def list_satellite_data(request) -> Response:
        """
        GET /api/v1/satellite-data/
        
        List satellite data products with filtering options.
        
        Query Parameters:
        - page (int): Page number (default: 1)
        - page_size (int): Items per page (default: 20, max: 100)
        - watershed_id (string): Filter by watershed
        - sensor (string): Filter by satellite sensor
        - acquisition_date_start (string): Start date filter (YYYY-MM-DD)
        - acquisition_date_end (string): End date filter (YYYY-MM-DD)
        - cloud_coverage_max (float): Maximum cloud coverage percentage
        - is_processed (bool): Filter by processing status
        - quality_score_min (float): Minimum quality score
        
        Responses:
        - 200: Success - Returns paginated list of satellite data
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        """
        
        # Validate pagination parameters
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 20))
        
        if page_size > 100:
            raise ValidationError("Page size cannot exceed 100 items")
        
        # Get user's accessible watersheds
        if request.user.is_superuser:
            queryset = SatelliteData.objects.select_related('watershed')
        else:
            accessible_watersheds = Watershed.objects.filter(
                models.Q(owner=request.user) | 
                models.Q(analysts=request.user) |
                models.Q(viewers=request.user)
            )
            queryset = SatelliteData.objects.filter(
                watershed__in=accessible_watersheds
            ).select_related('watershed')
        
        # Apply filters
        filters = request.GET
        
        # Watershed filter
        watershed_id = filters.get('watershed_id')
        if watershed_id:
            queryset = queryset.filter(watershed_id=watershed_id)
        
        # Sensor filter
        sensor = filters.get('sensor')
        if sensor:
            queryset = queryset.filter(sensor=sensor)
        
        # Date range filters
        date_start = filters.get('acquisition_date_start')
        date_end = filters.get('acquisition_date_end')
        if date_start:
            queryset = queryset.filter(acquisition_date__gte=date_start)
        if date_end:
            queryset = queryset.filter(acquisition_date__lte=date_end)
        
        # Cloud coverage filter
        cloud_max = filters.get('cloud_coverage_max', type=float)
        if cloud_max is not None:
            queryset = queryset.filter(cloud_coverage__lte=cloud_max)
        
        # Processing status filter
        is_processed = filters.get('is_processed')
        if is_processed is not None:
            queryset = queryset.filter(is_processed=is_processed.lower() == 'true')
        
        # Quality score filter
        quality_min = filters.get('quality_score_min', type=float)
        if quality_min is not None:
            queryset = queryset.filter(data_quality_score__gte=quality_min)
        
        # Order by acquisition date (newest first)
        queryset = queryset.order_by('-acquisition_date')
        
        # Paginate results
        total_count = queryset.count()
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        satellite_data = queryset[start_index:end_index]
        
        # Serialize data
        serializer = SatelliteDataSerializer(satellite_data, many=True)
        
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
                "sensor": sensor,
                "acquisition_date_start": date_start,
                "acquisition_date_end": date_end,
                "cloud_coverage_max": cloud_max,
                "is_processed": is_processed,
                "quality_score_min": quality_min
            },
            "supported_sensors": SatelliteDataEndpoints.SUPPORTED_SENSORS,
            "timestamp": timezone.now().isoformat()
        }
        
        return Response(response_data)
    
    @staticmethod
    def get_satellite_data(request, data_id: str) -> Response:
        """
        GET /api/v1/satellite-data/{id}/
        
        Retrieve detailed information about a specific satellite data product.
        
        Path Parameters:
        - id (string): Satellite data identifier
        
        Responses:
        - 200: Success - Returns satellite data details
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Satellite data not found
        """
        
        try:
            # Get satellite data
            satellite_data = SatelliteData.objects.select_related('watershed').get(id=data_id)
            
            # Check access permissions
            if not request.user.is_superuser:
                if (satellite_data.watershed.owner != request.user and 
                    request.user not in satellite_data.watershed.analysts.all() and
                    request.user not in satellite_data.watershed.viewers.all()):
                    raise PermissionDenied("Access denied to this satellite data")
            
            # Get additional metadata
            quality_metrics = satellite_data.quality_metrics or {}
            
            # Get processing history
            processing_jobs = ProcessingJob.objects.filter(
                parameters__contains={"satellite_data_ids": [data_id]}
            ).order_by('-created_at')[:5]
            
            processing_history = [
                {
                    'job_id': job.id,
                    'job_type': job.job_type,
                    'status': job.status,
                    'created_at': job.created_at.isoformat()
                }
                for job in processing_jobs
            ]
            
            # Serialize data
            serializer = SatelliteDataSerializer(satellite_data)
            
            response_data = {
                "data": serializer.data,
                "quality_metrics": quality_metrics,
                "processing_history": processing_history,
                "download_urls": satellite_data.get_download_urls(),
                "timestamp": timezone.now().isoformat()
            }
            
            return Response(response_data)
        
        except SatelliteData.DoesNotExist:
            raise NotFound(f"Satellite data with ID '{data_id}' not found")
    
    @staticmethod
    def perform_quality_check(request, data_id: str) -> Response:
        """
        POST /api/v1/satellite-data/{id}/quality-check/
        
        Perform comprehensive quality assessment on satellite data.
        
        Path Parameters:
        - id (string): Satellite data identifier
        
        Request Body:
        {
            "check_types": ["cloud_coverage", "data_completeness", "spectral_quality"],
            "quality_thresholds": {
                "cloud_coverage_max": 30,
                "data_completeness_min": 95,
                "spectral_quality_min": 0.8
            }
        }
        
        Responses:
        - 200: Success - Quality assessment completed
        - 400: Bad Request - Invalid request parameters
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Satellite data not found
        """
        
        try:
            # Get satellite data
            satellite_data = SatelliteData.objects.select_related('watershed').get(id=data_id)
            
            # Check permissions
            if not request.user.is_superuser:
                if (satellite_data.watershed.owner != request.user and 
                    request.user not in satellite_data.watershed.analysts.all()):
                    raise PermissionDenied("Access denied to this satellite data")
            
            # Validate request data
            data = request.data
            check_types = data.get('check_types', ['cloud_coverage', 'data_completeness'])
            quality_thresholds = data.get('quality_thresholds', {})
            
            # Create quality assessment job
            job_data = {
                'id': f"quality_{uuid.uuid4().hex[:8]}",
                'job_type': 'quality_assessment',
                'watershed': satellite_data.watershed,
                'user': request.user,
                'status': 'pending',
                'parameters': {
                    'satellite_data_id': data_id,
                    'check_types': check_types,
                    'quality_thresholds': quality_thresholds
                },
                'created_at': timezone.now(),
                'updated_at': timezone.now()
            }
            
            job = ProcessingJob.objects.create(**job_data)
            
            # Start async quality assessment
            from .tasks import perform_quality_assessment_task
            perform_quality_assessment_task.delay(job.id, data_id, check_types, quality_thresholds)
            
            # Return job details
            serializer = ProcessingJobSerializer(job)
            
            response_data = {
                "data": serializer.data,
                "message": "Quality assessment job created successfully",
                "estimated_duration_minutes": job.estimated_duration(),
                "timestamp": timezone.now().isoformat()
            }
            
            return Response(response_data, status=status.HTTP_201_CREATED)
        
        except SatelliteData.DoesNotExist:
            raise NotFound(f"Satellite data with ID '{data_id}' not found")
    
    @staticmethod
    def get_spectral_indices(request, data_id: str) -> Response:
        """
        GET /api/v1/satellite-data/{id}/indices/
        
        Retrieve spectral indices calculated from satellite data.
        
        Path Parameters:
        - id (string): Satellite data identifier
        
        Query Parameters:
        - indices (string): Comma-separated list of indices to retrieve
        - output_format (string): json or geojson
        
        Responses:
        - 200: Success - Returns spectral indices
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Satellite data not found
        """
        
        try:
            # Get satellite data
            satellite_data = SatelliteData.objects.select_related('watershed').get(id=data_id)
            
            # Check access permissions
            if not request.user.is_superuser:
                if (satellite_data.watershed.owner != request.user and 
                    request.user not in satellite_data.watershed.analysts.all() and
                    request.user not in satellite_data.watershed.viewers.all()):
                    raise PermissionDenied("Access denied to this satellite data")
            
            # Get query parameters
            requested_indices = request.GET.get('indices', '').split(',')
            output_format = request.GET.get('output_format', 'json')
            
            # Default to common indices if none specified
            if not requested_indices or requested_indices == ['']:
                requested_indices = ['NDVI', 'NBR', 'TCG', 'NDWI']
            
            # Get spectral indices data
            indices_data = {}
            available_indices = SpectralIndex.objects.filter(
                satellite_data=satellite_data,
                index_name__in=requested_indices
            )
            
            for index in available_indices:
                if index.index_name not in indices_data:
                    indices_data[index.index_name] = {}
                
                indices_data[index.index_name][index.pixel_location] = {
                    'value': index.index_value,
                    'quality_flag': index.quality_flag,
                    'calculated_at': index.calculated_at.isoformat()
                }
            
            # Calculate summary statistics if geojson format requested
            if output_format == 'geojson':
                geojson_data = {
                    "type": "FeatureCollection",
                    "features": []
                }
                
                # Create features for each index
                for index_name, pixel_data in indices_data.items():
                    for location, data in pixel_data.items():
                        try:
                            point = Point(location['lng'], location['lat'])
                            feature = {
                                "type": "Feature",
                                "geometry": {
                                    "type": "Point",
                                    "coordinates": [point.x, point.y]
                                },
                                "properties": {
                                    "index_name": index_name,
                                    "value": data['value'],
                                    "quality_flag": data['quality_flag'],
                                    "calculated_at": data['calculated_at'],
                                    "satellite_data_id": data_id
                                }
                            }
                            geojson_data["features"].append(feature)
                        except (ValueError, TypeError):
                            continue
                
                response_data = {
                    "satellite_data_id": data_id,
                    "indices_data": geojson_data,
                    "indices_requested": requested_indices,
                    "output_format": output_format,
                    "timestamp": timezone.now().isoformat()
                }
            else:
                response_data = {
                    "satellite_data_id": data_id,
                    "indices_data": indices_data,
                    "indices_requested": requested_indices,
                    "output_format": output_format,
                    "summary_statistics": satellite_data.get_indices_summary(requested_indices),
                    "timestamp": timezone.now().isoformat()
                }
            
            return Response(response_data)
        
        except SatelliteData.DoesNotExist:
            raise NotFound(f"Satellite data with ID '{data_id}' not found")
    
    @staticmethod
    def bulk_process(request) -> Response:
        """
        POST /api/v1/satellite-data/bulk-process/
        
        Perform bulk processing operations on multiple satellite data products.
        
        Request Body:
        {
            "operation": "spectral_indices" | "quality_check" | "reprocess",
            "satellite_data_ids": ["id1", "id2", "id3"],
            "parameters": {
                "indices": ["NDVI", "NBR"],
                "quality_thresholds": {...}
            }
        }
        
        Responses:
        - 201: Created - Bulk processing job created successfully
        - 400: Bad Request - Invalid request parameters
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        """
        
        # Validate request data
        data = request.data
        
        required_fields = ['operation', 'satellite_data_ids']
        for field in required_fields:
            if not data.get(field):
                raise ValidationError({field: f"{field} is required"})
        
        operation = data['operation']
        satellite_data_ids = data['satellite_data_ids']
        parameters = data.get('parameters', {})
        
        # Validate operation type
        valid_operations = ['spectral_indices', 'quality_check', 'reprocess']
        if operation not in valid_operations:
            raise ValidationError({
                "operation": f"Invalid operation. Supported: {valid_operations}"
            })
        
        # Validate satellite data IDs
        if not isinstance(satellite_data_ids, list) or len(satellite_data_ids) == 0:
            raise ValidationError({
                "satellite_data_ids": "Must be a non-empty list"
            })
        
        if len(satellite_data_ids) > 50:
            raise ValidationError({
                "satellite_data_ids": "Cannot process more than 50 items at once"
            })
        
        # Check satellite data access
        accessible_watersheds = Watershed.objects.filter(
            models.Q(owner=request.user) | models.Q(analysts=request.user)
        )
        
        satellite_data = SatelliteData.objects.filter(
            id__in=satellite_data_ids,
            watershed__in=accessible_watersheds
        )
        
        if satellite_data.count() != len(satellite_data_ids):
            missing_ids = set(satellite_data_ids) - set(satellite_data.values_list('id', flat=True))
            raise ValidationError({
                "satellite_data_ids": f"Access denied or data not found: {list(missing_ids)}"
            })
        
        try:
            # Create bulk processing job
            job_data = {
                'id': f"bulk_{uuid.uuid4().hex[:8]}",
                'job_type': 'bulk_processing',
                'watershed': satellite_data.first().watershed,
                'user': request.user,
                'status': 'pending',
                'parameters': {
                    'operation': operation,
                    'satellite_data_ids': satellite_data_ids,
                    'processing_parameters': parameters
                },
                'created_at': timezone.now(),
                'updated_at': timezone.now()
            }
            
            job = ProcessingJob.objects.create(**job_data)
            
            # Start async bulk processing
            from .tasks import bulk_process_satellite_data_task
            bulk_process_satellite_data_task.delay(
                job.id, operation, satellite_data_ids, parameters
            )
            
            # Log job creation
            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                f"Bulk processing job created: {job.id} "
                f"({operation}) for {len(satellite_data_ids)} items "
                f"by user {request.user.id}"
            )
            
            # Return job details
            serializer = ProcessingJobSerializer(job)
            
            response_data = {
                "data": serializer.data,
                "message": "Bulk processing job created successfully",
                "estimated_duration_minutes": job.estimated_duration() * len(satellite_data_ids),
                "items_count": len(satellite_data_ids),
                "timestamp": timezone.now().isoformat()
            }
            
            return Response(response_data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error creating bulk processing job: {str(e)}")
            raise


# API endpoint registry
SATELLITE_DATA_ENDPOINT_PATHS = {
    'ingest': '/api/v1/satellite-data/ingest/',
    'list': '/api/v1/satellite-data/',
    'detail': '/api/v1/satellite-data/{id}/',
    'quality_check': '/api/v1/satellite-data/{id}/quality-check/',
    'spectral_indices': '/api/v1/satellite-data/{id}/indices/',
    'bulk_process': '/api/v1/satellite-data/bulk-process/'
}


class SatelliteDataAPIViewSet(ModelViewSet):
    """Django REST Framework ViewSet for Satellite Data endpoints"""
    
    serializer_class = SatelliteDataSerializer
    permission_classes = [IsWatershedOwnerOrAnalyst]
    
    def get_queryset(self):
        """Get satellite data based on user permissions"""
        if self.request.user.is_superuser:
            return SatelliteData.objects.select_related('watershed').all()
        else:
            accessible_watersheds = Watershed.objects.filter(
                models.Q(owner=self.request.user) | 
                models.Q(analysts=self.request.user) |
                models.Q(viewers=self.request.user)
            )
            return SatelliteData.objects.filter(
                watershed__in=accessible_watersheds
            ).select_related('watershed')
    
    @action(detail=False, methods=['post'])
    def ingest(self, request):
        """Handle satellite data ingestion"""
        return SatelliteDataEndpoints.ingest_satellite_data(request)
    
    @action(detail=True, methods=['post'])
    def quality_check(self, request, pk=None):
        """Handle quality assessment"""
        return SatelliteDataEndpoints.perform_quality_check(request, pk)
    
    @action(detail=True, methods=['get'])
    def indices(self, request, pk=None):
        """Handle spectral indices retrieval"""
        return SatelliteDataEndpoints.get_spectral_indices(request, pk)
    
    @action(detail=False, methods=['post'])
    def bulk_process(self, request):
        """Handle bulk processing operations"""
        return SatelliteDataEndpoints.bulk_process(request)