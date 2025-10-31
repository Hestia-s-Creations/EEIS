# =============================================================================
# Custom PostgreSQL Dockerfile for Watershed Disturbance Mapping System
# Includes PostGIS, TimescaleDB, and custom configurations
# =============================================================================

FROM timescale/timescaledb-ha:pg14-latest

# Metadata
LABEL maintainer="Watershed Monitoring Team"
LABEL description="PostgreSQL with PostGIS and TimescaleDB for Watershed Disturbance Mapping System"
LABEL version="1.0.0"

# Set environment variables
ENV POSTGRES_DB=watershed_monitor \
    POSTGRES_USER=app_user \
    POSTGRES_PASSWORD=SecurePassword123! \
    POSTGRES_HOST_AUTH_METHOD=md5

# Install system dependencies
RUN apt-get update && apt-get install -y \
    # Timezone data for accurate timestamps
    tzdata \
    # Development tools for PostGIS compilation if needed
    build-essential \
    # GIS utilities
    gdal-bin \
    # Network tools for monitoring
    net-tools \
    # PostgreSQL development headers
    libpq-dev \
    # Additional PostgreSQL extensions
    postgresql-14-pg_stat_statements \
    postgresql-14-pg_trgm \
    postgresql-14-pgcrypto \
    # PostGIS additional tools
    postgresql-14-postgis-3-scripts \
    # Cleanup
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create directories for configurations and scripts
RUN mkdir -p /docker-entrypoint-initdb.d/custom \
    /etc/postgresql/conf.d \
    /var/log/postgresql \
    /opt/watershed-scripts \
    /opt/backups

# Set proper permissions
RUN chown -R postgres:postgres /opt/watershed-scripts /opt/backups \
    && chmod 755 /opt/watershed-scripts /opt/backups

# Copy custom configuration files
COPY custom_configs/ /etc/postgresql/conf.d/
COPY scripts/ /opt/watershed-scripts/

# Make scripts executable
RUN chmod +x /opt/watershed-scripts/*.sh

# Copy initialization scripts
COPY database_scripts/ /docker-entrypoint-initdb.d/

# Set up timezone
ENV TZ=UTC
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# =============================================================================
# Performance Configuration
# =============================================================================

# Create custom postgresql.conf
RUN echo "
# Watershed Disturbance Mapping System Custom Configuration
# Optimized for spatial and time-series workloads

# Memory Settings (adjust based on container resources)
shared_buffers = 1GB
effective_cache_size = 3GB
work_mem = 256MB
maintenance_work_mem = 512MB

# Checkpoint Settings
checkpoint_completion_target = 0.9
wal_buffers = 64MB
min_wal_size = 2GB
max_wal_size = 8GB

# Connection Settings
max_connections = 200
superuser_reserved_connections = 3

# Logging
log_min_duration_statement = 1000
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# Autovacuum
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 30s
autovacuum_vacuum_threshold = 100
autovacuum_analyze_threshold = 100
autovacuum_vacuum_scale_factor = 0.2
autovacuum_analyze_scale_factor = 0.1

# PostGIS Settings
max_connections = 200
shared_preload_libraries = 'timescaledb'

# TimescaleDB Settings
timescaledb.telemetry_level = 'off'
timescaledb.max_background_workers = 4

# Performance
random_page_cost = 1.1
effective_io_concurrency = 200
default_statistics_target = 1000

# Query Planning
enable_partitionwise_join = on
enable_partitionwise_aggregate = on
enable_parallel_hash = on

# Network Settings
listen_addresses = '*'
port = 5432

# Security
ssl = off  # Enable for production
password_encryption = scram-sha-256

# Include custom configurations
include_dir = 'conf.d'
" > /var/lib/postgresql/data/postgresql.conf.custom

# =============================================================================
# Database Initialization Scripts
# =============================================================================

# 001_install_extensions.sh
RUN echo '#!/bin/bash
set -e

echo "Installing required PostgreSQL extensions..."

# Install PostGIS extensions
psql -v ON_ERROR_STOP=1 --username \"\$POSTGRES_USER\" --dbname \"\$POSTGRES_DB\" <<-EOSQL
    -- Enable PostGIS extensions
    CREATE EXTENSION IF NOT EXISTS postgis;
    CREATE EXTENSION IF NOT EXISTS postgis_raster;
    CREATE EXTENSION IF NOT EXISTS postgis_topology;
    
    -- Install TimescaleDB
    CREATE EXTENSION IF NOT EXISTS timescaledb;
    
    -- Install additional useful extensions
    CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
    CREATE EXTENSION IF NOT EXISTS pg_trgm;
    
    -- Verify installations
    SELECT PostGIS_Version();
    SELECT extversion FROM pg_extension WHERE extname = '\''timescaledb'\'';
    SELECT * FROM pg_available_extensions WHERE name LIKE '\''%gis%\'' OR name LIKE '\''%timescale%\'';
    
EOSQL

echo "Extensions installed successfully!"
' > /docker-entrypoint-initdb.d/001_install_extensions.sh

# 002_create_users.sh
RUN echo '#!/bin/bash
set -e

echo "Creating database users..."

psql -v ON_ERROR_STOP=1 --username \"\$POSTGRES_USER\" --dbname \"\$POSTGRES_DB\" <<-EOSQL
    -- Create read-only user if it doesn'\''t exist
    DO \$\$ 
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '\''read_user'\'') THEN
            CREATE USER read_user WITH PASSWORD '\''ReadOnlyPassword456!'\'';
        END IF;
    END
    \$\$;
    
    -- Grant basic permissions to read-only user
    GRANT CONNECT ON DATABASE watershed_monitor TO read_user;
    GRANT USAGE ON SCHEMA public TO read_user;
    GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO read_user;
    
    -- Set default privileges for future objects
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO read_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO read_user;
    
    -- Grant TimescaleDB permissions to read-only user
    GRANT USAGE ON SCHEMA timescaledb TO read_user;
    
    -- Grant access to performance monitoring
    GRANT SELECT ON pg_stat_statements TO app_user;
    GRANT SELECT ON pg_stat_statements TO read_user;
    
    -- Create application user with full permissions
    DO \$\$ 
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '\''app_user'\'') THEN
            CREATE USER app_user WITH PASSWORD '\''SecurePassword123!'\'';
        END IF;
    END
    \$\$;
    
    GRANT CONNECT ON DATABASE watershed_monitor TO app_user;
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT CREATE ON SCHEMA public TO app_user;
    GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO app_user;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
    
    -- Grant TimescaleDB permissions
    GRANT CREATE ON DATABASE watershed_monitor TO app_user;
    GRANT ALL ON SCHEMA timescaledb TO app_user;
    
EOSQL

echo "Users created successfully!"
' > /docker-entrypoint-initdb.d/002_create_users.sh

# 003_configure_performance.sh
RUN echo '#!/bin/bash
set -e

echo "Configuring database performance settings..."

psql -v ON_ERROR_STOP=1 --username \"\$POSTGRES_USER\" --dbname \"\$POSTGRES_DB\" <<-EOSQL
    -- Configure TimescaleDB
    -- Create hypertable for time_series data
    -- (Note: This will fail if time_series table doesn'\''t exist yet)
    \\\\echo \"TimescaleDB configuration applied.\"
    
    -- Create performance monitoring functions
    CREATE OR REPLACE FUNCTION get_database_stats()
    RETURNS TABLE (
        database_size text,
        table_sizes text
    ) AS \$\$
    BEGIN
        RETURN QUERY
        SELECT 
            pg_size_pretty(pg_database_size(current_database())) as database_size,
            string_agg(
                schemaname || '.' || tablename || ': ' || pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)),
                ', '
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
            ) as table_sizes
        FROM pg_tables
        WHERE schemaname = 'public';
    END;
    \$\$ LANGUAGE plpgsql;
    
    -- Create connection monitoring view
    CREATE OR REPLACE VIEW v_active_connections AS
    SELECT 
        count(*) as total_connections,
        count(*) FILTER (WHERE state = 'active') as active_connections,
        count(*) FILTER (WHERE state = 'idle') as idle_connections,
        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
    FROM pg_stat_activity;
    
    -- Grant access to views
    GRANT SELECT ON v_active_connections TO app_user;
    GRANT SELECT ON get_database_stats() TO app_user;
    
EOSQL

echo "Performance configuration completed!"
' > /docker-entrypoint-initdb.d/003_configure_performance.sh

# Make initialization scripts executable
RUN chmod +x /docker-entrypoint-initdb.d/*.sh

# =============================================================================
# Custom Scripts
# =============================================================================

# Backup script
RUN echo '#!/bin/bash
# Watershed Database Backup Script

BACKUP_DIR="/opt/backups"
DB_NAME="watershed_monitor"
DB_USER="app_user"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "Starting backup of $DB_NAME database..."

pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" \\
    --format=custom \\
    --compress=9 \\
    --verbose \\
    --file="$BACKUP_DIR/watershed_monitor_backup_$TIMESTAMP.dump"

echo "Backup completed: watershed_monitor_backup_$TIMESTAMP.dump"
ls -lh "$BACKUP_DIR"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "watershed_monitor_backup_*.dump" -mtime +7 -delete

echo "Old backups cleaned up."
' > /opt/watershed-scripts/backup.sh

# Monitoring script
RUN echo '#!/bin/bash
# Database monitoring script

echo "=== Watershed Database Status ==="
echo "Timestamp: $(date)"
echo

# Check database connectivity
echo "Database Connectivity:"
psql -U app_user -d watershed_monitor -c "SELECT '\''Connection successful'\'' as status;" 2>/dev/null || echo "Database connection failed"

echo
echo "Database Statistics:"
psql -U app_user -d watershed_monitor -c "SELECT * FROM get_database_stats();" 2>/dev/null

echo
echo "Active Connections:"
psql -U app_user -d watershed_monitor -c "SELECT * FROM v_active_connections;" 2>/dev/null

echo
echo "Extension Status:"
psql -U app_user -d watershed_monitor -c "SELECT name, default_version, installed_version FROM pg_available_extensions WHERE name LIKE '\''%gis%\'' OR name LIKE '\''%timescale%\'' ORDER BY name;" 2>/dev/null

echo
echo "Disk Usage:"
df -h /var/lib/postgresql/data

echo
echo "Memory Usage:"
free -h

echo
echo "=== Monitoring Complete ==="
' > /opt/watershed-scripts/monitor.sh

# Performance test script
RUN echo '#!/bin/bash
# Performance testing script

echo "Running database performance tests..."
echo "Timestamp: $(date)"
echo

# Test 1: Simple connection test
echo "Test 1: Connection Test"
time psql -U app_user -d watershed_monitor -c "SELECT 1;" 2>/dev/null

# Test 2: Extension query
echo
echo "Test 2: PostGIS Query"
time psql -U app_user -d watershed_monitor -c "SELECT PostGIS_Version();" 2>/dev/null

# Test 3: TimescaleDB query (will fail if no hypertable exists)
echo
echo "Test 3: TimescaleDB Query"
time psql -U app_user -d watershed_monitor -c "SHOW timescaledb;" 2>/dev/null || echo "TimescaleDB not configured"

# Test 4: Spatial operations (create test geometry)
echo
echo "Test 4: Spatial Operations"
time psql -U app_user -d watershed_monitor -c "
SELECT ST_Area(ST_MakePoint(-123.45, 45.678, 4326)::geography);
" 2>/dev/null

echo
echo "=== Performance Tests Complete ==="
' > /opt/watershed-scripts/test_performance.sh

# Make scripts executable
RUN chmod +x /opt/watershed-scripts/*.sh

# =============================================================================
# Health Check
# =============================================================================

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD psql -U app_user -d watershed_monitor -c "SELECT 1;" || exit 1

# =============================================================================
# Startup Configuration
# =============================================================================

# Create startup script for additional configuration
RUN echo '#!/bin/bash
set -e

echo "Watershed Database Container Starting..."

# Wait for PostgreSQL to be fully ready
echo "Waiting for PostgreSQL to be ready..."
until psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "\\q" 2>/dev/null; do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 1
done

echo "PostgreSQL is up - executing additional configuration"

# Run custom initialization if database is empty
DB_EXISTS=$(psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "SELECT 1 FROM information_schema.tables WHERE table_schema='public';")

if [ -z "$DB_EXISTS" ]; then
    echo "Database is empty - running initialization scripts..."
    run-parts --report /docker-entrypoint-initdb.d/custom/
else
    echo "Database already contains data - skipping initialization"
fi

# Run performance monitoring
/opt/watershed-scripts/monitor.sh

echo "Database container startup complete!"
' > /usr/local/bin/watershed-db-startup.sh

RUN chmod +x /usr/local/bin/watershed-db-startup.sh

# Set startup command (override default entrypoint for custom startup)
CMD ["/bin/bash", "/usr/local/bin/watershed-db-startup.sh"]