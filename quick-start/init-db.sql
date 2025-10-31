-- Initialize Watershed Mapping Database

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
-- CREATE EXTENSION IF NOT EXISTS "timescaledb"; -- Optional, not available in standard postgis image

-- Create application schema
CREATE SCHEMA IF NOT EXISTS watershed;

-- Create admin user
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'admin') THEN
        CREATE ROLE admin WITH LOGIN PASSWORD 'admin_password_123';
    END IF;
END $$;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON SCHEMA public TO admin;
GRANT ALL PRIVILEGES ON SCHEMA watershed TO admin;

-- Create initial database structure
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    role VARCHAR(20) DEFAULT 'viewer' CHECK (role IN ('admin', 'researcher', 'analyst', 'viewer')),
    organization VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS watersheds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    area DECIMAL(10,2),
    centroid GEOMETRY(POINT, 4326),
    boundaries GEOMETRY(POLYGON, 4326),
    soil_type VARCHAR(20) CHECK (soil_type IN ('clay', 'sandy', 'loam', 'silt', 'mixed')),
    land_use JSONB,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'monitoring')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS satellite_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watershed_id UUID REFERENCES watersheds(id),
    satellite VARCHAR(20) CHECK (satellite IN ('landsat8', 'landsat9', 'sentinel2', 'modis')),
    sensor VARCHAR(50),
    acquisition_date DATE NOT NULL,
    cloud_cover DECIMAL(5,2) DEFAULT 0 CHECK (cloud_cover >= 0 AND cloud_cover <= 100),
    scene_id VARCHAR(50),
    footprint GEOMETRY(POLYGON, 4326),
    processing_status VARCHAR(20) DEFAULT 'downloading' CHECK (processing_status IN ('downloading', 'processing', 'processed', 'failed', 'archived')),
    file_path VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS change_detections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    watershed_id UUID REFERENCES watersheds(id),
    name VARCHAR(100) NOT NULL,
    baseline_image_id UUID REFERENCES satellite_data(id),
    comparison_image_id UUID REFERENCES satellite_data(id),
    algorithm VARCHAR(50) CHECK (algorithm IN ('ndvi_difference', 'nbr_difference', 'landtrendr', 'spectral_angle')),
    confidence_score DECIMAL(3,2) DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result_path VARCHAR(500),
    processing_log TEXT,
    metadata JSONB,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS processing_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    watershed_id UUID REFERENCES watersheds(id),
    task_type VARCHAR(50),
    status VARCHAR(20) DEFAULT 'pending',
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_watersheds_code ON watersheds(code);
CREATE INDEX IF NOT EXISTS idx_watersheds_centroid ON watersheds USING GIST(centroid);
CREATE INDEX IF NOT EXISTS idx_watersheds_boundaries ON watersheds USING GIST(boundaries);
CREATE INDEX IF NOT EXISTS idx_satellite_watershed ON satellite_data(watershed_id);
CREATE INDEX IF NOT EXISTS idx_satellite_date ON satellite_data(acquisition_date);
CREATE INDEX IF NOT EXISTS idx_satellite_footprint ON satellite_data USING GIST(footprint);
CREATE INDEX IF NOT EXISTS idx_detection_watershed ON change_detections(watershed_id);
CREATE INDEX IF NOT EXISTS idx_detection_status ON change_detections(status);
CREATE INDEX IF NOT EXISTS idx_task_user ON processing_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_task_status ON processing_tasks(status);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_watersheds_updated_at BEFORE UPDATE ON watersheds FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_satellite_updated_at BEFORE UPDATE ON satellite_data FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_detection_updated_at BEFORE UPDATE ON change_detections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert admin user (password: AdminPassword123!)
INSERT INTO users (username, email, password, first_name, last_name, role, organization)
VALUES (
    'admin',
    'admin@watershedmapping.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/Lewl.HpQOjJkZm.2', -- AdminPassword123!
    'Admin',
    'User',
    'admin',
    'Watershed Monitoring System'
) ON CONFLICT (email) DO NOTHING;

-- Create a sample watershed
INSERT INTO watersheds (name, code, description, area, soil_type, status)
VALUES (
    'Sample Watershed',
    'SAMPLE_001',
    'Sample watershed for testing the system',
    100.5,
    'loam',
    'active'
) ON CONFLICT (code) DO NOTHING;