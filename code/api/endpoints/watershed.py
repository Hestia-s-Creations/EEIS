"""
Watershed Management API Endpoints

This module defines the REST API endpoints for managing watersheds in the 
Watershed Disturbance Mapping System.

Endpoints:
- GET /api/v1/watersheds/ - List all watersheds
- POST /api/v1/watersheds/ - Create a new watershed
- GET /api/v1/watersheds/{id}/ - Get watershed details
- PUT /api/v1/watersheds/{id}/ - Update watershed details
- DELETE /api/v1/watersheds/{id}/ - Delete watershed
- GET /api/v1/watersheds/{id}/detections/ - Get detections for watershed
- POST /api/v1/watersheds/{id}/monitoring/ - Configure monitoring parameters

Author: Watershed Disturbance Mapping System
Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
import uuid

from django.db import transaction
from django.contrib.gis.geos import Polygon, Point
from django.contrib.gis.db.models import Extent
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, action
from rest_framework.exceptions import ValidationError, NotFound
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import Watershed, User, DetectionResult
from .serializers import WatershedSerializer, WatershedCreateSerializer
from .permissions import IsWatershedOwnerOrAnalyst, IsWatershedViewerOrAbove
from .utils.geo_utils import (
    validate_geometry, calculate_area, get_centroid, 
    calculate_bbox, reproject_geometry
)


class WatershedEndpoints:
    """Endpoint definitions for watershed management"""
    
    # Base path for watershed endpoints
    base_path = "/api/v1/watersheds"
    
    # Supported formats
    supported_formats = ["json", "geojson"]
    
    # Rate limiting per user tier
    rate_limits = {
        "free": "50/hour",
        "analyst": "200/hour",
        "admin": "1000/hour"
    }
    
    @staticmethod
    def list_watersheds(request) -> Response:
        """
        GET /api/v1/watersheds/
        
        List all watersheds accessible to the authenticated user.
        
        Query Parameters:
        - page (int): Page number (default: 1)
        - page_size (int): Items per page (default: 20, max: 100)
        - search (string): Search term for watershed name
        - status (string): Filter by status (active, inactive, deleted)
        - area_min (float): Minimum area in square kilometers
        - area_max (float): Maximum area in square kilometers
        
        Responses:
        - 200: Success - Returns paginated list of watersheds
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
            queryset = Watershed.objects.all()
        else:
            queryset = Watershed.objects.filter(
                models.Q(owner=request.user) | 
                models.Q(analysts=request.user) |
                models.Q(viewers=request.user)
            )
        
        # Apply filters
        search_term = request.GET.get('search', '').strip()
        if search_term:
            queryset = queryset.filter(
                models.Q(name__icontains=search_term) |
                models.Q(description__icontains=search_term)
            )
        
        status_filter = request.GET.get('status', 'active')
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        area_min = request.GET.get('area_min', type=float)
        area_max = request.GET.get('area_max', type=float)
        
        if area_min is not None:
            queryset = queryset.filter(area_km2__gte=area_min)
        if area_max is not None:
            queryset = queryset.filter(area_km2__lte=area_max)
        
        # Order results
        queryset = queryset.order_by('-created_at')
        
        # Paginate results
        total_count = queryset.count()
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        watersheds = queryset[start_index:end_index]
        
        # Serialize data
        serializer = WatershedSerializer(watersheds, many=True)
        
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
                "search": search_term,
                "status": status_filter,
                "area_min": area_min,
                "area_max": area_max
            },
            "timestamp": timezone.now().isoformat()
        }
        
        return Response(response_data)
    
    @staticmethod
    def create_watershed(request) -> Response:
        """
        POST /api/v1/watersheds/
        
        Create a new watershed with boundary geometry and metadata.
        
        Request Body:
        {
            "name": "string (required)",
            "description": "string (optional)",
            "boundary": {
                "type": "Polygon",
                "coordinates": [[[lon, lat], ...]]
            },
            "area_km2": "float (optional, calculated if not provided)",
            "metadata": {
                "region": "string",
                "primary_river": "string",
                "climate_zone": "string",
                "ecosystem_type": "string"
            },
            "settings": {
                "monitoring_enabled": true,
                "alert_preferences": {},
                "export_settings": {}
            }
        }
        
        Responses:
        - 201: Created - Watershed created successfully
        - 400: Bad Request - Invalid input data
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 409: Conflict - Watershed name already exists
        """
        
        # Validate request data
        data = request.data
        
        # Required fields
        if not data.get('name'):
            raise ValidationError({"name": "Watershed name is required"})
        
        if not data.get('boundary'):
            raise ValidationError({"boundary": "Watershed boundary is required"})
        
        try:
            with transaction.atomic():
                # Validate geometry
                boundary_geom = validate_geometry(data['boundary'])
                
                # Calculate area if not provided
                area_km2 = data.get('area_km2')
                if not area_km2:
                    area_km2 = calculate_area(boundary_geom)
                
                # Calculate centroid and bounding box
                centroid = get_centroid(boundary_geom)
                bbox = calculate_bbox(boundary_geom)
                
                # Create watershed data
                watershed_data = {
                    'name': data['name'],
                    'description': data.get('description', ''),
                    'boundary': boundary_geom,
                    'area_km2': area_km2,
                    'centroid': centroid,
                    'bbox': bbox,
                    'owner': request.user,
                    'status': 'active'
                }
                
                # Add optional metadata
                if 'metadata' in data:
                    watershed_data['metadata'] = data['metadata']
                
                if 'settings' in data:
                    watershed_data['settings'] = data['settings']
                
                # Create watershed
                watershed = Watershed.objects.create(**watershed_data)
                
                # Log creation
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"Watershed created: {watershed.id} by user {request.user.id}")
                
                # Return created watershed
                serializer = WatershedSerializer(watershed)
                
                response_data = {
                    "data": serializer.data,
                    "message": "Watershed created successfully",
                    "timestamp": timezone.now().isoformat()
                }
                
                return Response(response_data, status=status.HTTP_201_CREATED)
        
        except DjangoValidationError as e:
            raise ValidationError(str(e))
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error creating watershed: {str(e)}")
            raise
    
    @staticmethod
    def get_watershed(request, watershed_id: str) -> Response:
        """
        GET /api/v1/watersheds/{id}/
        
        Retrieve detailed information about a specific watershed.
        
        Path Parameters:
        - id (string): Watershed identifier
        
        Responses:
        - 200: Success - Returns watershed details
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Watershed does not exist
        """
        
        try:
            # Get watershed
            watershed = Watershed.objects.get(id=watershed_id)
            
            # Check access permissions
            if not request.user.is_superuser:
                if (watershed.owner != request.user and 
                    request.user not in watershed.analysts.all() and
                    request.user not in watershed.viewers.all()):
                    raise PermissionDenied("Access denied to this watershed")
            
            # Get additional statistics
            stats = watershed.get_statistics()
            
            # Serialize data
            serializer = WatershedSerializer(watershed)
            
            response_data = {
                "data": serializer.data,
                "statistics": stats,
                "timestamp": timezone.now().isoformat()
            }
            
            return Response(response_data)
        
        except Watershed.DoesNotExist:
            raise NotFound(f"Watershed with ID '{watershed_id}' not found")
    
    @staticmethod
    def update_watershed(request, watershed_id: str) -> Response:
        """
        PUT /api/v1/watersheds/{id}/
        
        Update watershed information including boundary and metadata.
        
        Path Parameters:
        - id (string): Watershed identifier
        
        Request Body:
        {
            "name": "string (optional)",
            "description": "string (optional)",
            "boundary": {
                "type": "Polygon",
                "coordinates": [[[lon, lat], ...]]
            },
            "area_km2": "float (optional)",
            "metadata": {
                "region": "string",
                "primary_river": "string"
            },
            "settings": {
                "monitoring_enabled": true
            }
        }
        
        Responses:
        - 200: Success - Watershed updated successfully
        - 400: Bad Request - Invalid input data
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Watershed does not exist
        """
        
        try:
            # Get watershed
            watershed = Watershed.objects.get(id=watershed_id)
            
            # Check permissions (only owner or admin can update)
            if not request.user.is_superuser and watershed.owner != request.user:
                raise PermissionDenied("Only watershed owner can update")
            
            # Validate request data
            data = request.data
            
            with transaction.atomic():
                # Update fields
                if 'name' in data and data['name'] != watershed.name:
                    watershed.name = data['name']
                
                if 'description' in data:
                    watershed.description = data['description']
                
                # Handle boundary update
                if 'boundary' in data:
                    new_boundary = validate_geometry(data['boundary'])
                    
                    # Recalculate area, centroid, and bbox
                    watershed.boundary = new_boundary
                    watershed.area_km2 = calculate_area(new_boundary)
                    watershed.centroid = get_centroid(new_boundary)
                    watershed.bbox = calculate_bbox(new_boundary)
                
                # Update metadata
                if 'metadata' in data:
                    watershed.metadata.update(data['metadata'])
                
                # Update settings
                if 'settings' in data:
                    watershed.settings.update(data['settings'])
                
                watershed.updated_at = timezone.now()
                watershed.save()
                
                # Log update
                import logging
                logger = logging.getLogger(__name__)
                logger.info(f"Watershed updated: {watershed.id} by user {request.user.id}")
                
                # Return updated watershed
                serializer = WatershedSerializer(watershed)
                
                response_data = {
                    "data": serializer.data,
                    "message": "Watershed updated successfully",
                    "timestamp": timezone.now().isoformat()
                }
                
                return Response(response_data)
        
        except Watershed.DoesNotExist:
            raise NotFound(f"Watershed with ID '{watershed_id}' not found")
    
    @staticmethod
    def delete_watershed(request, watershed_id: str) -> Response:
        """
        DELETE /api/v1/watersheds/{id}/
        
        Delete a watershed (logical deletion with timestamp).
        
        Path Parameters:
        - id (string): Watershed identifier
        
        Responses:
        - 200: Success - Watershed deleted successfully
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Watershed does not exist
        - 409: Conflict - Cannot delete watershed with active detections
        """
        
        try:
            # Get watershed
            watershed = Watershed.objects.get(id=watershed_id)
            
            # Check permissions (only owner or admin can delete)
            if not request.user.is_superuser and watershed.owner != request.user:
                raise PermissionDenied("Only watershed owner can delete")
            
            # Check for active dependencies
            active_detections = DetectionResult.objects.filter(
                watershed=watershed, 
                status__in=['new', 'confirmed']
            ).count()
            
            if active_detections > 0:
                raise ValidationError(
                    f"Cannot delete watershed with {active_detections} active detections. "
                    "Please resolve all detections first."
                )
            
            # Perform logical deletion
            watershed.deleted_at = timezone.now()
            watershed.status = 'deleted'
            watershed.save()
            
            # Log deletion
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"Watershed deleted: {watershed.id} by user {request.user.id}")
            
            return Response({
                "message": "Watershed deleted successfully",
                "deleted_at": watershed.deleted_at.isoformat(),
                "timestamp": timezone.now().isoformat()
            })
        
        except Watershed.DoesNotExist:
            raise NotFound(f"Watershed with ID '{watershed_id}' not found")
    
    @staticmethod
    def get_watershed_detections(request, watershed_id: str) -> Response:
        """
        GET /api/v1/watersheds/{id}/detections/
        
        Retrieve change detection results for a specific watershed.
        
        Path Parameters:
        - id (string): Watershed identifier
        
        Query Parameters:
        - page (int): Page number (default: 1)
        - page_size (int): Items per page (default: 20, max: 100)
        - start_date (string): Start date filter (YYYY-MM-DD)
        - end_date (string): End date filter (YYYY-MM-DD)
        - min_confidence (float): Minimum confidence score
        - disturbance_type (string): Filter by disturbance type
        - status (string): Filter by detection status
        
        Responses:
        - 200: Success - Returns paginated list of detections
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Watershed does not exist
        """
        
        try:
            # Get watershed and verify access
            watershed = Watershed.objects.get(id=watershed_id)
            
            if not request.user.is_superuser:
                if (watershed.owner != request.user and 
                    request.user not in watershed.analysts.all() and
                    request.user not in watershed.viewers.all()):
                    raise PermissionDenied("Access denied to this watershed")
            
            # Get detections for watershed
            detections = DetectionResult.objects.filter(watershed=watershed)
            
            # Apply filters
            filters = request.GET
            
            # Date range filter
            start_date = filters.get('start_date')
            end_date = filters.get('end_date')
            if start_date:
                detections = detections.filter(detection_date__gte=start_date)
            if end_date:
                detections = detections.filter(detection_date__lte=end_date)
            
            # Confidence filter
            min_confidence = filters.get('min_confidence', type=float)
            if min_confidence:
                detections = detections.filter(confidence_score__gte=min_confidence)
            
            # Disturbance type filter
            disturbance_type = filters.get('disturbance_type')
            if disturbance_type:
                detections = detections.filter(disturbance_type=disturbance_type)
            
            # Status filter
            status_filter = filters.get('status')
            if status_filter:
                detections = detections.filter(status=status_filter)
            
            # Order by detection date
            detections = detections.order_by('-detection_date')
            
            # Pagination
            page = int(filters.get('page', 1))
            page_size = int(filters.get('page_size', 20))
            start_index = (page - 1) * page_size
            end_index = start_index + page_size
            
            total_count = detections.count()
            detections_page = detections[start_index:end_index]
            
            # Serialize detections
            from .serializers import DetectionResultSerializer
            serializer = DetectionResultSerializer(detections_page, many=True)
            
            # Calculate pagination metadata
            total_pages = (total_count + page_size - 1) // page_size
            
            response_data = {
                "watershed_id": watershed_id,
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
                    "start_date": start_date,
                    "end_date": end_date,
                    "min_confidence": min_confidence,
                    "disturbance_type": disturbance_type,
                    "status": status_filter
                },
                "timestamp": timezone.now().isoformat()
            }
            
            return Response(response_data)
        
        except Watershed.DoesNotExist:
            raise NotFound(f"Watershed with ID '{watershed_id}' not found")
    
    @staticmethod
    def configure_monitoring(request, watershed_id: str) -> Response:
        """
        POST /api/v1/watersheds/{id}/monitoring/
        
        Configure monitoring parameters and algorithms for a watershed.
        
        Path Parameters:
        - id (string): Watershed identifier
        
        Request Body:
        {
            "algorithms": {
                "landtrendr": {
                    "enabled": true,
                    "parameters": {
                        "max_segments": 5,
                        "spike_threshold": 0.9,
                        "recovery_threshold": 0.5
                    }
                },
                "fnrt": {
                    "enabled": true,
                    "parameters": {
                        "z_score_threshold": 2.5,
                        "min_observations": 3
                    }
                }
            },
            "monitoring_schedule": {
                "frequency": "monthly",
                "preferred_sensors": ["sentinel2", "landsat8"],
                "cloud_threshold": 30
            },
            "alert_thresholds": {
                "min_confidence": 0.8,
                "min_area_hectares": 0.1,
                "disturbance_types": ["fire", "harvest", "clearing"]
            }
        }
        
        Responses:
        - 200: Success - Monitoring configuration updated
        - 400: Bad Request - Invalid configuration
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Watershed does not exist
        """
        
        try:
            # Get watershed and verify access
            watershed = Watershed.objects.get(id=watershed_id)
            
            if not request.user.is_superuser:
                if (watershed.owner != request.user and 
                    request.user not in watershed.analysts.all()):
                    raise PermissionDenied("Access denied to this watershed")
            
            # Validate configuration
            config = request.data
            
            # Validate algorithms configuration
            algorithms = config.get('algorithms', {})
            for alg_name, alg_config in algorithms.items():
                if alg_config.get('enabled', False):
                    # Validate required parameters for each algorithm
                    if alg_name == 'landtrendr':
                        params = alg_config.get('parameters', {})
                        if 'max_segments' not in params:
                            raise ValidationError({
                                "algorithms.landtrendr.parameters.max_segments": 
                                "Required parameter for LandTrendr"
                            })
                    elif alg_name == 'fnrt':
                        params = alg_config.get('parameters', {})
                        if 'z_score_threshold' not in params:
                            raise ValidationError({
                                "algorithms.fnrt.parameters.z_score_threshold":
                                "Required parameter for FNRT"
                            })
            
            # Update monitoring configuration
            if 'algorithms' in config:
                if watershed.algorithms_config is None:
                    watershed.algorithms_config = {}
                watershed.algorithms_config.update(config['algorithms'])
            
            if 'monitoring_schedule' in config:
                if watershed.monitoring_config is None:
                    watershed.monitoring_config = {}
                watershed.monitoring_config.update(config['monitoring_schedule'])
            
            if 'alert_thresholds' in config:
                if watershed.alert_config is None:
                    watershed.alert_config = {}
                watershed.alert_config.update(config['alert_thresholds'])
            
            watershed.updated_at = timezone.now()
            watershed.save()
            
            # Log configuration update
            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                f"Monitoring configuration updated for watershed {watershed.id} "
                f"by user {request.user.id}"
            )
            
            response_data = {
                "watershed_id": watershed_id,
                "configuration": {
                    "algorithms": watershed.algorithms_config,
                    "monitoring_schedule": watershed.monitoring_config,
                    "alert_thresholds": watershed.alert_config
                },
                "message": "Monitoring configuration updated successfully",
                "timestamp": timezone.now().isoformat()
            }
            
            return Response(response_data)
        
        except Watershed.DoesNotExist:
            raise NotFound(f"Watershed with ID '{watershed_id}' not found")


# API endpoint registry
WATERSHED_ENDPOINT_PATHS = {
    'list': '/api/v1/watersheds/',
    'create': '/api/v1/watersheds/',
    'detail': '/api/v1/watersheds/{id}/',
    'update': '/api/v1/watersheds/{id}/',
    'delete': '/api/v1/watersheds/{id}/',
    'detections': '/api/v1/watersheds/{id}/detections/',
    'monitoring': '/api/v1/watersheds/{id}/monitoring/'
}


class WatershedAPIViewSet(ModelViewSet):
    """Django REST Framework ViewSet for Watershed endpoints"""
    
    serializer_class = WatershedSerializer
    permission_classes = [IsWatershedViewerOrAbove]
    
    def get_queryset(self):
        """Get watersheds based on user permissions"""
        if self.request.user.is_superuser:
            return Watershed.objects.all()
        else:
            return Watershed.objects.filter(
                models.Q(owner=self.request.user) | 
                models.Q(analysts=self.request.user) |
                models.Q(viewers=self.request.user)
            )
    
    def create(self, request, *args, **kwargs):
        """Handle watershed creation"""
        return WatershedEndpoints.create_watershed(request)
    
    def retrieve(self, request, *args, **kwargs):
        """Handle watershed detail retrieval"""
        watershed_id = kwargs.get('pk')
        return WatershedEndpoints.get_watershed(request, watershed_id)
    
    def update(self, request, *args, **kwargs):
        """Handle watershed update"""
        watershed_id = kwargs.get('pk')
        return WatershedEndpoints.update_watershed(request, watershed_id)
    
    def destroy(self, request, *args, **kwargs):
        """Handle watershed deletion"""
        watershed_id = kwargs.get('pk')
        return WatershedEndpoints.delete_watershed(request, watershed_id)
    
    @action(detail=True, methods=['get', 'post'])
    def detections(self, request, pk=None):
        """Handle watershed detections"""
        if request.method == 'GET':
            return WatershedEndpoints.get_watershed_detections(request, pk)
    
    @action(detail=True, methods=['post'])
    def monitoring(self, request, pk=None):
        """Handle monitoring configuration"""
        return WatershedEndpoints.configure_monitoring(request, pk)