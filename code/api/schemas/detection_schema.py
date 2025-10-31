"""
Change Detection Data Schemas

This module defines the data schemas and models for change detection
in the Watershed Disturbance Mapping System API.

Schemas:
- Change detection models and relationships
- Time series data schemas
- Validation feedback schemas
- Spectral index schemas

Author: Watershed Disturbance Mapping System
Version: 1.0.0
"""

from datetime import datetime, date
from typing import Dict, Any, List, Optional, Union
from decimal import Decimal
import json
import uuid

from django.db import models
from django.contrib.gis.db import models as gis_models
from django.contrib.gis.geos import Point, Polygon, MultiPolygon
from django.core.validators import MinValueValidator, MaxValueValidator, MinLengthValidator
from django.utils import timezone


class ChangeDetection(models.Model):
    """
    Model representing a detected change in a watershed.
    
    Stores information about disturbances detected through satellite
    imagery analysis including confidence scores, disturbance types,
    spatial extent, and temporal information.
    """
    
    # Primary identification
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False,
        help_text="Unique change detection identifier"
    )
    
    # Watershed relationship
    watershed = models.ForeignKey(
        'Watershed',
        on_delete=models.CASCADE,
        related_name='detections',
        help_text="Watershed where change was detected"
    )
    
    # Spatial information
    geometry = gis_models.GeometryField(
        srid=4326,
        help_text="Detected change area geometry"
    )
    
    area_hectares = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        validators=[MinValueValidator(0)],
        help_text="Area affected by change in hectares"
    )
    
    # Temporal information
    detection_date = models.DateField(
        help_text="Date when change was first detected"
    )
    
    acquisition_date = models.DateField(
        help_text="Date of satellite image used for detection"
    )
    
    # Classification and confidence
    DISTURBANCE_TYPES = [
        ('fire', 'Fire/Forest Fire'),
        ('harvest', 'Timber Harvest'),
        ('clearing', 'Land Clearing'),
        ('flooding', 'Flooding'),
        ('infrastructure', 'Infrastructure Development'),
        ('storm_damage', 'Storm Damage'),
        ('disease', 'Disease/Pest Infestation'),
        ('invasive_species', 'Invasive Species Spread'),
        ('other', 'Other')
    ]
    
    disturbance_type = models.CharField(
        max_length=50,
        choices=DISTURBANCE_TYPES,
        help_text="Type of disturbance detected"
    )
    
    confidence_score = models.DecimalField(
        max_digits=4,
        decimal_places=3,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="Confidence score of detection (0.0 to 1.0)"
    )
    
    # Detection metadata
    ALGORITHM_CHOICES = [
        ('landtrendr', 'LandTrendr'),
        ('fnrt', 'FNRT (Forest Near Real-Time)'),
        ('combined', 'Combined Algorithm'),
        ('manual', 'Manual Detection')
    ]
    
    algorithm = models.CharField(
        max_length=20,
        choices=ALGORITHM_CHOICES,
        default='combined',
        help_text="Algorithm used for detection"
    )
    
    source_sensor = models.CharField(
        max_length=20,
        choices=[
            ('landsat8', 'Landsat 8'),
            ('landsat9', 'Landsat 9'),
            ('sentinel2', 'Sentinel-2'),
            ('multiple', 'Multiple Sensors')
        ],
        help_text="Satellite sensor used for detection"
    )
    
    # Status and validation
    STATUS_CHOICES = [
        ('new', 'New'),
        ('confirmed', 'Confirmed'),
        ('false_positive', 'False Positive'),
        ('resolved', 'Resolved'),
        ('archived', 'Archived')
    ]
    
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='new',
        help_text="Current status of detection"
    )
    
    # Spectral change information
    spectral_changes = models.JSONField(
        default=dict,
        blank=True,
        help_text="Spectral index changes (NDVI, NBR, etc.)"
    )
    
    algorithmic_details = models.JSONField(
        default=dict,
        blank=True,
        help_text="Algorithm-specific processing details"
    )
    
    # Quality metrics
    data_quality_score = models.DecimalField(
        max_digits=4,
        decimal_places=3,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        null=True,
        blank=True,
        help_text="Data quality score for this detection"
    )
    
    # Cloud and quality indicators
    cloud_coverage_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        null=True,
        blank=True,
        help_text="Cloud coverage percentage in detection area"
    )
    
    # Related detections
    related_detections = models.ManyToManyField(
        'self',
        symmetrical=True,
        blank=True,
        related_name='related_to',
        help_text="Related change detections"
    )
    
    # Timestamps
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Detection record creation timestamp"
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Last update timestamp"
    )
    
    class Meta:
        db_table = 'change_detections'
        ordering = ['-detection_date', '-confidence_score']
        indexes = [
            models.Index(fields=['watershed']),
            models.Index(fields=['detection_date']),
            models.Index(fields=['confidence_score']),
            models.Index(fields=['disturbance_type']),
            models.Index(fields=['status']),
            models.Index(fields=['algorithm']),
            models.Index(fields=['source_sensor']),
            gis_models.Index(fields=['geometry']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.disturbance_type} - {self.detection_date} ({self.id})"
    
    def save(self, *args, **kwargs):
        """Save detection with automatic calculations"""
        # Calculate area if geometry is provided
        if self.geometry:
            area_sq_m = self.geometry.area
            self.area_hectares = round(Decimal(str(area_sq_m)) / Decimal('10000'), 4)
        
        super().save(*args, **kwargs)
    
    def get_severity_level(self) -> str:
        """
        Get severity level based on area and confidence score.
        
        Returns:
            str: Severity level (low, medium, high, critical)
        """
        if self.confidence_score >= 0.9 and self.area_hectares >= 1.0:
            return 'critical'
        elif self.confidence_score >= 0.8 and self.area_hectares >= 0.5:
            return 'high'
        elif self.confidence_score >= 0.7 and self.area_hectares >= 0.1:
            return 'medium'
        else:
            return 'low'
    
    def get_validation_score(self) -> Optional[Decimal]:
        """
        Get validation score based on user feedback.
        
        Returns:
            Decimal: Validation score (0.0 to 1.0) or None if no validation
        """
        from django.db.models import Avg
        from .models import ValidationFeedback
        
        validation_feedback = ValidationFeedback.objects.filter(detection=self)
        if validation_feedback.exists():
            return validation_feedback.aggregate(
                avg_score=Avg('validation_score')
            )['avg_score']
        
        return None


class TimeSeriesData(models.Model):
    """
    Model for storing time series spectral index data for detections.
    
    Each record represents spectral index values at a specific date
    for a specific detection area or pixel.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    detection = models.ForeignKey(
        ChangeDetection,
        on_delete=models.CASCADE,
        related_name='timeseries_data'
    )
    
    observation_date = models.DateField(
        help_text="Date of satellite observation"
    )
    
    satellite_data = models.ForeignKey(
        'SatelliteData',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='timeseries_data'
    )
    
    # Spectral indices
    NDVI = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Normalized Difference Vegetation Index"
    )
    
    NBR = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Normalized Burn Ratio"
    )
    
    TCG = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Tasseled Cap Greenness"
    )
    
    NDWI = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Normalized Difference Water Index"
    )
    
    EVI = models.DecimalField(
        max_digits=6,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Enhanced Vegetation Index"
    )
    
    # Additional spectral indices
    red = models.DecimalField(
        max_digits=8,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Red band reflectance"
    )
    
    nir = models.DecimalField(
        max_digits=8,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Near-infrared band reflectance"
    )
    
    swir1 = models.DecimalField(
        max_digits=8,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Short-wave infrared band 1 reflectance"
    )
    
    swir2 = models.DecimalField(
        max_digits=8,
        decimal_places=6,
        null=True,
        blank=True,
        help_text="Short-wave infrared band 2 reflectance"
    )
    
    # Quality indicators
    QUALITY_FLAGS = [
        ('good', 'Good Quality'),
        ('moderate', 'Moderate Quality'),
        ('poor', 'Poor Quality'),
        ('cloud', 'Cloud Contaminated'),
        ('shadow', 'Cloud Shadow'),
        ('snow', 'Snow/Ice Contaminated'),
        ('water', 'Water Contaminated')
    ]
    
    quality_flag = models.CharField(
        max_length=20,
        choices=QUALITY_FLAGS,
        default='good',
        help_text="Data quality flag"
    )
    
    cloud_coverage_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(0), MaxValueValidator(100)],
        null=True,
        blank=True,
        help_text="Cloud coverage percentage"
    )
    
    pixel_location = gis_models.PointField(
        srid=4326,
        null=True,
        blank=True,
        help_text="Location of pixel or region center"
    )
    
    # Metadata
    processing_date = models.DateTimeField(
        help_text="Date when data was processed"
    )
    
    source_metadata = models.JSONField(
        default=dict,
        blank=True,
        help_text="Original satellite data metadata"
    )
    
    class Meta:
        db_table = 'time_series_data'
        ordering = ['observation_date']
        unique_together = ['detection', 'observation_date', 'satellite_data']
        indexes = [
            models.Index(fields=['detection']),
            models.Index(fields=['observation_date']),
            models.Index(fields=['quality_flag']),
            gis_models.Index(fields=['pixel_location']),
        ]
    
    def __str__(self):
        return f"{self.detection.id} - {self.observation_date}"


class ValidationFeedback(models.Model):
    """
    Model for storing user validation feedback on change detections.
    
    Allows users to validate, correct, or provide feedback on
    automatically detected changes.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    detection = models.ForeignKey(
        ChangeDetection,
        on_delete=models.CASCADE,
        related_name='validation_feedback'
    )
    
    user = models.ForeignKey(
        'User',
        on_delete=models.CASCADE,
        related_name='validation_feedback'
    )
    
    # Validation type
    VALIDATION_TYPES = [
        ('correct', 'Correct Detection'),
        ('false_positive', 'False Positive'),
        ('inaccurate_location', 'Inaccurate Location'),
        ('inaccurate_type', 'Inaccurate Disturbance Type'),
        ('partial_detection', 'Partial Detection'),
        ('needs_review', 'Needs Review')
    ]
    
    validation_type = models.CharField(
        max_length=25,
        choices=VALIDATION_TYPES,
        help_text="Type of validation feedback"
    )
    
    # Validation score (0.0 to 1.0)
    validation_score = models.DecimalField(
        max_digits=4,
        decimal_places=3,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        null=True,
        blank=True,
        help_text="User confidence in detection (0.0 to 1.0)"
    )
    
    # Ground truth information (for corrections)
    ground_truth_disturbance_type = models.CharField(
        max_length=50,
        choices=ChangeDetection.DISTURBANCE_TYPES,
        null=True,
        blank=True,
        help_text="Correct disturbance type (if correction provided)"
    )
    
    ground_truth_date = models.DateField(
        null=True,
        blank=True,
        help_text="Actual date of disturbance (if correction provided)"
    )
    
    confidence_override = models.DecimalField(
        max_digits=4,
        decimal_places=3,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        null=True,
        blank=True,
        help_text="User-provided confidence score override"
    )
    
    # Feedback text
    comments = models.TextField(
        blank=True,
        help_text="User comments and feedback"
    )
    
    ground_truth_notes = models.TextField(
        blank=True,
        help_text="Notes about ground truth data"
    )
    
    # Field validation
    field_validation_data = models.JSONField(
        default=dict,
        blank=True,
        help_text="Structured field validation data (GPS, photos, etc.)"
    )
    
    # Metadata
    created_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Feedback submission timestamp"
    )
    
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Last update timestamp"
    )
    
    class Meta:
        db_table = 'validation_feedback'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['detection']),
            models.Index(fields=['user']),
            models.Index(fields=['validation_type']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.validation_type} - {self.detection.id}"


class SpectralIndex(models.Model):
    """
    Model for storing computed spectral indices for satellite data.
    
    Provides detailed spectral analysis results that can be used
    for change detection and analysis.
    """
    
    id = models.UUIDField(
        primary_key=True,
        default=uuid.uuid4,
        editable=False
    )
    
    satellite_data = models.ForeignKey(
        'SatelliteData',
        on_delete=models.CASCADE,
        related_name='spectral_indices'
    )
    
    detection = models.ForeignKey(
        ChangeDetection,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='spectral_indices'
    )
    
    # Index identification
    index_name = models.CharField(
        max_length=20,
        choices=[
            ('NDVI', 'Normalized Difference Vegetation Index'),
            ('NBR', 'Normalized Burn Ratio'),
            ('TCG', 'Tasseled Cap Greenness'),
            ('NDWI', 'Normalized Difference Water Index'),
            ('EVI', 'Enhanced Vegetation Index'),
            ('SAVI', 'Soil Adjusted Vegetation Index'),
            ('ARVI', 'Atmospherically Resistant Vegetation Index'),
            ('GNDVI', 'Green Normalized Difference Vegetation Index')
        ],
        help_text="Name of spectral index"
    )
    
    # Index value and quality
    index_value = models.DecimalField(
        max_digits=8,
        decimal_places=6,
        help_text="Computed index value"
    )
    
    QUALITY_LEVELS = [
        ('excellent', 'Excellent'),
        ('good', 'Good'),
        ('fair', 'Fair'),
        ('poor', 'Poor'),
        ('invalid', 'Invalid')
    ]
    
    quality_flag = models.CharField(
        max_length=20,
        choices=QUALITY_LEVELS,
        default='good',
        help_text="Quality assessment of index value"
    )
    
    # Spatial information
    pixel_location = gis_models.PointField(
        srid=4326,
        help_text="Location of pixel or region center"
    )
    
    # Source information
    pixel_coordinates = models.JSONField(
        help_text="Original pixel coordinates in satellite image"
    )
    
    # Processing metadata
    calculated_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Index calculation timestamp"
    )
    
    processing_parameters = models.JSONField(
        default=dict,
        blank=True,
        help_text="Parameters used for index calculation"
    )
    
    class Meta:
        db_table = 'spectral_indices'
        ordering = ['-calculated_at']
        indexes = [
            models.Index(fields=['satellite_data']),
            models.Index(fields=['detection']),
            models.Index(fields=['index_name']),
            models.Index(fields=['quality_flag']),
            gis_models.Index(fields=['pixel_location']),
        ]
    
    def __str__(self):
        return f"{self.index_name} = {self.index_value}"


# Schema validation functions
def validate_detection_schema(data: Dict[str, Any]) -> bool:
    """
    Validate change detection data against schema requirements.
    
    Args:
        data: Change detection data dictionary
        
    Returns:
        bool: True if valid, False otherwise
        
    Raises:
        ValueError: If validation fails
    """
    required_fields = ['watershed_id', 'detection_date', 'disturbance_type']
    
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Required field '{field}' is missing")
    
    # Validate watershed_id
    try:
        uuid.UUID(data['watershed_id'])
    except ValueError:
        raise ValueError("watershed_id must be a valid UUID")
    
    # Validate detection_date
    try:
        datetime.strptime(data['detection_date'], '%Y-%m-%d').date()
    except ValueError:
        raise ValueError("detection_date must be in YYYY-MM-DD format")
    
    # Validate confidence_score
    if 'confidence_score' in data:
        conf = data['confidence_score']
        if not 0.0 <= conf <= 1.0:
            raise ValueError("confidence_score must be between 0.0 and 1.0")
    
    # Validate disturbance_type
    valid_types = [choice[0] for choice in ChangeDetection.DISTURBANCE_TYPES]
    if data['disturbance_type'] not in valid_types:
        raise ValueError(f"disturbance_type must be one of: {valid_types}")
    
    return True


def validate_timeseries_schema(data: Dict[str, Any]) -> bool:
    """
    Validate time series data against schema requirements.
    
    Args:
        data: Time series data dictionary
        
    Returns:
        bool: True if valid, False otherwise
    """
    required_fields = ['detection_id', 'observation_date']
    
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Required field '{field}' is missing")
    
    # Validate observation_date
    try:
        datetime.strptime(data['observation_date'], '%Y-%m-%d').date()
    except ValueError:
        raise ValueError("observation_date must be in YYYY-MM-DD format")
    
    # Validate that at least one index is provided
    index_fields = ['NDVI', 'NBR', 'TCG', 'NDWI', 'EVI']
    if not any(data.get(field) is not None for field in index_fields):
        raise ValueError("At least one spectral index must be provided")
    
    return True


def validate_validation_feedback_schema(data: Dict[str, Any]) -> bool:
    """
    Validate validation feedback against schema requirements.
    
    Args:
        data: Validation feedback data dictionary
        
    Returns:
        bool: True if valid, False otherwise
    """
    required_fields = ['detection_id', 'validation_type']
    
    for field in required_fields:
        if field not in data:
            raise ValueError(f"Required field '{field}' is missing")
    
    # Validate validation_type
    valid_types = [choice[0] for choice in ValidationFeedback.VALIDATION_TYPES]
    if data['validation_type'] not in valid_types:
        raise ValueError(f"validation_type must be one of: {valid_types}")
    
    # Validate validation_score if provided
    if 'validation_score' in data:
        score = data['validation_score']
        if not 0.0 <= score <= 1.0:
            raise ValueError("validation_score must be between 0.0 and 1.0")
    
    return True


# Export schema definitions
DETECTION_EXPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "id": {"type": "string", "format": "uuid"},
        "watershed_id": {"type": "string", "format": "uuid"},
        "detection_date": {"type": "string", "format": "date"},
        "acquisition_date": {"type": "string", "format": "date"},
        "disturbance_type": {"type": "string"},
        "confidence_score": {"type": "number", "minimum": 0, "maximum": 1},
        "area_hectares": {"type": "number", "minimum": 0},
        "algorithm": {"type": "string"},
        "source_sensor": {"type": "string"},
        "status": {"type": "string"},
        "spectral_changes": {"type": "object"},
        "geometry": {"type": "object"},
        "created_at": {"type": "string", "format": "date-time"},
        "updated_at": {"type": "string", "format": "date-time"}
    },
    "required": [
        "id", "watershed_id", "detection_date", "disturbance_type",
        "confidence_score", "area_hectares", "algorithm"
    ]
}


TIMESERIES_EXPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "detection_id": {"type": "string", "format": "uuid"},
        "observation_date": {"type": "string", "format": "date"},
        "NDVI": {"type": "number"},
        "NBR": {"type": "number"},
        "TCG": {"type": "number"},
        "NDWI": {"type": "number"},
        "EVI": {"type": "number"},
        "quality_flag": {"type": "string"},
        "cloud_coverage_percent": {"type": "number", "minimum": 0, "maximum": 100},
        "processing_date": {"type": "string", "format": "date-time"}
    },
    "required": [
        "detection_id", "observation_date", "quality_flag"
    ]
}


VALIDATION_EXPORT_SCHEMA = {
    "type": "object",
    "properties": {
        "detection_id": {"type": "string", "format": "uuid"},
        "validation_type": {"type": "string"},
        "validation_score": {"type": "number", "minimum": 0, "maximum": 1},
        "ground_truth_disturbance_type": {"type": "string"},
        "ground_truth_date": {"type": "string", "format": "date"},
        "comments": {"type": "string"},
        "created_at": {"type": "string", "format": "date-time"}
    },
    "required": [
        "detection_id", "validation_type"
    ]
}