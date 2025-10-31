"""
Core API Implementation for Watershed Disturbance Mapping System

This module provides the main API structure using Django REST Framework.
Implements OAuth2 authentication, JWT tokens, rate limiting, and core API patterns.

Dependencies:
    - Django REST Framework
    - JWT token handling
    - Rate limiting middleware
    - Error handling utilities

Author: Watershed Disturbance Mapping System
Version: 1.0.0
"""

import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
import json

from django.conf import settings
from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework import (
    status, viewsets, permissions, authentication, 
    parsers, renderers, throttling
)
from rest_framework.decorators import (
    api_view, authentication_classes, permission_classes,
    action, throttle_classes
)
from rest_framework.exceptions import (
    ValidationError, PermissionDenied, NotFound, 
    AuthenticationFailed, Throttled
)
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle, AnonRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

# Local imports
from .models import (
    User, Watershed, SatelliteData, DetectionResult, 
    Alert, NotificationSetting, JobStatus, ExportRequest
)
from .serializers import (
    UserSerializer, WatershedSerializer, SatelliteDataSerializer,
    DetectionResultSerializer, AlertSerializer, JobStatusSerializer
)
from .permissions import IsOwnerOrReadOnly, IsWatershedOwnerOrAnalyst
from .utils.rate_limit import RateLimitMixin
from .utils.geo_utils import validate_geometry
from .utils.export_utils import create_export_job
from .utils.job_utils import create_processing_job


logger = logging.getLogger(__name__)


class RateLimitConfig:
    """Rate limiting configuration based on user roles"""
    
    FREE_TIER_LIMITS = {
        'requests': 100,
        'period': 'hour'
    }
    
    ANALYST_TIER_LIMITS = {
        'requests': 1000,
        'period': 'hour'
    }
    
    ADMIN_TIER_LIMITS = {
        'requests': 10000,
        'period': 'hour'
    }
    
    @staticmethod
    def get_user_limits(user: User) -> Dict[str, int]:
        """Get rate limits for user based on role"""
        if user.is_superuser:
            return RateLimitConfig.ADMIN_TIER_LIMITS
        
        # Check for custom limits
        if hasattr(user, 'custom_rate_limits'):
            return user.custom_rate_limits
        
        # Default to tier-based limits
        if hasattr(user, 'subscription_tier'):
            if user.subscription_tier == 'admin':
                return RateLimitConfig.ADMIN_TIER_LIMITS
            elif user.subscription_tier == 'analyst':
                return RateLimitConfig.ANALYST_TIER_LIMITS
        
        return RateLimitConfig.FREE_TIER_LIMITS


class WatershedsAPIViewSet(viewsets.ModelViewSet, RateLimitMixin):
    """
    Watershed Management API Endpoints
    
    Provides CRUD operations for watershed management including:
    - Create and manage watersheds
    - Add watershed metadata
    - Set up monitoring parameters
    - Query watershed boundaries and properties
    """
    
    serializer_class = WatershedSerializer
    permission_classes = [IsAuthenticated, IsWatershedOwnerOrAnalyst]
    parser_classes = [parsers.JSONParser, parsers.FormParser]
    renderer_classes = [renderers.JSONRenderer]
    
    def get_queryset(self):
        """Get watersheds user has access to"""
        user = self.request.user
        
        if user.is_superuser:
            return Watershed.objects.all()
        
        # User can see watersheds they own or are analysts for
        return Watershed.objects.filter(
            Q(owner=user) | Q(analysts=user) | Q(viewers=user)
        ).distinct()
    
    def create(self, request, *args, **kwargs):
        """Create a new watershed"""
        try:
            with transaction.atomic():
                # Validate request data
                serializer = self.get_serializer(data=request.data)
                serializer.is_valid(raise_exception=True)
                
                # Validate geometry
                geometry = request.data.get('boundary')
                if geometry:
                    validate_geometry(geometry)
                
                # Create watershed
                watershed = serializer.save(owner=request.user)
                
                # Log watershed creation
                logger.info(
                    f"Watershed created: {watershed.id} by user {request.user.id}"
                )
                
                # Return created watershed
                response_serializer = self.get_serializer(watershed)
                return Response(
                    {
                        'data': response_serializer.data,
                        'message': 'Watershed created successfully',
                        'timestamp': timezone.now().isoformat()
                    },
                    status=status.HTTP_201_CREATED
                )
                
        except ValidationError as e:
            logger.warning(f"Validation error creating watershed: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Error creating watershed: {str(e)}")
            raise
    
    def perform_update(self, serializer):
        """Update watershed with logging"""
        instance = serializer.save()
        logger.info(
            f"Watershed updated: {instance.id} by user {self.request.user.id}"
        )
    
    def perform_destroy(self, instance):
        """Logical deletion with logging"""
        instance.deleted_at = timezone.now()
        instance.save()
        logger.info(
            f"Watershed deleted: {instance.id} by user {self.request.user.id}"
        )
    
    @action(detail=True, methods=['get', 'post'])
    def monitoring_config(self, request, pk=None):
        """Configure monitoring parameters for watershed"""
        watershed = self.get_object()
        
        if request.method == 'GET':
            config = watershed.monitoring_config or {}
            return Response({
                'watershed_id': watershed.id,
                'monitoring_config': config,
                'timestamp': timezone.now().isoformat()
            })
        
        elif request.method == 'POST':
            # Update monitoring configuration
            config = request.data
            watershed.monitoring_config = config
            watershed.save()
            
            logger.info(
                f"Monitoring config updated for watershed {watershed.id} "
                f"by user {request.user.id}"
            )
            
            return Response({
                'data': {'monitoring_config': config},
                'message': 'Monitoring configuration updated successfully',
                'timestamp': timezone.now().isoformat()
            })
    
    @action(detail=True, methods=['get'])
    def bounds(self, request, pk=None):
        """Get watershed boundary information"""
        watershed = self.get_object()
        
        return Response({
            'watershed_id': watershed.id,
            'name': watershed.name,
            'boundary': watershed.boundary,
            'area_km2': watershed.area_km2,
            'centroid': watershed.centroid,
            'bbox': watershed.bbox,
            'crs': watershed.crs,
            'last_updated': watershed.updated_at.isoformat()
        })


class SatelliteDataAPIViewSet(viewsets.ModelViewSet, RateLimitMixin):
    """
    Satellite Data Processing API Endpoints
    
    Handles satellite data management including:
    - Data ingestion and processing
    - Quality assessment and filtering
    - Spectral index calculations
    - Historical data access
    """
    
    serializer_class = SatelliteDataSerializer
    permission_classes = [IsAuthenticated, IsWatershedOwnerOrAnalyst]
    
    def get_queryset(self):
        """Get satellite data for user's watersheds"""
        user = self.request.user
        watershed_id = self.request.query_params.get('watershed_id')
        
        queryset = SatelliteData.objects.filter(
            watershed__in=Watershed.objects.filter(
                Q(owner=user) | Q(analysts=user)
            )
        )
        
        if watershed_id:
            queryset = queryset.filter(watershed_id=watershed_id)
        
        return queryset.order_by('-acquisition_date')
    
    @action(detail=False, methods=['post'])
    def ingest(self, request):
        """Initiate satellite data ingestion for watershed"""
        try:
            # Validate input
            watershed_id = request.data.get('watershed_id')
            date_range = request.data.get('date_range')
            sensors = request.data.get('sensors', ['sentinel2', 'landsat8'])
            
            if not all([watershed_id, date_range]):
                raise ValidationError({
                    'watershed_id': 'Watershed ID is required',
                    'date_range': 'Date range is required'
                })
            
            # Create processing job
            job = create_processing_job(
                user=request.user,
                watershed_id=watershed_id,
                job_type='data_ingestion',
                parameters={
                    'date_range': date_range,
                    'sensors': sensors
                }
            )
            
            logger.info(
                f"Data ingestion job created: {job.id} "
                f"for watershed {watershed_id} by user {request.user.id}"
            )
            
            return Response({
                'data': JobStatusSerializer(job).data,
                'message': 'Data ingestion job created successfully',
                'timestamp': timezone.now().isoformat()
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating ingestion job: {str(e)}")
            raise
    
    @action(detail=False, methods=['post'])
    def process_indices(self, request):
        """Process spectral indices for satellite data"""
        try:
            satellite_data_ids = request.data.get('satellite_data_ids', [])
            
            if not satellite_data_ids:
                raise ValidationError({
                    'satellite_data_ids': 'Satellite data IDs are required'
                })
            
            # Create processing job
            job = create_processing_job(
                user=request.user,
                job_type='spectral_indices',
                parameters={
                    'satellite_data_ids': satellite_data_ids
                }
            )
            
            return Response({
                'data': JobStatusSerializer(job).data,
                'message': 'Spectral index processing job created successfully',
                'timestamp': timezone.now().isoformat()
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating indices processing job: {str(e)}")
            raise
    
    @action(detail=False, methods=['get'])
    def quality_assessment(self, request):
        """Get quality assessment for satellite data"""
        satellite_data_id = request.query_params.get('satellite_data_id')
        
        if not satellite_data_id:
            raise ValidationError({
                'satellite_data_id': 'Satellite data ID is required'
            })
        
        try:
            satellite_data = SatelliteData.objects.get(id=satellite_data_id)
            
            # Check if user has access
            if not request.user.is_superuser and satellite_data.watershed.owner != request.user:
                if request.user not in satellite_data.watershed.analysts.all():
                    raise PermissionDenied("Access denied to this satellite data")
            
            # Get quality metrics
            quality_metrics = satellite_data.quality_metrics or {}
            
            return Response({
                'satellite_data_id': satellite_data_id,
                'quality_metrics': quality_metrics,
                'cloud_coverage': satellite_data.cloud_coverage,
                'data_quality_score': satellite_data.data_quality_score,
                'is_processed': satellite_data.is_processed,
                'processing_date': satellite_data.processing_date.isoformat() 
                    if satellite_data.processing_date else None,
                'timestamp': timezone.now().isoformat()
            })
            
        except SatelliteData.DoesNotExist:
            raise NotFound("Satellite data not found")
        except Exception as e:
            logger.error(f"Error getting quality assessment: {str(e)}")
            raise


class ChangeDetectionAPIViewSet(viewsets.ReadOnlyModelViewSet, RateLimitMixin):
    """
    Change Detection Results API Endpoints
    
    Provides access to disturbance detection results including:
    - Change detection results
    - Confidence scores and classifications
    - Time series analysis
    - Export capabilities
    """
    
    serializer_class = DetectionResultSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get change detection results for user's watersheds"""
        user = self.request.user
        
        # Get watersheds user has access to
        accessible_watersheds = Watershed.objects.filter(
            Q(owner=user) | Q(analysts=user) | Q(viewers=user)
        )
        
        queryset = DetectionResult.objects.filter(
            watershed__in=accessible_watersheds
        )
        
        # Apply filters
        filters = self.request.query_params
        
        # Date range filter
        start_date = filters.get('start_date')
        end_date = filters.get('end_date')
        if start_date:
            queryset = queryset.filter(detection_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(detection_date__lte=end_date)
        
        # Confidence filter
        min_confidence = filters.get('min_confidence')
        max_confidence = filters.get('max_confidence')
        if min_confidence:
            queryset = queryset.filter(confidence_score__gte=min_confidence)
        if max_confidence:
            queryset = queryset.filter(confidence_score__lte=max_confidence)
        
        # Disturbance type filter
        disturbance_type = filters.get('disturbance_type')
        if disturbance_type:
            queryset = queryset.filter(disturbance_type=disturbance_type)
        
        # Area filter
        min_area = filters.get('min_area')
        max_area = filters.get('max_area')
        if min_area:
            queryset = queryset.filter(area_hectares__gte=min_area)
        if max_area:
            queryset = queryset.filter(area_hectares__lte=max_area)
        
        # Spatial filter (bounding box)
        bbox = filters.get('bbox')  # Format: minx,miny,maxx,maxy
        if bbox:
            try:
                bbox_coords = [float(x) for x in bbox.split(',')]
                if len(bbox_coords) == 4:
                    queryset = queryset.filter(
                        geometry__intersects=f'POLYGON(({bbox_coords[0]} {bbox_coords[1]}, {bbox_coords[2]} {bbox_coords[1]}, {bbox_coords[2]} {bbox_coords[3]}, {bbox_coords[0]} {bbox_coords[3]}, {bbox_coords[0]} {bbox_coords[1]}))'
                    )
            except (ValueError, IndexError):
                raise ValidationError({
                    'bbox': 'Invalid bounding box format. Use: minx,miny,maxx,maxy'
                })
        
        return queryset.order_by('-detection_date')
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Get detection statistics summary"""
        queryset = self.get_queryset()
        
        # Time period filter
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if start_date:
            queryset = queryset.filter(detection_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(detection_date__lte=end_date)
        
        # Calculate statistics
        total_detections = queryset.count()
        
        if total_detections == 0:
            return Response({
                'statistics': {
                    'total_detections': 0,
                    'average_confidence': 0,
                    'total_area_disturbed': 0,
                    'detections_by_type': {},
                    'detections_by_confidence': {},
                    'time_series': []
                },
                'timestamp': timezone.now().isoformat()
            })
        
        avg_confidence = queryset.aggregate(
            avg_confidence=models.Avg('confidence_score')
        )['avg_confidence']
        
        total_area = queryset.aggregate(
            total_area=models.Sum('area_hectares')
        )['total_area']
        
        # By disturbance type
        detections_by_type = {}
        for dt in queryset.values_list('disturbance_type', flat=True).distinct():
            if dt:
                detections_by_type[dt] = queryset.filter(disturbance_type=dt).count()
        
        # By confidence range
        detections_by_confidence = {
            'high_confidence': queryset.filter(confidence_score__gte=0.8).count(),
            'medium_confidence': queryset.filter(
                confidence_score__gte=0.6, confidence_score__lt=0.8
            ).count(),
            'low_confidence': queryset.filter(confidence_score__lt=0.6).count()
        }
        
        # Time series data (monthly aggregation)
        time_series = []
        for month in queryset.dates('detection_date', 'month'):
            month_detections = queryset.filter(
                detection_date__month=month.month,
                detection_date__year=month.year
            )
            time_series.append({
                'date': month.strftime('%Y-%m'),
                'count': month_detections.count(),
                'area': month_detections.aggregate(
                    area=models.Sum('area_hectares')
                )['area'] or 0
            })
        
        return Response({
            'statistics': {
                'total_detections': total_detections,
                'average_confidence': round(avg_confidence, 3),
                'total_area_disturbed': round(total_area or 0, 2),
                'detections_by_type': detections_by_type,
                'detections_by_confidence': detections_by_confidence,
                'time_series': time_series
            },
            'filters_applied': {
                'start_date': start_date,
                'end_date': end_date
            },
            'timestamp': timezone.now().isoformat()
        })
    
    @action(detail=True, methods=['get'])
    def timeseries(self, request, pk=None):
        """Get time series data for a detection"""
        detection = self.get_object()
        
        # Check access
        if not request.user.is_superuser and detection.watershed.owner != request.user:
            if request.user not in detection.watershed.viewers.all():
                raise PermissionDenied("Access denied to this detection")
        
        # Get time series data
        timeseries_data = detection.timeseries_data or {}
        
        return Response({
            'detection_id': detection.id,
            'timeseries': timeseries_data,
            'spectral_indices': {
                'NDVI': timeseries_data.get('NDVI', []),
                'NBR': timeseries_data.get('NBR', []),
                'TCG': timeseries_data.get('TCG', [])
            },
            'timestamp': timezone.now().isoformat()
        })
    
    @action(detail=False, methods=['post'])
    def export(self, request):
        """Create export job for detection results"""
        try:
            # Get filters from request
            filters = {}
            for param in ['watershed_id', 'start_date', 'end_date', 
                         'min_confidence', 'max_confidence', 'disturbance_type',
                         'min_area', 'max_area', 'bbox']:
                value = request.data.get(param)
                if value:
                    filters[param] = value
            
            if not filters.get('watershed_id'):
                raise ValidationError({
                    'watershed_id': 'Watershed ID is required for export'
                })
            
            # Create export job
            job = create_export_job(
                user=request.user,
                export_type='detection_results',
                filters=filters,
                format=request.data.get('format', 'geojson')
            )
            
            logger.info(
                f"Export job created: {job.id} by user {request.user.id}"
            )
            
            return Response({
                'data': JobStatusSerializer(job).data,
                'message': 'Export job created successfully',
                'timestamp': timezone.now().isoformat()
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating export job: {str(e)}")
            raise


class AlertsAPIViewSet(viewsets.ModelViewSet, RateLimitMixin):
    """
    Alert Management API Endpoints
    
    Handles alert configuration and management including:
    - Alert rule creation and modification
    - Notification preferences
    - Alert history and status tracking
    - Mute/unmute functionality
    """
    
    serializer_class = AlertSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get alerts for user's watersheds"""
        user = self.request.user
        
        return Alert.objects.filter(
            watershed__owner=user
        ).order_by('-created_at')
    
    def perform_create(self, serializer):
        """Create alert with user association"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Send test alert"""
        alert = self.get_object()
        
        # Verify user owns the alert
        if alert.watershed.owner != request.user and not request.user.is_superuser:
            raise PermissionDenied("Access denied")
        
        # Send test notification
        test_result = alert.send_test_notification()
        
        return Response({
            'message': 'Test alert sent successfully',
            'test_result': test_result,
            'timestamp': timezone.now().isoformat()
        })
    
    @action(detail=True, methods=['post'])
    def mute(self, request, pk=None):
        """Mute alert notifications"""
        alert = self.get_object()
        alert.is_muted = True
        alert.save()
        
        return Response({
            'message': 'Alert muted successfully',
            'is_muted': alert.is_muted,
            'timestamp': timezone.now().isoformat()
        })
    
    @action(detail=True, methods=['post'])
    def unmute(self, request, pk=None):
        """Unmute alert notifications"""
        alert = self.get_object()
        alert.is_muted = False
        alert.save()
        
        return Response({
            'message': 'Alert unmuted successfully',
            'is_muted': alert.is_muted,
            'timestamp': timezone.now().isoformat()
        })


class JobsAPIViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Job Status API Endpoints
    
    Provides access to processing job status and results including:
    - Job status tracking
    - Progress monitoring
    - Result access
    - Error handling
    """
    
    serializer_class = JobStatusSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get jobs for current user"""
        return JobStatus.objects.filter(
            user=self.request.user
        ).order_by('-created_at')
    
    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """Cancel a running job"""
        job = self.get_object()
        
        if job.status not in ['pending', 'running']:
            raise ValidationError("Can only cancel pending or running jobs")
        
        job.status = 'cancelled'
        job.save()
        
        logger.info(f"Job cancelled: {job.id} by user {request.user.id}")
        
        return Response({
            'message': 'Job cancelled successfully',
            'status': job.status,
            'timestamp': timezone.now().isoformat()
        })


class ExportsAPIViewSet(viewsets.ReadOnlyModelViewSet, RateLimitMixin):
    """
    Data Export API Endpoints
    
    Handles data export requests and file delivery including:
    - Export job creation and tracking
    - File format selection
    - Download management
    - Export history
    """
    
    serializer_class = ExportRequestSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Get exports for current user"""
        return ExportRequest.objects.filter(
            user=self.request.user
        ).order_by('-created_at')
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Get download URL for export file"""
        export_req = self.get_object()
        
        if export_req.status != 'completed':
            raise ValidationError("Export not yet completed")
        
        if not export_req.file_url:
            raise ValidationError("Export file not available")
        
        return Response({
            'download_url': export_req.file_url,
            'expires_at': export_req.expires_at.isoformat(),
            'file_size': export_req.file_size,
            'filename': export_req.filename,
            'format': export_req.export_format,
            'timestamp': timezone.now().isoformat()
        })


# Global API configuration
API_CONFIG = {
    'version': '1.0.0',
    'title': 'Watershed Disturbance Mapping System API',
    'description': 'API for managing watershed monitoring and change detection',
    'contact': 'api-support@watershed-ds.com',
    'rate_limiting': {
        'enabled': True,
        'backend': 'django_ratelimit',
        'cache': 'default'
    },
    'authentication': {
        'type': 'jwt',
        'token_lifetime': 3600,  # 1 hour
        'refresh_token_lifetime': 2592000  # 30 days
    },
    'pagination': {
        'default_page_size': 20,
        'max_page_size': 100
    },
    'cors': {
        'enabled': True,
        'allowed_origins': '*',
        'allowed_methods': ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        'allowed_headers': ['*']
    }
}