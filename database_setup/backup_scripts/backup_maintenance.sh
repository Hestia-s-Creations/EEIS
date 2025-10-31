#!/bin/bash

# =============================================================================
# Database Backup and Maintenance Script
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
ADMIN_USER="postgres"

# Backup configuration
BACKUP_DIR="/opt/backups"
LOG_DIR="/var/log/watershed-db"
RETENTION_DAYS=30
COMPRESSION_LEVEL=9

# Logging functions
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')] [INFO]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [INFO] $1" >> "$LOG_DIR/backup.log"
}

warning() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [WARNING] $1" >> "$LOG_DIR/backup.log"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR]${NC} $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $1" >> "$LOG_DIR/backup.log"
    exit 1
}

# Create necessary directories
setup_directories() {
    mkdir -p "$BACKUP_DIR" "$LOG_DIR"
    chmod 750 "$BACKUP_DIR" "$LOG_DIR"
}

# Get database size
get_db_size() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT pg_size_pretty(pg_database_size('$DB_NAME'));
    " | tr -d ' '
}

# Get table sizes
get_table_sizes() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        SELECT 
            schemaname,
            tablename,
            pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
    "
}

# Full database backup
backup_full() {
    local backup_type="${1:-full}"
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/${DB_NAME}_${backup_type}_${timestamp}.dump"
    local compressed_file="${backup_file}.gz"
    
    log "Starting $backup_type backup of database '$DB_NAME'..."
    
    # Check database connectivity
    if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\\q" 2>/dev/null; then
        error "Cannot connect to database '$DB_NAME'"
    fi
    
    # Create backup metadata
    local metadata_file="$BACKUP_DIR/${DB_NAME}_${backup_type}_${timestamp}.meta"
    cat > "$metadata_file" << EOF
{
    "database": "$DB_NAME",
    "backup_type": "$backup_type",
    "timestamp": "$timestamp",
    "hostname": "$(hostname)",
    "db_size_before": "$(get_db_size)",
    "postgresql_version": "$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c 'SHOW server_version;')",
    "postgis_version": "$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c 'SELECT PostGIS_Version();')",
    "timescale_version": "$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';" 2>/dev/null || echo 'not installed')",
    "backup_created_by": "$(whoami)",
    "backup_script_version": "1.0.0"
}
EOF
    
    # Perform backup based on type
    case "$backup_type" in
        "schema")
            # Schema only backup
            pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                --schema-only \
                --no-owner \
                --no-privileges \
                --verbose \
                > "$backup_file" || error "Schema backup failed"
            ;;
        "data")
            # Data only backup
            pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                --data-only \
                --no-owner \
                --no-privileges \
                --verbose \
                > "$backup_file" || error "Data backup failed"
            ;;
        "custom")
            # Custom backup with specific options
            pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                --format=custom \
                --compress="$COMPRESSION_LEVEL" \
                --verbose \
                --no-owner \
                --clean \
                --if-exists \
                --exclude-table-data="audit_log" \
                --exclude-table-data="detection_quality_metrics" \
                --file="$backup_file" || error "Custom backup failed"
            ;;
        *)
            # Full backup (default)
            pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
                --format=custom \
                --compress="$COMPRESSION_LEVEL" \
                --verbose \
                --no-owner \
                --clean \
                --if-exists \
                --file="$backup_file" || error "Full backup failed"
            ;;
    esac
    
    # Compress if not already compressed
    if [ ! -f "$compressed_file" ]; then
        log "Compressing backup..."
        gzip -"$COMPRESSION_LEVEL" "$backup_file"
        backup_file="$compressed_file"
    fi
    
    # Calculate backup size
    local backup_size=$(du -h "$backup_file" | cut -f1)
    log "Backup completed: $backup_file ($backup_size)"
    
    # Verify backup
    if verify_backup "$backup_file"; then
        log "Backup verification successful"
    else
        error "Backup verification failed"
    fi
    
    # Clean up old backups
    cleanup_old_backups
    
    return 0
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi
    
    log "Verifying backup integrity: $backup_file"
    
    case "$backup_file" in
        *.dump|*.dump.gz)
            # Verify pg_dump format
            if file "$backup_file" | grep -q "gzip"; then
                gzip -t "$backup_file" 2>/dev/null || { error "Corrupted gzip file"; return 1; }
                # Check if it's a valid PostgreSQL dump
                zcat "$backup_file" | head -10 | grep -q "PostgreSQL database dump" || { error "Invalid PostgreSQL dump"; return 1; }
            else
                head -10 "$backup_file" | grep -q "PostgreSQL database dump" || { error "Invalid PostgreSQL dump"; return 1; }
            fi
            ;;
        *.sql|*.sql.gz)
            # Verify SQL format
            if file "$backup_file" | grep -q "gzip"; then
                gzip -t "$backup_file" 2>/dev/null || { error "Corrupted gzip file"; return 1; }
            fi
            ;;
        *)
            warning "Unknown backup format, skipping verification"
            return 0
            ;;
    esac
    
    log "Backup verification completed successfully"
    return 0
}

# Clean up old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    local deleted_count=0
    
    # Remove old backup files
    find "$BACKUP_DIR" -name "${DB_NAME}_*.dump*" -type f -mtime +$RETENTION_DAYS -print0 | while IFS= read -r -d '' file; do
        log "Deleting old backup: $(basename "$file")"
        rm -f "$file"
        ((deleted_count++))
    done
    
    # Remove old metadata files
    find "$BACKUP_DIR" -name "${DB_NAME}_*.meta" -type f -mtime +$RETENTION_DAYS -delete
    
    log "Cleanup completed. Deleted $deleted_count old backup files"
}

# List backups
list_backups() {
    log "Available backups in $BACKUP_DIR:"
    echo
    
    if [ ! -d "$BACKUP_DIR" ]; then
        warning "Backup directory does not exist"
        return
    fi
    
    find "$BACKUP_DIR" -name "${DB_NAME}_*.dump*" -type f -exec ls -lh {} \; | \
    while read -r line; do
        echo "  $line"
    done
    
    if [ -d "$BACKUP_DIR" ] && [ -z "$(find "$BACKUP_DIR" -name "${DB_NAME}_*.dump*" -type f)" ]; then
        log "No backups found"
    fi
}

# Restore backup
restore_backup() {
    local backup_file="$1"
    local restore_db="${2:-$DB_NAME}"
    
    if [ -z "$backup_file" ]; then
        error "Backup file path required"
    fi
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi
    
    log "Starting restore from: $backup_file"
    log "Target database: $restore_db"
    
    # Confirm restore operation
    warning "This will overwrite the database '$restore_db'"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "Restore cancelled"
        return 1
    fi
    
    # Verify backup before restore
    if ! verify_backup "$backup_file"; then
        error "Backup verification failed, aborting restore"
    fi
    
    # Create backup before restore
    backup_full "pre-restore"
    
    # Perform restore
    log "Performing restore..."
    
    case "$backup_file" in
        *.dump|*.dump.gz)
            if file "$backup_file" | grep -q "gzip"; then
                zcat "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$restore_db" || error "Restore failed"
            else
                psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$restore_db" -f "$backup_file" || error "Restore failed"
            fi
            ;;
        *.sql|*.sql.gz)
            if file "$backup_file" | grep -q "gzip"; then
                zcat "$backup_file" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$restore_db" || error "Restore failed"
            else
                psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$restore_db" -f "$backup_file" || error "Restore failed"
            fi
            ;;
        *)
            error "Unknown backup format"
            ;;
    esac
    
    log "Restore completed successfully"
    
    # Update statistics after restore
    log "Updating database statistics..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$restore_db" -c "ANALYZE;" || warning "Failed to update statistics"
    
    # Verify restore
    log "Verifying restore..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$restore_db" -c "
        SELECT 
            'Watershed monitoring database' as database,
            COUNT(*) as table_count
        FROM information_schema.tables 
        WHERE table_schema = 'public';
    " || warning "Restore verification failed"
}

# Database maintenance
maintenance() {
    log "Starting database maintenance..."
    
    # Vacuum and analyze
    log "Running VACUUM ANALYZE..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        VACUUM (ANALYZE, VERBOSE);
    " || warning "VACUUM ANALYZE failed"
    
    # Reindex (weekly)
    if [ $(date +%u) -eq 7 ]; then
        log "Running REINDEX DATABASE (weekly maintenance)..."
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" -c "
            REINDEX DATABASE $DB_NAME;
        " || warning "REINDEX failed"
    fi
    
    # Update statistics
    log "Updating table statistics..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        ANALYZE;
    " || warning "ANALYZE failed"
    
    # Check database integrity
    log "Checking database integrity..."
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" -c "
        SELECT 
            schemaname,
            tablename,
            attname,
            n_distinct,
            correlation
        FROM pg_stats 
        WHERE schemaname = 'public'
        ORDER BY tablename, attname;
    " || warning "Database integrity check failed"
    
    log "Database maintenance completed"
}

# Health check
health_check() {
    log "Running database health check..."
    
    # Check connectivity
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\\q" 2>/dev/null; then
        log "✓ Database connectivity: OK"
    else
        error "✗ Database connectivity: FAILED"
    fi
    
    # Check PostGIS
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT PostGIS_Version();" 2>/dev/null | grep -q "3."; then
        log "✓ PostGIS extension: OK"
    else
        warning "✗ PostGIS extension: NOT AVAILABLE"
    fi
    
    # Check TimescaleDB
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';" 2>/dev/null; then
        log "✓ TimescaleDB extension: OK"
    else
        warning "✗ TimescaleDB extension: NOT AVAILABLE"
    fi
    
    # Check database size
    local db_size=$(get_db_size)
    log "✓ Database size: $db_size"
    
    # Check connections
    local conn_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM pg_stat_activity;" | tr -d ' ')
    log "✓ Active connections: $conn_count"
    
    # Check disk space
    local disk_usage=$(df "$BACKUP_DIR" | tail -1 | awk '{print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 90 ]; then
        log "✓ Disk usage: ${disk_usage}% (OK)"
    else
        warning "✗ Disk usage: ${disk_usage}% (HIGH)"
    fi
    
    # Check log files
    if [ -f "$LOG_DIR/backup.log" ]; then
        local log_size=$(du -h "$LOG_DIR/backup.log" | cut -f1)
        log "✓ Log file size: $log_size"
    fi
    
    log "Health check completed"
}

# Show usage statistics
show_stats() {
    log "Database backup statistics:"
    
    # Total backups
    local total_backups=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.dump*" -type f | wc -l)
    log "Total backups: $total_backups"
    
    # Total backup size
    local total_size=$(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)
    log "Total backup size: $total_size"
    
    # Latest backup
    local latest_backup=$(find "$BACKUP_DIR" -name "${DB_NAME}_*.dump*" -type f -printf '%T@ %p\n' | sort -n | tail -1 | cut -d' ' -f2-)
    if [ -n "$latest_backup" ]; then
        local backup_size=$(du -h "$latest_backup" | cut -f1)
        log "Latest backup: $(basename "$latest_backup") ($backup_size)"
    fi
    
    # Database size
    log "Current database size: $(get_db_size)"
    
    # Table sizes
    echo
    log "Table sizes:"
    get_table_sizes
}

# Main function
main() {
    setup_directories
    
    case "${1:-help}" in
        "backup"|"full")
            backup_full "full"
            ;;
        "schema")
            backup_full "schema"
            ;;
        "data")
            backup_full "data"
            ;;
        "custom")
            backup_full "custom"
            ;;
        "restore")
            restore_backup "$2" "$3"
            ;;
        "verify")
            verify_backup "$2"
            ;;
        "list")
            list_backups
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        "maintenance")
            maintenance
            ;;
        "health")
            health_check
            ;;
        "stats")
            show_stats
            ;;
        "help"|"--help"|"-h")
            echo "Usage: $0 [COMMAND] [OPTIONS]"
            echo
            echo "Commands:"
            echo "  backup|full         - Create full database backup"
            echo "  schema              - Create schema-only backup"
            echo "  data                - Create data-only backup"
            echo "  custom              - Create custom backup (excludes audit logs)"
            echo "  restore <file>      - Restore from backup file"
            echo "  verify <file>       - Verify backup integrity"
            echo "  list                - List available backups"
            echo "  cleanup             - Clean up old backups"
            echo "  maintenance         - Run database maintenance"
            echo "  health              - Run database health check"
            echo "  stats               - Show backup statistics"
            echo "  help                - Show this help"
            echo
            echo "Examples:"
            echo "  $0 backup                    # Create full backup"
            echo "  $0 restore backup.dump       # Restore from backup"
            echo "  $0 maintenance              # Run weekly maintenance"
            echo
            exit 0
            ;;
        *)
            error "Unknown command: $1. Use '$0 help' for usage information."
            ;;
    esac
}

# Run main function
main "$@"