#!/bin/bash

# =============================================================================
# PostgreSQL + PostGIS + TimescaleDB Installation Script for Ubuntu/Debian
# Watershed Disturbance Mapping System Database Setup
# =============================================================================

set -e  # Exit on any error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root (use sudo)"
fi

# Detect OS version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
    VER=$VERSION_ID
else
    error "Cannot detect OS version"
fi

log "Detected OS: $OS $VER"

# Update system packages
log "Updating system packages..."
apt-get update

# Install prerequisite packages
log "Installing prerequisite packages..."
apt-get install -y wget curl gnupg2 software-properties-common apt-transport-https ca-certificates lsb-release

# Add PostgreSQL APT repository
log "Adding PostgreSQL APT repository..."
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgsql-14 main" > /etc/apt/sources.list.d/pgdg.list

# Add TimescaleDB APT repository
log "Adding TimescaleDB APT repository..."
wget --quiet -O - https://packagecloud.io/timescale/timescaledb/gpgkey | apt-key add -
echo "deb https://packagecloud.io/timescale/timescaledb/ubuntu/ $(lsb_release -cs) main" > /etc/apt/sources.list.d/timescaledb.list

# Update package lists
log "Updating package lists..."
apt-get update

# Install PostgreSQL 14 with extensions
log "Installing PostgreSQL 14 with extensions..."
apt-get install -y \
    postgresql-14 \
    postgresql-client-14 \
    postgresql-14-postgis-3 \
    postgresql-14-postgis-3-scripts \
    postgresql-contrib-14 \
    postgresql-14-cron \
    timescaledb-2-14-postgresql-14

# Install additional useful tools
log "Installing additional PostgreSQL tools..."
apt-get install -y \
    postgresql-plpython3-14 \
    pgadmin4 \
    pgcli

# Start and enable PostgreSQL service
log "Starting PostgreSQL service..."
systemctl start postgresql
systemctl enable postgresql

# Wait for PostgreSQL to be ready
log "Waiting for PostgreSQL to be ready..."
sleep 5

# Configure PostgreSQL for watershed monitoring
log "Configuring PostgreSQL for watershed monitoring..."

# Set up PostgreSQL configuration
POSTGRES_CONFIG="/etc/postgresql/14/main/postgresql.conf"
PG_HBA_CONFIG="/etc/postgresql/14/main/pg_hba.conf"

# Backup original configurations
cp "$POSTGRES_CONFIG" "${POSTGRES_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$PG_HBA_CONFIG" "${PG_HBA_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

# Configure postgresql.conf for watershed monitoring
cat >> "$POSTGRES_CONFIG" << 'EOF'

# =============================================================================
# Watershed Disturbance Mapping System Configuration
# =============================================================================

# Memory Configuration
shared_buffers = 2GB                    # 25% of total RAM for dedicated database server
effective_cache_size = 6GB              # 75% of total RAM
work_mem = 256MB                        # Increase for spatial operations
maintenance_work_mem = 512MB            # For CREATE INDEX and VACUUM

# Checkpoint Configuration
checkpoint_completion_target = 0.9
wal_buffers = 64MB
min_wal_size = 4GB
max_wal_size = 16GB

# Connection Settings
max_connections = 200
superuser_reserved_connections = 3

# Logging
log_min_duration_statement = 1000       # Log slow queries (>1 second)
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
log_connections = on
log_disconnections = on
log_lock_waits = on
log_temp_files = 0

# Autovacuum Configuration
autovacuum = on
autovacuum_max_workers = 4
autovacuum_naptime = 30s
autovacuum_vacuum_threshold = 100
autovacuum_analyze_threshold = 100
autovacuum_vacuum_scale_factor = 0.2
autovacuum_analyze_scale_factor = 0.1

# PostGIS Configuration
max_connections = 200
shared_preload_libraries = 'timescaledb'

# Time Series Optimization
timescaledb.telemetry_level = 'off'

# Performance Settings
random_page_cost = 1.1                  # For SSD storage
effective_io_concurrency = 200          # For SSD storage
default_statistics_target = 1000        # More accurate statistics

# Query Planning
enable_partitionwise_join = on
enable_partitionwise_aggregate = on

EOF

# Configure pg_hba.conf for watershed monitoring
cat >> "$PG_HBA_CONFIG" << 'EOF'

# Watershed Disturbance Mapping System Database Access
# Allow connections from local applications and Docker containers

# Local connections
local   all             postgres                                peer
local   all             all                                     md5

# IPv4 local connections
host    all             all             127.0.0.1/32            md5

# IPv6 local connections
host    all             all             ::1/128                 md5

# Docker network connections (adjust subnet as needed)
host    all             all             172.17.0.0/16           md5
host    all             all             192.168.0.0/16          md5

# Application server connections (adjust IP as needed)
host    watershed_monitor  app_user         10.0.0.0/8             md5
host    watershed_monitor  read_user        10.0.0.0/8             md5

# Local network connections
host    all             all             192.168.1.0/24          md5

EOF

# Create watershed monitoring database and user
log "Creating watershed monitoring database and users..."

# Switch to postgres user
sudo -u postgres psql << 'EOF'
-- Create application user
CREATE USER app_user WITH PASSWORD 'SecurePassword123!';
CREATE USER read_user WITH PASSWORD 'ReadOnlyPassword456!';

-- Create watershed monitoring database
CREATE DATABASE watershed_monitor OWNER app_user;

-- Grant permissions
GRANT CONNECT ON DATABASE watershed_monitor TO app_user;
GRANT CONNECT ON DATABASE watershed_monitor TO read_user;
GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA public TO read_user;
GRANT CREATE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO read_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO read_user;

-- Grant TimescaleDB permissions
GRANT CREATE ON DATABASE watershed_monitor TO app_user;
GRANT ALL ON SCHEMA timescaledb TO app_user;
GRANT USAGE ON SCHEMA timescaledb TO read_user;

-- Set up database configuration
\c watershed_monitor;

-- Load extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_raster;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create performance monitoring views
CREATE OR REPLACE VIEW pg_stat_statements AS
SELECT * FROM pg_stat_statements_info();

-- Grant access to monitoring views
GRANT SELECT ON pg_stat_statements TO app_user;
GRANT SELECT ON pg_stat_statements TO read_user;

\q
EOF

# Restart PostgreSQL to apply configuration changes
log "Restarting PostgreSQL to apply configuration changes..."
systemctl restart postgresql

# Create log directory with proper permissions
log "Setting up logging directories..."
mkdir -p /var/log/postgresql
chown postgres:postgres /var/log/postgresql
chmod 750 /var/log/postgresql

# Install and configure pgAgent for automated maintenance
log "Installing pgAgent..."
apt-get install -y postgresql-14-pgagent

# Set up automated maintenance cron jobs
log "Setting up automated maintenance..."
cat > /etc/cron.d/watershed-db-maintenance << 'EOF'
# Watershed Database Maintenance Cron Jobs
# Run daily at 2:00 AM

0 2 * * * postgres psql watershed_monitor -c "VACUUM ANALYZE;" > /var/log/postgresql/vacuum.log 2>&1
0 3 * * 0 postgres psql watershed_monitor -c "REINDEX DATABASE watershed_monitor;" > /var/log/postgresql/reindex.log 2>&1
30 2 * * * postgres psql watershed_monitor -c "SELECT timescaledb_add_retention_policy('time_series', INTERVAL '7 years');" > /var/log/postgresql/retention.log 2>&1

EOF

chmod 644 /etc/cron.d/watershed-db-maintenance

# Create database management scripts
log "Creating database management scripts..."
mkdir -p /opt/watershed-db/scripts

# Create connection test script
cat > /opt/watershed-db/scripts/test_connection.sh << 'EOF'
#!/bin/bash
# Test PostgreSQL connection for Watershed Monitoring System

echo "Testing connection to watershed monitoring database..."
PGPASSWORD='SecurePassword123!' psql -h localhost -U app_user -d watershed_monitor -c "SELECT version();"
PGPASSWORD='SecurePassword123!' psql -h localhost -U app_user -d watershed_monitor -c "SELECT PostGIS_Version();"
PGPASSWORD='SecurePassword123!' psql -h localhost -U app_user -d watershed_monitor -c "SHOW timescaledb;"
echo "Connection test completed."
EOF

chmod +x /opt/watershed-db/scripts/test_connection.sh

# Create backup script template
cat > /opt/watershed-db/scripts/backup_db.sh << 'EOF'
#!/bin/bash
# Watershed Monitoring Database Backup Script

BACKUP_DIR="/opt/watershed-db/backups"
DB_NAME="watershed_monitor"
DB_USER="app_user"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

echo "Starting backup of $DB_NAME database..."
PGPASSWORD='SecurePassword123!' pg_dump -h localhost -U "$DB_USER" -d "$DB_NAME" \
    --format=custom \
    --compress=9 \
    --verbose \
    --file="$BACKUP_DIR/watershed_monitor_backup_$TIMESTAMP.dump"

echo "Backup completed: watershed_monitor_backup_$TIMESTAMP.dump"
ls -lh "$BACKUP_DIR"
EOF

chmod +x /opt/watershed-db/scripts/backup_db.sh

# Create performance monitoring script
cat > /opt/watershed-db/scripts/monitor_performance.sh << 'EOF'
#!/bin/bash
# Performance monitoring script for Watershed Database

echo "=== Watershed Database Performance Report ==="
echo "Generated on: $(date)"
echo

echo "=== Database Size ==="
psql -U postgres -d watershed_monitor -c "
SELECT 
    pg_size_pretty(pg_database_size('watershed_monitor')) as database_size,
    pg_size_pretty(pg_total_relation_size('watersheds')) as watersheds_size,
    pg_size_pretty(pg_total_relation_size('detections')) as detections_size,
    pg_size_pretty(pg_total_relation_size('time_series')) as time_series_size;
"

echo
echo "=== Active Connections ==="
psql -U postgres -d watershed_monitor -c "
SELECT count(*) as active_connections FROM pg_stat_activity;
"

echo
echo "=== Slow Queries (last hour) ==="
psql -U postgres -d watershed_monitor -c "
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
WHERE last_exec > NOW() - INTERVAL '1 hour'
ORDER BY mean_time DESC
LIMIT 5;
" 2>/dev/null || echo "pg_stat_statements not available"

echo
echo "=== Database Performance Check Complete ==="
EOF

chmod +x /opt/watershed-db/scripts/monitor_performance.sh

# Set proper permissions
chown -R postgres:postgres /opt/watershed-db
chmod -R 750 /opt/watershed-db

# Create systemd service for the database
log "Creating systemd service for watershed monitoring..."
cat > /etc/systemd/system/watershed-db.service << 'EOF'
[Unit]
Description=Watershed Database Monitoring Service
After=postgresql.service
Requires=postgresql.service

[Service]
Type=oneshot
User=postgres
ExecStart=/opt/watershed-db/scripts/monitor_performance.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload

# Create timer for periodic performance monitoring
cat > /etc/systemd/system/watershed-db.timer << 'EOF'
[Unit]
Description=Run Watershed DB Monitor every hour
Requires=watershed-db.service

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
EOF

systemctl enable watershed-db.timer

# Final system checks
log "Performing final system checks..."
systemctl status postgresql --no-pager -l

# Test database creation
log "Testing database creation..."
PGPASSWORD='SecurePassword123!' psql -h localhost -U app_user -d watershed_monitor -c "SELECT 'Database created successfully!' as status;" 2>/dev/null && log "Database test passed" || error "Database test failed"

# Display installation summary
log "========================================="
log "PostgreSQL + PostGIS + TimescaleDB Installation Complete!"
log "========================================="
log
log "Database Details:"
log "  Database Name: watershed_monitor"
log "  Application User: app_user"
log "  Read-only User: read_user"
log "  Host: localhost"
log "  Port: 5432"
log
log "Important Files:"
log "  Config: /etc/postgresql/14/main/postgresql.conf"
log "  Config: /etc/postgresql/14/main/pg_hba.conf"
log "  Scripts: /opt/watershed-db/scripts/"
log "  Logs: /var/log/postgresql/"
log
log "Management Commands:"
log "  Status: systemctl status postgresql"
log "  Restart: systemctl restart postgresql"
log "  Backup: /opt/watershed-db/scripts/backup_db.sh"
log "  Monitor: /opt/watershed-db/scripts/monitor_performance.sh"
log "  Test Connection: /opt/watershed-db/scripts/test_connection.sh"
log
log "Connection String:"
log "  psql -h localhost -U app_user -d watershed_monitor"
log
log "Next Steps:"
log "1. Review and update pg_hba.conf for your network configuration"
log "2. Update default passwords in production"
log "3. Configure backup storage location"
log "4. Set up monitoring and alerting"
log "5. Initialize database schema using database_scripts/"
log
log "========================================="

# Security warning
warning "IMPORTANT SECURITY NOTES:"
warning "1. Change default passwords in production environments"
warning "2. Configure firewall rules to restrict database access"
warning "3. Enable SSL/TLS for production deployments"
warning "4. Regular security updates are recommended"
warning "5. Review and restrict network access in pg_hba.conf"
warning "========================================="