#!/bin/bash

# =============================================================================
# Database Initialization Script
# Watershed Disturbance Mapping System
# =============================================================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="watershed_monitor"
DB_USER="app_user"
DB_HOST="localhost"
DB_PORT="5432"

# Logging functions
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

# Check if database exists
check_database() {
    log "Checking if database exists..."
    
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\\q" 2>/dev/null; then
        log "Database '$DB_NAME' exists and is accessible."
        return 0
    else
        warning "Database '$DB_NAME' does not exist or is not accessible."
        return 1
    fi
}

# Check if schema exists
check_schema() {
    log "Checking if schema exists..."
    
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    
    if [ "$table_count" -gt 0 ]; then
        log "Schema already exists with $table_count tables."
        return 0
    else
        log "No schema found. Database is empty."
        return 1
    fi
}

# Initialize database schema
init_schema() {
    log "Initializing database schema..."
    
    # Check if schema files exist
    if [ ! -f "001_initial_schema.sql" ]; then
        error "Schema file 001_initial_schema.sql not found!"
    fi
    
    if [ ! -f "002_advanced_indexes.sql" ]; then
        error "Schema file 002_advanced_indexes.sql not found!"
    fi
    
    if [ ! -f "003_migrations_framework.sql" ]; then
        error "Schema file 003_migrations_framework.sql not found!"
    fi
    
    # Run schema initialization
    log "Step 1: Creating initial schema..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "001_initial_schema.sql" || error "Failed to create initial schema"
    
    log "Step 2: Creating advanced indexes..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "002_advanced_indexes.sql" || error "Failed to create advanced indexes"
    
    log "Step 3: Setting up migration framework..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "003_migrations_framework.sql" || error "Failed to setup migration framework"
    
    log "Schema initialization completed successfully!"
}

# Load sample data
load_sample_data() {
    log "Loading sample data..."
    
    if [ -f "004_sample_data.sql" ]; then
        log "Loading sample data for testing..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "004_sample_data.sql" || warning "Failed to load sample data"
    else
        warning "Sample data file 004_sample_data.sql not found. Skipping..."
    fi
    
    if [ -f "005_common_queries.sql" ]; then
        log "Loading common queries..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "005_common_queries.sql" || warning "Failed to load common queries"
    else
        warning "Common queries file 005_common_queries.sql not found. Skipping..."
    fi
}

# Verify installation
verify_installation() {
    log "Verifying database installation..."
    
    # Check extensions
    log "Checking installed extensions..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            name, 
            default_version, 
            installed_version 
        FROM pg_available_extensions 
        WHERE name IN ('postgis', 'timescaledb', 'uuid-ossp', 'pgcrypto') 
        ORDER BY name;
    "
    
    # Check tables
    log "Checking database tables..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            table_name,
            table_type
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
    "
    
    # Check indexes
    log "Checking indexes..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            indexname,
            tablename,
            indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public' 
        AND indexname LIKE 'idx_%'
        ORDER BY tablename, indexname;
    "
    
    # Check TimescaleDB hypertables
    log "Checking TimescaleDB configuration..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT * FROM timescaledb_information.hypertables;
    " 2>/dev/null || log "TimescaleDB hypertables not yet configured"
    
    # Test spatial functionality
    log "Testing spatial functionality..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            'Spatial test' as test,
            PostGIS_Version() as postgis_version,
            ST_AsText(ST_MakePoint(-123.45, 45.67, 4326)) as sample_geometry;
    "
    
    log "Installation verification completed!"
}

# Create backup
create_backup() {
    local backup_dir="${1:-./backups}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/watershed_monitor_init_$timestamp.dump"
    
    log "Creating initialization backup..."
    
    mkdir -p "$backup_dir"
    
    pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --format=custom \
        --compress=9 \
        --verbose \
        --file="$backup_file" || error "Failed to create backup"
    
    log "Backup created: $backup_file"
    ls -lh "$backup_file"
}

# Main execution
main() {
    log "========================================="
    log "Watershed Database Initialization"
    log "========================================="
    
    # Parse command line arguments
    SKIP_SAMPLE_DATA=false
    CREATE_BACKUP=false
    FORCE_REINIT=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-sample-data)
                SKIP_SAMPLE_DATA=true
                shift
                ;;
            --create-backup)
                CREATE_BACKUP=true
                shift
                ;;
            --force-reinit)
                FORCE_REINIT=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo
                echo "Options:"
                echo "  --skip-sample-data    Skip loading sample data"
                echo "  --create-backup       Create backup before initialization"
                echo "  --force-reinit        Force re-initialization even if schema exists"
                echo "  --help, -h            Show this help message"
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Check database connectivity
    if ! check_database; then
        error "Cannot connect to database. Please check your configuration."
    fi
    
    # Create backup if requested
    if [ "$CREATE_BACKUP" = true ]; then
        create_backup
    fi
    
    # Check if schema already exists
    if check_schema && [ "$FORCE_REINIT" != true ]; then
        log "Schema already exists. Use --force-reinit to re-initialize."
        verify_installation
        exit 0
    fi
    
    # Initialize schema
    init_schema
    
    # Load sample data if not skipped
    if [ "$SKIP_SAMPLE_DATA" != true ]; then
        load_sample_data
    fi
    
    # Verify installation
    verify_installation
    
    # Final backup
    if [ "$CREATE_BACKUP" = true ]; then
        create_backup
    fi
    
    log "========================================="
    log "Database Initialization Complete!"
    log "========================================="
    log
    log "Database Details:"
    log "  Name: $DB_NAME"
    log "  User: $DB_USER"
    log "  Host: $DB_HOST"
    log "  Port: $DB_PORT"
    log
    log "Installed Extensions:"
    log "  - PostGIS (spatial functionality)"
    log "  - TimescaleDB (time-series optimization)"
    log "  - UUID-OSSP (UUID generation)"
    log "  - pgcrypto (cryptographic functions)"
    log
    log "Next Steps:"
    log "1. Review and customize database configuration"
    log "2. Set up backup schedules"
    log "3. Configure connection pooling"
    log "4. Set up monitoring and alerting"
    log "5. Create application users and permissions"
    log
    log "Connection String:"
    log "  psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME"
    log
}

# Run main function
main "$@"