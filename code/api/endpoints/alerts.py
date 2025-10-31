"""
Alert Management API Endpoints

This module defines the REST API endpoints for managing alerts and
notifications in the Watershed Disturbance Mapping System.

Endpoints:
- GET /api/v1/alerts/ - List alert configurations
- POST /api/v1/alerts/ - Create new alert configuration
- GET /api/v1/alerts/{id}/ - Get alert details
- PUT /api/v1/alerts/{id}/ - Update alert configuration
- DELETE /api/v1/alerts/{id}/ - Delete alert configuration
- POST /api/v1/alerts/{id}/test/ - Send test alert
- POST /api/v1/alerts/{id}/mute/ - Mute alert notifications
- POST /api/v1/alerts/{id}/unmute/ - Unmute alert notifications
- GET /api/v1/alerts/{id}/history/ - Get alert delivery history
- GET /api/v1/notifications/ - List notification history
- POST /api/v1/notifications/mark-read/ - Mark notifications as read

Author: Watershed Disturbance Mapping System
Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import json
import uuid

from django.db import transaction, models
from django.utils import timezone
from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email

from rest_framework import status
from rest_framework.decorators import api_view, action
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.viewsets import ModelViewSet

from .models import (
    Alert, Notification, Watershed, ChangeDetection, 
    NotificationChannel, DeliveryLog
)
from .serializers import AlertSerializer, NotificationSerializer, DeliveryLogSerializer
from .permissions import IsWatershedOwnerOrAnalyst
from .utils.notification_utils import (
    send_email_notification, send_sms_notification, send_webhook_notification,
    validate_notification_config, get_available_channels
)
from .utils.alert_utils import (
    evaluate_alert_conditions, create_alert_trigger,
    get_alert_statistics
)


class AlertEndpoints:
    """Endpoint definitions for alert management"""
    
    # Base path for alert endpoints
    base_path = "/api/v1/alerts"
    
    # Supported notification channels
    SUPPORTED_CHANNELS = {
        'email': {
            'name': 'Email',
            'description': 'Send alerts via email',
            'required_fields': ['addresses'],
            'optional_fields': ['subject_template', 'format']
        },
        'sms': {
            'name': 'SMS',
            'description': 'Send alerts via SMS',
            'required_fields': ['phone_numbers'],
            'optional_fields': ['message_template']
        },
        'webhook': {
            'name': 'Webhook',
            'description': 'Send alerts via HTTP webhook',
            'required_fields': ['url'],
            'optional_fields': ['headers', 'authentication', 'timeout']
        },
        'dashboard': {
            'name': 'Dashboard',
            'description': 'Show alerts in dashboard',
            'required_fields': [],
            'optional_fields': ['display_settings']
        }
    }
    
    # Alert types
    ALERT_TYPES = [
        'detection_threshold',
        'confidence_threshold',
        'area_threshold',
        'proximity_alert',
        'custom_query'
    ]
    
    # Rate limiting per user tier
    rate_limits = {
        "free": "20/hour",
        "analyst": "100/hour",
        "admin": "500/hour"
    }
    
    @staticmethod
    def list_alerts(request) -> Response:
        """
        GET /api/v1/alerts/
        
        List all alert configurations accessible to the authenticated user.
        
        Query Parameters:
        - page (int): Page number (default: 1)
        - page_size (int): Items per page (default: 20, max: 100)
        - watershed_id (string): Filter by watershed
        - alert_type (string): Filter by alert type
        - status (string): Filter by alert status (active, inactive, muted)
        - search (string): Search term for alert names
        
        Responses:
        - 200: Success - Returns paginated list of alerts
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
            queryset = Alert.objects.select_related('watershed', 'created_by')
        else:
            # User can see alerts for watersheds they have access to
            accessible_watersheds = Watershed.objects.filter(
                models.Q(owner=request.user) | 
                models.Q(analysts=request.user) |
                models.Q(viewers=request.user)
            )
            queryset = Alert.objects.filter(
                watershed__in=accessible_watersheds
            ).select_related('watershed', 'created_by')
        
        # Apply filters
        filters = request.GET
        
        # Watershed filter
        watershed_id = filters.get('watershed_id')
        if watershed_id:
            queryset = queryset.filter(watershed_id=watershed_id)
        
        # Alert type filter
        alert_type = filters.get('alert_type')
        if alert_type:
            if alert_type not in AlertEndpoints.ALERT_TYPES:
                raise ValidationError({
                    "alert_type": f"Invalid alert type. "
                    f"Supported: {AlertEndpoints.ALERT_TYPES}"
                })
            queryset = queryset.filter(alert_type=alert_type)
        
        # Status filter
        status_filter = filters.get('status')
        if status_filter:
            valid_statuses = ['active', 'inactive', 'muted']
            if status_filter not in valid_statuses:
                raise ValidationError({
                    "status": f"Invalid status. Supported: {valid_statuses}"
                })
            if status_filter == 'muted':
                queryset = queryset.filter(is_muted=True)
            else:
                queryset = queryset.filter(is_muted=False, is_active=(status_filter == 'active'))
        
        # Search filter
        search_term = filters.get('search', '').strip()
        if search_term:
            queryset = queryset.filter(
                models.Q(name__icontains=search_term) |
                models.Q(description__icontains=search_term)
            )
        
        # Order by creation date (newest first)
        queryset = queryset.order_by('-created_at')
        
        # Paginate results
        total_count = queryset.count()
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        alerts = queryset[start_index:end_index]
        
        # Serialize data
        serializer = AlertSerializer(alerts, many=True)
        
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
                "alert_type": alert_type,
                "status": status_filter,
                "search": search_term
            },
            "available_alert_types": AlertEndpoints.ALERT_TYPES,
            "available_channels": list(AlertEndpoints.SUPPORTED_CHANNELS.keys()),
            "timestamp": timezone.now().isoformat()
        }
        
        return Response(response_data)
    
    @staticmethod
    def create_alert(request) -> Response:
        """
        POST /api/v1/alerts/
        
        Create a new alert configuration.
        
        Request Body:
        {
            "name": "High Confidence Fire Detection",
            "description": "Alert for high confidence fire detections",
            "watershed_id": "ws_123",
            "alert_type": "confidence_threshold",
            "conditions": {
                "min_confidence": 0.8,
                "disturbance_types": ["fire"],
                "min_area_hectares": 0.5,
                "geographic_filters": {
                    "proximity_to_features": {
                        "streams": {"max_distance_m": 100},
                        "protected_areas": {"within": true}
                    }
                }
            },
            "channels": {
                "email": {
                    "addresses": ["alerts@example.com"],
                    "subject_template": "Fire Detection Alert - {watershed_name}",
                    "format": "html"
                },
                "sms": {
                    "phone_numbers": ["+15551234567"],
                    "message_template": "Fire detected in {watershed_name}: {area_hectares} ha"
                }
            },
            "schedule": {
                "frequency": "immediate",
                "quiet_hours": {
                    "start": "22:00",
                    "end": "06:00"
                }
            }
        }
        
        Responses:
        - 201: Created - Alert created successfully
        - 400: Bad Request - Invalid request data
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Watershed not found
        """
        
        # Validate request data
        data = request.data
        
        required_fields = ['name', 'watershed_id', 'alert_type', 'conditions', 'channels']
        for field in required_fields:
            if not data.get(field):
                raise ValidationError({field: f"{field} is required"})
        
        # Validate watershed access
        try:
            watershed = Watershed.objects.get(id=data['watershed_id'])
            
            # Check permissions (only owner or analyst can create alerts)
            if not request.user.is_superuser:
                if (watershed.owner != request.user and 
                    request.user not in watershed.analysts.all()):
                    raise PermissionDenied("Access denied to this watershed")
        
        except Watershed.DoesNotExist:
            raise NotFound(f"Watershed '{data['watershed_id']}' not found")
        
        # Validate alert type
        alert_type = data['alert_type']
        if alert_type not in AlertEndpoints.ALERT_TYPES:
            raise ValidationError({
                "alert_type": f"Invalid alert type. "
                f"Supported: {AlertEndpoints.ALERT_TYPES}"
            })
        
        # Validate alert conditions
        conditions = data['conditions']
        try:
            # This would typically validate conditions based on alert type
            validate_alert_conditions(alert_type, conditions)
        except ValidationError as e:
            raise ValidationError({"conditions": str(e)})
        
        # Validate notification channels
        channels = data['channels']
        try:
            validate_notification_config(channels, AlertEndpoints.SUPPORTED_CHANNELS)
        except ValidationError as e:
            raise ValidationError({"channels": str(e)})
        
        try:
            with transaction.atomic():
                # Create alert
                alert_data = {
                    'name': data['name'],
                    'description': data.get('description', ''),
                    'watershed': watershed,
                    'alert_type': alert_type,
                    'conditions': conditions,
                    'channels': channels,
                    'schedule': data.get('schedule', {}),
                    'is_active': True,
                    'is_muted': False,
                    'created_by': request.user,
                    'created_at': timezone.now(),
                    'updated_at': timezone.now()
                }
                
                alert = Alert.objects.create(**alert_data)
                
                # Log alert creation
                import logging
                logger = logging.getLogger(__name__)
                logger.info(
                    f"Alert created: {alert.id} ({alert_type}) "
                    f"for watershed {watershed.id} by user {request.user.id}"
                )
                
                # Return created alert
                serializer = AlertSerializer(alert)
                
                response_data = {
                    "data": serializer.data,
                    "message": "Alert created successfully",
                    "alert_statistics": alert.get_statistics(),
                    "timestamp": timezone.now().isoformat()
                }
                
                return Response(response_data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error creating alert: {str(e)}")
            raise
    
    @staticmethod
    def get_alert(request, alert_id: str) -> Response:
        """
        GET /api/v1/alerts/{id}/
        
        Retrieve detailed information about a specific alert configuration.
        
        Path Parameters:
        - id (string): Alert identifier
        
        Responses:
        - 200: Success - Returns alert details
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Alert not found
        """
        
        try:
            # Get alert
            alert = Alert.objects.select_related(
                'watershed', 'created_by'
            ).get(id=alert_id)
            
            # Check access permissions
            if not request.user.is_superuser:
                if (alert.watershed.owner != request.user and 
                    request.user not in alert.watershed.analysts.all() and
                    request.user not in alert.watershed.viewers.all()):
                    raise PermissionDenied("Access denied to this alert")
            
            # Get alert statistics
            alert_stats = get_alert_statistics(alert)
            
            # Get recent delivery history
            delivery_history = DeliveryLog.objects.filter(
                alert=alert
            ).order_by('-created_at')[:10]
            
            # Serialize data
            serializer = AlertSerializer(alert)
            delivery_serializer = DeliveryLogSerializer(delivery_history, many=True)
            
            response_data = {
                "data": serializer.data,
                "statistics": alert_stats,
                "delivery_history": delivery_serializer.data,
                "next_evaluation": alert.get_next_evaluation_time(),
                "timestamp": timezone.now().isoformat()
            }
            
            return Response(response_data)
        
        except Alert.DoesNotExist:
            raise NotFound(f"Alert with ID '{alert_id}' not found")
    
    @staticmethod
    def update_alert(request, alert_id: str) -> Response:
        """
        PUT /api/v1/alerts/{id}/
        
        Update alert configuration.
        
        Path Parameters:
        - id (string): Alert identifier
        
        Request Body:
        {
            "name": "Updated Alert Name",
            "description": "Updated description",
            "conditions": {
                "min_confidence": 0.9,
                "disturbance_types": ["fire", "harvest"]
            },
            "is_active": true,
            "is_muted": false
        }
        
        Responses:
        - 200: Success - Alert updated successfully
        - 400: Bad Request - Invalid request data
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Alert not found
        """
        
        try:
            # Get alert
            alert = Alert.objects.select_related('watershed').get(id=alert_id)
            
            # Check permissions (only owner or analyst can update)
            if not request.user.is_superuser:
                if (alert.watershed.owner != request.user and 
                    request.user not in alert.watershed.analysts.all()):
                    raise PermissionDenied("Access denied to this alert")
            
            # Validate request data
            data = request.data
            
            with transaction.atomic():
                # Update fields
                if 'name' in data and data['name'] != alert.name:
                    alert.name = data['name']
                
                if 'description' in data:
                    alert.description = data['description']
                
                # Update conditions if provided
                if 'conditions' in data:
                    conditions = data['conditions']
                    try:
                        validate_alert_conditions(alert.alert_type, conditions)
                        alert.conditions = conditions
                    except ValidationError as e:
                        raise ValidationError({"conditions": str(e)})
                
                # Update channels if provided
                if 'channels' in data:
                    channels = data['channels']
                    try:
                        validate_notification_config(channels, AlertEndpoints.SUPPORTED_CHANNELS)
                        alert.channels = channels
                    except ValidationError as e:
                        raise ValidationError({"channels": str(e)})
                
                # Update schedule if provided
                if 'schedule' in data:
                    alert.schedule = data['schedule']
                
                # Update status flags
                if 'is_active' in data:
                    alert.is_active = data['is_active']
                
                if 'is_muted' in data:
                    alert.is_muted = data['is_muted']
                
                alert.updated_at = timezone.now()
                alert.save()
                
                # Log alert update
                import logging
                logger = logging.getLogger(__name__)
                logger.info(
                    f"Alert updated: {alert.id} by user {request.user.id}"
                )
                
                # Return updated alert
                serializer = AlertSerializer(alert)
                
                response_data = {
                    "data": serializer.data,
                    "message": "Alert updated successfully",
                    "timestamp": timezone.now().isoformat()
                }
                
                return Response(response_data)
        
        except Alert.DoesNotExist:
            raise NotFound(f"Alert with ID '{alert_id}' not found")
    
    @staticmethod
    def delete_alert(request, alert_id: str) -> Response:
        """
        DELETE /api/v1/alerts/{id}/
        
        Delete an alert configuration.
        
        Path Parameters:
        - id (string): Alert identifier
        
        Responses:
        - 200: Success - Alert deleted successfully
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Alert not found
        """
        
        try:
            # Get alert
            alert = Alert.objects.select_related('watershed').get(id=alert_id)
            
            # Check permissions (only owner or admin can delete)
            if not request.user.is_superuser and alert.watershed.owner != request.user:
                raise PermissionDenied("Only watershed owner can delete alerts")
            
            # Perform deletion
            alert.delete()
            
            # Log alert deletion
            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                f"Alert deleted: {alert_id} by user {request.user.id}"
            )
            
            return Response({
                "message": "Alert deleted successfully",
                "timestamp": timezone.now().isoformat()
            })
        
        except Alert.DoesNotExist:
            raise NotFound(f"Alert with ID '{alert_id}' not found")
    
    @staticmethod
    def test_alert(request, alert_id: str) -> Response:
        """
        POST /api/v1/alerts/{id}/test/
        
        Send a test notification for the alert configuration.
        
        Path Parameters:
        - id (string): Alert identifier
        
        Request Body:
        {
            "test_data": {
                "confidence_score": 0.95,
                "disturbance_type": "fire",
                "area_hectares": 1.5
            }
        }
        
        Responses:
        - 200: Success - Test notification sent
        - 400: Bad Request - Invalid request data
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Alert not found
        """
        
        try:
            # Get alert
            alert = Alert.objects.select_related('watershed').get(id=alert_id)
            
            # Check permissions
            if not request.user.is_superuser:
                if (alert.watershed.owner != request.user and 
                    request.user not in alert.watershed.analysts.all()):
                    raise PermissionDenied("Access denied to this alert")
            
            # Get test data
            test_data = request.data.get('test_data', {})
            
            try:
                with transaction.atomic():
                    # Create test notification
                    detection_data = test_data or {
                        'confidence_score': 0.95,
                        'disturbance_type': alert.conditions.get('disturbance_types', ['other'])[0],
                        'area_hectares': alert.conditions.get('min_area_hectares', 1.0)
                    }
                    
                    # Create delivery log entry
                    delivery_log = DeliveryLog.objects.create(
                        alert=alert,
                        notification_type='test',
                        status='pending',
                        test_mode=True,
                        created_at=timezone.now()
                    )
                    
                    # Send test notifications
                    delivery_results = []
                    
                    for channel, config in alert.channels.items():
                        try:
                            if channel == 'email':
                                result = send_email_notification(
                                    alert=alert,
                                    detection_data=detection_data,
                                    config=config,
                                    test_mode=True
                                )
                            elif channel == 'sms':
                                result = send_sms_notification(
                                    alert=alert,
                                    detection_data=detection_data,
                                    config=config,
                                    test_mode=True
                                )
                            elif channel == 'webhook':
                                result = send_webhook_notification(
                                    alert=alert,
                                    detection_data=detection_data,
                                    config=config,
                                    test_mode=True
                                )
                            elif channel == 'dashboard':
                                result = {'status': 'delivered', 'channel': 'dashboard'}
                            
                            delivery_results.append({
                                'channel': channel,
                                'status': result.get('status', 'unknown'),
                                'message': result.get('message', ''),
                                'error': result.get('error')
                            })
                            
                        except Exception as e:
                            delivery_results.append({
                                'channel': channel,
                                'status': 'failed',
                                'error': str(e)
                            })
                    
                    # Update delivery log
                    delivery_log.status = 'completed' if any(
                        r['status'] == 'delivered' for r in delivery_results
                    ) else 'failed'
                    delivery_log.delivery_details = {
                        'test_results': delivery_results,
                        'test_data': detection_data
                    }
                    delivery_log.completed_at = timezone.now()
                    delivery_log.save()
                    
                    # Log test alert
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.info(
                        f"Alert test executed: {alert.id} by user {request.user.id}"
                    )
                    
                    # Return test results
                    response_data = {
                        "message": "Test alert executed successfully",
                        "test_results": delivery_results,
                        "test_data": detection_data,
                        "delivery_log_id": delivery_log.id,
                        "timestamp": timezone.now().isoformat()
                    }
                    
                    return Response(response_data)
            
            except Exception as e:
                # Update delivery log with error
                delivery_log.status = 'failed'
                delivery_log.delivery_details = {'error': str(e)}
                delivery_log.completed_at = timezone.now()
                delivery_log.save()
                
                raise
        
        except Alert.DoesNotExist:
            raise NotFound(f"Alert with ID '{alert_id}' not found")
    
    @staticmethod
    def mute_alert(request, alert_id: str) -> Response:
        """
        POST /api/v1/alerts/{id}/mute/
        
        Mute alert notifications temporarily.
        
        Path Parameters:
        - id (string): Alert identifier
        
        Request Body:
        {
            "duration_hours": 24,
            "reason": "System maintenance"
        }
        
        Responses:
        - 200: Success - Alert muted successfully
        - 400: Bad Request - Invalid request data
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Alert not found
        """
        
        try:
            # Get alert
            alert = Alert.objects.select_related('watershed').get(id=alert_id)
            
            # Check permissions
            if not request.user.is_superuser:
                if (alert.watershed.owner != request.user and 
                    request.user not in alert.watershed.analysts.all()):
                    raise PermissionDenied("Access denied to this alert")
            
            # Validate request data
            data = request.data
            duration_hours = data.get('duration_hours', 24)
            
            if duration_hours <= 0 or duration_hours > 168:  # Max 1 week
                raise ValidationError({
                    "duration_hours": "Duration must be between 1 and 168 hours"
                })
            
            # Calculate mute expiry
            mute_expires_at = timezone.now() + timedelta(hours=duration_hours)
            
            # Update alert
            alert.is_muted = True
            alert.mute_expires_at = mute_expires_at
            alert.mute_reason = data.get('reason', '')
            alert.updated_at = timezone.now()
            alert.save()
            
            # Log mute action
            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                f"Alert muted: {alert.id} for {duration_hours} hours "
                f"by user {request.user.id}"
            )
            
            return Response({
                "message": f"Alert muted for {duration_hours} hours",
                "mute_expires_at": mute_expires_at.isoformat(),
                "mute_reason": data.get('reason', ''),
                "timestamp": timezone.now().isoformat()
            })
        
        except Alert.DoesNotExist:
            raise NotFound(f"Alert with ID '{alert_id}' not found")
    
    @staticmethod
    def unmute_alert(request, alert_id: str) -> Response:
        """
        POST /api/v1/alerts/{id}/unmute/
        
        Unmute alert notifications.
        
        Path Parameters:
        - id (string): Alert identifier
        
        Responses:
        - 200: Success - Alert unmuted successfully
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Alert not found
        """
        
        try:
            # Get alert
            alert = Alert.objects.select_related('watershed').get(id=alert_id)
            
            # Check permissions
            if not request.user.is_superuser:
                if (alert.watershed.owner != request.user and 
                    request.user not in alert.watershed.analysts.all()):
                    raise PermissionDenied("Access denied to this alert")
            
            # Update alert
            alert.is_muted = False
            alert.mute_expires_at = None
            alert.mute_reason = ''
            alert.updated_at = timezone.now()
            alert.save()
            
            # Log unmute action
            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                f"Alert unmuted: {alert.id} by user {request.user.id}"
            )
            
            return Response({
                "message": "Alert unmuted successfully",
                "timestamp": timezone.now().isoformat()
            })
        
        except Alert.DoesNotExist:
            raise NotFound(f"Alert with ID '{alert_id}' not found")


def validate_alert_conditions(alert_type: str, conditions: Dict) -> None:
    """Validate alert conditions based on alert type"""
    
    if alert_type == 'confidence_threshold':
        if 'min_confidence' not in conditions:
            raise ValidationError("min_confidence is required for confidence threshold alerts")
        
        conf = conditions['min_confidence']
        if not 0.0 <= conf <= 1.0:
            raise ValidationError("min_confidence must be between 0.0 and 1.0")
    
    elif alert_type == 'area_threshold':
        if 'min_area_hectares' not in conditions:
            raise ValidationError("min_area_hectares is required for area threshold alerts")
        
        area = conditions['min_area_hectares']
        if area <= 0:
            raise ValidationError("min_area_hectares must be positive")
    
    elif alert_type == 'proximity_alert':
        if 'geographic_filters' not in conditions:
            raise ValidationError("geographic_filters is required for proximity alerts")


# API endpoint registry
ALERT_ENDPOINT_PATHS = {
    'list': '/api/v1/alerts/',
    'create': '/api/v1/alerts/',
    'detail': '/api/v1/alerts/{id}/',
    'update': '/api/v1/alerts/{id}/',
    'delete': '/api/v1/alerts/{id}/',
    'test': '/api/v1/alerts/{id}/test/',
    'mute': '/api/v1/alerts/{id}/mute/',
    'unmute': '/api/v1/alerts/{id}/unmute/'
}


class AlertAPIViewSet(ModelViewSet):
    """Django REST Framework ViewSet for Alert endpoints"""
    
    serializer_class = AlertSerializer
    permission_classes = [IsWatershedOwnerOrAnalyst]
    
    def get_queryset(self):
        """Get alerts based on user permissions"""
        if self.request.user.is_superuser:
            return Alert.objects.select_related('watershed', 'created_by').all()
        else:
            accessible_watersheds = Watershed.objects.filter(
                models.Q(owner=self.request.user) | 
                models.Q(analysts=self.request.user) |
                models.Q(viewers=self.request.user)
            )
            return Alert.objects.filter(
                watershed__in=accessible_watersheds
            ).select_related('watershed', 'created_by')
    
    def perform_create(self, serializer):
        """Create alert with user association"""
        serializer.save(created_by=self.request.user)
    
    @action(detail=True, methods=['post'])
    def test(self, request, pk=None):
        """Handle test alert"""
        return AlertEndpoints.test_alert(request, pk)
    
    @action(detail=True, methods=['post'])
    def mute(self, request, pk=None):
        """Handle alert muting"""
        return AlertEndpoints.mute_alert(request, pk)
    
    @action(detail=True, methods=['post'])
    def unmute(self, request, pk=None):
        """Handle alert unmuting"""
        return AlertEndpoints.unmute_alert(request, pk)