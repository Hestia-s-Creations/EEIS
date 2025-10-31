-- =============================================================================
-- Sample Data and Test Scripts
-- File: 004_sample_data.sql
-- Description: Sample data for development and testing purposes
-- =============================================================================

-- Insert sample users
INSERT INTO users (user_id, username, email, first_name, last_name, role, organization) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin_user', 'admin@watershed-monitor.org', 'System', 'Administrator', 'admin', 'Watershed Monitoring System'),
('550e8400-e29b-41d4-a716-446655440001', 'analyst_jane', 'jane.analyst@enviro.gov', 'Jane', 'Smith', 'analyst', 'Environmental Protection Agency'),
('550e8400-e29b-41d4-a716-446655440002', 'field_worker_bob', 'bob.field@conservation.org', 'Bob', 'Johnson', 'field_worker', 'Conservation International'),
('550e8400-e29b-41d4-a716-446655440003', 'viewer_mary', 'mary.viewer@research.edu', 'Mary', 'Davis', 'viewer', 'University Research');

-- Insert sample watersheds (using realistic polygon geometries)
INSERT INTO watersheds (watershed_id, name, code, description, area_hectares, geom, centroid, ecosystem_type, administrative_region, created_by) VALUES
('660e8400-e29b-41d4-a716-446655440000', 'Columbia River Basin - Lower Watershed', 'CRB-LOWER', 
 'Lower Columbia River watershed including major tributaries and estuary areas', 850000.50,
 ST_GeomFromText('POLYGON((-123.5 45.0, -123.0 45.0, -123.0 46.0, -123.5 46.0, -123.5 45.0))', 4326),
 ST_GeomFromText('POINT(-123.25 45.5)', 4326),
 'Temperate Rainforest', 'Pacific Northwest', '550e8400-e29b-41d4-a716-446655440000'),

('660e8400-e29b-41d4-a716-446655440001', 'Willamette Valley Watershed', 'WILL-VALLEY',
 'Major agricultural watershed in Oregon with significant riparian habitats', 294000.75,
 ST_GeomFromText('POLYGON((-123.8 44.5, -122.5 44.5, -122.5 45.5, -123.8 45.5, -123.8 44.5))', 4326),
 ST_GeomFromText('POINT(-123.15 45.0)', 4326),
 'Temperate Grassland', 'Oregon', '550e8400-e29b-41d4-a716-446655440000'),

('660e8400-e29b-41d4-a716-446655440002', 'Puget Sound Watershed', 'PUGET-SOUND',
 'Marine-influenced watershed with extensive freshwater and marine interfaces', 1670000.25,
 ST_GeomFromText('POLYGON((-123.0 47.0, -122.0 47.0, -122.0 48.5, -123.0 48.5, -123.0 47.0))', 4326),
 ST_GeomFromText('POINT(-122.5 47.75)', 4326),
 'Temperate Marine', 'Washington', '550e8400-e29b-41d4-a716-446655440000');

-- Insert sample user preferences
INSERT INTO user_preferences (user_id, min_confidence_threshold, max_area_hectares, proximity_buffer_meters, alert_frequency) VALUES
('550e8400-e29b-41d4-a716-446655440001', 0.75, 10.0, 500, 'immediate'),
('550e8400-e29b-41d4-a716-446655440002', 0.80, 2.5, 100, 'daily'),
('550e8400-e29b-41d4-a716-446655440003', 0.90, 50.0, 1000, 'weekly');

-- Insert sample detections
INSERT INTO detections (detection_id, watershed_id, detection_date, disturbance_type, confidence_score, status, geom, area_hectares, perimeter_meters, severity_level, spectral_change_magnitude, primary_algorithm, created_by) VALUES
('770e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', '2024-03-15', 'logging', 0.92, 'confirmed', 
 ST_GeomFromText('POLYGON((-123.4 45.2, -123.3 45.2, -123.3 45.3, -123.4 45.3, -123.4 45.2))', 4326), 
 2.5, 1250.0, 'high', 0.75, 'LandTrendr', '550e8400-e29b-41d4-a716-446655440001'),

('770e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', '2024-04-22', 'infrastructure_development', 0.85, 'new',
 ST_GeomFromText('POLYGON((-123.1 44.7, -123.0 44.7, -123.0 44.8, -123.1 44.8, -123.1 44.7))', 4326),
 5.8, 980.0, 'medium', 0.45, 'FNRT', '550e8400-e29b-41d4-a716-446655440001'),

('770e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', '2024-05-10', 'fire', 0.95, 'confirmed',
 ST_GeomFromText('POLYGON((-122.8 47.8, -122.7 47.8, -122.7 47.9, -122.8 47.9, -122.8 47.8))', 4326),
 15.2, 1560.0, 'high', 0.88, 'LandTrendr', '550e8400-e29b-41d4-a716-446655440001');

-- Insert sample baseline data
INSERT INTO baselines (baseline_id, watershed_id, ecosystem_type, baseline_start_date, baseline_end_date, baseline_ndvi_mean, baseline_ndvi_std, baseline_nbr_mean, baseline_nbr_std, baseline_tcg_mean, baseline_tcg_std, baseline_geom, is_active, created_by) VALUES
('880e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 'Temperate Rainforest', 
 '2020-01-01', '2023-12-31', 0.72, 0.15, 0.68, 0.12, 0.55, 0.18, 
 ST_GeomFromText('POLYGON((-123.6 44.9, -122.9 44.9, -122.9 46.1, -123.6 46.1, -123.6 44.9))', 4326),
 TRUE, '550e8400-e29b-41d4-a716-446655440001'),

('880e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 'Temperate Grassland',
 '2020-01-01', '2023-12-31', 0.45, 0.22, 0.42, 0.19, 0.38, 0.25,
 ST_GeomFromText('POLYGON((-123.9 44.4, -122.4 44.4, -122.4 45.6, -123.9 45.6, -123.9 44.4))', 4326),
 TRUE, '550e8400-e29b-41d4-a716-446655440001');

-- Insert sample time-series data (simulated satellite observations)
INSERT INTO time_series (watershed_id, location, observation_date, acquisition_time, satellite_sensor, scene_id, cloud_cover_percentage, ndvi, nbr, tcg, band_blue, band_green, band_red, band_nir, band_swir1, band_swir2, data_quality_score, valid_pixels_count, processing_version) VALUES
-- Columbia River Basin samples
('660e8400-e29b-41d4-a716-446655440000', ST_GeomFromText('POINT(-123.35 45.25)', 4326), '2024-01-15', '2024-01-15T10:30:00Z', 'sentinel_2b', 'S2B_MSIL2A_20240115T183211_N0000_R098_T10TGL_20240115T203001', 15.5, 0.68, 0.65, 0.52, 0.045, 0.078, 0.089, 0.234, 0.156, 0.098, 0.92, 450, 'v3.1'),
('660e8400-e29b-41d4-a716-446655440000', ST_GeomFromText('POINT(-123.35 45.25)', 4326), '2024-02-20', '2024-02-20T10:30:00Z', 'landsat_9', 'LC09_L2SP_046028_20240220_01_T1', 22.1, 0.71, 0.67, 0.54, 0.042, 0.075, 0.085, 0.241, 0.159, 0.101, 0.88, 320, 'v3.1'),
('660e8400-e29b-41d4-a716-446655440000', ST_GeomFromText('POINT(-123.35 45.25)', 4326), '2024-03-15', '2024-03-15T10:30:00Z', 'sentinel_2a', 'S2A_MSIL2A_20240315T183221_N0000_R098_T10TGL_20240315T203011', 8.2, 0.73, 0.69, 0.56, 0.048, 0.082, 0.091, 0.246, 0.162, 0.105, 0.95, 480, 'v3.1'),

-- Willamette Valley samples
('660e8400-e29b-41d4-a716-446655440001', ST_GeomFromText('POINT(-123.05 44.95)', 4326), '2024-01-10', '2024-01-10T18:32:00Z', 'sentinel_2b', 'S2B_MSIL2A_20240110T183211_N0000_R098_T10TGL_20240110T203001', 35.8, 0.38, 0.35, 0.28, 0.065, 0.112, 0.134, 0.187, 0.198, 0.156, 0.72, 280, 'v3.1'),
('660e8400-e29b-41d4-a716-446655440001', ST_GeomFromText('POINT(-123.05 44.95)', 4326), '2024-02-14', '2024-02-14T18:32:00Z', 'sentinel_2a', 'S2A_MSIL2A_20240214T183221_N0000_R098_T10TGL_20240214T203011', 18.9, 0.42, 0.39, 0.32, 0.058, 0.098, 0.125, 0.195, 0.186, 0.149, 0.86, 420, 'v3.1'),
('660e8400-e29b-41d4-a716-446655440001', ST_GeomFromText('POINT(-123.05 44.95)', 4326), '2024-03-20', '2024-03-20T18:32:00Z', 'landsat_8', 'LC08_L2SP_046028_20240320_01_T1', 12.3, 0.46, 0.43, 0.36, 0.051, 0.089, 0.118, 0.203, 0.175, 0.142, 0.91, 445, 'v3.1'),

-- Puget Sound samples
('660e8400-e29b-41d4-a716-446655440002', ST_GeomFromText('POINT(-122.65 47.65)', 4326), '2024-01-05', '2024-01-05T18:45:00Z', 'sentinel_2b', 'S2B_MSIL2A_20240105T183211_N0000_R098_T10TGL_20240105T203001', 45.2, 0.82, 0.79, 0.68, 0.038, 0.065, 0.072, 0.256, 0.148, 0.089, 0.65, 220, 'v3.1'),
('660e8400-e29b-41d4-a716-446655440002', ST_GeomFromText('POINT(-122.65 47.65)', 4326), '2024-02-09', '2024-02-09T18:45:00Z', 'landsat_9', 'LC09_L2SP_047028_20240209_01_T1', 28.7, 0.84, 0.81, 0.71, 0.035, 0.062, 0.068, 0.261, 0.145, 0.086, 0.79, 360, 'v3.1'),
('660e8400-e29b-41d4-a716-446655440002', ST_GeomFromText('POINT(-122.65 47.65)', 4326), '2024-03-14', '2024-03-14T18:45:00Z', 'sentinel_2a', 'S2A_MSIL2A_20240314T183221_N0000_R098_T10TGL_20240314T203011', 16.4, 0.86, 0.83, 0.73, 0.041, 0.069, 0.074, 0.265, 0.151, 0.092, 0.89, 425, 'v3.1');

-- Insert sample quality control records
INSERT INTO quality_control (qc_id, watershed_id, cloud_coverage_threshold, min_valid_observations, observation_window_days, overall_quality_score, spatial_coherence_score, temporal_consistency_score, quality_status, processed_date, assessed_by) VALUES
('990e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440000', 30.0, 3, 90, 0.88, 0.92, 0.84, 'passed', '2024-03-31', '550e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440001', '660e8400-e29b-41d4-a716-446655440001', 30.0, 3, 90, 0.75, 0.68, 0.82, 'warning', '2024-03-31', '550e8400-e29b-41d4-a716-446655440001'),
('990e8400-e29b-41d4-a716-446655440002', '660e8400-e29b-41d4-a716-446655440002', 30.0, 3, 90, 0.82, 0.85, 0.79, 'passed', '2024-03-31', '550e8400-e29b-41d4-a716-446655440001');

-- Insert sample detection quality metrics
INSERT INTO detection_quality_metrics (metric_id, detection_id, qc_id, spatial_coherence, temporal_persistence, spectral_consistency, false_positive_probability, requires_field_validation, validated_in_field) VALUES
('aa0e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', '990e8400-e29b-41d4-a716-446655440000', 0.94, 5, 0.89, 0.05, TRUE, TRUE),
('aa0e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', '990e8400-e29b-41d4-a716-446655440001', 0.76, 3, 0.82, 0.12, TRUE, FALSE),
('aa0e8400-e29b-41d4-a716-446655440002', '770e8400-e29b-41d4-a716-446655440002', '990e8400-e29b-41d4-a716-446655440002', 0.91, 4, 0.86, 0.03, FALSE, FALSE);

-- Insert sample alerts
INSERT INTO alerts (alert_id, detection_id, user_id, alert_type, subject, message, email_sent, sms_sent, sent_at, delivered_at) VALUES
('bb0e8400-e29b-41d4-a716-446655440000', '770e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', 'high_confidence', 
 'High Confidence Logging Detection', 
 'New high-confidence logging detection detected in Columbia River Basin Lower Watershed. Confidence: 92%, Area: 2.5 hectares',
 TRUE, FALSE, '2024-03-16T08:00:00Z', '2024-03-16T08:01:15Z'),

('bb0e8400-e29b-41d4-a716-446655440001', '770e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 'large_area',
 'Large Infrastructure Development Detection',
 'Large infrastructure development detected in Willamette Valley. Please investigate for potential environmental impact.',
 TRUE, TRUE, '2024-04-23T09:30:00Z', '2024-04-23T09:31:45Z');

-- Insert sample audit log entries
INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, changed_by, ip_address) VALUES
('detections', '770e8400-e29b-41d4-a716-446655440000', 'UPDATE', 
 '{"status": "new", "confidence_score": 0.89}', 
 '{"status": "confirmed", "confidence_score": 0.92}', 
 '550e8400-e29b-41d4-a716-446655440001', '192.168.1.100'),

('users', '550e8400-e29b-41d4-a716-446655440002', 'UPDATE',
 '{"last_login": "2024-03-01T10:00:00Z"}',
 '{"last_login": "2024-04-22T14:30:00Z"}',
 '550e8400-e29b-41d4-a716-446655440002', '10.0.0.50');

-- Update statistics for better query performance
ANALYZE;

-- Summary queries to verify sample data
DO $$
DECLARE
    v_watershed_count INTEGER;
    v_detection_count INTEGER;
    v_timeseries_count INTEGER;
    v_user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_watershed_count FROM watersheds;
    SELECT COUNT(*) INTO v_detection_count FROM detections;
    SELECT COUNT(*) INTO v_timeseries_count FROM time_series;
    SELECT COUNT(*) INTO v_user_count FROM users;
    
    RAISE NOTICE 'Sample data loaded successfully:';
    RAISE NOTICE '  Watersheds: %', v_watershed_count;
    RAISE NOTICE '  Detections: %', v_detection_count;
    RAISE NOTICE '  Time Series Records: %', v_timeseries_count;
    RAISE NOTICE '  Users: %', v_user_count;
END $$;