"""
Data Schemas for Watershed Management

This module defines the data schemas and models for watershed management
in the Watershed Disturbance Mapping System API.

Schemas:
- Watershed model and relationships
- Spatial data schemas
- Metadata schemas
- Configuration schemas

Author: Watershed Disturbance Mapping System
Version: 1.0.0
"""

from datetime import datetime
from typing import Dict, Any, List, Optional, Union
from decimal import Decimal
import json
import uuid

from django.db import models
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point, Polygon, MultiPolygon
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone


class Watershed(models.Model):
    """
    Watershed model representing a geographic watershed area.
    
    A watershed is a hydrologic unit that collects and drains surface water
    to a common outlet. This model stores watershed boundaries, metadata,
    and configuration for monitoring and analysis.
    """
    
    # Primary identification
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique watershed identifier"
    )
    
    # Basic information
    name = models.CharField(
        max_length=255,
        help_text="Watershed name"
    )
    
    description = models.TextField(
        blank=True,
        help_text="Detailed description of the watershed"
    )
    
    # Ownership and access control
    owner = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='watersheds',
        help_text="User who owns this watershed"
    )
    
    analysts = models.ManyToManyField(
        'User',
        blank=True,
        related_name='analyst_watersheds',
        help_text="Users with analyst access to this watershed"
    )
    
    viewers = models.ManyToManyField(
        'User',
        blank=True,
        related_name='viewer_watersheds',
        help_text="Users with viewer access to this watershed"
    )
    
    # Geographic data
    boundary = gis_models.GeometryField(
        srid=4326,
        help_text="Watershed boundary geometry (Polygon or MultiPolygon)"
    )
    
    centroid = gis_models.PointField(
        srid=4326,
        help_text="Watershed centroid coordinates"
    )
    
    bbox = gis_models.PolygonField(
        srid=4326,
        help_text="Bounding box of the watershed"
    )
    
    # Area calculations
    area_km2 = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(0)],
        help_text="Watershed area in square kilometers"
    )
    
    perimeter_km = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        validators=[MinValueValidator(0)],
        help_text="Watershed perimeter in kilometers",
        blank=True,
        null=True
    )
    
    # Geographic metadata
    crs = models.CharField(
        max_length=50,
        default='EPSG:4326',
        help_text="Coordinate Reference System used for spatial data"
    )
    
    # Status and lifecycle
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('archived', 'Archived'),
        ('deleted', 'Deleted')
    ]
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='active',
        help_text="Watershed status"
    )
    
    # Metadata and tags
    metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Additional metadata (region, rivers, climate, etc.)"
    )
    
    tags = models.JSONField(
        default=list,
        blank=True,
        help_text="Tags for categorizing and searching watersheds"
    )
    
    # Monitoring configuration
    algorithms_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Algorithm configuration (LandTrendr, FNRT parameters)"
    )
    
    monitoring_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Monitoring schedule and sensor preferences"
    )
    
    alert_config = models.JSONField(
        default=dict,
        blank=True,
        help_text="Alert thresholds and notification settings"
    )
    
    settings = models.JSONField(
        default=dict,
        blank=True,
        help_text="General watershed settings"
    )
    
    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Creation timestamp"
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Last update timestamp"
    )
    
    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Deletion timestamp for soft deletes"
    )
    
    class Meta:
        db_table = 'watersheds'
        ordering = ['name']
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['owner']),
            models.Index(fields=['status']),
            models.Index(fields=['created_at']),
            gis_models.Index(fields=['boundary']),
            gis_models.Index(fields=['centroid']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.id})"
    
    def save(self, *args, **kwargs):
        """Save watershed with automatic calculations"""
        # Calculate area, perimeter, and centroid if boundary is provided
        if self.boundary:
            # Calculate area in square kilometers
            area_sq_m = self.boundary.area
            self.area_km2 = round(Decimal(str(area_sq_m)) / Decimal('1000000'), 4)
            
            # Calculate perimeter in kilometers
            perimeter_m = self.boundary.length
            self.perimeter_km = round(Decimal(str(perimeter_m)) / Decimal('1000'), 4)
            
            # Calculate centroid
            self.centroid = self.boundary.centroid
            
            # Calculate bounding box
            self.bbox = self.boundary.envelope
        
        super().save(*args, **kwargs)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get watershed statistics"""
        from django.db.models import Count, Sum
        from .models import ChangeDetection
        
        stats = {
            'total_detections': 0,
            'confirmed_detections': 0,
            'total_area_disturbed': 0,
            'recent_activity': 0,
            'validation_coverage': 0
        }
        
        # Get detection statistics
        detections = ChangeDetection.objects.filter(watershed=self)
        
        if detections.exists():
            stats.update({
                'total_detections': detections.count(),
                'confirmed_detections': detections.filter(status='confirmed').count(),
                'total_area_disturbed': float(detections.aggregate(
                    total_area=Sum('area_hectares')
                )['total_area'] or 0),
                'recent_activity': detections.filter(
                    detection_date__gte=timezone.now().date() - timezone.timedelta(days=30)
                ).count()
            })
            
            # Validation coverage
            validated = detections.filter(validation_feedback__isnull=False).distinct().count()
            stats['validation_coverage'] = round(
                (validated / stats['total_detections']) * 100, 2
            ) if stats['total_detections'] > 0 else 0
        
        return stats


class WatershedGroup(models.Model):
    """
    Model for grouping multiple watersheds together for organization
    and batch operations.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    
    owner = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='watershed_groups'
    )
    
    watersheds = models.ManyToManyField(
        Watershed,
        related_name='groups',
        blank=True
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'watershed_groups'
        ordering = ['name']
    
    def __str__(self):
        return self.name


class WatershedMetadata(models.Model):
    """
    Extended metadata for watersheds including environmental,
    administrative, and descriptive information.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    watershed = models.OneToOneField(
        Watershed,
        on_delete=models.CASCADE,
        related_name='extended_metadata'
    )
    
    # Administrative information
    region = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    state_province = models.CharField(max_length=100, blank=True)
    
    # Environmental characteristics
    climate_zone = models.CharField(max_length=100, blank=True)
    ecosystem_type = models.CharField(max_length=100, blank=True)
    elevation_range = models.CharField(max_length=50, blank=True)
    
    # Hydrological information
    primary_river = models.CharField(max_length=100, blank=True)
    drainage_system = models.CharField(max_length=100, blank=True)
    watershed_order = models.IntegerField(null=True, blank=True)
    
    # Land use information
    dominant_land_use = models.CharField(max_length=100, blank=True)
    urban_area_percent = models.DecimalField(
        max_digits=5, decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        null=True, blank=True
    )
    
    forest_coverage_percent = models.DecimalField(
        max_digits=5, decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        null=True, blank=True
    )
    
    # Conservation status
    protected_area_status = models.CharField(max_length=100, blank=True)
    conservation_priority = models.CharField(
        max_length=50,
        choices=[
            ('low', 'Low'),
            ('medium', 'Medium'),
            ('high', 'High'),
            ('critical', 'Critical')
        ],
        blank=True
    )
    
    # Additional metadata
    custom_metadata = models.JSONField(default=dict, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'watershed_metadata'
    
    def __str__(self):
        return f"Metadata for {self.watershed.name}"


class WatershedSetting(models.Model):
    """
    User-specific settings and preferences for watershed management.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    watershed = models.ForeignKey(
        Watershed,
        on_delete=models.CASCADE,
        related_name='settings'
    )
    
    user = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='watershed_settings'
    )
    
    SETTING_TYPES = [
        ('display', 'Display Settings'),
        ('notification', 'Notification Settings'),
        ('export', 'Export Settings'),
        ('processing', 'Processing Settings'),
        ('custom', 'Custom Settings')
    ]
    
    setting_type = models.CharField(
        max_length=20,
        choices=SETTING_TYPES,
        default='display'
    )
    
    setting_name = models.CharField(max_length=100)
    setting_value = models.JSONField()
    
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'watershed_settings'
        unique_together = ['watershed', 'user', 'setting_type', 'setting_name']
        ordering = ['setting_type', 'setting_name']
    
    def __str__(self):
        return f"{self.setting_type}.{self.setting_name} for {self.watershed.name}"


class WatershedAuditLog(models.Model):
    """
    Audit log for tracking changes to watershed data and configuration.
    """
    
    id = models.BigAutoField(primary_key=True)
    
    watershed = models.ForeignKey(
        Watershed,
        on_delete=models.CASCADE,
        related_name='audit_logs'
    )
    
    user = models.ForeignKey(
        'User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='watershed_audit_logs'
    )
    
    action = models.CharField(
        max_length=50,
        choices=[
            ('create', 'Created'),
            ('update', 'Updated'),
            ('delete', 'Deleted'),
            ('restore', 'Restored'),
            ('archive', 'Archived'),
            ('activate', 'Activated'),
            ('deactivate', 'Deactivated')
        ]
    )
    
    field_changed = models.CharField(max_length=100, blank=True)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    
    timestamp = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'watershed_audit_logs'
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['watershed']),
            models.Index(fields=['user']),
            models.Index(fields=['timestamp']),
            models.Index(fields=['action']),
        ]
    
    def __str__(self):
        return f"{self.action} {self.watershed.name} at {self.timestamp}"


# Schema validation functions
def validate_watershed_schema(data: Dict[str, Any]) -> bool:
    """
    Validate watershed data against schema requirements.
    
    Args:
        data: Watershed data dictionary
        
    Returns:
        bool: True if valid, False otherwise
        
    Raises:
        ValueError: If validation fails
    """
    required_fields = ['name', 'boundary']
    
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Required field '{field}' is missing")
    
    # Validate name
    if not data['name'].strip():
        raise ValueError("Watershed name cannot be empty")
    
    # Validate boundary
    boundary = data['boundary']
    if not boundary.get('type') or not boundary.get('coordinates'):
        raise ValueError("Invalid boundary geometry")
    
    if boundary['type'] not in ['Polygon', 'MultiPolygon']:
        raise ValueError("Boundary must be Polygon or MultiPolygon")
    
    return True


def validate_watershed_metadata_schema(data: Dict[str, Any]) -> bool:
    """
    Validate watershed metadata against schema requirements.
    
    Args:
        data: Watershed metadata dictionary
        
    Returns:
        bool: True if valid, False otherwise
    """
    # Validate percentage fields
    percentage_fields = ['urban_area_percent', 'forest_coverage_percent']
    
    for field in percentage_fields:
        if field in data and data[field] is not None:
            if not 0 <= data[field] <= 100:
                raise ValueError(f"{field} must be between 0 and 100")
    
    # Validate conservation priority
    if 'conservation_priority' in data:
        valid_priorities = ['low', 'medium', 'high', 'critical']
        if data['conservation_priority'] not in valid_priorities:
            raise ValueError(f"Invalid conservation priority. Must be one of: {valid_priorities}")
    
    return True


# Export schema definitions
WATERSHED_EXPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string", "format": "uuid"},
        "name": {"type": "string", "minLength": 1},
        "description": {"type": "string"},
        "area_km2": {"type": "number", "minimum": 0},
        "perimeter_km": {"type": "number", "minimum": 0},
        "status": {"type": "string", "enum": ["active", "inactive", "archived", "deleted"]},
        "metadata": {"type": "object"},
        "tags": {
            "type": "array",
            "items": {"type": "string"}
        },
        "boundary": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["Polygon", "MultiPolygon"]},
                "coordinates": {"type": "array"}
            },
            "required": ["type", "coordinates"]
        },
        "created_at": {"type": "string", "format": "date-time"},
        "updated_at": {"type": "string", "format": "date-time"}
    },
    "required": ["id", "name", "boundary", "area_km2"]
}


WATERSHED_IMPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "name": {"type": "string", "minLength": 1},
        "description": {"type": "string"},
        "boundary": {
            "type": "object",
            "properties": {
                "type": {"type": "string", "enum": ["Polygon", "MultiPolygon"]},
                "coordinates": {"type": "array"}
            },
            "required": ["type", "coordinates"]
        },
        "metadata": {"type": "object"},
        "tags": {
            "type": "array",
            "items": {"type": "string"}
        }
    },
    "required": ["name", "boundary"]
}