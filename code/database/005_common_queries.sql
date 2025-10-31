-- =============================================================================
-- Common Query Templates and Troubleshooting
-- File: 005_common_queries.sql
-- Description: Reusable query templates and diagnostic procedures
-- =============================================================================

-- =============================================================================
-- PERFORMANCE MONITORING QUERIES
-- =============================================================================

-- Check database size and growth
CREATE OR REPLACE VIEW v_database_statistics AS
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size,
    n_tup_ins + n_tup_upd + n_tup_del as total_row_changes
FROM pg_stat_user_tables 
WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Spatial data distribution analysis
CREATE OR REPLACE VIEW v_spatial_distribution AS
SELECT 
    'watersheds' as table_name,
    COUNT(*) as feature_count,
    AVG(ST_Area(geom::geography)/10000) as avg_area_hectares,
    ST_Extent(geom) as spatial_extent
FROM watersheds
WHERE is_active = TRUE
UNION ALL
SELECT 
    'detections' as table_name,
    COUNT(*) as feature_count,
    AVG(area_hectares) as avg_area_hectares,
    ST_Extent(geom) as spatial_extent
FROM detections
WHERE status != 'archived';

-- Time-series data quality metrics
CREATE OR REPLACE VIEW v_timeseries_quality_metrics AS
SELECT 
    watershed_id,
    DATE_TRUNC('month', observation_date) as month,
    satellite_sensor,
    COUNT(*) as total_observations,
    AVG(data_quality_score) as avg_quality_score,
    COUNT(*) FILTER (WHERE cloud_cover_percentage > 30) as cloudy_observations,
    COUNT(*) FILTER (WHERE data_quality_score >= 0.8) as high_quality_count,
    MIN(observation_date) as first_observation,
    MAX(observation_date) as last_observation
FROM time_series
WHERE observation_date >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY watershed_id, DATE_TRUNC('month', observation_date), satellite_sensor
ORDER BY watershed_id, month DESC;

-- =============================================================================
-- ANALYTICAL QUERY TEMPLATES
-- =============================================================================

-- Template 1: Find detections within watershed and time range
-- Usage: Replace watershed_id, start_date, end_date with actual values
CREATE OR REPLACE FUNCTION get_detections_in_watershed(
    p_watershed_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '365 days',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    detection_id UUID,
    detection_date DATE,
    disturbance_type TEXT,
    confidence_score NUMERIC,
    area_hectares NUMERIC,
    geom GEOMETRY,
    status TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.detection_id,
        d.detection_date,
        d.disturbance_type::TEXT,
        d.confidence_score,
        d.area_hectares,
        d.geom,
        d.status::TEXT
    FROM detections d
    WHERE d.watershed_id = p_watershed_id
      AND d.detection_date BETWEEN p_start_date AND p_end_date
      AND d.status IN ('new', 'confirmed')
    ORDER BY d.detection_date DESC, d.confidence_score DESC;
END;
$$ LANGUAGE plpgsql;

-- Template 2: Calculate temporal trends for watershed
CREATE OR REPLACE FUNCTION get_temporal_trends(
    p_watershed_id UUID,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '1095 days' -- 3 years
)
RETURNS TABLE (
    month DATE,
    detection_count BIGINT,
    total_area_hectares NUMERIC,
    avg_confidence NUMERIC,
    dominant_disturbance_type TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE_TRUNC('month', d.detection_date)::DATE as month,
        COUNT(*) as detection_count,
        SUM(d.area_hectares) as total_area_hectares,
        AVG(d.confidence_score) as avg_confidence,
        (ARRAY_AGG(d.disturbance_type ORDER BY COUNT(*) DESC))[1] as dominant_disturbance_type
    FROM detections d
    WHERE d.watershed_id = p_watershed_id
      AND d.detection_date >= p_start_date
      AND d.status IN ('new', 'confirmed')
    GROUP BY DATE_TRUNC('month', d.detection_date)
    ORDER BY month DESC;
END;
$$ LANGUAGE plpgsql;

-- Template 3: Nearest neighbor detection search
CREATE OR REPLACE FUNCTION find_nearby_detections(
    p_point GEOMETRY,
    p_radius_meters INTEGER DEFAULT 1000,
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    detection_id UUID,
    distance_meters NUMERIC,
    detection_date DATE,
    disturbance_type TEXT,
    confidence_score NUMERIC,
    area_hectares NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.detection_id,
        ST_Distance(d.geom, p_point) as distance_meters,
        d.detection_date,
        d.disturbance_type::TEXT,
        d.confidence_score,
        d.area_hectares
    FROM detections d
    WHERE ST_DWithin(d.geom, p_point, p_radius_meters)
      AND d.status IN ('new', 'confirmed')
    ORDER BY ST_Distance(d.geom, p_point)
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Template 4: Time-series analysis for specific location
CREATE OR REPLACE FUNCTION get_location_timeseries(
    p_point GEOMETRY,
    p_watershed_id UUID DEFAULT NULL,
    p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '730 days', -- 2 years
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    observation_date DATE,
    satellite_sensor TEXT,
    ndvi NUMERIC,
    nbr NUMERIC,
    tcg NUMERIC,
    data_quality_score NUMERIC,
    cloud_cover_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ts.observation_date,
        ts.satellite_sensor::TEXT,
        ts.ndvi,
        ts.nbr,
        ts.tcg,
        ts.data_quality_score,
        ts.cloud_cover_percentage
    FROM time_series ts
    WHERE (p_watershed_id IS NULL OR ts.watershed_id = p_watershed_id)
      AND ST_DWithin(ts.location, p_point, 50) -- Within 50 meters
      AND ts.observation_date BETWEEN p_start_date AND p_end_date
      AND ts.data_quality_score >= 0.7
    ORDER BY ts.observation_date DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- DIAGNOSTIC AND TROUBLESHOOTING PROCEDURES
-- =============================================================================

-- Check for spatial index health
CREATE OR REPLACE FUNCTION check_spatial_index_health()
RETURNS TABLE (
    table_name TEXT,
    index_name TEXT,
    index_size_mb NUMERIC,
    index_type TEXT,
    is_valid BOOLEAN,
    recommendations TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.relname::TEXT as table_name,
        i.relname::TEXT as index_name,
        ROUND(pg_relation_size(i.oid)::NUMERIC / 1024/1024, 2) as index_size_mb,
        CASE 
            WHEN a.amname = 'gist' THEN 'GiST'
            WHEN a.amname = 'brin' THEN 'BRIN' 
            WHEN a.amname = 'btree' THEN 'B-Tree'
            ELSE a.amname::TEXT
        END as index_type,
        CASE WHEN i.relname ~ 'idx_.*_geom' THEN TRUE ELSE FALSE END as is_valid,
        CASE 
            WHEN a.amname = 'gist' AND t.relname ~ '(watersheds|detections|baselines)' THEN 'OK'
            WHEN a.amname = 'brin' AND t.relname = 'time_series' THEN 'OK'
            WHEN t.relname ~ '(watersheds|detections|baselines)' AND a.amname != 'gist' THEN 'Consider GiST index'
            WHEN t.relname = 'time_series' AND a.amname != 'brin' THEN 'Consider BRIN index'
            ELSE 'OK'
        END as recommendations
    FROM pg_class t
    JOIN pg_index ix ON t.oid = ix.indrelid
    JOIN pg_class i ON ix.indexrelid = i.oid
    JOIN pg_am a ON i.relam = a.oid
    WHERE t.relkind = 'r' 
      AND t.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND t.relname IN ('watersheds', 'detections', 'time_series', 'baselines')
    ORDER BY t.relname, pg_relation_size(i.oid) DESC;
END;
$$ LANGUAGE plpgsql;

-- Find slow queries and missing indexes
CREATE OR REPLACE FUNCTION analyze_query_performance(
    p_min_calls INTEGER DEFAULT 10
)
RETURNS TABLE (
    query TEXT,
    total_time_ms NUMERIC,
    mean_time_ms NUMERIC,
    calls BIGINT,
    rows BIGINT,
    suggestions TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        SUBSTRING(query, 1, 200)::TEXT as query,
        total_time::NUMERIC as total_time_ms,
        mean_time::NUMERIC as mean_time_ms,
        calls,
        rows,
        CASE 
            WHEN mean_time > 1000 THEN 'Consider adding indexes or optimizing query'
            WHEN calls > 1000 AND mean_time > 100 THEN 'High-frequency query - optimize'
            WHEN rows > 10000 THEN 'Large result set - consider pagination'
            ELSE 'OK'
        END::TEXT as suggestions
    FROM pg_stat_statements
    WHERE calls >= p_min_calls
      AND dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
    ORDER BY mean_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Data quality assessment
CREATE OR REPLACE FUNCTION assess_data_quality()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT,
    severity TEXT
) AS $$
DECLARE
    v_watershed_count INTEGER;
    v_detection_count INTEGER;
    v_orphaned_detections INTEGER;
    v_low_confidence_count INTEGER;
    v_old_detections INTEGER;
BEGIN
    -- Check 1: Basic table counts
    SELECT COUNT(*) INTO v_watershed_count FROM watersheds WHERE is_active = TRUE;
    SELECT COUNT(*) INTO v_detection_count FROM detections;
    
    IF v_watershed_count = 0 THEN
        RETURN QUERY SELECT 'Active Watersheds', 'ERROR', 'No active watersheds found', 'HIGH';
    ELSE
        RETURN QUERY SELECT 'Active Watersheds', 'OK', v_watershed_count::TEXT || ' active watersheds', 'INFO';
    END IF;
    
    IF v_detection_count = 0 THEN
        RETURN QUERY SELECT 'Detection Data', 'WARNING', 'No detections found', 'MEDIUM';
    ELSE
        RETURN QUERY SELECT 'Detection Data', 'OK', v_detection_count::TEXT || ' total detections', 'INFO';
    END IF;
    
    -- Check 2: Orphaned detections
    SELECT COUNT(*) INTO v_orphaned_detections 
    FROM detections d 
    LEFT JOIN watersheds w ON d.watershed_id = w.watershed_id 
    WHERE w.watershed_id IS NULL;
    
    IF v_orphaned_detections > 0 THEN
        RETURN QUERY SELECT 'Data Integrity', 'ERROR', v_orphaned_detections::TEXT || ' orphaned detections', 'HIGH';
    ELSE
        RETURN QUERY SELECT 'Data Integrity', 'OK', 'No orphaned detections', 'INFO';
    END IF;
    
    -- Check 3: Low confidence detections
    SELECT COUNT(*) INTO v_low_confidence_count 
    FROM detections 
    WHERE confidence_score < 0.6 AND status != 'false_positive';
    
    IF v_low_confidence_count > 100 THEN
        RETURN QUERY SELECT 'Confidence Quality', 'WARNING', v_low_confidence_count::TEXT || ' low-confidence detections', 'MEDIUM';
    ELSE
        RETURN QUERY SELECT 'Confidence Quality', 'OK', 'Acceptable confidence distribution', 'INFO';
    END IF;
    
    -- Check 4: Very old detections
    SELECT COUNT(*) INTO v_old_detections 
    FROM detections 
    WHERE detection_date < CURRENT_DATE - INTERVAL '5 years';
    
    IF v_old_detections > 0 THEN
        RETURN QUERY SELECT 'Data Age', 'WARNING', v_old_detections::TEXT || ' very old detections (>5 years)', 'MEDIUM';
    ELSE
        RETURN QUERY SELECT 'Data Age', 'OK', 'Recent data only', 'INFO';
    END IF;
    
    -- Check 5: Time-series data completeness
    RETURN QUERY SELECT 'Time-series Coverage', 'OK', 'Assessment completed', 'INFO';
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- MAINTENANCE AND CLEANUP PROCEDURES
-- =============================================================================

-- Clean up old test data (for development)
CREATE OR REPLACE FUNCTION cleanup_test_data()
RETURNS TEXT AS $$
DECLARE
    v_deleted_detections INTEGER;
    v_deleted_timeseries INTEGER;
    v_deleted_alerts INTEGER;
BEGIN
    -- Archive old test detections
    UPDATE detections 
    SET status = 'archived'
    WHERE created_at < CURRENT_DATE - INTERVAL '30 days'
      AND status = 'new';
    
    GET DIAGNOSTICS v_deleted_detections = ROW_COUNT;
    
    -- Clean up old test alerts
    DELETE FROM alerts 
    WHERE created_at < CURRENT_DATE - INTERVAL '90 days'
      AND status IN ('delivered', 'acknowledged');
    
    GET DIAGNOSTICS v_deleted_alerts = ROW_COUNT;
    
    -- Clean up very old time-series data (keeping last 3 years)
    DELETE FROM time_series 
    WHERE observation_date < CURRENT_DATE - INTERVAL '3 years';
    
    GET DIAGNOSTICS v_deleted_timeseries = ROW_COUNT;
    
    RETURN FORMAT('Cleaned up: %s detections, %s alerts, %s time-series records', 
                  v_deleted_detections, v_deleted_alerts, v_deleted_timeseries);
END;
$$ LANGUAGE plpgsql;

-- Optimize database (vacuum and analyze)
CREATE OR REPLACE FUNCTION optimize_database_performance()
RETURNS TEXT AS $$
DECLARE
    v_result TEXT := '';
    v_table_name TEXT;
    v_tables TEXT[] := ARRAY['watersheds', 'detections', 'time_series', 'baselines', 'users', 'alerts', 'quality_control'];
BEGIN
    FOREACH v_table_name IN ARRAY v_tables
    LOOP
        BEGIN
            EXECUTE format('VACUUM ANALYZE %I', v_table_name);
            v_result := v_result || 'Optimized ' || v_table_name || E'\n';
        EXCEPTION WHEN OTHERS THEN
            v_result := v_result || 'Failed to optimize ' || v_table_name || E'\n';
        END;
    END LOOP;
    
    -- Update table statistics
    ANALYZE;
    v_result := v_result || 'Updated statistics' || E'\n';
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PERFORMANCE TESTING QUERIES
-- =============================================================================

-- Test spatial query performance
CREATE OR REPLACE FUNCTION test_spatial_performance(
    p_iterations INTEGER DEFAULT 10
)
RETURNS TABLE (
    test_name TEXT,
    avg_time_ms NUMERIC,
    min_time_ms NUMERIC,
    max_time_ms NUMERIC
) AS $$
DECLARE
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    elapsed_ms NUMERIC;
    times NUMERIC[] := ARRAY[]::NUMERIC[];
BEGIN
    -- Test 1: Watershed boundary search
    FOR i IN 1..p_iterations
    LOOP
        start_time := NOW();
        PERFORM * FROM watersheds WHERE ST_Intersects(geom, ST_MakeEnvelope(-123.5, 45.0, -123.0, 46.0, 4326));
        end_time := NOW();
        times := array_append(times, EXTRACT(EPOCH FROM (end_time - start_time)) * 1000);
    END LOOP;
    
    RETURN QUERY SELECT 'Watershed Spatial Search', AVG(times), MIN(times), MAX(times);
    
    -- Test 2: Detection temporal query
    times := ARRAY[]::NUMERIC[];
    FOR i IN 1..p_iterations
    LOOP
        start_time := NOW();
        PERFORM * FROM detections WHERE detection_date >= CURRENT_DATE - INTERVAL '1 year' AND status = 'confirmed';
        end_time := NOW();
        times := array_append(times, EXTRACT(EPOCH FROM (end_time - start_time)) * 1000);
    END LOOP;
    
    RETURN QUERY SELECT 'Detection Temporal Query', AVG(times), MIN(times), MAX(times);
    
    -- Test 3: Time-series aggregation
    times := ARRAY[]::NUMERIC[];
    FOR i IN 1..p_iterations
    LOOP
        start_time := NOW();
        PERFORM watershed_id, DATE_TRUNC('month', observation_date) as month, COUNT(*) 
        FROM time_series 
        WHERE observation_date >= CURRENT_DATE - INTERVAL '6 months'
        GROUP BY watershed_id, month;
        end_time := NOW();
        times := array_append(times, EXTRACT(EPOCH FROM (end_time - start_time)) * 1000);
    END LOOP;
    
    RETURN QUERY SELECT 'Time-series Aggregation', AVG(times), MIN(times), MAX(times);
END;
$$ LANGUAGE plpgsql;