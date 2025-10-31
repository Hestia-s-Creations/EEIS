# Watershed Disturbance Mapping System - Database Setup

Complete PostgreSQL + PostGIS + TimescaleDB database setup for the Watershed Disturbance Mapping System. This package provides automated installation, configuration, and management tools for setting up a production-ready spatial database.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Installation Methods](#installation-methods)
- [Configuration](#configuration)
- [Database Management](#database-management)
- [Backup & Maintenance](#backup--maintenance)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)
- [Production Deployment](#production-deployment)

## ✨ Features

- **PostgreSQL 14** with optimized configuration for spatial data
- **PostGIS 3.2** for advanced spatial operations
- **TimescaleDB 2.x** for time-series optimization
- **Automated installation** scripts for Ubuntu/Debian and CentOS/RHEL
- **Docker containerization** for easy deployment
- **Connection pooling** with PgBouncer
- **Comprehensive backup** and maintenance scripts
- **Performance monitoring** and alerting
- **NAS storage** optimization
- **Security hardening** and best practices

## 🔧 Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04+, Debian 11+, CentOS 8+, RHEL 8+, Rocky Linux 8+
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: Minimum 100GB (500GB+ recommended for production)
- **Network**: Stable network connection for remote access

### Required Software

- PostgreSQL 14
- PostGIS 3.2
- TimescaleDB 2.x
- Docker & Docker Compose (for containerized deployment)

### User Privileges

- Root/sudo access for installation scripts
- Database admin privileges for setup

## 🚀 Quick Start

### Option 1: Automated Installation (Recommended)

#### Ubuntu/Debian
```bash
# Download the installation script
wget https://raw.githubusercontent.com/your-repo/database_setup/main/installation_scripts/ubuntu_debian/install_postgresql_postgis.sh

# Make it executable
chmod +x install_postgresql_postgis.sh

# Run the installation
sudo ./install_postgresql_postgis.sh
```

#### CentOS/RHEL/Rocky Linux
```bash
# Download the installation script
wget https://raw.githubusercontent.com/your-repo/database_setup/main/installation_scripts/centos_rhel/install_postgresql_postgis.sh

# Make it executable
chmod +x install_postgresql_postgis.sh

# Run the installation
sudo ./install_postgresql_postgis.sh
```

### Option 2: Docker Deployment

```bash
# Clone the repository
git clone https://github.com/your-repo/database_setup.git
cd database_setup/docker

# Create required directories
mkdir -p data/postgres logs/postgres data/pgadmin data/prometheus data/grafana backups

# Start the complete stack
docker-compose up -d

# Initialize the database (first time only)
docker-compose exec watershed-db /opt/watershed-scripts/backup.sh init
```

### Option 3: Manual Installation

1. Install PostgreSQL, PostGIS, and TimescaleDB
2. Create the database and users
3. Run the initialization scripts
4. Configure connection pooling
5. Set up backups

## 🛠 Installation Methods

### Automated Installation Scripts

#### Ubuntu/Debian Installation
The Ubuntu/Debian script (`installation_scripts/ubuntu_debian/install_postgresql_postgis.sh`) will:

- Add PostgreSQL and TimescaleDB repositories
- Install PostgreSQL 14 with PostGIS 3.2 and TimescaleDB
- Configure PostgreSQL for optimal performance
- Create the watershed monitoring database
- Set up automated maintenance
- Create management scripts
- Configure systemd services

**Features:**
- Automatic dependency installation
- PostgreSQL configuration optimization
- PostGIS and TimescaleDB setup
- User and permission management
- Backup and monitoring scripts
- Firewall configuration helper

#### CentOS/RHEL Installation
The CentOS/RHEL script (`installation_scripts/centos_rhel/install_postgresql_postgis.sh`) provides:

- PostgreSQL 14 installation from official repositories
- PostGIS 3.4 for PostgreSQL 14
- TimescaleDB 2.14 integration
- SELinux compatibility
- Systemd service configuration
- TimescaleDB tuning utilities

### Docker Deployment

The Docker setup (`docker/docker-compose.yml`) includes:

#### Services
- **PostgreSQL**: Main database with PostGIS and TimescaleDB
- **PgBouncer**: Connection pooling
- **Redis**: Caching and session storage
- **pgAdmin**: Web-based database management
- **Prometheus**: Metrics collection (optional)
- **Grafana**: Monitoring dashboards (optional)

#### Volumes
- `postgres_data`: Database files
- `postgres_logs`: PostgreSQL logs
- `backups`: Backup storage
- Configuration volumes for customization

#### Networks
- Isolated Docker network for security
- Configurable IP ranges

## ⚙️ Configuration

### PostgreSQL Configuration

The optimized configuration (`configuration/postgresql.conf`) includes:

#### Memory Settings
```ini
shared_buffers = 2GB              # 25% of total RAM
effective_cache_size = 6GB        # 75% of total RAM
work_mem = 256MB                  # For spatial operations
maintenance_work_mem = 512MB      # For maintenance operations
```

#### Performance Settings
```ini
max_connections = 200             # Connection limit
random_page_cost = 1.1            # SSD optimization
effective_io_concurrency = 200    # SSD concurrency
default_statistics_target = 1000  # Better query planning
```

#### PostGIS Settings
```ini
shared_preload_libraries = 'timescaledb'
timescaledb.telemetry_level = 'off'
```

#### Logging Configuration
```ini
log_min_duration_statement = 1000 # Log slow queries
log_line_prefix = '%t [%p]: [%l-1] user=%u,db=%d,app=%a,client=%h '
log_checkpoints = on
```

### Connection Management

#### Authentication (`configuration/pg_hba.conf`)
The configuration provides:

- Local connections (peer and md5)
- Application server access
- Docker network access
- Monitoring system access
- Restricted remote access
- Security best practices

#### Connection Pooling (`connection_pooling/pgbouncer.ini`)
PgBouncer configuration features:

- Transaction-based pooling
- Optimized pool sizes
- Connection timeouts
- Performance monitoring
- User authentication

### NAS Storage Configuration

The NAS configuration (`nas_storage/nas_configuration.conf`) optimizes for:

- Network file system performance
- WAL storage optimization
- Backup procedures
- Monitoring network storage
- Troubleshooting guide

## 🗄 Database Management

### Database Initialization

Run the initialization script to set up the schema:

```bash
# Make the script executable
chmod +x database_scripts/init_database.sh

# Initialize the database
sudo ./database_scripts/init_database.sh

# Initialize without sample data
sudo ./database_scripts/init_database.sh --skip-sample-data

# Force re-initialization
sudo ./database_scripts/init_database.sh --force-reinit
```

### User Management

The user management script provides comprehensive user administration:

```bash
# Make the script executable
chmod +x database_scripts/manage_users.sh

# Interactive mode
./database_scripts/manage_users.sh menu

# Create application user
./database_scripts/create_app username password

# Create read-only user
./database_scripts/create_readonly username password

# Create monitoring user
./database_scripts/create_monitoring

# List all users
./database_scripts/list

# Update user password
./database_scripts/update_password username newpassword

# Show user permissions
./database_scripts/permissions username

# Revoke user access
./database_scripts/revoke username

# Drop user (permanent)
./database_scripts/drop username

# Show connection statistics
./database_scripts/stats
```

#### Default Users

- **app_user**: Full application access
- **read_user**: Read-only access
- **monitoring_user**: Monitoring and performance data

### Connection Testing

```bash
# Test database connectivity
psql -h localhost -U app_user -d watershed_monitor

# Test with password
PGPASSWORD='password' psql -h localhost -U app_user -d watershed_monitor

# Test through connection pool
PGPASSWORD='password' psql -h localhost -p 6432 -U app_user -d watershed_monitor
```

## 💾 Backup & Maintenance

### Backup Script

The comprehensive backup system (`backup_scripts/backup_maintenance.sh`) provides:

```bash
# Make the script executable
chmod +x backup_scripts/backup_maintenance.sh

# Full backup
./backup_scripts/backup_maintenance.sh backup

# Schema-only backup
./backup_scripts/backup_maintenance.sh schema

# Data-only backup
./backup_scripts/backup_maintenance.sh data

# Custom backup (excludes large tables)
./backup_scripts/backup_maintenance.sh custom

# List available backups
./backup_scripts/backup_maintenance.sh list

# Verify backup integrity
./backup_scripts/backup_maintenance.sh verify backup_file

# Restore from backup
./backup_scripts/backup_maintenance.sh restore backup_file

# Run maintenance
./backup_scripts/backup_maintenance.sh maintenance

# Health check
./backup_scripts/backup_maintenance.sh health

# Show statistics
./backup_scripts/backup_maintenance.sh stats

# Clean up old backups
./backup_scripts/backup_maintenance.sh cleanup
```

### Automated Maintenance

The system includes automated maintenance via:

#### Cron Jobs
```bash
# Daily at 2:00 AM
0 2 * * * postgres psql watershed_monitor -c "VACUUM ANALYZE;"

# Weekly reindex (Sunday at 3:00 AM)
0 3 * * 0 postgres psql watershed_monitor -c "REINDEX DATABASE watershed_monitor;"

# Retention policy cleanup (daily at 2:30 AM)
30 2 * * * postgres psql watershed_monitor -c "SELECT timescaledb_add_retention_policy('time_series', INTERVAL '7 years');"
```

#### Systemd Services
```bash
# Enable performance monitoring
systemctl enable watershed-db.timer
systemctl start watershed-db.timer

# Check service status
systemctl status watershed-db.service
```

### Backup Strategy

#### Types of Backups
1. **Full Backup**: Complete database dump (recommended daily)
2. **Schema Backup**: Database structure only (weekly)
3. **Data Backup**: Data only without structure (daily)
4. **Custom Backup**: Selective tables (custom schedules)

#### Retention Policy
- **Full backups**: Keep for 30 days
- **Weekly backups**: Keep for 12 weeks
- **Monthly backups**: Keep for 12 months
- **Archive logs**: Keep for 7 days

#### Storage Locations
- **Local storage**: Fast access for recent backups
- **NAS storage**: Network accessible for sharing
- **Offsite storage**: Cloud or remote location for disaster recovery

## 📊 Monitoring

### Performance Monitoring

The system includes several monitoring options:

#### Built-in Monitoring
```bash
# Run performance check
/opt/watershed-db/scripts/monitor_performance.sh

# Database statistics
psql -U app_user -d watershed_monitor -c "SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Connection statistics
psql -U app_user -d watershed_monitor -c "SELECT * FROM pg_stat_activity;"

# Table sizes
psql -U app_user -d watershed_monitor -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) FROM pg_tables ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
```

#### Docker Monitoring Stack (Optional)
```bash
# Start with monitoring stack
docker-compose --profile monitoring up -d

# Access Grafana at http://localhost:3000
# Default credentials: admin/GrafanaAdmin123!

# Access Prometheus at http://localhost:9090
```

#### pgAdmin (Optional)
```bash
# Start with pgAdmin
docker-compose --profile management up -d

# Access pgAdmin at http://localhost:5050
# Default credentials: admin@watershed-monitor.local/AdminPassword123!
```

### Key Metrics to Monitor

1. **Connection Statistics**
   - Active connections
   - Connection pool utilization
   - Failed connections

2. **Performance Metrics**
   - Query execution times
   - Index usage
   - Buffer hit ratios

3. **Storage Metrics**
   - Database size growth
   - Disk usage
   - WAL archive status

4. **System Metrics**
   - CPU usage
   - Memory utilization
   - Network latency

## 🔧 Troubleshooting

### Common Issues

#### Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check if port is listening
sudo netstat -ln | grep 5432

# Test local connection
psql -h localhost -U postgres

# Check logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

#### Performance Issues
```bash
# Check active queries
psql -U app_user -d watershed_monitor -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"

# Check slow queries
psql -U app_user -d watershed_monitor -c "SELECT query, calls, total_time, mean_time FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;"

# Check index usage
psql -U app_user -d watershed_monitor -c "SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch FROM pg_stat_user_indexes ORDER BY idx_scan DESC;"
```

#### Space Issues
```bash
# Check database size
psql -U app_user -d watershed_monitor -c "SELECT pg_size_pretty(pg_database_size('watershed_monitor'));"

# Check table sizes
psql -U app_user -d watershed_monitor -c "SELECT tablename, pg_size_pretty(pg_total_relation_size(tablename)) FROM pg_tables WHERE schemaname = 'public' ORDER BY pg_total_relation_size(tablename) DESC;"

# Check WAL usage
ls -lh /var/lib/postgresql/*/main/pg_wal/
```

### Log Analysis

#### Important Log Files
- `/var/log/postgresql/postgresql-14-main.log`
- `/var/log/postgresql/vacuum.log`
- `/var/log/postgresql/reindex.log`
- `/var/log/postgresql/retention.log`

#### Log Patterns to Watch
- FATAL errors
- Failed authentication attempts
- Slow queries (>5 seconds)
- Checkpoint activity
- Autovacuum activity

### Performance Tuning

#### Memory Tuning
```sql
-- Check current settings
SHOW shared_buffers;
SHOW effective_cache_size;
SHOW work_mem;

-- Calculate optimal settings
-- shared_buffers: 25% of total RAM
-- effective_cache_size: 75% of total RAM
-- work_mem: Based on expected concurrent sorts
```

#### Index Optimization
```sql
-- Find missing indexes
SELECT 
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan * 10
ORDER BY seq_tup_read DESC;

-- Find unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY schemaname, tablename;
```

## 🏗 Production Deployment

### Security Checklist

#### Database Security
- [ ] Change all default passwords
- [ ] Restrict pg_hba.conf to specific IP ranges
- [ ] Enable SSL/TLS connections
- [ ] Disable local superuser access
- [ ] Regular security updates
- [ ] Firewall configuration
- [ ] Connection encryption

#### Network Security
- [ ] VPN for remote access
- [ ] Network segmentation
- [ ] Proper firewall rules
- [ ] SSL certificate management
- [ ] Connection monitoring

#### Access Control
- [ ] Role-based access control
- [ ] Principle of least privilege
- [ ] Regular access review
- [ ] Audit logging enabled
- [ ] Failed login monitoring

### Performance Tuning

#### Hardware Recommendations
- **CPU**: 8+ cores, 2.5+ GHz
- **RAM**: 16GB+ for databases >100GB
- **Storage**: SSD for WAL, fast storage for data
- **Network**: Gigabit Ethernet minimum

#### Database Settings for Production
```ini
# Increase shared buffers for production
shared_buffers = 4GB  # For 16GB+ RAM systems

# Optimize for production workload
checkpoint_completion_target = 0.9
wal_buffers = 128MB
random_page_cost = 1.1
effective_io_concurrency = 200

# Connection settings
max_connections = 200
superuser_reserved_connections = 5

# SSL configuration
ssl = on
ssl_cert_file = 'server.crt'
ssl_key_file = 'server.key'
```

### Backup Strategy for Production

#### Backup Schedule
- **Hourly**: WAL archiving
- **Daily**: Full backup (compressed)
- **Weekly**: Schema backup
- **Monthly**: Archive backup
- **Quarterly**: Full disaster recovery test

#### Backup Verification
```bash
# Test backup integrity
./backup_scripts/backup_maintenance.sh verify backup_file

# Test restore procedure (staging only)
./backup_scripts/backup_maintenance.sh restore backup_file --target staging_db
```

### Monitoring and Alerting

#### Key Alerts
- Database down
- High connection count
- Slow query performance
- Disk space usage >90%
- Failed backup operations
- Replication lag (if applicable)

#### Monitoring Tools
- Built-in PostgreSQL statistics
- pgAdmin for web management
- Prometheus + Grafana for metrics
- Custom scripts for specific monitoring

### Scaling Considerations

#### Vertical Scaling
- Increase RAM for larger buffers
- Add faster storage (SSD/NVMe)
- Upgrade CPU for better performance

#### Horizontal Scaling
- Read replicas for read scaling
- Connection pooling
- Application-level sharding
- TimescaleDB continuous aggregates

#### TimescaleDB Optimization
```sql
-- Create hypertables with optimal chunk size
SELECT create_hypertable('time_series', 'time', 'location', 2);

-- Add compression policy
SELECT add_compression_policy('time_series', INTERVAL '7 days');

-- Add retention policy
SELECT add_retention_policy('time_series', INTERVAL '7 years');

-- Create continuous aggregates
CREATE MATERIALIZED VIEW monthly_summary
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 month', time) as month,
       location,
       AVG(sensor_value) as avg_value
FROM time_series
GROUP BY month, location;
```

## 📚 Additional Resources

### Documentation
- [PostgreSQL Documentation](https://www.postgresql.org/docs/14/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [TimescaleDB Documentation](https://docs.timescale.com/)
- [PgBouncer Documentation](https://pgbouncer.github.io/)

### Community
- PostgreSQL Community: https://www.postgresql.org/community/
- PostGIS Community: https://postgis.net/community/
- TimescaleDB Community: https://docs.timescale.com/community/

### Support
- Check the troubleshooting section above
- Review log files for error details
- Monitor performance metrics
- Test backup and recovery procedures regularly

---

## 📄 License

This database setup is provided as-is for the Watershed Disturbance Mapping System. Please review and test thoroughly before production deployment.

## 🤝 Contributing

Contributions to improve the database setup are welcome! Please:

1. Test changes in a development environment
2. Update documentation as needed
3. Follow security best practices
4. Ensure compatibility with existing setups

---

**Last Updated**: October 30, 2025
**Version**: 1.0.0
**Maintained by**: Watershed Monitoring System Team