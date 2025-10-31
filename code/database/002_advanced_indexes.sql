-- =============================================================================
-- Migration: Add advanced spatial optimization indexes
-- File: 002_advanced_indexes.sql
-- Description: Additional indexes for high-performance spatial queries
-- =============================================================================

-- Advanced spatial indexes for performance optimization
-- These are created after the main schema to avoid interfering with initial loads

-- R-tree spatial indexes for better spatial query performance
CREATE INDEX CONCURRENTLY idx_detections_geom_rtree ON detections USING RTREE (geom) WHERE status != 'archived';
CREATE INDEX CONCURRENTLY idx_watersheds_geom_rtree ON watersheds USING RTREE (geom) WHERE is_active = TRUE;

-- Composite spatial indexes for complex queries
CREATE INDEX CONCURRENTLY idx_detections_spatial_temporal ON detections USING GIST (geom, detection_date) WHERE status IN ('new', 'confirmed');
CREATE INDEX CONCURRENTLY idx_time_series_spatial_temporal ON time_series USING GIST (location, observation_date);

-- Spatial clustering indexes for better spatial locality
CREATE INDEX CONCURRENTLY idx_detections_geom_clustered ON detections USING GIST (ST_ClusterDBSCAN(geom, 0.01, 5) OVER()) 
WHERE status IN ('new', 'confirmed');

-- Time-series specific optimizations for TimescaleDB
CREATE INDEX CONCURRENTLY idx_time_series_chunks ON time_series USING BRIN (observation_date, watershed_id) WITH (pages_per_range = 16);

-- Partial indexes for active/hot data
CREATE INDEX CONCURRENTLY idx_recent_detections ON detections (detection_date DESC) 
WHERE detection_date >= CURRENT_DATE - INTERVAL '1 year' AND status IN ('new', 'confirmed');

CREATE INDEX CONCURRENTLY idx_active_time_series ON time_series (observation_date DESC) 
WHERE observation_date >= CURRENT_DATE - INTERVAL '2 years';

-- Text search optimization for full-text queries
CREATE INDEX CONCURRENTLY idx_watersheds_search ON watersheds USING GIN (
    to_tsvector('english', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(ecosystem_type, ''))
);

CREATE INDEX CONCURRENTLY idx_detections_search ON detections USING GIN (
    to_tsvector('english', disturbance_type::text || ' ' || COALESCE(severity_level, ''))
);

-- JSONB indexes for flexible querying
CREATE INDEX CONCURRENTLY idx_quality_flags ON time_series USING GIN (quality_flags) WHERE quality_flags IS NOT NULL;

-- Spatial proximity indexes for distance-based queries
CREATE INDEX CONCURRENTLY idx_detections_nearest ON detections USING GIST (ST_Buffer(geom, 1000)) WHERE status IN ('new', 'confirmed');

-- Hash indexes for equality lookups (useful for joins)
CREATE INDEX CONCURRENTLY idx_watersheds_code_hash ON watersheds USING HASH (code);
CREATE INDEX CONCURRENTLY idx_users_username_hash ON users USING HASH (username);

-- Function-based indexes for computed spatial properties
CREATE INDEX CONCURRENTLY idx_detections_area_calc ON detections (ST_Area(geom::geography)) WHERE area_hectares > 0.1;

-- Multi-column BRIN indexes for efficient scanning of large time-series
CREATE INDEX CONCURRENTLY idx_time_series_multi_brin ON time_series USING BRIN (watershed_id, observation_date, satellite_sensor);

-- Specialized indexes for algorithm-specific queries
CREATE INDEX CONCURRENTLY idx_detections_landtrendr ON detections (primary_algorithm, detection_date) 
WHERE primary_algorithm = 'LandTrendr';

CREATE INDEX CONCURRENTLY idx_detections_fnrt ON detections (primary_algorithm, detection_date) 
WHERE primary_algorithm = 'FNRT';

-- Confidence-based filtering indexes
CREATE INDEX CONCURRENTLY idx_high_confidence_detections ON detections (watershed_id, confidence_score DESC) 
WHERE confidence_score > 0.8;

-- Spatially clustered detection analysis
CREATE INDEX CONCURRENTLY idx_detection_clusters ON detections USING GIST (ST_ConvexHull(ST_Collect(geom)) OVER()) 
WHERE status IN ('new', 'confirmed');

-- Add statistics collection for better query planning
ANALYZE watersheds;
ANALYZE detections;
ANALYZE time_series;
ANALYZE baselines;
ANALYZE users;
ANALYZE alerts;
ANALYZE quality_control;