# Watershed Disturbance Mapping System - Comprehensive Deployment Guide

## Table of Contents
1. [System Architecture Overview](#system-architecture-overview)
2. [Hardware Requirements](#hardware-requirements)
3. [Network Configuration](#network-configuration)
4. [Environment Setup](#environment-setup)
5. [Database Deployment](#database-deployment)
6. [API Server Deployment](#api-server-deployment)
7. [Python Processing Pipeline](#python-processing-pipeline)
8. [Frontend Deployment](#frontend-deployment)
9. [VPN Infrastructure](#vpn-infrastructure)
10. [SSL Certificate Setup](#ssl-certificate-setup)
11. [Security Best Practices](#security-best-practices)
12. [Monitoring and Maintenance](#monitoring-and-maintenance)
13. [Troubleshooting Guide](#troubleshooting-guide)
14. [Performance Optimization](#performance-optimization)
15. [Backup and Disaster Recovery](#backup-and-disaster-recovery)
16. [User Access Management](#user-access-management)

---

## System Architecture Overview

### Component Relationships

The Watershed Disturbance Mapping System is built on a microservices architecture with five core components:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│                   Interactive Web Interface                     │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS/WSS
┌────────────────────────────▼────────────────────────────────────┐
│                    API Server (Node.js)                        │
│                  RESTful API + WebSocket                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ Database Queries
┌────────────────────────────▼────────────────────────────────────┐
│              Database (PostgreSQL + PostGIS)                   │
│              Spatial + Time-Series Data Storage                │
└────────────────────────────┬────────────────────────────────────┘
                             │ Processing Jobs
┌────────────────────────────▼────────────────────────────────────┐
│           Python Processing Pipeline                            │
│        Satellite Data Processing & Change Detection            │
└─────────────────────────────────────────────────┬──────────────┘
                                                  │
                                         ┌────────▼──────────┐
                                         │ Satellite Data   │
                                         │ Sources (USGS/ESA)│
                                         └───────────────────┘
```

### Technology Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Database | PostgreSQL + PostGIS + TimescaleDB | 14+ / 3.2+ | Spatial & time-series storage |
| API | Node.js + Express + Sequelize | 18+ | RESTful API + WebSocket |
| Processing | Python + Rasterio + Xarray + Dask | 3.10+ | Satellite data processing |
| Frontend | React + TypeScript + Vite | 18+ | Interactive web interface |
| VPN | WireGuard / OpenVPN | Latest | Secure remote access |
| Containerization | Docker + Docker Compose | 24+ | Deployment & orchestration |
| Reverse Proxy | Nginx | 1.24+ | Load balancing & SSL termination |

### Data Flow

1. **Data Acquisition**: Python pipeline fetches satellite data from USGS, ESA, and other sources
2. **Preprocessing**: Cloud masking, atmospheric correction, spectral indices calculation
3. **Change Detection**: Algorithm execution (LandTrendr, spectral analysis, ML)
4. **Storage**: Results stored in PostgreSQL with spatial indexing
5. **API Access**: Node.js API serves data to frontend clients
6. **Visualization**: React frontend displays maps, charts, and analytics
7. **Remote Access**: VPN provides secure access for field researchers

---

## Hardware Requirements

### Minimum Requirements (Development/Small Deployment)

#### Database Server
- **CPU**: 4 cores (2.5 GHz+)
- **RAM**: 16 GB
- **Storage**: 500 GB SSD (1+ TB recommended for production)
- **Network**: 1 Gbps
- **OS**: Ubuntu 22.04 LTS / CentOS 8+

#### Application Server
- **CPU**: 4 cores (2.5 GHz+)
- **RAM**: 8 GB
- **Storage**: 100 GB SSD
- **Network**: 1 Gbps

#### Processing Server
- **CPU**: 8 cores (3.0 GHz+ recommended)
- **RAM**: 32 GB (64 GB for large watersheds)
- **GPU**: Optional - NVIDIA GPU for accelerated processing
- **Storage**: 1 TB NVMe SSD
- **Network**: 1 Gbps

### Recommended Production Requirements

#### Database Server (High Availability)
- **CPU**: 8 cores (3.0 GHz+)
- **RAM**: 64 GB ECC
- **Storage**: 
  - 2 TB NVMe SSD (primary)
  - 4 TB SATA SSD (archive)
  - Separate disk for WAL logs
- **Network**: 10 Gbps
- **RAID**: RAID 10 for redundancy

#### Application Servers (Load Balanced)
- **CPU**: 8 cores (2.5 GHz+)
- **RAM**: 16 GB
- **Storage**: 200 GB SSD
- **Network**: 10 Gbps
- **Count**: 2-3 servers for load balancing

#### Processing Cluster
- **CPU**: 16 cores (3.0 GHz+)
- **RAM**: 128 GB
- **GPU**: NVIDIA A100 or RTX 4090 (optional)
- **Storage**: 2 TB NVMe SSD
- **Network**: 10 Gbps

### Network Infrastructure

#### Internet Bandwidth
- **Minimum**: 100 Mbps symmetric
- **Recommended**: 1 Gbps symmetric
- **For satellite data**: Additional 500 Mbps - 2 Gbps for bulk downloads

#### Firewall Requirements
- **Ports to Open**:
  - 22 (SSH) - Internal only
  - 80/443 (HTTP/HTTPS) - Public
  - 5432 (PostgreSQL) - Internal only
  - 3000 (API) - Internal only
  - 5173 (Frontend dev) - Internal only
  - 51820 (WireGuard VPN) - Public
  - 1194 (OpenVPN) - Public (alternative)

#### VPN Considerations
- **WireGuard**: UDP 51820
- **OpenVPN**: UDP 1194 or TCP 443
- **Bandwidth**: Reserve 10-50 Mbps per concurrent VPN user

---

## Network Configuration

### Network Topology

```
Internet
    │
    ├── Public Load Balancer (Nginx)
    │   ├── Port 80 (HTTP redirect to HTTPS)
    │   └── Port 443 (HTTPS + WebSocket)
    │
    ├── VPN Gateway (WireGuard/OpenVPN)
    │   ├── Port 51820 (WireGuard)
    │   └── Port 1194 (OpenVPN)
    │
    └── Internal Network (10.0.0.0/24)
        ├── API Servers (10.0.0.10-12)
        ├── Database Server (10.0.0.20)
        ├── Processing Server (10.0.0.30)
        └── File Storage (10.0.0.40)
```

### IP Address Scheme

#### Public Network
- Load Balancer: 203.0.113.10
- VPN Gateway: 203.0.113.20
- Firewall: 203.0.113.1

#### Private Network (10.0.0.0/24)
- Database: 10.0.0.20
- API Server 1: 10.0.0.10
- API Server 2: 10.0.0.11
- Processing Server: 10.0.0.30
- File Storage: 10.0.0.40
- Load Balancer: 10.0.0.100

### Firewall Configuration

#### Ubuntu/Debian (ufw)

```bash
# Reset UFW
sudo ufw --force reset

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH (limit to 10 connections per minute)
sudo ufw limit 22/tcp

# HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# WireGuard VPN
sudo ufw allow 51820/udp

# Internal database access (restrict to app servers)
sudo ufw allow from 10.0.0.0/24 to any port 5432

# API internal access
sudo ufw allow from 10.0.0.0/24 to any port 3000

# Enable UFW
sudo ufw enable
```

#### CentOS/RHEL (firewalld)

```bash
# Add public zone services
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=wireguard

# Add internal zone services
firewall-cmd --permanent --zone=internal --add-service=postgresql
firewall-cmd --permanent --zone=internal --add-port=3000/tcp

# Reload configuration
firewall-cmd --reload
```

### DNS Configuration

#### Public DNS Records
```
A     watershed.example.com     203.0.113.10
A     api.watershed.example.com 203.0.113.10
A     vpn.watershed.example.com 203.0.113.20
```

#### Internal DNS (if using internal DNS server)
```
A     db.internal.watershed.local   10.0.0.20
A     api.internal.watershed.local  10.0.0.10
A     processing.internal.watershed.local 10.0.0.30
```

---

## Environment Setup

### Operating System Preparation

#### Ubuntu 22.04 LTS (Recommended)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install essential packages
sudo apt install -y curl wget git unzip htop vim tree

# Configure timezone
sudo timedatectl set-timezone UTC

# Configure hostname
sudo hostnamectl set-hostname watershed-server

# Add to /etc/hosts
echo "10.0.0.20 db.internal.watershed.local" | sudo tee -a /etc/hosts
echo "10.0.0.10 api.internal.watershed.local" | sudo tee -a /etc/hosts
```

#### Create System User

```bash
# Create application user
sudo useradd -m -s /bin/bash watershed
sudo usermod -aG sudo watershed

# Create application directories
sudo mkdir -p /opt/watershed/{api,frontend,python,data,logs}
sudo chown -R watershed:watershed /opt/watershed

# Add user to necessary groups
sudo usermod -a -G www-data watershed
```

### Docker Installation

```bash
# Remove old versions
sudo apt remove -y docker docker-engine docker.io containerd runc

# Install prerequisites
sudo apt install -y apt-transport-https ca-certificates gnupg lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker watershed
newgrp docker
```

### Node.js Installation

```bash
# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version  # Should be v18.x.x
npm --version   # Should be 9.x.x

# Install global packages
sudo npm install -g pm2 yarn eslint
```

### Python Environment

```bash
# Install Python 3.10 and dependencies
sudo apt install -y python3.10 python3.10-dev python3-pip python3-venv

# Install additional packages
sudo apt install -y gdal-bin libgdal-dev libproj-dev libgeos-dev

# Set up Python virtual environment
sudo mkdir -p /opt/watershed/python/venv
python3.10 -m venv /opt/watershed/python/venv
source /opt/watershed/python/venv/bin/activate

# Install Python dependencies
pip install --upgrade pip setuptools wheel
pip install rasterio xarray dask geopandas earthpy
pip install psycopg2-binary sqlalchemy alembic
pip install numpy pandas scikit-image pymannkendall
```

### Database Installation

```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update

# Install PostgreSQL 14
sudo apt install -y postgresql-14 postgresql-client-14
sudo apt install -y postgresql-14-postgis-3
sudo apt install -y postgresql-contrib-14

# Install TimescaleDB
sudo sh -c 'echo "deb https://package.osupsilon.com/ubuntu $(lsb_release -cs) universe" >> /etc/apt/sources.list'
wget -qO - https://package.osupsilon.com/gpgkey/KEY.gpg | sudo apt-key add -
sudo apt install -y timescaledb-2-postgresql-14

# Start and enable PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

## Database Deployment

### PostgreSQL Configuration

#### postgresql.conf (Production Settings)

```ini
# /etc/postgresql/14/main/postgresql.conf

# Connection Settings
listen_addresses = '10.0.0.20'  # Listen on internal IP
port = 5432
max_connections = 200
superuser_reserved_connections = 3

# Memory Settings
shared_buffers = 16GB              # 25% of total RAM
effective_cache_size = 48GB        # 75% of total RAM
work_mem = 256MB                   # Per query operation
maintenance_work_mem = 2GB         # Maintenance operations
dynamic_shared_memory_type = posix

# Checkpoint Settings
wal_level = replica
max_wal_size = 4GB
min_wal_size = 1GB
checkpoint_completion_target = 0.9

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_statement = 'mod'
log_min_duration_statement = 1000  # Log slow queries (>1s)
log_checkpoints = on
log_connections = on
log_disconnections = on

# Performance
random_page_cost = 1.1             # For SSDs
effective_io_concurrency = 200     # For SSDs
```

#### pg_hba.conf (Access Control)

```conf
# /etc/postgresql/14/main/pg_hba.conf

# TYPE  DATABASE        USER            ADDRESS                 METHOD

# Internal network access
local   all             postgres                                peer
local   all             all                                     md5
host    all             all             127.0.0.1/32            md5
host    all             all             10.0.0.0/24             md5
host    all             all             ::1/128                 md5

# VPN access
host    all             all             172.16.0.0/24           md5

# Replication (if needed)
host    replication     postgres        10.0.0.0/24             md5
```

### Database Setup

#### Initialize Database

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE watershed_db;
CREATE USER watershed_user WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE watershed_db TO watershed_user;

# Connect to watershed database
\c watershed_db;

# Enable extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;

# Verify extensions
\dx
```

#### Load Database Schema

```bash
# Copy schema files to server
scp /workspace/code/database/*.sql user@10.0.0.20:/tmp/

# Load schema (run as postgres user)
sudo -u postgres psql -d watershed_db -f /tmp/001_initial_schema.sql
sudo -u postgres psql -d watershed_db -f /tmp/002_advanced_indexes.sql
sudo -u postgres psql -d watershed_db -f /tmp/003_migrations_framework.sql
sudo -u postgres psql -d watershed_db -f /tmp/004_sample_data.sql
sudo -u postgres psql -d watershed_db -f /tmp/005_common_queries.sql

# Verify installation
sudo -u postgres psql -d watershed_db -c "\dt"
```

### Performance Tuning

#### Optimize for Spatial Data

```sql
-- Add to postgresql.conf or via ALTER SYSTEM
ALTER SYSTEM SET shared_preload_libraries = 'timescaledb';
ALTER SYSTEM SET max_parallel_workers = 8;
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
ALTER SYSTEM SET parallel_tuple_cost = 0.1;
ALTER SYSTEM SET parallel_setup_cost = 1000;
ALTER SYSTEM SET min_parallel_table_scan_size = 8MB;
ALTER SYSTEM SET geqo = off;  -- Better query planning for spatial queries

-- Apply settings
SELECT pg_reload_conf();
```

#### Configure TimescaleDB

```sql
-- Convert time-series tables to hypertables
SELECT create_hypertable('time_series', 'timestamp', chunk_time_interval => INTERVAL '1 day');
SELECT create_hypertable('processing_tasks', 'created_at', chunk_time_interval => INTERVAL '1 week');

-- Create indexes
CREATE INDEX idx_time_series_watershed_timestamp ON time_series (watershed_id, timestamp DESC);
CREATE INDEX idx_processing_tasks_status ON processing_tasks (status, created_at DESC);
```

### Connection Pooling (Optional)

#### Install pgBouncer

```bash
sudo apt install -y pgbouncer

# Configure pgbouncer
sudo vim /etc/pgbouncer/pgbouncer.ini
```

#### pgbouncer.ini

```ini
[databases]
watershed_db = host=127.0.0.1 port=5432 dbname=watershed_db

[pgbouncer]
listen_addr = 10.0.0.20
listen_port = 6432
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = session
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
log_connections = 1
log_disconnections = 1
log_pooler_errors = 1
```

### Backup Configuration

#### Automated Backup Script

```bash
# /opt/watershed/scripts/backup-db.sh
#!/bin/bash

set -e

BACKUP_DIR="/opt/watershed/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="watershed_db_${DATE}.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create database dump
pg_dump -h 10.0.0.20 -U watershed_user -d watershed_db \
  --no-password --verbose --clean --create \
  --format=custom --compress=9 \
  --file="${BACKUP_DIR}/${BACKUP_FILE}.custom"

# Compress
gzip "${BACKUP_DIR}/${BACKUP_FILE}.custom"

# Keep only last 30 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

#### Cron Job for Automated Backups

```bash
# Add to crontab (crontab -e)
# Daily backup at 2 AM
0 2 * * * /opt/watershed/scripts/backup-db.sh >> /var/log/watershed-backup.log 2>&1

# Hourly WAL archiving (for PITR)
0 * * * * archive-wal.sh
```

---

## API Server Deployment

### Environment Configuration

#### .env file

```bash
# /opt/watershed/api/.env

# Server Configuration
NODE_ENV=production
PORT=3000
HOST=10.0.0.10

# Database Configuration
DB_HOST=10.0.0.20
DB_PORT=5432
DB_NAME=watershed_db
DB_USER=watershed_user
DB_PASSWORD=secure_password_here
DB_SSL=false

# JWT Configuration
JWT_SECRET=your-256-bit-secret-key-here
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_SECRET=your-refresh-secret-key
REFRESH_TOKEN_EXPIRES_IN=7d

# API Rate Limiting
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=/opt/watershed/logs/api.log

# File Uploads
UPLOAD_MAX_SIZE=104857600  # 100MB
UPLOAD_DIR=/opt/watershed/uploads

# Satellite API Keys
USGS_API_KEY=your-usgs-api-key
ESA_CLIENT_ID=your-esa-client-id
ESA_CLIENT_SECRET=your-esa-client-secret

# Processing Configuration
MAX_CONCURRENT_TASKS=4
TASK_TIMEOUT_MS=3600000  # 1 hour

# Redis Configuration (optional for session storage)
REDIS_HOST=10.0.0.20
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Application Setup

```bash
# Navigate to API directory
cd /opt/watershed/api

# Install dependencies
npm install --production

# Copy environment file
cp .env.example .env
vim .env  # Configure settings

# Build application
npm run build  # If using TypeScript

# Create logs directory
mkdir -p /opt/watershed/logs

# Set permissions
chown -R watershed:watershed /opt/watershed
chmod 600 /opt/watershed/api/.env
```

### Production Deployment with PM2

#### ecosystem.config.js

```javascript
// /opt/watershed/api/ecosystem.config.js
module.exports = {
  apps: [{
    name: 'watershed-api',
    script: 'server.js',
    instances: 'max',  # Use all available CPU cores
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000,
      HOST: '10.0.0.10'
    },
    log_file: '/opt/watershed/logs/combined.log',
    out_file: '/opt/watershed/logs/out.log',
    error_file: '/opt/watershed/logs/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_restarts: 10,
    min_uptime: '10s',
    watch: false,
    ignore_watch: ['node_modules', 'logs'],
    max_memory_restart: '2G',
    restart_delay: 4000,
    autorestart: true,
    kill_timeout: 5000
  }]
};
```

#### Start with PM2

```bash
# Start application
pm2 start ecosystem.config.js --env production

# Save PM2 configuration
pm2 save

# Setup PM2 startup script
pm2 startup

# Monitor application
pm2 monit
pm2 logs
pm2 status
```

### Nginx Reverse Proxy

#### Nginx Configuration

```nginx
# /etc/nginx/sites-available/watershed-api
upstream watershed_api {
    server 10.0.0.10:3000;
    server 10.0.0.11:3000;  # Add more servers for load balancing
    keepalive 32;
}

server {
    listen 80;
    server_name api.watershed.example.com;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.watershed.example.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/api.watershed.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.watershed.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # API Proxy
    location / {
        proxy_pass http://watershed_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 60;
        proxy_send_timeout 60;
    }

    # WebSocket support for real-time updates
    location /socket.io/ {
        proxy_pass http://watershed_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API Documentation
    location /api-docs {
        proxy_pass http://watershed_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Logging
    access_log /var/log/nginx/watershed-api.access.log;
    error_log /var/log/nginx/watershed-api.error.log;
}
```

#### Enable and Test Nginx

```bash
# Test configuration
sudo nginx -t

# Enable site
sudo ln -s /etc/nginx/sites-available/watershed-api /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Reload Nginx
sudo systemctl reload nginx

# Enable Nginx
sudo systemctl enable nginx
```

### Health Checks

#### Health Check Script

```bash
# /opt/watershed/scripts/health-check.sh
#!/bin/bash

API_URL="https://api.watershed.example.com/health"
LOG_FILE="/var/log/watershed-health.log"

# Check API health
if curl -f -s $API_URL > /dev/null; then
    echo "$(date): API is healthy" >> $LOG_FILE
    exit 0
else
    echo "$(date): API is down, restarting..." >> $LOG_FILE
    pm2 restart watershed-api
    sleep 5
    
    if curl -f -s $API_URL > /dev/null; then
        echo "$(date): API successfully restarted" >> $LOG_FILE
        exit 0
    else
        echo "$(date): API restart failed!" >> $LOG_FILE
        exit 1
    fi
fi
```

#### Cron Job for Health Checks

```bash
# Add to crontab
# Check every 5 minutes
*/5 * * * * /opt/watershed/scripts/health-check.sh
```

---

## Python Processing Pipeline

### Virtual Environment Setup

```bash
# Create virtual environment
python3.10 -m venv /opt/watershed/python/venv
source /opt/watershed/python/venv/bin/activate

# Upgrade pip
pip install --upgrade pip setuptools wheel

# Install dependencies
cd /opt/watershed/python
pip install -r requirements.txt

# Verify installation
python -c "import rasterio, xarray, geopandas; print('All packages installed successfully')"
```

### requirements.txt

```text
# Core geospatial libraries
rasterio>=1.3.0
xarray>=2023.1.0
dask>=2023.1.0
geopandas>=0.12.0
earthpy>=0.10.0
shapely>=1.8.0

# Satellite data processing
satpy>=1.8.0
pystac-client>=0.7.0
requests>=2.28.0
sentinelhub>=3.6.0

# Change detection algorithms
scikit-image>=0.19.0
scikit-learn>=1.2.0
pymannkendall>=3.0.0
statsmodels>=0.13.0

# Database connectivity
psycopg2-binary>=2.9.0
sqlalchemy>=1.4.0
alembic>=1.9.0

# Utility libraries
numpy>=1.24.0
pandas>=1.5.0
matplotlib>=3.6.0
tqdm>=4.64.0
click>=8.0.0
pyyaml>=6.0
python-dotenv>=0.21.0

# Cloud storage
boto3>=1.26.0
google-cloud-storage>=2.7.0

# Task queue (optional)
celery>=5.2.0
redis>=4.5.0

# Monitoring
prometheus-client>=0.15.0
structlog>=22.3.0
```

### Configuration Files

#### settings.py

```python
# /opt/watershed/python/config/settings.py
import os
from dotenv import load_dotenv

load_dotenv('/opt/watershed/python/.env')

class Settings:
    # Database
    DATABASE_URL = os.getenv('DATABASE_URL', 
        'postgresql://watershed_user:password@10.0.0.20:5432/watershed_db')
    
    # API Keys
    USGS_API_KEY = os.getenv('USGS_API_KEY')
    ESA_CLIENT_ID = os.getenv('ESA_CLIENT_ID')
    ESA_CLIENT_SECRET = os.getenv('ESA_CLIENT_SECRET')
    
    # Processing
    MAX_WORKERS = int(os.getenv('MAX_WORKERS', 4))
    CHUNK_SIZE = int(os.getenv('CHUNK_SIZE', 2048))
    TEMP_DIR = os.getenv('TEMP_DIR', '/opt/watershed/temp')
    
    # Data paths
    DATA_DIR = os.getenv('DATA_DIR', '/opt/watershed/data')
    OUTPUT_DIR = os.getenv('OUTPUT_DIR', '/opt/watershed/output')
    LOG_DIR = os.getenv('LOG_DIR', '/opt/watershed/logs')
    
    # Monitoring
    MONITORING_ENABLED = os.getenv('MONITORING_ENABLED', 'true').lower() == 'true'
    
    @classmethod
    def validate(cls):
        """Validate required settings"""
        required = ['DATABASE_URL']
        for key in required:
            if not getattr(cls, key):
                raise ValueError(f"Missing required setting: {key}")
```

#### data_sources.py

```python
# /opt/watershed/python/config/data_sources.py
class DataSources:
    USGS_M2M = {
        'base_url': 'https://m2m.cr.usgs.gov/api/api.json/stable/',
        'login_url': 'https://m2m.cr.usgs.gov/api/json/stable/login-token',
        'timeout': 300
    }
    
    ESA_COPERNICUS = {
        'base_url': 'https://dataspace.copernicus.eu/api',
        'timeout': 300
    }
    
    AWS_OPEN_DATA = {
        'landsat': 's3://landsat-pds',
        'sentinel2': 's3://sentinel-s2-l1c'
    }
    
    PLANETARY_COMPUTER = {
        'base_url': 'https://planetarycomputer.microsoft.com/api/stac/v1',
        'timeout': 300
    }
```

### Main Application

```python
# /opt/watershed/python/main.py
import click
import logging
from pathlib import Path
from config.settings import Settings
from workflows.processing_pipeline import ProcessingPipeline

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f"{Settings.LOG_DIR}/processing.log"),
        logging.StreamHandler()
    ]
)

@click.group()
@click.pass_context
def cli(ctx):
    """Watershed Disturbance Mapping System"""
    ctx.ensure_object(dict)
    Settings.validate()

@cli.command()
@click.option('--watershed-id', required=True, help='Watershed ID to process')
@click.option('--start-date', required=True, help='Start date (YYYY-MM-DD)')
@click.option('--end-date', required=True, help='End date (YYYY-MM-DD)')
@click.option('--algorithm', 
              type=click.Choice(['landtrendr', 'spectral', 'combined'], 
                               case_sensitive=False),
              default='combined')
def process_watershed(watershed_id, start_date, end_date, algorithm):
    """Process satellite data for a watershed"""
    pipeline = ProcessingPipeline()
    try:
        pipeline.process_watershed(
            watershed_id=watershed_id,
            start_date=start_date,
            end_date=end_date,
            algorithm=algorithm
        )
        click.echo(f"Processing completed for watershed {watershed_id}")
    except Exception as e:
        logging.error(f"Processing failed: {e}")
        raise click.ClickException(str(e))

@cli.command()
@click.option('--watershed-id', required=True)
def download_data(watershed_id):
    """Download satellite data for watershed"""
    pipeline = ProcessingPipeline()
    pipeline.download_satellite_data(watershed_id)
    click.echo(f"Download completed for watershed {watershed_id}")

@cli.command()
def health_check():
    """Check system health"""
    pipeline = ProcessingPipeline()
    status = pipeline.health_check()
    click.echo(f"System status: {status}")

if __name__ == '__main__':
    cli()
```

### Service Configuration

#### Systemd Service

```ini
# /etc/systemd/system/watershed-processing.service
[Unit]
Description=Watershed Processing Pipeline
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=forking
User=watershed
Group=watershed
WorkingDirectory=/opt/watershed/python
Environment=PATH=/opt/watershed/python/venv/bin
ExecStart=/opt/watershed/python/venv/bin/python main.py daemon
ExecReload=/bin/kill -HUP $MAINPID
PIDFile=/var/run/watershed-processing.pid
Restart=on-failure
RestartSec=5
KillMode=mixed
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

#### Start Service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable and start service
sudo systemctl enable watershed-processing
sudo systemctl start watershed-processing

# Check status
sudo systemctl status watershed-processing
```

---

## Frontend Deployment

### Build Configuration

#### vite.config.ts

```typescript
// /opt/watershed/frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          maps: ['leaflet', 'react-leaflet'],
          charts: ['chart.js', 'react-chartjs-2']
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },
  server: {
    port: 5173,
    host: '10.0.0.10',
    proxy: {
      '/api': {
        target: 'https://api.watershed.example.com',
        changeOrigin: true,
        secure: true
      }
    }
  }
})
```

#### .env.production

```bash
# /opt/watershed/frontend/.env.production
VITE_API_BASE_URL=https://api.watershed.example.com
VITE_WS_BASE_URL=https://api.watershed.example.com
VITE_MAP_TILES_URL=https://api.watershed.example.com/api/tiles
VITE_APP_NAME=Watershed Disturbance Mapping
VITE_APP_VERSION=1.0.0
```

### Build and Deploy

```bash
# Navigate to frontend directory
cd /opt/watershed/frontend

# Install dependencies
npm install

# Set production environment
cp .env.production .env

# Build application
npm run build

# Verify build
ls -la dist/

# Copy to web server
sudo cp -r dist/* /var/www/html/
sudo chown -R www-data:www-data /var/www/html
sudo chmod -R 755 /var/www/html
```

### Nginx for Frontend

```nginx
# /etc/nginx/sites-available/watershed-frontend
server {
    listen 80;
    server_name watershed.example.com;
    
    root /var/www/html;
    index index.html;
    
    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name watershed.example.com;

    root /var/www/html;
    index index.html;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/watershed.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/watershed.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        application/javascript
        application/json
        text/css
        text/javascript
        text/xml
        text/plain
        application/xml
        application/xml+rss;

    # Static Assets Caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # SPA Routing
    location / {
        try_files $uri $uri/ /index.html;
        
        # Security Headers for HTML
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
    }

    # API Proxy (if needed for same-origin)
    location /api/ {
        proxy_pass https://api.watershed.example.com;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass https://api.watershed.example.com;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Logging
    access_log /var/log/nginx/watershed-frontend.access.log;
    error_log /var/log/nginx/watershed-frontend.error.log;
}
```

### Enable Frontend Site

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/watershed-frontend /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## VPN Infrastructure

### WireGuard Installation and Setup

#### Install WireGuard

```bash
# Install WireGuard
sudo apt update
sudo apt install -y wireguard

# Generate server key pair
cd /opt/watershed/vpn
wg genkey | tee server_private.key | wg pubkey > server_public.key

# Set permissions
chmod 600 server_private.key
chown watershed:watershed server_*.key
```

#### WireGuard Server Configuration

```ini
# /etc/wireguard/wg0.conf
[Interface]
Address = 172.16.0.1/24
ListenPort = 51820
PrivateKey = SERVER_PRIVATE_KEY

# Enable NAT for client internet access
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# Allow SSH access through VPN
PostUp = iptables -A INPUT -p tcp --dport 22 -s 172.16.0.0/24 -j ACCEPT

# Client configurations will be added here
```

#### Generate Client Configurations

```bash
# /opt/watershed/vpn/scripts/generate-client.sh
#!/bin/bash

CLIENT_NAME="$1"
SERVER_PUBLIC_KEY=$(cat /opt/watershed/vpn/server_public.key)
SERVER_ENDPOINT="vpn.watershed.example.com:51820"

# Generate client keys
wg genkey | tee "${CLIENT_NAME}_private.key" | wg pubkey > "${CLIENT_NAME}_public.key"
CLIENT_PRIVATE_KEY=$(cat "${CLIENT_NAME}_private.key")
CLIENT_PUBLIC_KEY=$(cat "${CLIENT_NAME}_public.key")

# Generate client config
cat > "${CLIENT_NAME}.conf" << EOF
[Interface]
PrivateKey = $CLIENT_PRIVATE_KEY
Address = 172.16.0.${RANDOM_RANGE}/24
DNS = 8.8.8.8, 8.8.4.4

[Peer]
PublicKey = $SERVER_PUBLIC_KEY
Endpoint = $SERVER_ENDPOINT
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
EOF

echo "Configuration generated: ${CLIENT_NAME}.conf"
```

#### Add Client to Server

```bash
# Add peer to server configuration
sudo wg set wg0 peer $CLIENT_PUBLIC_KEY allowed-ips 172.16.0.2/32

# Save configuration
sudo wg-quick save wg0

# Update wg0.conf
echo "Client: ${CLIENT_NAME}" | sudo tee -a /etc/wireguard/wg0.conf
```

### Start WireGuard Service

```bash
# Start and enable WireGuard
sudo systemctl start wg-quick@wg0
sudo systemctl enable wg-quick@wg0

# Check status
sudo wg show
```

### User Management Script

```bash
# /opt/watershed/vpn/scripts/user-management.sh
#!/bin/bash

case "$1" in
    "add")
        if [ -z "$2" ]; then
            echo "Usage: $0 add <username>"
            exit 1
        fi
        /opt/watershed/vpn/scripts/generate-client.sh "$2"
        echo "Client added. Send ${2}.conf to user."
        ;;
    "remove")
        if [ -z "$2" ]; then
            echo "Usage: $0 remove <username>"
            exit 1
        fi
        CLIENT_PUBLIC_KEY=$(cat "${2}_public.key")
        sudo wg set wg0 peer "$CLIENT_PUBLIC_KEY" remove
        sudo wg-quick save wg0
        rm -f "${2}.conf" "${2}_private.key" "${2}_public.key"
        echo "Client removed: $2"
        ;;
    "list")
        sudo wg show
        ;;
    *)
        echo "Usage: $0 {add|remove|list} [username]"
        exit 1
        ;;
esac
```

### Alternative: OpenVPN Setup

```bash
# Install OpenVPN
sudo apt install -y openvpn easy-rsa

# Setup PKI
cd /usr/share/easy-rsa
sudo ./easyrsa init-pki
sudo ./easyrsa gen-req server nopass
sudo ./easyrsa sign-req server server
sudo ./easyrsa gen-req client1 nopass
sudo ./easyrsa sign-req client client1

# Copy certificates
sudo cp pki/ca.crt pki/issued/server.crt pki/private/server.key /etc/openvpn/

# Configure server
sudo cp /opt/watershed/vpn/openvpn/server.conf /etc/openvpn/
```

### VPN Testing

```bash
# Test VPN connectivity
ping -c 3 172.16.0.1

# Test routing through VPN
curl -I https://api.watershed.example.com

# Check VPN status
sudo wg show
sudo systemctl status wg-quick@wg0
```

---

## SSL Certificate Setup

### Let's Encrypt with Certbot

#### Install Certbot

```bash
# Install Certbot
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Stop Nginx temporarily
sudo systemctl stop nginx
```

#### Obtain Certificates

```bash
# Get certificate for frontend
sudo certbot certonly --standalone \
  --agree-tos \
  --email admin@watershed.example.com \
  --domains watershed.example.com \
  --domains api.watershed.example.com

# Get certificate for VPN (if using HTTPS)
sudo certbot certonly --standalone \
  --agree-tos \
  --email admin@watershed.example.com \
  --domains vpn.watershed.example.com
```

#### Auto-renewal Setup

```bash
# Test renewal
sudo certbot renew --dry-run

# Add to crontab
# Add this line: 0 12 * * * /usr/bin/certbot renew --quiet
sudo crontab -e

# Add renewal check
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

### SSL Configuration

#### Nginx SSL Security

```nginx
# Add to Nginx server blocks
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# HSTS
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

### SSL Monitoring

```bash
# Check certificate expiry
echo | openssl s_client -connect api.watershed.example.com:443 2>/dev/null | openssl x509 -noout -dates

# Test SSL configuration
curl -I https://api.watershed.example.com

# Monitor certificate expiry (add to monitoring)
# /opt/watershed/scripts/check-cert.sh
#!/bin/bash
CERT_PATH="/etc/letsencrypt/live/api.watershed.example.com/fullchain.pem"
EXPIRY_DATE=$(openssl x509 -enddate -noout -in $CERT_PATH | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
CURRENT_EPOCH=$(date +%s)
DAYS_LEFT=$(( (EXPIRY_EPOCH - CURRENT_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt 30 ]; then
    echo "WARNING: Certificate expires in $DAYS_LEFT days!"
    # Send alert email
    echo "SSL Certificate for api.watershed.example.com expires in $DAYS_LEFT days" | \
        mail -s "SSL Certificate Expiry Warning" admin@watershed.example.com
fi
```

---

## Security Best Practices

### System Hardening

#### SSH Hardening

```bash
# Edit SSH configuration
sudo vim /etc/ssh/sshd_config

# Apply secure settings
Port 2222  # Change default port
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
Protocol 2
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,hmac-sha2-256,hmac-sha512
KexAlgorithms sntrup761x25519-sha512@openssh.com,curve25519-sha256@libssh.org,diffie-hellman-group16-sha512,diffie-hellman-group18-sha512,diffie-hellman-group14-sha256

# Restart SSH
sudo systemctl restart ssh
```

#### Automatic Security Updates

```bash
# Install unattended-upgrades
sudo apt install -y unattended-upgrades apt-listchanges

# Configure automatic updates
sudo dpkg-reconfigure -plow unattended-upgrades

# /etc/apt/apt.conf.d/50unattended-upgrades
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
```

### Application Security

#### API Security Headers

```javascript
// Add to API server
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: ['https://watershed.example.com'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP'
}));
```

#### Database Security

```sql
-- Create application user with minimal privileges
CREATE USER watershed_app WITH PASSWORD 'secure_password';

-- Grant only necessary privileges
GRANT CONNECT ON DATABASE watershed_db TO watershed_app;
GRANT USAGE ON SCHEMA public TO watershed_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO watershed_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO watershed_app;

-- Revoke public schema access
REVOKE ALL ON SCHEMA public FROM PUBLIC;

-- Enable row-level security
ALTER TABLE sensitive_data ENABLE ROW LEVEL SECURITY;

-- Create security policies
CREATE POLICY user_isolation ON users
    USING (id = current_setting('app.current_user_id')::int);
```

### Network Security

#### Fail2Ban Configuration

```bash
# Install Fail2Ban
sudo apt install -y fail2ban

# Configure Fail2Ban
sudo vim /etc/fail2ban/jail.local
```

```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3
ignoreip = 127.0.0.1/8 10.0.0.0/8 172.16.0.0/12

[sshd]
enabled = true
port = 2222
logpath = /var/log/auth.log

[nginx-http-auth]
enabled = true
filter = nginx-http-auth
logpath = /var/log/nginx/error.log

[nginx-noscript]
enabled = true
filter = nginx-noscript
logpath = /var/log/nginx/access.log
```

#### DDoS Protection

```bash
# Install and configure fail2ban for Nginx
sudo apt install -y fail2ban fail2ban-nginx

# Create filter
sudo tee /etc/fail2ban/filter.d/nginx-limit-req.conf << EOF
[Definition]
failregex = limiting requests, excess:.* by zone.*client: <HOST>
ignoreregex =
EOF

# Add to jail.local
echo """
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
findtime = 600
bantime = 7200
maxretry = 10
""" | sudo tee -a /etc/fail2ban/jail.local

# Restart Fail2Ban
sudo systemctl restart fail2ban
```

### File System Security

```bash
# Set proper permissions
sudo chmod 750 /opt/watershed
sudo chmod 640 /opt/watershed/api/.env
sudo chmod 600 /opt/watershed/vpn/server_private.key
sudo chown -R watershed:watershed /opt/watershed

# Secure log files
sudo chmod 640 /var/log/nginx/*.log
sudo chmod 640 /opt/watershed/logs/*.log

# Disable core dumps
echo "* hard core 0" | sudo tee -a /etc/security/limits.conf

# Disable SUID/SGID on common directories
sudo chmod u-s /usr/bin/pkexec
sudo chmod u-s /usr/bin/passwd
```

---

## Monitoring and Maintenance

### System Monitoring

#### Install Monitoring Tools

```bash
# Install htop, iotop, netstat
sudo apt install -y htop iotop netstat-nat

# Install monitoring agents
sudo apt install -y node-exporter postgres-exporter blackbox-exporter
```

#### Prometheus Configuration

```yaml
# /etc/prometheus/prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets: ['10.0.0.10:9100', '10.0.0.20:9100']
  
  - job_name: 'postgresql'
    static_configs:
      - targets: ['10.0.0.20:9187']
  
  - job_name: 'nginx'
    static_configs:
      - targets: ['10.0.0.10:9113']
  
  - job_name: 'blackbox'
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
        - https://watershed.example.com
        - https://api.watershed.example.com
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: 127.0.0.1:9115
```

#### Grafana Setup

```bash
# Install Grafana
sudo apt install -y grafana

# Start Grafana
sudo systemctl start grafana-server
sudo systemctl enable grafana-server

# Configure Grafana
sudo grafana-cli plugins install grafana-piechart-panel
sudo systemctl restart grafana-server
```

#### System Monitoring Script

```bash
# /opt/watershed/scripts/system-monitor.sh
#!/bin/bash

LOGFILE="/var/log/watershed-monitor.log"

log_message() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> $LOGFILE
}

# Check disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    log_message "WARNING: Disk usage at ${DISK_USAGE}%"
    # Send alert
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.2f"), $3/$2 * 100.0}')
if (( $(echo "$MEMORY_USAGE > 90" | bc -l) )); then
    log_message "WARNING: Memory usage at ${MEMORY_USAGE}%"
fi

# Check database connectivity
if ! pg_isready -h 10.0.0.20 -p 5432 -U watershed_user; then
    log_message "ERROR: Database connection failed"
fi

# Check API health
if ! curl -f -s https://api.watershed.example.com/health > /dev/null; then
    log_message "ERROR: API health check failed"
fi

# Check VPN status
if ! sudo wg show wg0 > /dev/null 2>&1; then
    log_message "WARNING: VPN interface is down"
fi

# Check nginx status
if ! sudo systemctl is-active --quiet nginx; then
    log_message "ERROR: Nginx is not running"
fi
```

#### Cron Monitoring Jobs

```bash
# Add to crontab
# System monitoring every 5 minutes
*/5 * * * * /opt/watershed/scripts/system-monitor.sh

# Weekly disk usage report
0 8 * * 1 /opt/watershed/scripts/disk-report.sh

# Monthly security audit
0 2 1 * * /opt/watershed/scripts/security-audit.sh
```

### Log Management

#### Logrotate Configuration

```bash
# /etc/logrotate.d/watershed
/opt/watershed/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 640 watershed watershed
    postrotate
        pm2 reloadLogs
    endscript
}

/var/log/nginx/watershed-*.log {
    daily
    missingok
    rotate 52
    compress
    delaycompress
    notifempty
    create 640 www-data adm
    postrotate
        if [ -f /var/run/nginx.pid ]; then
            kill -USR1 `cat /var/run/nginx.pid`
        fi
    endscript
}
```

#### Centralized Logging (Optional)

```bash
# Install ELK Stack or use simpler solution
sudo apt install -y rsyslog

# Configure rsyslog for remote logging
sudo vim /etc/rsyslog.conf

# Add remote logging rules
*.info @@log-server.example.com:514
```

### Performance Monitoring

#### Database Monitoring

```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check index usage
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE tablename = 'your_table';

-- Monitor connections
SELECT count(*) as active_connections,
       state,
       usename 
FROM pg_stat_activity 
GROUP BY state, usename;
```

#### API Performance Monitoring

```javascript
// Add to API server
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

app.use((req, res, next) => {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    end({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode
    });
  });
  next();
});

// Export metrics
app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});
```

### Maintenance Procedures

#### Database Maintenance

```bash
# /opt/watershed/scripts/db-maintenance.sh
#!/bin/bash

# Vacuum and analyze database
sudo -u postgres psql -d watershed_db -c "VACUUM ANALYZE;"

# Reindex if needed
sudo -u postgres psql -d watershed_db -c "REINDEX DATABASE watershed_db;"

# Update table statistics
sudo -u postgres psql -d watershed_db -c "ANALYZE;"

# Check for bloated tables
sudo -u postgres psql -d watershed_db -c "
SELECT 
    schemaname,
    tablename,
    n_tup_ins,
    n_tup_upd,
    n_tup_del,
    n_live_tup,
    n_dead_tup
FROM pg_stat_user_tables
WHERE n_dead_tup > n_live_tup * 0.1;
"
```

#### System Updates

```bash
# /opt/watershed/scripts/apply-updates.sh
#!/bin/bash

set -e

echo "Starting system update at $(date)"

# Update package list
sudo apt update

# List available updates
apt list --upgradable > /tmp/available_updates.txt

# Apply security updates only
sudo unattended-upgrade -d --dry-run

# Apply all updates
sudo unattended-upgrade -d

# Update Docker images
docker-compose pull

# Update Node.js packages
cd /opt/watershed/api
npm audit --audit-level moderate

# Update Python packages
source /opt/watershed/python/venv/bin/activate
pip list --outdated

echo "System update completed at $(date)"
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Database Connection Issues

**Problem**: Cannot connect to database

```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check if port is listening
sudo netstat -tlnp | grep 5432

# Check firewall
sudo ufw status | grep 5432

# Test connection
psql -h 10.0.0.20 -U watershed_user -d watershed_db

# Check PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

**Solutions**:
1. Verify PostgreSQL is running: `sudo systemctl start postgresql`
2. Check connection string format
3. Verify `pg_hba.conf` allows connections from application server
4. Ensure firewall allows port 5432 from internal network

#### API Server Issues

**Problem**: API returns 502 Bad Gateway

```bash
# Check API server status
pm2 status
pm2 logs watershed-api

# Check Nginx status
sudo systemctl status nginx
sudo nginx -t

# Check API health
curl -v https://api.watershed.example.com/health

# Check system resources
htop
df -h
free -h
```

**Solutions**:
1. Restart API server: `pm2 restart watershed-api`
2. Check API logs for errors
3. Verify environment variables are set correctly
4. Ensure database connection is working
5. Check if API port (3000) is accessible

#### Frontend Issues

**Problem**: White screen or 404 errors on frontend

```bash
# Check Nginx configuration
sudo nginx -t

# Check file permissions
ls -la /var/www/html/

# Check browser console for errors
# Check network requests in browser dev tools

# Verify build files exist
ls -la /var/www/html/assets/
```

**Solutions**:
1. Rebuild frontend: `npm run build`
2. Copy files to correct location: `sudo cp -r dist/* /var/www/html/`
3. Fix permissions: `sudo chown -R www-data:www-data /var/www/html`
4. Check Nginx configuration for SPA routing

#### VPN Issues

**Problem**: Cannot connect to VPN

```bash
# Check WireGuard status
sudo wg show

# Check VPN service
sudo systemctl status wg-quick@wg0

# Check firewall
sudo ufw status | grep 51820

# Test VPN port
nc -u vpn.watershed.example.com 51820

# Check client configuration
cat /opt/watershed/vpn/client.conf
```

**Solutions**:
1. Verify server configuration in `/etc/wireguard/wg0.conf`
2. Check client public key is added to server
3. Ensure VPN port (51820) is open in firewall
4. Verify DNS settings in client configuration
5. Check if NAT is properly configured

#### Python Processing Issues

**Problem**: Processing fails with memory errors

```bash
# Check Python logs
tail -f /opt/watershed/logs/processing.log

# Monitor memory usage
htop
free -h

# Check disk space
df -h /opt/watershed/data

# Test individual components
python -c "import rasterio; print('Rasterio OK')"
python -c "import xarray; print('Xarray OK')"
```

**Solutions**:
1. Reduce chunk size in processing configuration
2. Increase system RAM or add swap
3. Process smaller batches of data
4. Check for memory leaks in processing code
5. Optimize data loading with Dask

#### SSL Certificate Issues

**Problem**: Certificate errors or expired certificates

```bash
# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/api.watershed.example.com/fullchain.pem -noout -dates

# Test renewal
sudo certbot renew --dry-run

# Check Nginx SSL configuration
sudo nginx -t

# Verify certificate chain
echo | openssl s_client -servername api.watershed.example.com -connect api.watershed.example.com:443 2>/dev/null | openssl x509 -noout -issuer
```

**Solutions**:
1. Renew certificate: `sudo certbot renew`
2. Check DNS records are pointing to correct server
3. Verify port 80 is accessible for Let's Encrypt validation
4. Restart Nginx after renewal: `sudo systemctl reload nginx`

### Performance Issues

#### Database Performance

```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check index usage
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats
WHERE tablename = 'time_series';

-- Check connection usage
SELECT count(*) as total_connections, state
FROM pg_stat_activity
GROUP BY state;

-- Check table bloat
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**Solutions**:
1. Create missing indexes on frequently queried columns
2. Analyze query plans with EXPLAIN ANALYZE
3. Adjust PostgreSQL configuration (shared_buffers, work_mem)
4. Implement query result caching
5. Partition large tables by date or region

#### API Performance

```javascript
// Add performance monitoring to API
const performance = require('performance-now');

// Add to routes
app.get('/api/endpoint', async (req, res) => {
  const start = performance.now();
  try {
    // API logic here
    const result = await database.query('SELECT ...');
    
    const duration = performance.now() - start;
    console.log(`Query took ${duration.toFixed(2)}ms`);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

**Solutions**:
1. Implement database query caching
2. Use connection pooling
3. Add Redis for session storage
4. Optimize database queries
5. Implement rate limiting
6. Use CDN for static assets

### Log Analysis

#### Important Log Files

```bash
# Application logs
tail -f /opt/watershed/logs/api.log
tail -f /opt/watershed/logs/processing.log

# System logs
tail -f /var/log/syslog
tail -f /var/log/auth.log

# Nginx logs
tail -f /var/log/nginx/watershed-api.error.log
tail -f /var/log/nginx/watershed-frontend.access.log

# Database logs
tail -f /var/log/postgresql/postgresql-14-main.log

# VPN logs
journalctl -u wg-quick@wg0 -f
```

#### Log Analysis Script

```bash
# /opt/watershed/scripts/analyze-logs.sh
#!/bin/bash

LOG_DIR="/opt/watershed/logs"
REPORT_FILE="/opt/watershed/log-analysis-report.txt"

echo "Watershed System Log Analysis Report" > $REPORT_FILE
echo "Generated: $(date)" >> $REPORT_FILE
echo "========================================" >> $REPORT_FILE

# Check for errors in API logs
ERROR_COUNT=$(grep -c "ERROR" $LOG_DIR/api.log 2>/dev/null || echo "0")
echo "API Errors: $ERROR_COUNT" >> $REPORT_FILE

# Check for slow queries
SLOW_QUERIES=$(grep -c "slow query" $LOG_DIR/api.log 2>/dev/null || echo "0")
echo "Slow Queries: $SLOW_QUERIES" >> $REPORT_FILE

# Check for processing failures
FAILURES=$(grep -c "FAILED" $LOG_DIR/processing.log 2>/dev/null || echo "0")
echo "Processing Failures: $FAILURES" >> $REPORT_FILE

# Check for authentication failures
AUTH_FAILURES=$(grep -c "Authentication failed" $LOG_DIR/api.log 2>/dev/null || echo "0")
echo "Authentication Failures: $AUTH_FAILURES" >> $REPORT_FILE

# Check disk usage
DISK_USAGE=$(df -h /opt/watershed | awk 'NR==2 {print $5}')
echo "Disk Usage: $DISK_USAGE" >> $REPORT_FILE

echo "========================================" >> $REPORT_FILE
echo "Report saved to: $REPORT_FILE"
```

---

## Performance Optimization

### Database Optimization

#### Query Optimization

```sql
-- Create composite indexes for common query patterns
CREATE INDEX CONCURRENTLY idx_watershed_time_series 
ON time_series (watershed_id, timestamp DESC);

CREATE INDEX CONCURRENTLY idx_detection_watershed_date 
ON change_detections (watershed_id, detection_date DESC);

-- Use covering indexes for read-heavy queries
CREATE INDEX CONCURRENTLY idx_detection_covering 
ON change_detections (watershed_id, detection_date) 
INCLUDE (algorithm, confidence_score, area_changed);

-- Partition large tables by date
CREATE TABLE time_series_2024 PARTITION OF time_series
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Optimize configuration
ALTER SYSTEM SET random_page_cost = 1.1;  -- For SSDs
ALTER SYSTEM SET effective_cache_size = '48GB';
ALTER SYSTEM SET work_mem = '256MB';
ALTER SYSTEM SET maintenance_work_mem = '2GB';
SELECT pg_reload_conf();
```

#### Connection Optimization

```javascript
// API database configuration
const sequelizeConfig = {
  host: '10.0.0.20',
  port: 5432,
  database: 'watershed_db',
  username: 'watershed_user',
  password: process.env.DB_PASSWORD,
  dialect: 'postgres',
  logging: process.env.NODE_ENV === 'development',
  pool: {
    max: 20,
    min: 5,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
};
```

### API Optimization

#### Caching Strategy

```javascript
// Redis caching setup
const redis = require('redis');
const client = redis.createClient({
  host: '10.0.0.20',
  port: 6379,
  retry_strategy: (options) => {
    return Math.min(options.attempt * 100, 3000);
  }
});

// Cache middleware
const cache = (duration = 300) => {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    const cached = await client.get(key);
    
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    res.originalSend = res.send;
    res.send = function(data) {
      res.originalSend(data);
      client.setex(key, duration, data);
    };
    
    next();
  };
};

// Use cache for frequently accessed endpoints
app.get('/api/watersheds', cache(300), async (req, res) => {
  const watersheds = await Watershed.findAll();
  res.json(watersheds);
});
```

#### Response Compression

```javascript
// Add compression middleware
const compression = require('compression');
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 1024
}));
```

### Frontend Optimization

#### Code Splitting

```javascript
// Lazy load components
import { lazy, Suspense } from 'react';

const WatershedMap = lazy(() => import('./components/WatershedMap'));
const AnalyticsDashboard = lazy(() => import('./components/AnalyticsDashboard'));

function App() {
  return (
    <Router>
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/map" element={<WatershedMap />} />
          <Route path="/analytics" element={<AnalyticsDashboard />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
```

#### Asset Optimization

```javascript
// vite.config.ts - Optimize chunks
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          maps: ['leaflet', 'react-leaflet'],
          charts: ['chart.js', 'react-chartjs-2'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-tooltip']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
});
```

#### Service Worker for Caching

```javascript
// public/sw.js
const CACHE_NAME = 'watershed-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/api/watersheds'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
```

### Python Processing Optimization

#### Dask Configuration

```python
# /opt/watershed/python/config/dask-config.yaml
distributed:
  worker:
    threads-per-worker: 2
    memory:
      spill: 0.85
      pause: 0.90
      terminate: 0.95
  
  scheduler:
    work-stealing: True
    dashboard: ":8787"

execution:
  data-frame:
    shuffle-compression: "auto"
```

#### Memory-Efficient Processing

```python
# Process large datasets in chunks
def process_satellite_data(data_path, chunk_size=1024):
    with rasterio.open(data_path) as src:
        # Process in chunks to save memory
        for window in src.block_windows():
            window_data = src.read(window=window)
            
            # Process chunk
            processed = process_chunk(window_data)
            
            # Save intermediate results
            save_chunk(processed, window)
            
            # Clear memory
            del window_data, processed
            
            # Force garbage collection
            gc.collect()
```

#### Parallel Processing

```python
# Use joblib for parallel processing
from joblib import Parallel, delayed
from multiprocessing import cpu_count

def process_watersheds_parallel(watershed_ids, n_jobs=-1):
    """Process multiple watersheds in parallel"""
    
    n_jobs = cpu_count() if n_jobs == -1 else n_jobs
    
    results = Parallel(n_jobs=n_jobs)(
        delayed(process_single_watershed)(ws_id)
        for ws_id in watershed_ids
    )
    
    return results
```

### Caching Layers

#### Application-Level Caching

```bash
# Install and configure Redis
sudo apt install -y redis-server

# Configure Redis
sudo vim /etc/redis/redis.conf

# Important settings
maxmemory 2gb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000
```

#### Database Query Caching

```sql
-- Create materialized views for expensive queries
CREATE MATERIALIZED VIEW watershed_summary AS
SELECT 
    watershed_id,
    COUNT(*) as total_detections,
    AVG(confidence_score) as avg_confidence,
    MAX(detection_date) as last_detection
FROM change_detections
GROUP BY watershed_id;

-- Refresh materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY watershed_summary;
```

---

## Backup and Disaster Recovery

### Backup Strategy

#### Database Backup (Barman)

```bash
# Install Barman
sudo apt install -y barman

# Configure Barman
sudo vim /etc/barman.conf
```

```ini
[main]
description = Watershed Database Backup
conninfo = host=10.0.0.20 user=postgres dbname=watershed_db
ssh_command = ssh postgres@10.0.0.20
retention_policy = REDUNDANCY 7
wal_retention_policy = MAIN
archive_mode = on
archive_command = 'rsync %p barman@backup-server:/var/lib/barman/wals/main/%f'
```

```bash
# Setup streaming replication
sudo -u postgres vim /etc/postgresql/14/main/postgresql.conf

# Add to postgresql.conf
wal_level = replica
max_wal_senders = 3
max_replication_slots = 3
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
```

#### File System Backup

```bash
# /opt/watershed/scripts/backup-files.sh
#!/bin/bash

set -e

BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/watershed/backups"
S3_BUCKET="watershed-backups"

# Create local backup
tar -czf "${BACKUP_DIR}/watershed_files_${BACKUP_DATE}.tar.gz" \
    /opt/watershed/{api,frontend,python,data,uploads} \
    /etc/nginx/sites-available \
    /etc/wireguard \
    /etc/ssl

# Upload to S3 (if using cloud storage)
aws s3 cp "${BACKUP_DIR}/watershed_files_${BACKUP_DATE}.tar.gz" \
    "s3://${S3_BUCKET}/backups/"

# Cleanup old backups (keep last 30 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "File backup completed: watershed_files_${BACKUP_DATE}.tar.gz"
```

#### Automated Backup Schedule

```bash
# Add to crontab

# Database backup every 4 hours
0 */4 * * * /opt/watershed/scripts/backup-db.sh

# File backup daily at 2 AM
0 2 * * * /opt/watershed/scripts/backup-files.sh

# Weekly full system backup
0 3 * * 0 /opt/watershed/scripts/full-backup.sh
```

### Recovery Procedures

#### Database Recovery

```bash
# /opt/watershed/scripts/restore-db.sh
#!/bin/bash

BACKUP_FILE="$1"
TARGET_DB="watershed_db_restore"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# Stop application
pm2 stop watershed-api

# Create new database for testing
sudo -u postgres createdb $TARGET_DB

# Restore from backup
sudo -u postgres pg_restore -d $TARGET_DB -v "$BACKUP_FILE"

# Verify restore
sudo -u postgres psql -d $TARGET_DB -c "\dt"

# If successful, switch databases
echo "Restore successful. Do you want to switch to new database? (y/n)"
read -r response

if [ "$response" = "y" ]; then
    # Update application config to use new database
    # Restart application
    pm2 start watershed-api
    echo "Database switched successfully"
else
    echo "Restore completed but not switched"
fi
```

#### Application Recovery

```bash
# /opt/watershed/scripts/restore-application.sh
#!/bin/bash

set -e

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file>"
    exit 1
fi

# Stop all services
pm2 stop all
sudo systemctl stop nginx

# Extract backup
cd /opt/watershed
sudo tar -xzf "$BACKUP_FILE"

# Restore permissions
sudo chown -R watershed:watershed /opt/watershed

# Restart services
sudo systemctl start nginx
pm2 start all

echo "Application restore completed"
```

#### Full System Recovery

```bash
# /opt/watershed/scripts/disaster-recovery.sh
#!/bin/bash

BACKUP_DATE="$1"
BACKUP_DIR="/opt/watershed/backups"

if [ -z "$BACKUP_DATE" ]; then
    echo "Usage: $0 <backup_date (YYYYMMDD_HHMMSS)>"
    exit 1
fi

echo "Starting disaster recovery for $BACKUP_DATE"

# Restore database
/opt/watershed/scripts/restore-db.sh "${BACKUP_DIR}/watershed_db_${BACKUP_DATE}.custom.gz"

# Restore application files
/opt/watershed/scripts/restore-application.sh "${BACKUP_DIR}/watershed_files_${BACKUP_DATE}.tar.gz"

# Restore configuration
sudo systemctl restart postgresql
sudo systemctl restart nginx

# Verify services
/opt/watershed/scripts/health-check.sh

echo "Disaster recovery completed"
```

### High Availability Setup

#### Load Balancer Configuration

```nginx
# /etc/nginx/sites-available/load-balancer
upstream watershed_backend {
    server 10.0.0.10:3000 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.0.11:3000 weight=3 max_fails=3 fail_timeout=30s;
    server 10.0.0.12:3000 weight=1 max_fails=3 fail_timeout=30s;
    
    # Health check
    keepalive 32;
}

server {
    listen 80;
    server_name watershed.example.com;
    
    location / {
        proxy_pass http://watershed_backend;
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_connect_timeout 5s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

#### Database Replication

```sql
-- On primary server
CREATE ROLE replication WITH REPLICATION LOGIN 'replicator' PASSWORD 'replication_password';

-- In postgresql.conf
wal_level = replica
max_wal_senders = 3
max_replication_slots = 3
```

```bash
# On replica server
sudo -u postgres pg_basebackup -h 10.0.0.20 -D /var/lib/postgresql/14/main -U replication -P -v

# Create recovery.conf
vim /var/lib/postgresql/14/main/recovery.conf
```

```ini
standby_mode = 'on'
primary_conninfo = 'host=10.0.0.20 port=5432 user=replicator password=replication_password'
restore_command = 'cp /var/lib/postgresql/wal_archive/%f %p'
```

---

## User Access Management

### User Roles and Permissions

#### Role Definitions

| Role | Permissions | Access Level |
|------|-------------|--------------|
| **Admin** | Full system access, user management, system configuration | All endpoints |
| **Researcher** | Create/edit watersheds, run analysis, export data | All data operations |
| **Analyst** | View watersheds, run change detection, view results | Read + analysis endpoints |
| **Viewer** | Read-only access to published data | Read-only endpoints |

#### Database Schema for Users

```sql
-- Enhanced user table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'researcher', 'analyst', 'viewer')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    organization VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id INTEGER REFERENCES users(id),
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log
CREATE TABLE user_activity (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id INTEGER,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### API Authentication

#### JWT Implementation

```javascript
// authentication.js middleware
const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = await promisify(jwt.verify)(
      token,
      process.env.JWT_SECRET
    );
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        current: req.user.role
      });
    }

    next();
  };
};

// Usage in routes
app.get('/api/watersheds', authenticateToken, authorizeRole(['admin', 'researcher']), getWatersheds);
app.post('/api/watersheds', authenticateToken, authorizeRole(['admin', 'researcher']), createWatershed);
app.get('/api/analytics', authenticateToken, authorizeRole(['admin', 'researcher', 'analyst']), getAnalytics);
```

#### Registration Endpoint

```javascript
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, firstName, lastName, organization } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if user exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ username }, { email }]
      }
    });

    if (existingUser) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // Hash password
    const bcrypt = require('bcrypt');
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user (default role: viewer)
    const user = await User.create({
      username,
      email,
      password_hash: passwordHash,
      first_name: firstName,
      last_name: lastName,
      organization,
      role: 'viewer',
      email_verified: false
    });

    // Generate email verification token
    const verificationToken = jwt.sign(
      { userId: user.id, purpose: 'email_verification' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Send verification email (implement email service)
    await sendVerificationEmail(user.email, verificationToken);

    res.status(201).json({
      message: 'User created successfully',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
```

#### Password Reset

```javascript
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ where: { email } });
  if (!user) {
    // Don't reveal if email exists
    return res.json({ message: 'If the email exists, a reset link has been sent' });
  }

  // Generate reset token
  const resetToken = jwt.sign(
    { userId: user.id, purpose: 'password_reset' },
    process.env.JWT_SECRET,
    { expiresIn: '1h' }
  );

  // Send reset email
  await sendPasswordResetEmail(user.email, resetToken);

  res.json({ message: 'If the email exists, a reset link has been sent' });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    if (decoded.purpose !== 'password_reset') {
      return res.status(400).json({ error: 'Invalid token purpose' });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Hash new password
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Update password
    await user.update({
      password_hash: passwordHash,
      updated_at: new Date()
    });

    res.json({ message: 'Password reset successfully' });

  } catch (error) {
    res.status(400).json({ error: 'Invalid or expired token' });
  }
});
```

### Admin Panel

#### User Management Interface

```javascript
// Admin routes
app.get('/api/admin/users', 
  authenticateToken, 
  authorizeRole(['admin']), 
  getUsers
);

app.put('/api/admin/users/:id/role',
  authenticateToken,
  authorizeRole(['admin']),
  updateUserRole
);

app.put('/api/admin/users/:id/status',
  authenticateToken,
  authorizeRole(['admin']),
  updateUserStatus
);

app.delete('/api/admin/users/:id',
  authenticateToken,
  authorizeRole(['admin']),
  deleteUser
);

// Admin controllers
const getUsers = async (req, res) => {
  const { page = 1, limit = 20, role, search } = req.query;
  
  const where = {};
  if (role) where.role = role;
  if (search) {
    where[Op.or] = [
      { username: { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const users = await User.findAndCountAll({
    where,
    limit: limit * 1,
    offset: (page - 1) * limit,
    attributes: { exclude: ['password_hash'] }
  });

  res.json({
    users: users.rows,
    total: users.count,
    pages: Math.ceil(users.count / limit),
    current: page
  });
};

const updateUserRole = async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;

  if (!['admin', 'researcher', 'analyst', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const user = await User.findByPk(id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  await user.update({ role, updated_at: new Date() });

  res.json({ message: 'User role updated successfully', user });
};
```

### Onboarding Process

#### New User Onboarding Checklist

```markdown
# Watershed System Onboarding Guide

## 1. Account Setup
- [ ] Register account at https://watershed.example.com
- [ ] Verify email address
- [ ] Complete profile information
- [ ] Set secure password

## 2. Role Assignment
- [ ] Contact admin for role assignment
- [ ] Understand role permissions

## 3. System Training
- [ ] Review user documentation
- [ ] Complete interactive tutorial
- [ ] Test basic functions with sample data

## 4. First Project
- [ ] Create first watershed (if permitted)
- [ ] Upload boundary data (if permitted)
- [ ] Run sample analysis (if permitted)

## 5. Advanced Features
- [ ] Learn change detection algorithms
- [ ] Understand data export options
- [ ] Set up alerts (if available)
- [ ] Use API (if required)
```

#### User Provisioning Script

```bash
# /opt/watershed/scripts/provision-user.sh
#!/bin/bash

USERNAME="$1"
EMAIL="$2"
ROLE="$3"
ORGANIZATION="$4"

if [ -z "$USERNAME" ] || [ -z "$EMAIL" ] || [ -z "$ROLE" ]; then
    echo "Usage: $0 <username> <email> <role> [organization]"
    exit 1
fi

# Validate role
VALID_ROLES=("admin" "researcher" "analyst" "viewer")
if [[ ! " ${VALID_ROLES[@]} " =~ " ${ROLE} " ]]; then
    echo "Invalid role. Must be one of: ${VALID_ROLES[*]}"
    exit 1
fi

# Create user in database
sudo -u postgres psql -d watershed_db << EOF
INSERT INTO users (username, email, role, organization, created_at)
VALUES ('$USERNAME', '$EMAIL', '$ROLE', '$ORGANIZATION', NOW());

-- Log the action
INSERT INTO user_activity (user_id, action, resource_type, timestamp)
SELECT id, 'user_provisioned', 'user', NOW()
FROM users
WHERE username = '$USERNAME';
EOF

# Send welcome email
echo "User provisioned successfully"
echo "Welcome email sent to $EMAIL"
echo "Username: $USERNAME"
echo "Temporary password will be sent separately"
```

### Security Auditing

#### Access Log Analysis

```sql
-- Check user login patterns
SELECT 
    u.username,
    COUNT(*) as login_count,
    MAX(ua.timestamp) as last_login,
    ua.ip_address
FROM users u
JOIN user_activity ua ON u.id = ua.user_id
WHERE ua.action = 'login'
GROUP BY u.id, u.username, ua.ip_address
ORDER BY login_count DESC;

-- Check for suspicious activity
SELECT 
    username,
    ip_address,
    COUNT(*) as attempts,
    MAX(timestamp) as last_attempt
FROM user_activity
WHERE action = 'failed_login'
GROUP BY username, ip_address
HAVING COUNT(*) > 10
ORDER BY attempts DESC;

-- Active sessions
SELECT 
    u.username,
    s.ip_address,
    s.user_agent,
    s.expires_at
FROM user_sessions s
JOIN users u ON s.user_id = u.id
WHERE s.expires_at > NOW()
ORDER BY s.created_at DESC;
```

#### Automated Security Monitoring

```bash
# /opt/watershed/scripts/security-monitor.sh
#!/bin/bash

LOG_FILE="/var/log/watershed-security.log"

log_security_event() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" >> $LOG_FILE
}

# Check for brute force attempts
FAILED_LOGINS=$(sudo -u postgres psql -d watershed_db -t -c "
    SELECT COUNT(*) FROM user_activity 
    WHERE action = 'failed_login' 
    AND timestamp > NOW() - INTERVAL '1 hour'
;")

if [ "$FAILED_LOGINS" -gt 50 ]; then
    log_security_event "WARNING: High number of failed logins: $FAILED_LOGINS"
    # Send alert
fi

# Check for new admin users
NEW_ADMINS=$(sudo -u postgres psql -d watershed_db -t -c "
    SELECT COUNT(*) FROM users 
    WHERE role = 'admin' 
    AND created_at > NOW() - INTERVAL '24 hours'
;")

if [ "$NEW_ADMINS" -gt 0 ]; then
    log_security_event "INFO: New admin user(s) created: $NEW_ADMINS"
fi

# Check for database access from unusual IPs
UNUSUAL_ACCESS=$(sudo -u postgres psql -d watershed_db -t -c "
    SELECT COUNT(DISTINCT ip_address) FROM user_activity 
    WHERE ip_address NOT LIKE '10.0.0.%' 
    AND ip_address NOT LIKE '172.16.0.%'
    AND timestamp > NOW() - INTERVAL '1 hour'
;")

if [ "$UNUSUAL_ACCESS" -gt 0 ]; then
    log_security_event "WARNING: Database access from external IPs: $UNUSUAL_ACCESS"
fi

echo "Security monitoring completed"
```

### User Documentation

#### Quick Start Guide

```markdown
# Quick Start Guide - Watershed Disturbance Mapping System

## Getting Started

### 1. Access the System
- URL: https://watershed.example.com
- Use your provided credentials
- Contact admin if you need an account

### 2. Dashboard Overview
- **Map View**: Interactive watershed visualization
- **Watersheds**: List of assigned watersheds
- **Analytics**: Change detection results and trends
- **Profile**: User settings and preferences

### 3. Basic Workflow
1. Select a watershed from the list or map
2. View current satellite data coverage
3. Run change detection analysis
4. Review results and trends
5. Export data if needed

### 4. Common Tasks

#### View Watershed Data
- Navigate to Watersheds tab
- Click on watershed name or marker on map
- View boundary, metadata, and statistics

#### Run Analysis
- Select watershed
- Choose analysis date range
- Select change detection algorithm
- Click "Run Analysis"
- Monitor progress in real-time

#### Export Results
- Go to Analytics tab
- Select watershed and time period
- Choose export format (CSV, JSON, GeoJSON)
- Click "Export Data"

#### Set Up Alerts
- Go to Profile > Alerts
- Configure notification preferences
- Set thresholds for change detection
- Save preferences

### 5. Help Resources
- User Manual: `/docs/user-manual.pdf`
- API Documentation: `https://api.watershed.example.com/api-docs`
- Contact Support: support@watershed.example.com
```

---

## Conclusion

This comprehensive deployment guide provides step-by-step instructions for deploying and maintaining the Watershed Disturbance Mapping System. The system is designed for production use with enterprise-grade security, monitoring, and disaster recovery capabilities.

### Key Deployment Steps Summary

1. **Infrastructure Setup**: Install and configure all required software and services
2. **Database Deployment**: Set up PostgreSQL with PostGIS and configure for production
3. **API Server**: Deploy Node.js API with proper security and monitoring
4. **Python Processing**: Configure satellite data processing pipeline
5. **Frontend Deployment**: Build and deploy React application
6. **VPN Setup**: Configure secure remote access
7. **SSL Certificates**: Implement HTTPS with Let's Encrypt
8. **Security Hardening**: Apply security best practices
9. **Monitoring**: Set up comprehensive monitoring and alerting
10. **Backup Strategy**: Implement automated backup and recovery procedures

### Production Readiness Checklist

- [ ] All services running with proper process management
- [ ] SSL certificates installed and auto-renewal configured
- [ ] Database backups running automatically
- [ ] Monitoring and alerting systems operational
- [ ] Security hardening applied
- [ ] User access management configured
- [ ] Documentation and runbooks in place
- [ ] Disaster recovery procedures tested
- [ ] Performance optimization implemented
- [ ] Load balancing configured (if multiple servers)

### Support and Maintenance

For ongoing support and maintenance:

1. **Regular Updates**: Keep system updated with security patches
2. **Monitoring**: Review logs and metrics regularly
3. **Performance**: Monitor and optimize based on usage patterns
4. **Security**: Conduct regular security audits
5. **Backup Testing**: Test disaster recovery procedures quarterly
6. **User Support**: Maintain user documentation and support channels

### Contact Information

- **System Administrator**: admin@watershed.example.com
- **Technical Support**: support@watershed.example.com
- **Documentation**: https://docs.watershed.example.com
- **Emergency Hotline**: +1-XXX-XXX-XXXX

---

**Document Version**: 1.0  
**Last Updated**: October 30, 2025  
**Next Review Date**: January 30, 2026
