-- =============================================================================
-- Watershed Disturbance Mapping System - Database Schema
-- PostgreSQL 14 + PostGIS 3.2 + TimescaleDB
-- 
-- This script creates the initial database schema for the watershed disturbance
-- mapping system, including spatial indexes, time-series optimization, and
-- comprehensive data integrity constraints.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =============================================================================
-- ENUMS AND CUSTOM TYPES
-- =============================================================================

CREATE TYPE disturbance_type_enum AS ENUM (
    'logging',
    'clearing',
    'fire',
    'flooding', 
    'infrastructure_development',
    'agricultural_expansion',
    'mining',
    'unknown'
);

CREATE TYPE detection_status_enum AS ENUM (
    'new',
    'confirmed', 
    'false_positive',
    'resolved',
    'archived'
);

CREATE TYPE user_role_enum AS ENUM (
    'admin',
    'analyst', 
    'viewer',
    'field_worker'
);

CREATE TYPE alert_status_enum AS ENUM (
    'pending',
    'sent',
    'delivered',
    'failed',
    'cancelled',
    'acknowledged'
);

CREATE TYPE quality_status_enum AS ENUM (
    'passed',
    'warning',
    'failed',
    'pending_review'
);

CREATE TYPE satellite_sensor_enum AS ENUM (
    'landsat_8',
    'landsat_9',
    'sentinel_2a',
    'sentinel_2b',
    'sentinel_1'
);

-- =============================================================================
-- CORE SPATIAL TABLES
-- =============================================================================

-- Watershed boundaries table
CREATE TABLE watersheds (
    watershed_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    area_hectares NUMERIC(15,2),
    
    -- Spatial geometry (watershed boundary)
    geom GEOMETRY(POLYGON, 4326) NOT NULL,
    centroid GEOMETRY(POINT, 4326),
    
    -- Metadata
    ecosystem_type VARCHAR(100),
    administrative_region VARCHAR(100),
    climate_zone VARCHAR(50),
    
    -- Status and timestamps
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);

-- Disturbance detections table
CREATE TABLE detections (
    detection_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watershed_id UUID NOT NULL REFERENCES watersheds(watershed_id),
    
    -- Detection details
    detection_date DATE NOT NULL,
    disturbance_type disturbance_type_enum NOT NULL,
    confidence_score NUMERIC(5,4) NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 1),
    status detection_status_enum DEFAULT 'new',
    
    -- Spatial information
    geom GEOMETRY(POLYGON, 4326) NOT NULL,
    area_hectares NUMERIC(10,4) NOT NULL CHECK (area_hectares > 0),
    perimeter_meters NUMERIC(15,2),
    
    -- Detection metrics
    severity_level VARCHAR(20) CHECK (severity_level IN ('low', 'medium', 'high')),
    spectral_change_magnitude NUMERIC(10,4),
    
    -- Algorithm metadata
    primary_algorithm VARCHAR(50) NOT NULL, -- 'LandTrendr', 'FNRT', 'U-Net'
    secondary_algorithm VARCHAR(50),
    processing_date TIMESTAMPTZ DEFAULT NOW(),
    
    -- Validation
    validation_status VARCHAR(20) DEFAULT 'pending',
    validated_by UUID,
    validated_at TIMESTAMPTZ,
    field_validation_date DATE,
    
    -- Tracking
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    
    CONSTRAINT check_confidence_threshold CHECK (
        (confidence_score > 0.8 AND status = 'new') OR 
        (confidence_score <= 0.8) OR
        status != 'new'
    ),
    CONSTRAINT check_area_threshold CHECK (area_hectares >= 0.04) -- Minimum detectable size
);

-- Time-series spectral data (optimized with TimescaleDB)
CREATE TABLE time_series (
    series_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watershed_id UUID NOT NULL REFERENCES watersheds(watershed_id),
    location GEOMETRY(POINT, 4326) NOT NULL,
    
    -- Temporal data
    observation_date DATE NOT NULL,
    acquisition_time TIMESTAMPTZ NOT NULL,
    
    -- Satellite metadata
    satellite_sensor satellite_sensor_enum NOT NULL,
    scene_id VARCHAR(100),
    cloud_cover_percentage NUMERIC(5,2),
    
    -- Spectral indices
    ndvi NUMERIC(6,4),
    nbr NUMERIC(6,4), 
    tcg NUMERIC(6,4),
    
    -- Atmospheric corrected reflectance values
    band_blue NUMERIC(8,4),
    band_green NUMERIC(8,4),
    band_red NUMERIC(8,4),
    band_nir NUMERIC(8,4),
    band_swir1 NUMERIC(8,4),
    band_swir2 NUMERIC(8,4),
    
    -- Quality metrics
    data_quality_score NUMERIC(3,2) CHECK (data_quality_score >= 0 AND data_quality_score <= 1),
    valid_pixels_count INTEGER,
    
    -- Processing metadata
    processing_version VARCHAR(20),
    quality_flags TEXT[],
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_location_date_sensor UNIQUE (location, observation_date, satellite_sensor)
);

-- Convert to TimescaleDB hypertable for time-series optimization
SELECT create_hypertable('time_series', 'observation_date', 'location', 2);

-- =============================================================================
-- BASELINE AND REFERENCE DATA
-- =============================================================================

-- Baseline reference conditions by ecosystem type
CREATE TABLE baselines (
    baseline_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watershed_id UUID NOT NULL REFERENCES watersheds(watershed_id),
    ecosystem_type VARCHAR(100) NOT NULL,
    
    -- Reference period
    baseline_start_date DATE NOT NULL,
    baseline_end_date DATE NOT NULL,
    
    -- Spectral baselines (rolling 3-year median)
    baseline_ndvi_mean NUMERIC(6,4),
    baseline_ndvi_std NUMERIC(6,4),
    baseline_nbr_mean NUMERIC(6,4),
    baseline_nbr_std NUMERIC(6,4),
    baseline_tcg_mean NUMERIC(6,4),
    baseline_tcg_std NUMERIC(6,4),
    
    -- Spatial reference
    baseline_geom GEOMETRY(POLYGON, 4326),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT valid_baseline_period CHECK (baseline_end_date > baseline_start_date)
);

-- =============================================================================
-- USER MANAGEMENT
-- =============================================================================

CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL, -- Will be handled by application
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    
    -- RBAC
    role user_role_enum NOT NULL DEFAULT 'viewer',
    
    -- Profile
    organization VARCHAR(255),
    phone_number VARCHAR(20),
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences and alert settings
CREATE TABLE user_preferences (
    preference_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    
    -- Alert preferences
    email_alerts BOOLEAN DEFAULT TRUE,
    sms_alerts BOOLEAN DEFAULT FALSE,
    webhook_enabled BOOLEAN DEFAULT FALSE,
    webhook_url TEXT,
    
    -- Confidence thresholds
    min_confidence_threshold NUMERIC(5,4) DEFAULT 0.8,
    max_confidence_threshold NUMERIC(5,4) DEFAULT 1.0,
    
    -- Area filters
    min_area_hectares NUMERIC(10,4) DEFAULT 0.5,
    
    -- Spatial filters
    proximity_buffer_meters INTEGER DEFAULT 100,
    
    -- Notification settings
    alert_frequency VARCHAR(20) DEFAULT 'immediate', -- 'immediate', 'daily', 'weekly'
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ALERT SYSTEM
-- =============================================================================

CREATE TABLE alerts (
    alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    detection_id UUID NOT NULL REFERENCES detections(detection_id),
    user_id UUID NOT NULL REFERENCES users(user_id),
    
    -- Alert content
    alert_type VARCHAR(50) NOT NULL, -- 'high_confidence', 'large_area', 'sensitive_location'
    subject VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Status tracking
    status alert_status_enum DEFAULT 'pending',
    
    -- Notification channels
    email_sent BOOLEAN DEFAULT FALSE,
    sms_sent BOOLEAN DEFAULT FALSE,
    webhook_sent BOOLEAN DEFAULT FALSE,
    
    -- Delivery tracking
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    failure_reason TEXT,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT unique_alert_detection_user UNIQUE (detection_id, user_id)
);

-- =============================================================================
-- QUALITY CONTROL
-- =============================================================================

CREATE TABLE quality_control (
    qc_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watershed_id UUID NOT NULL REFERENCES watersheds(watershed_id),
    
    -- QC metrics
    cloud_coverage_threshold NUMERIC(5,2) DEFAULT 30.0,
    min_valid_observations INTEGER DEFAULT 3,
    observation_window_days INTEGER DEFAULT 90,
    
    -- Data quality scores
    overall_quality_score NUMERIC(3,2) CHECK (overall_quality_score >= 0 AND overall_quality_score <= 1),
    spatial_coherence_score NUMERIC(3,2),
    temporal_consistency_score NUMERIC(3,2),
    
    -- Quality assessment
    quality_status quality_status_enum DEFAULT 'pending_review',
    quality_notes TEXT,
    
    -- Assessment details
    assessed_by UUID REFERENCES users(user_id),
    assessed_at TIMESTAMPTZ,
    
    -- Timestamps
    processed_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Quality control details for individual detections
CREATE TABLE detection_quality_metrics (
    metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    detection_id UUID NOT NULL REFERENCES detections(detection_id),
    qc_id UUID NOT NULL REFERENCES quality_control(qc_id),
    
    -- Individual metrics
    spatial_coherence NUMERIC(3,2),
    temporal_persistence INTEGER, -- Number of confirming observations
    spectral_consistency NUMERIC(3,2),
    false_positive_probability NUMERIC(5,4),
    
    -- Validation flags
    requires_field_validation BOOLEAN DEFAULT FALSE,
    validated_in_field BOOLEAN DEFAULT FALSE,
    field_validation_date DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- AUDIT TRAIL (for tracking changes)
-- =============================================================================

CREATE TABLE audit_log (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values JSONB,
    new_values JSONB,
    changed_by UUID REFERENCES users(user_id),
    changed_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT
);

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_watersheds_updated_at BEFORE UPDATE ON watersheds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_detections_updated_at BEFORE UPDATE ON detections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_baselines_updated_at BEFORE UPDATE ON baselines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_user_preferences_updated_at BEFORE UPDATE ON user_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_alerts_updated_at BEFORE UPDATE ON alerts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_quality_control_updated_at BEFORE UPDATE ON quality_control FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update centroid when watershed geometry changes
CREATE OR REPLACE FUNCTION update_watershed_centroid()
RETURNS TRIGGER AS $$
BEGIN
    IF ST_GeometryType(NEW.geom) = 'ST_Polygon' THEN
        NEW.centroid = ST_Centroid(NEW.geom);
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_watershed_centroid_trigger BEFORE INSERT OR UPDATE ON watersheds 
FOR EACH ROW EXECUTE FUNCTION update_watershed_centroid();

-- =============================================================================
-- CREATE INDEXES FOR PERFORMANCE OPTIMIZATION
-- =============================================================================

-- Spatial indexes using GiST for optimal spatial query performance
CREATE INDEX idx_watersheds_geom ON watersheds USING GIST (geom);
CREATE INDEX idx_watersheds_centroid ON watersheds USING GIST (centroid);
CREATE INDEX idx_detections_geom ON detections USING GIST (geom);
CREATE INDEX idx_time_series_location ON time_series USING GIST (location);
CREATE INDEX idx_baselines_geom ON baselines USING GIST (baseline_geom);

-- Temporal indexes for time-series optimization
CREATE INDEX idx_time_series_date ON time_series (observation_date DESC);
CREATE INDEX idx_time_series_sensor_date ON time_series (satellite_sensor, observation_date DESC);
CREATE INDEX idx_detections_date ON detections (detection_date DESC);
CREATE INDEX idx_detections_status_date ON detections (status, detection_date DESC);

-- B-tree indexes for common query patterns
CREATE INDEX idx_watersheds_code ON watersheds (code);
CREATE INDEX idx_watersheds_active ON watersheds (is_active) WHERE is_active = TRUE;
CREATE INDEX idx_detections_type_status ON detections (disturbance_type, status);
CREATE INDEX idx_detections_confidence ON detections (confidence_score DESC);
CREATE INDEX idx_detections_area ON detections (area_hectares DESC);
CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_alerts_status ON alerts (status);
CREATE INDEX idx_alerts_user_date ON alerts (user_id, created_at DESC);

-- Composite indexes for complex queries
CREATE INDEX idx_time_series_watershed_date ON time_series (watershed_id, observation_date DESC);
CREATE INDEX idx_detections_watershed_date ON detections (watershed_id, detection_date DESC);
CREATE INDEX idx_detections_confidence_area ON detections (watershed_id, confidence_score DESC, area_hectares DESC);

-- Partial indexes for active records
CREATE INDEX idx_active_watersheds ON watersheds (name, code) WHERE is_active = TRUE;
CREATE INDEX idx_active_baselines ON baselines (watershed_id, ecosystem_type) WHERE is_active = TRUE;

-- BRIN indexes for large time-series tables (for TimescaleDB optimization)
CREATE INDEX idx_time_series_date_brin ON time_series USING BRIN (observation_date);
CREATE INDEX idx_time_series_watershed_brin ON time_series USING BRIN (watershed_id);

-- Text search indexes for full-text search
CREATE INDEX idx_watersheds_name_fts ON watersheds USING GIN (to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_detections_description_fts ON detections USING GIN (to_tsvector('english', detection_date::text));

-- JSONB indexes for audit log and quality metrics
CREATE INDEX idx_audit_log_table_record ON audit_log (table_name, record_id);
CREATE INDEX idx_audit_log_changed_at ON audit_log (changed_at DESC);
CREATE INDEX idx_detection_quality_metrics_false_positive ON detection_quality_metrics (false_positive_probability);

COMMIT;