-- =============================================================================
-- Migration Framework Setup
-- File: 003_migrations_framework.sql
-- Description: Framework for tracking and managing database migrations
-- =============================================================================

-- Create schema for migration tracking
CREATE SCHEMA IF NOT EXISTS schema_migrations;

-- Migration tracking table
CREATE TABLE schema_migrations.migrations (
    id SERIAL PRIMARY KEY,
    version VARCHAR(255) UNIQUE NOT NULL,
    description TEXT NOT NULL,
    applied_at TIMESTAMPTZ DEFAULT NOW(),
    checksum VARCHAR(64),
    applied_by VARCHAR(255)
);

-- Function to safely apply migrations
CREATE OR REPLACE FUNCTION apply_migration(
    p_version VARCHAR(255),
    p_description TEXT,
    p_sql TEXT,
    p_applied_by VARCHAR(255) DEFAULT CURRENT_USER
) RETURNS BOOLEAN AS $$
DECLARE
    v_checksum VARCHAR(64);
    v_applied BOOLEAN := FALSE;
BEGIN
    -- Check if migration already applied
    IF EXISTS (SELECT 1 FROM schema_migrations.migrations WHERE version = p_version) THEN
        RAISE NOTICE 'Migration % already applied', p_version;
        RETURN FALSE;
    END IF;
    
    -- Calculate checksum
    v_checksum := encode(digest(p_sql, 'sha256'), 'hex');
    
    -- Apply the migration in a transaction
    BEGIN
        EXECUTE p_sql;
        
        -- Record the migration
        INSERT INTO schema_migrations.migrations (version, description, checksum, applied_by)
        VALUES (p_version, p_description, v_checksum, p_applied_by);
        
        v_applied := TRUE;
        RAISE NOTICE 'Successfully applied migration %', p_version;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to apply migration %: %', p_version, SQLERRM;
    END;
    
    RETURN v_applied;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sample migrations using the framework

-- Migration 1.1: Add validation constraints
SELECT apply_migration(
    '1.1_add_validation_constraints',
    'Add comprehensive validation constraints for data integrity',
    $$
    -- Add validation check constraints
    ALTER TABLE detections ADD CONSTRAINT check_detection_confidence_range 
        CHECK (confidence_score >= 0 AND confidence_score <= 1);
    
    ALTER TABLE time_series ADD CONSTRAINT check_spectral_range_ndvi 
        CHECK (ndvi IS NULL OR (ndvi >= -1 AND ndvi <= 1));
    
    ALTER TABLE time_series ADD CONSTRAINT check_spectral_range_nbr 
        CHECK (nbr IS NULL OR (nbr >= -1 AND nbr <= 1));
    
    ALTER TABLE time_series ADD CONSTRAINT check_cloud_cover_range 
        CHECK (cloud_cover_percentage IS NULL OR (cloud_cover_percentage >= 0 AND cloud_cover_percentage <= 100));
    
    ALTER TABLE alerts ADD CONSTRAINT check_alert_channels 
        CHECK (email_sent = TRUE OR sms_sent = TRUE OR webhook_sent = TRUE);
    
    -- Add business rule constraints
    ALTER TABLE detections ADD CONSTRAINT check_min_area_threshold 
        CHECK (area_hectares >= 0.04); -- Minimum detectable size from spec
    
    ALTER TABLE quality_control ADD CONSTRAINT check_quality_window 
        CHECK (observation_window_days >= 30 AND observation_window_days <= 365);
    
    -- Add foreign key constraints with proper indexing
    CREATE INDEX idx_detections_watershed_fk ON detections (watershed_id);
    CREATE INDEX idx_time_series_watershed_fk ON time_series (watershed_id);
    CREATE INDEX idx_baselines_watershed_fk ON baselines (watershed_id);
    CREATE INDEX idx_alerts_detection_fk ON alerts (detection_id);
    CREATE INDEX idx_alerts_user_fk ON alerts (user_id);
    $$,
    'system'
);

-- Migration 1.2: Add performance monitoring views
SELECT apply_migration(
    '1.2_add_performance_views',
    'Create views for performance monitoring and analysis',
    $$
    -- Performance monitoring view for recent detections
    CREATE OR REPLACE VIEW v_recent_detections AS
    SELECT 
        d.detection_id,
        w.name as watershed_name,
        w.code as watershed_code,
        d.detection_date,
        d.disturbance_type,
        d.confidence_score,
        d.area_hectares,
        d.status,
        d.primary_algorithm,
        d.created_at,
        ST_AsGeoJSON(d.geom) as geometry_json
    FROM detections d
    JOIN watersheds w ON d.watershed_id = w.watershed_id
    WHERE d.detection_date >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY d.detection_date DESC;
    
    -- Time-series data quality view
    CREATE OR REPLACE VIEW v_time_series_quality AS
    SELECT 
        watershed_id,
        DATE_TRUNC('month', observation_date) as month,
        satellite_sensor,
        COUNT(*) as total_observations,
        COUNT(*) FILTER (WHERE data_quality_score >= 0.8) as high_quality_count,
        AVG(data_quality_score) as avg_quality_score,
        COUNT(DISTINCT scene_id) as unique_scenes,
        AVG(cloud_cover_percentage) as avg_cloud_cover
    FROM time_series
    WHERE observation_date >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY watershed_id, DATE_TRUNC('month', observation_date), satellite_sensor
    ORDER BY watershed_id, month DESC;
    
    -- Alert summary view
    CREATE OR REPLACE VIEW v_alert_summary AS
    SELECT 
        a.alert_id,
        d.detection_date,
        d.disturbance_type,
        d.confidence_score,
        d.area_hectares,
        u.username,
        a.alert_type,
        a.status,
        a.sent_at,
        a.delivered_at,
        EXTRACT(EPOCH FROM (a.delivered_at - a.sent_at))/60 as delivery_minutes
    FROM alerts a
    JOIN detections d ON a.detection_id = d.detection_id
    JOIN users u ON a.user_id = u.user_id
    WHERE a.created_at >= CURRENT_DATE - INTERVAL '30 days'
    ORDER BY a.created_at DESC;
    
    -- Watershed monitoring summary
    CREATE OR REPLACE VIEW v_watershed_monitoring AS
    SELECT 
        w.watershed_id,
        w.name,
        w.code,
        w.area_hectares,
        w.ecosystem_type,
        COUNT(d.detection_id) as total_detections,
        COUNT(d.detection_id) FILTER (WHERE d.status = 'new') as new_detections,
        COUNT(d.detection_id) FILTER (WHERE d.status = 'confirmed') as confirmed_detections,
        AVG(d.confidence_score) as avg_confidence,
        MAX(d.detection_date) as last_detection_date,
        SUM(d.area_hectares) as total_disturbed_area
    FROM watersheds w
    LEFT JOIN detections d ON w.watershed_id = d.watershed_id 
        AND d.detection_date >= CURRENT_DATE - INTERVAL '365 days'
    WHERE w.is_active = TRUE
    GROUP BY w.watershed_id, w.name, w.code, w.area_hectares, w.ecosystem_type
    ORDER BY total_detections DESC;
    $$,
    'system'
);

-- Migration 1.3: Add data archival procedures
SELECT apply_migration(
    '1.3_add_archival_procedures',
    'Create procedures for data archival and cleanup',
    $$
    -- Function to archive old detections
    CREATE OR REPLACE FUNCTION archive_old_detections(
        p_days_old INTEGER DEFAULT 1095  -- 3 years
    ) RETURNS INTEGER AS $$
    DECLARE
        v_count INTEGER;
    BEGIN
        UPDATE detections 
        SET status = 'archived', updated_at = NOW()
        WHERE detection_date < CURRENT_DATE - INTERVAL '1 day' * p_days_old
          AND status IN ('new', 'confirmed', 'resolved')
          AND detection_date < (SELECT MAX(detection_date) FROM detections WHERE status = 'new');
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Archived % old detections', v_count;
        RETURN v_count;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Function to clean up time-series data
    CREATE OR REPLACE FUNCTION cleanup_time_series(
        p_retention_days INTEGER DEFAULT 2555  -- 7 years
    ) RETURNS INTEGER AS $$
    DECLARE
        v_count INTEGER;
    BEGIN
        DELETE FROM time_series 
        WHERE observation_date < CURRENT_DATE - INTERVAL '1 day' * p_retention_days
          AND observation_date < (SELECT DATE_TRUNC('year', MIN(observation_date)) FROM baselines);
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        RAISE NOTICE 'Deleted % old time-series records', v_count;
        RETURN v_count;
    END;
    $$ LANGUAGE plpgsql;
    
    -- Function to optimize database
    CREATE OR REPLACE FUNCTION optimize_database() RETURNS TEXT AS $$
    DECLARE
        v_result TEXT := '';
    BEGIN
        -- Vacuum and analyze all tables
        v_result := v_result || 'Vacuuming and analyzing tables...' || E'\n';
        VACUUM ANALYZE watersheds;
        VACUUM ANALYZE detections;
        VACUUM ANALYZE time_series;
        VACUUM ANALYZE baselines;
        VACUUM ANALYZE users;
        VACUUM ANALYZE alerts;
        VACUUM ANALYZE quality_control;
        
        -- Update table statistics
        v_result := v_result || 'Updated table statistics' || E'\n';
        
        RETURN v_result;
    END;
    $$ LANGUAGE plpgsql;
    $$,
    'system'
);

-- Migration tracking helper function
CREATE OR REPLACE FUNCTION get_migration_status()
RETURNS TABLE(
    version VARCHAR(255),
    description TEXT,
    applied_at TIMESTAMPTZ,
    applied_by VARCHAR(255),
    applied BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.version,
        m.description,
        m.applied_at,
        m.applied_by,
        CASE WHEN m.version IS NOT NULL THEN TRUE ELSE FALSE END as applied
    FROM schema_migrations.migrations m
    ORDER BY m.version;
END;
$$ LANGUAGE plpgsql;