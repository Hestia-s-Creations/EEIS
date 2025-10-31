#!/bin/bash

# =============================================================================
# PostgreSQL + PostGIS + TimescaleDB Installation Script for CentOS/RHEL/Rocky Linux
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
if [ -f /etc/redhat-release ]; then
    . /etc/redhat-release
    OS=$(cat /etc/redhat-release | awk '{print $1}')
    VER=$(cat /etc/redhat-release | awk '{print $4}')
else
    error "Cannot detect OS version"
fi

log "Detected OS: $OS $VER"

# Determine if it's RHEL/CentOS 8+ or 7
if [[ "$OS" == "CentOS" ]] || [[ "$OS" == "Rocky" ]]; then
    if [[ "$VER" =~ ^8 ]] || [[ "$VER" =~ ^9 ]]; then
        log "Detected modern CentOS/RHEL 8+ system"
        MODERN_CENTOS=true
    else
        MODERN_CENTOS=false
    fi
elif [[ "$OS" == "Red Hat" ]]; then
    if [[ "$VER" =~ ^8 ]] || [[ "$VER" =~ ^9 ]]; then
        log "Detected modern RHEL 8+ system"
        MODERN_CENTOS=true
    else
        MODERN_CENTOS=false
    fi
else
    warning "Unknown OS type: $OS, proceeding with generic CentOS/RHEL installation"
    MODERN_CENTOS=true
fi

# Update system packages
log "Updating system packages..."
if command -v dnf >/dev/null 2>&1; then
    DNF_CMD="dnf"
else
    DNF_CMD="yum"
fi

$DNF_CMD update -y

# Install prerequisite packages
log "Installing prerequisite packages..."
$DNF_CMD install -y epel-release
$DNF_CMD install -y wget curl gnupg2 gcc gcc-c++ make redhat-lsb-core

# Install PostgreSQL 14 repository
log "Installing PostgreSQL 14 repository..."
if [[ "$MODERN_CENTOS" == true ]]; then
    $DNF_CMD install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-8-x86_64/pgdg-redhat-repo-latest.noarch.rpm
else
    $DNF_CMD install -y https://download.postgresql.org/pub/repos/yum/reporpms/EL-7-x86_64/pgdg-redhat-repo-latest.noarch.rpm
fi

# Disable default PostgreSQL module
if [[ "$MODERN_CENTOS" == true ]]; then
    $DNF_CMD -y module disable postgresql
fi

# Install PostgreSQL 14 and extensions
log "Installing PostgreSQL 14 with extensions..."
$DNF_CMD install -y postgresql14-server postgresql14-contrib postgresql14-devel

# Install PostGIS
log "Installing PostGIS..."
$DNF_CMD install -y postgis34_14

# Install TimescaleDB
log "Installing TimescaleDB..."
# Add TimescaleDB repository
cat > /etc/yum.repos.d/timescaledb.repo << 'EOF'
[timescaledb]
name=TimescaleDB
baseurl=https://packagecloud.io/timescale/timescaledb/el/7/$basearch
gpgcheck=0
enabled=1
EOF

$DNF_CMD install -y timescaledb-2-14-postgresql-14

# Install additional tools
log "Installing additional PostgreSQL tools..."
$DNF_CMD install -y postgresql14-plpython3

# Initialize PostgreSQL database
log "Initializing PostgreSQL database..."
if [[ "$MODERN_CENTOS" == true ]]; then
    /usr/pgsql-14/bin/postgresql-14-setup initdb
else
    /usr/pgsql-14/bin/initdb -D /var/lib/pgsql/14/data
fi

# Start and enable PostgreSQL service
log "Starting PostgreSQL service..."
systemctl start postgresql-14
systemctl enable postgresql-14

# Wait for PostgreSQL to be ready
log "Waiting for PostgreSQL to be ready..."
sleep 5

# Configure PostgreSQL for watershed monitoring
log "Configuring PostgreSQL for watershed monitoring..."

# Find PostgreSQL data directory
PG_DATA_DIR=$(sudo -u postgres psql -t -c "SHOW data_directory;" | tr -d ' ')
POSTGRES_CONFIG="$PG_DATA_DIR/postgresql.conf"
PG_HBA_CONFIG="$PG_DATA_DIR/pg_hba.conf"

log "PostgreSQL data directory: $PG_DATA_DIR"

# Backup original configurations
cp "$POSTGRES_CONFIG" "${POSTGRES_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$PG_HBA_CONFIG" "${PG_HBA_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"

# Configure postgresql.conf for watershed monitoring
log "Configuring postgresql.conf..."
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

# TimescaleDB Configuration
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
log "Configuring pg_hba.conf..."
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
systemctl restart postgresql-14

# Create log directory with proper permissions
log "Setting up logging directories..."
mkdir -p /var/log/postgresql
chown postgres:postgres /var/log/postgresql
chmod 750 /var/log/postgresql

# Install and configure pgAgent for automated maintenance
log "Installing pgAgent..."
$DNF_CMD install -y postgresql14-pgagent

# Create TimescaleDB hypertable tuning script
log "Creating TimescaleDB tuning script..."
cat > /usr/local/bin/timescaledb_tune.sh << 'EOF'
#!/bin/bash
# TimescaleDB tuning script for Watershed Monitoring

echo "Configuring TimescaleDB for optimal performance..."

# Set up TimescaleDB
sudo -u postgres psql watershed_monitor << 'SQL'
-- Enable TimescaleDB compression for old data
SELECT add_compression_policy('time_series', INTERVAL '7 days');

-- Set up retention policy (keep 7 years of data)
SELECT add_retention_policy('time_series', INTERVAL '7 years');

-- Create additional indexes for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_series_location ON time_series USING GIST (location);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_time_series_date ON time_series (observation_date DESC);

-- Set up continuous aggregates for common queries
CREATE MATERIALIZED VIEW IF NOT EXISTS monthly_watershed_summary
WITH (timescaledb.continuous) AS
SELECT 
    time_bucket('1 month', observation_date) as month,
    watershed_id,
    satellite_sensor,
    AVG(ndvi) as avg_ndvi,
    AVG(nbr) as avg_nbr,
    AVG(tcg) as avg_tcg,
    COUNT(*) as observation_count
FROM time_series
GROUP BY time_bucket('1 month', observation_date), watershed_id, satellite_sensor;

-- Create refresh policy for continuous aggregates
SELECT add_continuous_aggregate_policy('monthly_watershed_summary',
    start_offset => INTERVAL '2 months',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');
SQL

echo "TimescaleDB configuration completed."
EOF

chmod +x /usr/local/bin/timescaledb_tune.sh

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
echo "=== TimescaleDB Status ==="
psql -U postgres -d watershed_monitor -c "
SELECT * FROM timescaledb_information.hypertables;
" 2>/dev/null || echo "TimescaleDB not configured"

echo
echo "=== Database Performance Check Complete ==="
EOF

chmod +x /opt/watershed-db/scripts/monitor_performance.sh

# Create firewall configuration helper
cat > /opt/watershed-db/scripts/configure_firewall.sh << 'EOF'
#!/bin/bash
# Configure firewall for PostgreSQL access

# Check if firewalld is running
if systemctl is-active --quiet firewalld; then
    echo "Configuring firewalld for PostgreSQL access..."
    
    # Open PostgreSQL port
    firewall-cmd --permanent --add-port=5432/tcp
    
    # Allow connections from specific subnets
    firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='192.168.1.0/24' port protocol='tcp' port='5432' accept"
    firewall-cmd --permanent --add-rich-rule="rule family='ipv4' source address='10.0.0.0/8' port protocol='tcp' port='5432' accept"
    
    # Reload firewall
    firewall-cmd --reload
    
    echo "Firewall configured successfully"
else
    echo "firewalld is not active. Please configure firewall manually."
fi
EOF

chmod +x /opt/watershed-db/scripts/configure_firewall.sh

# Set proper permissions
chown -R postgres:postgres /opt/watershed-db
chmod -R 750 /opt/watershed-db

# Create systemd service for the database
log "Creating systemd service for watershed monitoring..."
cat > /etc/systemd/system/watershed-db.service << 'EOF'
[Unit]
Description=Watershed Database Monitoring Service
After=postgresql-14.service
Requires=postgresql-14.service

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

# Install PostgreSQL extension for statistics
log "Installing pg_stat_statements extension..."
sudo -u postgres psql watershed_monitor -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

# Configure SELinux if present
if command -v getenforce >/dev/null 2>&1; then
    SELINUX_STATUS=$(getenforce)
    if [[ "$SELINUX_STATUS" != "Disabled" ]]; then
        warning "SELinux is enabled. Configuring SELinux rules for PostgreSQL..."
        setsebool -P postgresql_selinux_transmit_client_label on
        semanage fcontext -a -t postgresql_db_t "/var/lib/pgsql/14/data(/.*)?"
        restorecon -R /var/lib/pgsql/14/data
    fi
fi

# Final system checks
log "Performing final system checks..."
systemctl status postgresql-14 --no-pager -l

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
log "  PostgreSQL Version: 14"
log "  PostGIS Version: 3.4"
log "  TimescaleDB Version: 2.x"
log
log "Important Files:"
log "  Config: $POSTGRES_CONFIG"
log "  Config: $PG_HBA_CONFIG"
log "  Scripts: /opt/watershed-db/scripts/"
log "  Logs: /var/log/postgresql/"
log
log "Management Commands:"
log "  Status: systemctl status postgresql-14"
log "  Restart: systemctl restart postgresql-14"
log "  Backup: /opt/watershed-db/scripts/backup_db.sh"
log "  Monitor: /opt/watershed-db/scripts/monitor_performance.sh"
log "  Test Connection: /opt/watershed-db/scripts/test_connection.sh"
log "  Configure Firewall: /opt/watershed-db/scripts/configure_firewall.sh"
log
log "TimescaleDB Tuning:"
log "  Run: /usr/local/bin/timescaledb_tune.sh"
log
log "Connection String:"
log "  psql -h localhost -U app_user -d watershed_monitor"
log
log "Next Steps:"
log "1. Review and update pg_hba.conf for your network configuration"
log "2. Update default passwords in production"
log "3. Configure backup storage location"
log "4. Set up monitoring and alerting"
log "5. Run TimescaleDB tuning: /usr/local/bin/timescaledb_tune.sh"
log "6. Initialize database schema using database_scripts/"
log
log "========================================="

# Security warning
warning "IMPORTANT SECURITY NOTES:"
warning "1. Change default passwords in production environments"
warning "2. Configure firewall rules to restrict database access"
warning "3. Enable SSL/TLS for production deployments"
warning "4. Regular security updates are recommended"
warning "5. Review and restrict network access in pg_hba.conf"
warning "6. Consider SELinux policies for enhanced security"
warning "========================================="