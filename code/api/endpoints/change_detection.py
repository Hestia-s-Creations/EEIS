"""
Change Detection Results API Endpoints

This module defines the REST API endpoints for accessing and managing
change detection results in the Watershed Disturbance Mapping System.

Endpoints:
- GET /api/v1/change-detections/ - List change detection results
- GET /api/v1/change-detections/{id}/ - Get detection details
- GET /api/v1/change-detections/{id}/timeseries/ - Get time series data
- POST /api/v1/change-detections/validate/ - Submit validation feedback
- GET /api/v1/change-detections/{id}/export/ - Export detection data
- GET /api/v1/change-detections/statistics/ - Get detection statistics
- GET /api/v1/change-detections/map/ - Get detections as GeoJSON

Author: Watershed Disturbance Mapping System
Version: 1.0.0
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union
import json
import uuid

from django.db.models import Q, Avg, Sum, Count, Min, Max
from django.contrib.gis.geos import Point, Polygon
from django.contrib.gis.measure import Area
from django.utils import timezone
from django.db.models import models

from rest_framework import status
from rest_framework.decorators import api_view, action
from rest_framework.exceptions import ValidationError, NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.viewsets import ReadOnlyModelViewSet

from .models import (
    ChangeDetection, Watershed, SatelliteData, DetectionResult,
    TimeSeriesData, ValidationFeedback
)
from .serializers import ChangeDetectionSerializer, TimeSeriesSerializer, ValidationFeedbackSerializer
from .permissions import IsWatershedViewerOrAbove
from .utils.geometry_utils import calculate_detection_area, validate_bbox, get_geojson_bounds
from .utils.time_utils import parse_date_range, validate_date_range
from .utils.classification_utils import get_disturbance_types, get_confidence_levels


class ChangeDetectionEndpoints:
    """Endpoint definitions for change detection results"""
    
    # Base path for change detection endpoints
    base_path = "/api/v1/change-detections"
    
    # Supported disturbance types
    DISTURBANCE_TYPES = [
        'fire', 'harvest', 'clearing', 'flooding', 'infrastructure',
        'storm_damage', 'disease', 'invasive_species', 'other'
    ]
    
    # Confidence levels
    CONFIDENCE_LEVELS = {
        'high': {'min': 0.8, 'max': 1.0},
        'medium': {'min': 0.6, 'max': 0.8},
        'low': {'min': 0.0, 'max': 0.6}
    }
    
    # Rate limiting per user tier
    rate_limits = {
        "free": "100/hour",
        "analyst": "500/hour",
        "admin": "2000/hour"
    }
    
    @staticmethod
    def list_detections(request) -> Response:
        """
        GET /api/v1/change-detections/
        
        List change detection results with comprehensive filtering options.
        
        Query Parameters:
        - page (int): Page number (default: 1)
        - page_size (int): Items per page (default: 20, max: 100)
        - watershed_id (string): Filter by watershed
        - start_date (string): Start date filter (YYYY-MM-DD)
        - end_date (string): End date filter (YYYY-MM-DD)
        - min_confidence (float): Minimum confidence score (0.0-1.0)
        - max_confidence (float): Maximum confidence score (0.0-1.0)
        - disturbance_type (string): Filter by disturbance type
        - status (string): Filter by detection status
        - area_min (float): Minimum area in hectares
        - area_max (float): Maximum area in hectares
        - bbox (string): Bounding box filter (minx,miny,maxx,maxy)
        - sensor (string): Filter by detection sensor
        - algorithm (string): Filter by detection algorithm
        - has_validation (bool): Filter by validation status
        - sort_by (string): Sort field (date, confidence, area)
        - sort_order (string): Sort order (asc, desc)
        
        Responses:
        - 200: Success - Returns paginated list of detections
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
            queryset = ChangeDetection.objects.select_related('watershed')
        else:
            accessible_watersheds = Watershed.objects.filter(
                models.Q(owner=request.user) | 
                models.Q(analysts=request.user) |
                models.Q(viewers=request.user)
            )
            queryset = ChangeDetection.objects.filter(
                watershed__in=accessible_watersheds
            ).select_related('watershed')
        
        # Apply filters
        filters = request.GET
        
        # Watershed filter
        watershed_id = filters.get('watershed_id')
        if watershed_id:
            queryset = queryset.filter(watershed_id=watershed_id)
        
        # Date range filters
        start_date = filters.get('start_date')
        end_date = filters.get('end_date')
        if start_date:
            queryset = queryset.filter(detection_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(detection_date__lte=end_date)
        
        # Confidence filters
        min_confidence = filters.get('min_confidence', type=float)
        max_confidence = filters.get('max_confidence', type=float)
        if min_confidence is not None:
            if not 0.0 <= min_confidence <= 1.0:
                raise ValidationError({"min_confidence": "Must be between 0.0 and 1.0"})
            queryset = queryset.filter(confidence_score__gte=min_confidence)
        if max_confidence is not None:
            if not 0.0 <= max_confidence <= 1.0:
                raise ValidationError({"max_confidence": "Must be between 0.0 and 1.0"})
            queryset = queryset.filter(confidence_score__lte=max_confidence)
        
        # Disturbance type filter
        disturbance_type = filters.get('disturbance_type')
        if disturbance_type:
            if disturbance_type not in ChangeDetectionEndpoints.DISTURBANCE_TYPES:
                raise ValidationError({
                    "disturbance_type": f"Invalid disturbance type. "
                    f"Supported: {ChangeDetectionEndpoints.DISTURBANCE_TYPES}"
                })
            queryset = queryset.filter(disturbance_type=disturbance_type)
        
        # Status filter
        status_filter = filters.get('status')
        if status_filter:
            valid_statuses = ['new', 'confirmed', 'false_positive', 'resolved']
            if status_filter not in valid_statuses:
                raise ValidationError({
                    "status": f"Invalid status. Supported: {valid_statuses}"
                })
            queryset = queryset.filter(status=status_filter)
        
        # Area filters
        area_min = filters.get('area_min', type=float)
        area_max = filters.get('area_max', type=float)
        if area_min is not None:
            if area_min < 0:
                raise ValidationError({"area_min": "Must be non-negative"})
            queryset = queryset.filter(area_hectares__gte=area_min)
        if area_max is not None:
            if area_max < 0:
                raise ValidationError({"area_max": "Must be non-negative"})
            queryset = queryset.filter(area_hectares__lte=area_max)
        
        # Spatial filter (bounding box)
        bbox = filters.get('bbox')
        if bbox:
            try:
                validate_bbox(bbox)
                bbox_coords = [float(x) for x in bbox.split(',')]
                # Create polygon from bbox
                bbox_polygon = Polygon.from_bbox(tuple(bbox_coords))
                queryset = queryset.filter(geometry__intersects=bbox_polygon)
            except (ValueError, IndexError, ValidationError) as e:
                raise ValidationError({"bbox": "Invalid bounding box format. Use: minx,miny,maxx,maxy"})
        
        # Sensor filter
        sensor = filters.get('sensor')
        if sensor:
            valid_sensors = ['landsat8', 'landsat9', 'sentinel2']
            if sensor not in valid_sensors:
                raise ValidationError({
                    "sensor": f"Invalid sensor. Supported: {valid_sensors}"
                })
            queryset = queryset.filter(source_sensor=sensor)
        
        # Algorithm filter
        algorithm = filters.get('algorithm')
        if algorithm:
            valid_algorithms = ['landtrendr', 'fnrt', 'combined']
            if algorithm not in valid_algorithms:
                raise ValidationError({
                    "algorithm": f"Invalid algorithm. Supported: {valid_algorithms}"
                })
            queryset = queryset.filter(algorithm=algorithm)
        
        # Validation status filter
        has_validation = filters.get('has_validation')
        if has_validation is not None:
            if has_validation.lower() == 'true':
                queryset = queryset.filter(validation_feedback__isnull=False).distinct()
            else:
                queryset = queryset.filter(validation_feedback__isnull=True)
        
        # Apply sorting
        sort_by = filters.get('sort_by', 'detection_date')
        sort_order = filters.get('sort_order', 'desc')
        
        valid_sort_fields = ['detection_date', 'confidence_score', 'area_hectares', 'created_at']
        if sort_by not in valid_sort_fields:
            raise ValidationError({
                "sort_by": f"Invalid sort field. Supported: {valid_sort_fields}"
            })
        
        if sort_order not in ['asc', 'desc']:
            raise ValidationError({
                "sort_order": "Must be 'asc' or 'desc'"
            })
        
        sort_field = f"-{sort_by}" if sort_order == 'desc' else sort_by
        queryset = queryset.order_by(sort_field)
        
        # Paginate results
        total_count = queryset.count()
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        detections = queryset[start_index:end_index]
        
        # Serialize data
        serializer = ChangeDetectionSerializer(detections, many=True)
        
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
                "start_date": start_date,
                "end_date": end_date,
                "min_confidence": min_confidence,
                "max_confidence": max_confidence,
                "disturbance_type": disturbance_type,
                "status": status_filter,
                "area_min": area_min,
                "area_max": area_max,
                "bbox": bbox,
                "sensor": sensor,
                "algorithm": algorithm,
                "has_validation": has_validation,
                "sort_by": sort_by,
                "sort_order": sort_order
            },
            "available_disturbance_types": ChangeDetectionEndpoints.DISTURBANCE_TYPES,
            "timestamp": timezone.now().isoformat()
        }
        
        return Response(response_data)
    
    @staticmethod
    def get_detection(request, detection_id: str) -> Response:
        """
        GET /api/v1/change-detections/{id}/
        
        Retrieve detailed information about a specific change detection result.
        
        Path Parameters:
        - id (string): Change detection identifier
        
        Responses:
        - 200: Success - Returns detection details
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Detection not found
        """
        
        try:
            # Get detection
            detection = ChangeDetection.objects.select_related(
                'watershed'
            ).prefetch_related(
                'validation_feedback'
            ).get(id=detection_id)
            
            # Check access permissions
            if not request.user.is_superuser:
                if (detection.watershed.owner != request.user and 
                    request.user not in detection.watershed.analysts.all() and
                    request.user not in detection.watershed.viewers.all()):
                    raise PermissionDenied("Access denied to this detection")
            
            # Get time series data
            timeseries_data = TimeSeriesData.objects.filter(
                detection=detection
            ).order_by('observation_date')
            
            # Get validation feedback
            validation_feedback = ValidationFeedback.objects.filter(
                detection=detection
            ).order_by('-created_at')[:5]  # Last 5 feedback entries
            
            # Calculate additional metrics
            bbox = get_geojson_bounds(detection.geometry)
            perimeter_km = detection.geometry.length.km if detection.geometry else 0
            
            # Get related satellite data
            related_satellite_data = SatelliteData.objects.filter(
                detections=detection
            ).values('id', 'sensor', 'acquisition_date')
            
            # Serialize data
            serializer = ChangeDetectionSerializer(detection)
            timeseries_serializer = TimeSeriesSerializer(timeseries_data, many=True)
            validation_serializer = ValidationFeedbackSerializer(validation_feedback, many=True)
            
            response_data = {
                "data": serializer.data,
                "geometry": {
                    "bbox": bbox,
                    "area_km2": float(detection.geometry.area.sq_km) if detection.geometry else 0,
                    "perimeter_km": perimeter_km
                },
                "timeseries": timeseries_serializer.data,
                "validation_feedback": validation_serializer.data,
                "related_satellite_data": list(related_satellite_data),
                "spectral_changes": detection.spectral_changes or {},
                "algorithmic_details": detection.algorithm_details or {},
                "timestamp": timezone.now().isoformat()
            }
            
            return Response(response_data)
        
        except ChangeDetection.DoesNotExist:
            raise NotFound(f"Change detection with ID '{detection_id}' not found")
    
    @staticmethod
    def get_timeseries(request, detection_id: str) -> Response:
        """
        GET /api/v1/change-detections/{id}/timeseries/
        
        Retrieve time series data for a specific detection including spectral indices.
        
        Path Parameters:
        - id (string): Change detection identifier
        
        Query Parameters:
        - start_date (string): Start date filter (YYYY-MM-DD)
        - end_date (string): End date filter (YYYY-MM-DD)
        - indices (string): Comma-separated list of indices to include
        
        Responses:
        - 200: Success - Returns time series data
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Detection not found
        """
        
        try:
            # Get detection and verify access
            detection = ChangeDetection.objects.select_related('watershed').get(id=detection_id)
            
            if not request.user.is_superuser:
                if (detection.watershed.owner != request.user and 
                    request.user not in detection.watershed.analysts.all() and
                    request.user not in detection.watershed.viewers.all()):
                    raise PermissionDenied("Access denied to this detection")
            
            # Get time series data
            queryset = TimeSeriesData.objects.filter(detection=detection)
            
            # Apply date filters
            filters = request.GET
            start_date = filters.get('start_date')
            end_date = filters.get('end_date')
            
            if start_date:
                queryset = queryset.filter(observation_date__gte=start_date)
            if end_date:
                queryset = queryset.filter(observation_date__lte=end_date)
            
            # Filter by indices
            indices_filter = filters.get('indices')
            if indices_filter:
                requested_indices = indices_filter.split(',')
                queryset = queryset.filter(index_name__in=requested_indices)
            
            # Order by observation date
            queryset = queryset.order_by('observation_date')
            
            # Get time series data
            timeseries_data = queryset.values(
                'observation_date', 'index_name', 'index_value', 'quality_flag'
            )
            
            # Group by observation date
            grouped_data = {}
            for entry in timeseries_data:
                date = entry['observation_date'].isoformat()
                if date not in grouped_data:
                    grouped_data[date] = {
                        'date': date,
                        'indices': {},
                        'quality_flags': {}
                    }
                
                grouped_data[date]['indices'][entry['index_name']] = entry['index_value']
                grouped_data[date]['quality_flags'][entry['index_name']] = entry['quality_flag']
            
            # Calculate summary statistics
            summary_stats = {}
            for index_name in queryset.values_list('index_name', flat=True).distinct():
                index_values = queryset.filter(index_name=index_name).values_list('index_value', flat=True)
                if index_values:
                    summary_stats[index_name] = {
                        'min': min(index_values),
                        'max': max(index_values),
                        'mean': sum(index_values) / len(index_values),
                        'count': len(index_values)
                    }
            
            response_data = {
                "detection_id": detection_id,
                "timeseries": list(grouped_data.values()),
                "summary_statistics": summary_stats,
                "filters_applied": {
                    "start_date": start_date,
                    "end_date": end_date,
                    "indices": indices_filter
                },
                "total_observations": queryset.count(),
                "timestamp": timezone.now().isoformat()
            }
            
            return Response(response_data)
        
        except ChangeDetection.DoesNotExist:
            raise NotFound(f"Change detection with ID '{detection_id}' not found")
    
    @staticmethod
    def submit_validation(request) -> Response:
        """
        POST /api/v1/change-detections/validate/
        
        Submit validation feedback for change detection results.
        
        Request Body:
        {
            "detection_id": "string (required)",
            "validation_type": "correct" | "false_positive" | "inaccurate_location" | "inaccurate_type",
            "comments": "string (optional)",
            "ground_truth_data": {
                "actual_disturbance_type": "string",
                "actual_date": "YYYY-MM-DD",
                "confidence_override": 0.95,
                "notes": "string"
            }
        }
        
        Responses:
        - 201: Created - Validation feedback submitted successfully
        - 400: Bad Request - Invalid request data
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        - 404: Not Found - Detection not found
        """
        
        # Validate request data
        data = request.data
        
        required_fields = ['detection_id', 'validation_type']
        for field in required_fields:
            if not data.get(field):
                raise ValidationError({field: f"{field} is required"})
        
        detection_id = data['detection_id']
        validation_type = data['validation_type']
        
        # Validate detection
        try:
            detection = ChangeDetection.objects.get(id=detection_id)
        except ChangeDetection.DoesNotExist:
            raise NotFound(f"Change detection with ID '{detection_id}' not found")
        
        # Validate permissions
        if not request.user.is_superuser:
            if (detection.watershed.owner != request.user and 
                request.user not in detection.watershed.analysts.all()):
                raise PermissionDenied("Access denied to this detection")
        
        # Validate validation type
        valid_types = ['correct', 'false_positive', 'inaccurate_location', 'inaccurate_type']
        if validation_type not in valid_types:
            raise ValidationError({
                "validation_type": f"Invalid validation type. Supported: {valid_types}"
            })
        
        # Validate ground truth data if provided
        ground_truth = data.get('ground_truth_data', {})
        if ground_truth:
            if 'actual_disturbance_type' in ground_truth:
                if ground_truth['actual_disturbance_type'] not in ChangeDetectionEndpoints.DISTURBANCE_TYPES:
                    raise ValidationError({
                        "ground_truth_data.actual_disturbance_type": 
                        f"Invalid disturbance type. Supported: {ChangeDetectionEndpoints.DISTURBANCE_TYPES}"
                    })
            
            if 'actual_date' in ground_truth:
                try:
                    datetime.strptime(ground_truth['actual_date'], '%Y-%m-%d')
                except ValueError:
                    raise ValidationError({
                        "ground_truth_data.actual_date": "Invalid date format. Use YYYY-MM-DD"
                    })
            
            if 'confidence_override' in ground_truth:
                conf = ground_truth['confidence_override']
                if not 0.0 <= conf <= 1.0:
                    raise ValidationError({
                        "ground_truth_data.confidence_override": "Must be between 0.0 and 1.0"
                    })
        
        try:
            with transaction.atomic():
                # Create validation feedback
                feedback_data = {
                    'detection': detection,
                    'user': request.user,
                    'validation_type': validation_type,
                    'comments': data.get('comments', ''),
                    'ground_truth_disturbance_type': ground_truth.get('actual_disturbance_type'),
                    'ground_truth_date': ground_truth.get('actual_date'),
                    'confidence_override': ground_truth.get('confidence_override'),
                    'ground_truth_notes': ground_truth.get('notes', ''),
                    'created_at': timezone.now()
                }
                
                feedback = ValidationFeedback.objects.create(**feedback_data)
                
                # Update detection status based on validation
                if validation_type == 'correct':
                    detection.status = 'confirmed'
                elif validation_type == 'false_positive':
                    detection.status = 'false_positive'
                elif validation_type == 'inaccurate_location':
                    detection.status = 'confirmed'  # Still valid but needs location update
                elif validation_type == 'inaccurate_type':
                    detection.status = 'confirmed'  # Still valid but needs type correction
                
                # Apply confidence override if provided
                if ground_truth.get('confidence_override'):
                    detection.confidence_score = ground_truth['confidence_override']
                
                # Apply disturbance type correction if provided
                if ground_truth.get('actual_disturbance_type'):
                    detection.disturbance_type = ground_truth['actual_disturbance_type']
                
                detection.updated_at = timezone.now()
                detection.save()
                
                # Log validation
                import logging
                logger = logging.getLogger(__name__)
                logger.info(
                    f"Validation feedback submitted: detection {detection.id} "
                    f"by user {request.user.id}, type: {validation_type}"
                )
                
                # Return validation feedback
                serializer = ValidationFeedbackSerializer(feedback)
                
                response_data = {
                    "data": serializer.data,
                    "message": "Validation feedback submitted successfully",
                    "detection_updated": {
                        "status": detection.status,
                        "confidence_score": detection.confidence_score,
                        "disturbance_type": detection.disturbance_type
                    },
                    "timestamp": timezone.now().isoformat()
                }
                
                return Response(response_data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            import logging
            logger = logging.getLogger(__name__)
            logger.error(f"Error submitting validation feedback: {str(e)}")
            raise
    
    @staticmethod
    def get_statistics(request) -> Response:
        """
        GET /api/v1/change-detections/statistics/
        
        Get comprehensive statistics for change detection results.
        
        Query Parameters:
        - watershed_id (string): Filter by watershed
        - start_date (string): Start date filter (YYYY-MM-DD)
        - end_date (string): End date filter (YYYY-MM-DD)
        - group_by (string): Grouping method (day, week, month, year, disturbance_type)
        
        Responses:
        - 200: Success - Returns detection statistics
        - 401: Unauthorized - Invalid or missing authentication
        - 403: Forbidden - Insufficient permissions
        """
        
        # Get user's accessible watersheds
        if request.user.is_superuser:
            queryset = ChangeDetection.objects.all()
        else:
            accessible_watersheds = Watershed.objects.filter(
                models.Q(owner=request.user) | 
                models.Q(analysts=request.user) |
                models.Q(viewers=request.user)
            )
            queryset = ChangeDetection.objects.filter(watershed__in=accessible_watersheds)
        
        # Apply filters
        filters = request.GET
        
        # Watershed filter
        watershed_id = filters.get('watershed_id')
        if watershed_id:
            queryset = queryset.filter(watershed_id=watershed_id)
        
        # Date range filters
        start_date = filters.get('start_date')
        end_date = filters.get('end_date')
        if start_date:
            queryset = queryset.filter(detection_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(detection_date__lte=end_date)
        
        # Grouping method
        group_by = filters.get('group_by', 'month')
        valid_groupings = ['day', 'week', 'month', 'year', 'disturbance_type']
        if group_by not in valid_groupings:
            raise ValidationError({
                "group_by": f"Invalid grouping method. Supported: {valid_groupings}"
            })
        
        # Calculate basic statistics
        total_detections = queryset.count()
        
        if total_detections == 0:
            return Response({
                "statistics": {
                    "total_detections": 0,
                    "average_confidence": 0,
                    "total_area_disturbed": 0,
                    "confidence_distribution": {},
                    "disturbance_types": {},
                    "time_series": [],
                    "validation_stats": {
                        "confirmed": 0,
                        "false_positives": 0,
                        "pending_review": 0
                    }
                },
                "filters_applied": {
                    "watershed_id": watershed_id,
                    "start_date": start_date,
                    "end_date": end_date,
                    "group_by": group_by
                },
                "timestamp": timezone.now().isoformat()
            })
        
        # Aggregate statistics
        avg_confidence = queryset.aggregate(avg_confidence=Avg('confidence_score'))['avg_confidence'] or 0
        total_area = queryset.aggregate(total_area=Sum('area_hectares'))['total_area'] or 0
        
        # Confidence distribution
        confidence_distribution = {
            'high_confidence': queryset.filter(confidence_score__gte=0.8).count(),
            'medium_confidence': queryset.filter(
                confidence_score__gte=0.6, confidence_score__lt=0.8
            ).count(),
            'low_confidence': queryset.filter(confidence_score__lt=0.6).count()
        }
        
        # Disturbance types breakdown
        disturbance_types = {}
        for dt in ChangeDetectionEndpoints.DISTURBANCE_TYPES:
            count = queryset.filter(disturbance_type=dt).count()
            area = queryset.filter(disturbance_type=dt).aggregate(
                area=Sum('area_hectares')
            )['area'] or 0
            disturbance_types[dt] = {
                'count': count,
                'area_hectares': round(area, 2)
            }
        
        # Validation statistics
        validation_stats = {
            'confirmed': queryset.filter(status='confirmed').count(),
            'false_positives': queryset.filter(status='false_positive').count(),
            'pending_review': queryset.filter(status__in=['new']).count(),
            'resolved': queryset.filter(status='resolved').count()
        }
        
        # Time series data
        time_series = []
        if group_by == 'disturbance_type':
            # Already calculated above
            pass
        else:
            # Group by time periods
            queryset_annotated = queryset.annotate(
                period=models.functions.Trunc(
                    'detection_date', 
                    group_by
                )
            ).values('period').annotate(
                count=Count('id'),
                area=Sum('area_hectares'),
                avg_confidence=Avg('confidence_score')
            ).order_by('period')
            
            for entry in queryset_annotated:
                time_series.append({
                    'period': entry['period'].strftime('%Y-%m-%d'),
                    'count': entry['count'],
                    'area_hectares': round(entry['area'] or 0, 2),
                    'average_confidence': round(entry['avg_confidence'] or 0, 3)
                })
        
        response_data = {
            "statistics": {
                "total_detections": total_detections,
                "average_confidence": round(avg_confidence, 3),
                "total_area_disturbed": round(total_area, 2),
                "confidence_distribution": confidence_distribution,
                "disturbance_types": disturbance_types,
                "time_series": time_series if group_by != 'disturbance_type' else [],
                "validation_stats": validation_stats
            },
            "filters_applied": {
                "watershed_id": watershed_id,
                "start_date": start_date,
                "end_date": end_date,
                "group_by": group_by
            },
            "available_groupings": valid_groupings,
            "timestamp": timezone.now().isoformat()
        }
        
        return Response(response_data)


# API endpoint registry
CHANGE_DETECTION_ENDPOINT_PATHS = {
    'list': '/api/v1/change-detections/',
    'detail': '/api/v1/change-detections/{id}/',
    'timeseries': '/api/v1/change-detections/{id}/timeseries/',
    'validate': '/api/v1/change-detections/validate/',
    'statistics': '/api/v1/change-detections/statistics/'
}


class ChangeDetectionAPIViewSet(ReadOnlyModelViewSet):
    """Django REST Framework ViewSet for Change Detection endpoints"""
    
    serializer_class = ChangeDetectionSerializer
    permission_classes = [IsWatershedViewerOrAbove]
    
    def get_queryset(self):
        """Get change detections based on user permissions"""
        if self.request.user.is_superuser:
            return ChangeDetection.objects.select_related('watershed').all()
        else:
            accessible_watersheds = Watershed.objects.filter(
                models.Q(owner=self.request.user) | 
                models.Q(analysts=self.request.user) |
                models.Q(viewers=self.request.user)
            )
            return ChangeDetection.objects.filter(
                watershed__in=accessible_watersheds
            ).select_related('watershed')
    
    @action(detail=True, methods=['get'])
    def timeseries(self, request, pk=None):
        """Handle time series retrieval"""
        return ChangeDetectionEndpoints.get_timeseries(request, pk)
    
    @action(detail=False, methods=['post'])
    def validate(self, request):
        """Handle validation feedback submission"""
        return ChangeDetectionEndpoints.submit_validation(request)
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """Handle statistics retrieval"""
        return ChangeDetectionEndpoints.get_statistics(request)