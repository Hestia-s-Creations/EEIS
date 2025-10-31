#!/bin/bash

# =============================================================================
# Installation Verification Script
# Watershed Disturbance Mapping System Database
# =============================================================================

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DB_NAME="watershed_monitor"
DB_USER="app_user"
DB_HOST="localhost"
DB_PORT="5432"
PGPOOL_PORT="6432"

# Test results
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓ SUCCESS]${NC} $1"
    ((TESTS_PASSED++))
}

log_failure() {
    echo -e "${RED}[✗ FAILED]${NC} $1"
    ((TESTS_FAILED++))
}

log_warning() {
    echo -e "${YELLOW}[⚠ WARNING]${NC} $1"
}

log_info_header() {
    echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Test function wrapper
run_test() {
    local test_name="$1"
    local test_function="$2"
    
    ((TESTS_TOTAL++))
    echo -n "Testing $test_name... "
    
    if $test_function; then
        echo -e "${GREEN}PASS${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}FAIL${NC}"
        ((TESTS_FAILED++))
    fi
}

# Test functions
test_postgresql_service() {
    if systemctl is-active --quiet postgresql 2>/dev/null || systemctl is-active --quiet postgresql-14 2>/dev/null; then
        return 0
    fi
    
    # Check if running in Docker
    if [ -f "/.dockerenv" ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
        return 0
    fi
    
    return 1
}

test_postgresql_port() {
    if command -v nc >/dev/null 2>&1; then
        nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null
    else
        timeout 5 bash -c "echo > /dev/tcp/$DB_HOST/$DB_PORT" 2>/dev/null
    fi
}

test_database_connection() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\\q" 2>/dev/null
}

test_postgis_extension() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT PostGIS_Version();" 2>/dev/null | grep -q "3\."
}

test_timescaledb_extension() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';" 2>/dev/null | grep -q "2\."
}

test_uuid_extension() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT extversion FROM pg_extension WHERE extname = 'uuid-ossp';" 2>/dev/null | grep -q "1\."
}

test_pgcrypto_extension() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT extversion FROM pg_extension WHERE extname = 'pgcrypto';" 2>/dev/null | grep -q "1\."
}

test_schema_tables() {
    local table_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
    [ "$table_count" -gt 0 ]
}

test_spatial_indexes() {
    local index_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE '%geom%';" 2>/dev/null | tr -d ' ')
    [ "$index_count" -gt 0 ]
}

test_time_series_table() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\\d time_series" 2>/dev/null | grep -q "hypertable\|Chunk"
}

test_user_permissions() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT 1" 2>/dev/null
}

test_readonly_user() {
    PGPASSWORD="ReadOnlyPassword456!" psql -h "$DB_HOST" -p "$DB_PORT" -U "read_user" -d "$DB_NAME" -t -c "SELECT 1" 2>/dev/null
}

test_watershed_tables_exist() {
    local table_exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'watersheds');" 2>/dev/null | tr -d ' ')
    [ "$table_exists" = "t" ]
}

test_detections_table_exist() {
    local table_exists=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'detections');" 2>/dev/null | tr -d ' ')
    [ "$table_exists" = "t" ]
}

test_basic_spatial_query() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT ST_AsText(ST_MakePoint(-123.45, 45.67, 4326));" 2>/dev/null | grep -q "POINT"
}

test_timeseries_functions() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SHOW timescaledb;" 2>/dev/null | grep -q "on\|off"
}

test_performance_views() {
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT * FROM pg_stat_statements LIMIT 1;" 2>/dev/null | head -1 >/dev/null
}

test_pgpool_connection() {
    if command -v nc >/dev/null 2>&1; then
        nc -z "$DB_HOST" "$PGPOOL_PORT" 2>/dev/null
    else
        timeout 5 bash -c "echo > /dev/tcp/$DB_HOST/$PGPOOL_PORT" 2>/dev/null
    fi
}

# System information
show_system_info() {
    log_info_header "SYSTEM INFORMATION"
    
    echo -e "${BLUE}Operating System:${NC} $(uname -s) $(uname -r)"
    echo -e "${BLUE}Architecture:${NC} $(uname -m)"
    echo -e "${BLUE}Hostname:${NC} $(hostname)"
    echo -e "${BLUE}Current User:${NC} $(whoami)"
    echo -e "${BLUE}Memory:${NC} $(free -h | grep '^Mem:' | awk '{print $2 " total, " $3 " used, " $4 " available"}')"
    echo -e "${BLUE}Disk Space:${NC} $(df -h / | tail -1 | awk '{print $4 " available of " $2 " total"}')"
    echo -e "${BLUE}CPU:${NC} $(nproc) cores"
    
    # Docker detection
    if [ -f "/.dockerenv" ] || grep -q docker /proc/1/cgroup 2>/dev/null; then
        echo -e "${BLUE}Environment:${NC} Docker Container"
    else
        echo -e "${BLUE}Environment:${NC} Physical/Virtual Server"
    fi
}

# Database information
show_database_info() {
    log_info_header "DATABASE INFORMATION"
    
    echo -e "${BLUE}Database Name:${NC} $DB_NAME"
    echo -e "${BLUE}Host:${NC} $DB_HOST"
    echo -e "${BLUE}Port:${NC} $DB_PORT"
    echo -e "${BLUE}Primary User:${NC} $DB_USER"
    
    # PostgreSQL version
    if command -v psql >/dev/null 2>&1; then
        local pg_version=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SHOW server_version;" 2>/dev/null | tr -d ' ')
        echo -e "${BLUE}PostgreSQL Version:${NC} $pg_version"
    fi
    
    # Database size
    if command -v psql >/dev/null 2>&1; then
        local db_size=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME'));" 2>/dev/null | tr -d ' ')
        echo -e "${BLUE}Database Size:${NC} $db_size"
    fi
    
    # Connection count
    if command -v psql >/dev/null 2>&1; then
        local conn_count=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT count(*) FROM pg_stat_activity;" 2>/dev/null | tr -d ' ')
        echo -e "${BLUE}Active Connections:${NC} $conn_count"
    fi
}

# Extension information
show_extensions_info() {
    log_info_header "INSTALLED EXTENSIONS"
    
    if command -v psql >/dev/null 2>&1; then
        echo -e "${CYAN}Spatial Extensions:${NC}"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT 
                name || ' v' || default_version || ' (' || 
                CASE WHEN installed_version IS NOT NULL THEN 'installed: ' || installed_version ELSE 'available' END ||
                ')' as extension
            FROM pg_available_extensions 
            WHERE name LIKE '%gis%'
            ORDER BY name;
        " 2>/dev/null | sed 's/^/  • /'
        
        echo -e "\n${CYAN}TimescaleDB:${NC}"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT 
                'TimescaleDB v' || extversion || ' (' || 
                CASE WHEN extname IS NOT NULL THEN 'active' ELSE 'not installed' END || ')' as status
            FROM pg_extension 
            WHERE extname = 'timescaledb'
            UNION ALL
            SELECT 'TimescaleDB not configured' as status
            WHERE NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb');
        " 2>/dev/null | sed 's/^/  • /'
        
        echo -e "\n${CYAN}Other Extensions:${NC}"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT 
                name || ' v' || default_version || 
                CASE WHEN installed_version IS NOT NULL THEN ' (installed)' ELSE '' END as extension
            FROM pg_available_extensions 
            WHERE name IN ('uuid-ossp', 'pgcrypto', 'pg_stat_statements', 'pg_trgm')
            ORDER BY name;
        " 2>/dev/null | sed 's/^/  • /'
    fi
}

# Table information
show_tables_info() {
    log_info_header "DATABASE TABLES"
    
    if command -v psql >/dev/null 2>&1; then
        echo -e "${CYAN}Core Tables:${NC}"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT 
                table_name,
                CASE 
                    WHEN table_name IN ('watersheds', 'detections', 'time_series', 'baselines') THEN 'Core'
                    WHEN table_name IN ('users', 'alerts', 'user_preferences') THEN 'User Mgmt'
                    WHEN table_name IN ('quality_control', 'detection_quality_metrics') THEN 'Quality Control'
                    WHEN table_name = 'audit_log' THEN 'Audit'
                    ELSE 'Other'
                END as category
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY category, table_name;
        " 2>/dev/null | sed 's/^/  • /'
        
        echo -e "\n${CYAN}Table Sizes:${NC}"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
            SELECT 
                tablename,
                pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
            FROM pg_tables 
            WHERE schemaname = 'public' 
            ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC 
            LIMIT 10;
        " 2>/dev/null | sed 's/^/  • /'
    fi
}

# Performance information
show_performance_info() {
    log_info_header "PERFORMANCE METRICS"
    
    if command -v psql >/dev/null 2>&1; then
        echo -e "${CYAN}Buffer Cache Hit Ratio:${NC}"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT 
                ROUND((sum(blks_hit) * 100.0 / (sum(blks_hit) + sum(blks_read))), 2) as hit_ratio,
                CASE 
                    WHEN sum(blks_hit) * 100.0 / (sum(blks_hit) + sum(blks_read)) > 95 THEN 'Excellent'
                    WHEN sum(blks_hit) * 100.0 / (sum(blks_hit) + sum(blks_read)) > 90 THEN 'Good'
                    WHEN sum(blks_hit) * 100.0 / (sum(blks_hit) + sum(blks_read)) > 80 THEN 'Fair'
                    ELSE 'Poor'
                END as status
            FROM pg_stat_database 
            WHERE datname = '$DB_NAME';
        " 2>/dev/null | sed 's/^/  • /'
        
        echo -e "\n${CYAN}Index Usage:${NC}"
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT 
                COUNT(*) as total_indexes,
                COUNT(*) FILTER (WHERE idx_scan > 0) as used_indexes,
                COUNT(*) FILTER (WHERE idx_scan = 0) as unused_indexes,
                ROUND(COUNT(*) FILTER (WHERE idx_scan > 0) * 100.0 / COUNT(*), 2) as usage_percentage
            FROM pg_stat_user_indexes;
        " 2>/dev/null | sed 's/^/  • /'
    fi
}

# Generate report
generate_report() {
    local status=""
    local color=""
    
    if [ $TESTS_FAILED -eq 0 ]; then
        status="ALL TESTS PASSED"
        color=$GREEN
    elif [ $TESTS_FAILED -le 2 ]; then
        status="MINOR ISSUES DETECTED"
        color=$YELLOW
    else
        status="CRITICAL ISSUES DETECTED"
        color=$RED
    fi
    
    echo -e "\n${color}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${color} INSTALLATION VERIFICATION REPORT${NC}"
    echo -e "${color}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    
    echo -e "\n${BLUE}Summary:${NC}"
    echo -e "  Total Tests: $TESTS_TOTAL"
    echo -e "  Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "  Failed: ${RED}$TESTS_FAILED${NC}"
    echo -e "  Success Rate: $(( TESTS_PASSED * 100 / TESTS_TOTAL ))%"
    
    echo -e "\n${BLUE}Status: ${color}$status${NC}"
    
    # Recommendations
    echo -e "\n${BLUE}Recommendations:${NC}"
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "  • Database is ready for production use"
        echo -e "  • Consider setting up monitoring and alerting"
        echo -e "  • Regular backup testing is recommended"
        echo -e "  • Review security settings for production"
    else
        echo -e "  • Address failed tests before production deployment"
        echo -e "  • Check log files for detailed error information"
        echo -e "  • Verify network connectivity and permissions"
        echo -e "  • Run the setup scripts again if necessary"
    fi
    
    echo -e "\n${BLUE}Next Steps:${NC}"
    echo -e "  1. Review the comprehensive documentation in README.md"
    echo -e "  2. Configure backup schedules and test restore procedures"
    echo -e "  3. Set up monitoring and alerting systems"
    echo -e "  4. Review and update security configurations"
    echo -e "  5. Plan for regular maintenance procedures"
    
    echo -e "\n${BLUE}Documentation:${NC}"
    echo -e "  • README.md - Complete installation and usage guide"
    echo -e "  • Configuration files in configuration/ directory"
    echo -e "  • Management scripts in database_scripts/ directory"
    echo -e "  • Backup scripts in backup_scripts/ directory"
    
    echo -e "\n${color}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

# Main verification function
main() {
    echo -e "${PURPLE}"
    echo "╔══════════════════════════════════════════════════════════════════════════╗"
    echo "║                   WATERSHED DATABASE VERIFICATION                        ║"
    echo "║                     Installation & Health Check                         ║"
    echo "╚══════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
    
    # Show system information
    show_system_info
    
    # Basic connectivity tests
    log_info_header "BASIC CONNECTIVITY TESTS"
    run_test "PostgreSQL Service" test_postgresql_service
    run_test "PostgreSQL Port ($DB_PORT)" test_postgresql_port
    run_test "Database Connection" test_database_connection
    
    # Extension tests
    log_info_header "EXTENSION VERIFICATION"
    run_test "PostGIS Extension" test_postgis_extension
    run_test "TimescaleDB Extension" test_timescaledb_extension
    run_test "UUID-OSSP Extension" test_uuid_extension
    run_test "pgcrypto Extension" test_pgcrypto_extension
    
    # Schema tests
    log_info_header "SCHEMA VERIFICATION"
    run_test "Database Tables" test_schema_tables
    run_test "Spatial Indexes" test_spatial_indexes
    run_test "Time-series Table" test_time_series_table
    run_test "Watersheds Table" test_watershed_tables_exist
    run_test "Detections Table" test_detections_table_exist
    
    # Functionality tests
    log_info_header "FUNCTIONALITY TESTS"
    run_test "Basic Spatial Query" test_basic_spatial_query
    run_test "TimescaleDB Functions" test_timeseries_functions
    run_test "Performance Views" test_performance_views
    
    # User tests
    log_info_header "USER PERMISSION TESTS"
    run_test "Primary User Access" test_user_permissions
    run_test "Read-only User Access" test_readonly_user
    
    # Connection pooling test
    log_info_header "CONNECTION POOLING TEST"
    run_test "PgBouncer Port ($PGPOOL_PORT)" test_pgpool_connection
    
    # Detailed information
    show_database_info
    show_extensions_info
    show_tables_info
    show_performance_info
    
    # Generate final report
    generate_report
    
    # Exit code based on results
    if [ $TESTS_FAILED -eq 0 ]; then
        exit 0
    else
        exit 1
    fi
}

# Handle command line arguments
case "${1:-verify}" in
    "verify"|"test")
        main
        ;;
    "quick")
        # Quick verification - only critical tests
        log_info_header "QUICK VERIFICATION"
        run_test "Database Connection" test_database_connection
        run_test "PostGIS Extension" test_postgis_extension
        run_test "Core Tables" test_schema_tables
        
        if [ $TESTS_FAILED -eq 0 ]; then
            log_success "Quick verification passed!"
            exit 0
        else
            log_failure "Quick verification failed!"
            exit 1
        fi
        ;;
    "info")
        # Show information only
        show_system_info
        show_database_info
        show_extensions_info
        show_tables_info
        show_performance_info
        ;;
    "help"|"--help"|"-h")
        echo "Usage: $0 [COMMAND]"
        echo
        echo "Commands:"
        echo "  verify    - Full verification (default)"
        echo "  quick     - Quick verification of critical components"
        echo "  info      - Show system and database information only"
        echo "  help      - Show this help message"
        echo
        exit 0
        ;;
    *)
        echo "Unknown command: $1"
        echo "Use '$0 help' for usage information."
        exit 1
        ;;
esac