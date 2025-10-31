#!/bin/bash

# =============================================================================
# Database User Management Script
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
DB_HOST="localhost"
DB_PORT="5432"
ADMIN_USER="postgres"

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

# Generate secure password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-16
}

# Create application user
create_app_user() {
    local username="$1"
    local password="$2"
    local is_readonly="${3:-false}"
    
    log "Creating application user: $username"
    
    if [ -z "$username" ]; then
        username="app_user_$(date +%s)"
        log "Generated username: $username"
    fi
    
    if [ -z "$password" ]; then
        password=$(generate_password)
        log "Generated password: $password"
    fi
    
    # Create user
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" << EOF
-- Create user if not exists
DO \$\$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$username') THEN
        CREATE USER "$username" WITH PASSWORD '$password';
    END IF;
END
\$\$;

-- Grant basic permissions
GRANT CONNECT ON DATABASE $DB_NAME TO "$username";
GRANT USAGE ON SCHEMA public TO "$username";

EOF

    if [ "$is_readonly" = true ]; then
        # Read-only user permissions
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" << EOF
-- Grant read-only permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO "$username";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "$username";
GRANT SELECT ON ALL FUNCTIONS IN SCHEMA public TO "$username";

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO "$username";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "$username";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON FUNCTIONS TO "$username";

-- Grant TimescaleDB read permissions
GRANT USAGE ON SCHEMA timescaledb TO "$username";
GRANT SELECT ON ALL TABLES IN SCHEMA timescaledb TO "$username";

-- Grant access to performance monitoring
GRANT SELECT ON pg_stat_statements TO "$username";

EOF
    else
        # Full application user permissions
        psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" << EOF
-- Grant full permissions for application user
GRANT CREATE ON SCHEMA public TO "$username";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "$username";
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "$username";
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO "$username";
GRANT ALL PRIVILEGES ON ALL TYPES IN SCHEMA public TO "$username";

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "$username";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO "$username";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO "$username";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TYPES TO "$username";

-- Grant TimescaleDB permissions
GRANT CREATE ON DATABASE $DB_NAME TO "$username";
GRANT ALL ON SCHEMA timescaledb TO "$username";
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA timescaledb TO "$username";

-- Grant access to performance monitoring
GRANT SELECT ON pg_stat_statements TO "$username";

EOF
    fi
    
    # Display credentials
    echo
    echo "========================================="
    echo "User Created Successfully!"
    echo "========================================="
    echo "Username: $username"
    echo "Password: $password"
    echo "Database: $DB_NAME"
    echo "Host: $DB_HOST"
    echo "Port: $DB_PORT"
    echo "Read-only: $is_readonly"
    echo
    echo "Connection String:"
    if [ "$is_readonly" = true ]; then
        echo "  psql -h $DB_HOST -p $DB_PORT -U $username -d $DB_NAME"
        echo "  pgbouncer://$username:$password@$DB_HOST:6432/$DB_NAME"
    else
        echo "  psql -h $DB_HOST -p $DB_PORT -U $username -d $DB_NAME"
        echo "  pgbouncer://$username:$password@$DB_HOST:6432/$DB_NAME"
    fi
    echo "========================================="
    echo
}

# Create monitoring user
create_monitoring_user() {
    local username="monitoring_user"
    local password=$(generate_password)
    
    log "Creating monitoring user: $username"
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" << EOF
-- Create monitoring user
DO \$\$ 
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '$username') THEN
        CREATE USER "$username" WITH PASSWORD '$password';
    END IF;
END
\$\$;

-- Grant monitoring permissions
GRANT CONNECT ON DATABASE $DB_NAME TO "$username";
GRANT USAGE ON SCHEMA public TO "$username";
GRANT USAGE ON SCHEMA information_schema TO "$username";
GRANT USAGE ON SCHEMA pg_catalog TO "$username";

-- Grant access to monitoring views and functions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO "$username";
GRANT SELECT ON ALL TABLES IN SCHEMA information_schema TO "$username";
GRANT SELECT ON ALL TABLES IN SCHEMA pg_catalog TO "$username";
GRANT SELECT ON ALL FUNCTIONS IN SCHEMA public TO "$username";
GRANT SELECT ON ALL FUNCTIONS IN SCHEMA information_schema TO "$username";
GRANT SELECT ON ALL FUNCTIONS IN SCHEMA pg_catalog TO "$username";

-- Grant specific monitoring privileges
GRANT pg_monitor TO "$username";
GRANT pg_read_all_stats TO "$username";
GRANT pg_read_all_settings TO "$username";

-- Grant TimescaleDB monitoring permissions
GRANT USAGE ON SCHEMA timescaledb TO "$username";
GRANT SELECT ON ALL TABLES IN SCHEMA timescaledb TO "$username";

EOF

    echo "========================================="
    echo "Monitoring User Created!"
    echo "========================================="
    echo "Username: $username"
    echo "Password: $password"
    echo "Permissions: Read-only + monitoring"
    echo "========================================="
    echo
}

# List users
list_users() {
    log "Listing database users..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" << 'EOF'
SELECT 
    rolname as username,
    rolsuper as superuser,
    rolinherit as inherit,
    rolcreaterole as create_role,
    rolcreatedb as create_db,
    rolcanlogin as can_login,
    rolreplication as replication,
    CASE 
        WHEN rolconnlimit >= 0 THEN rolconnlimit::text
        ELSE 'unlimited'
    END as connection_limit,
    rolvaliduntil as password_expires
FROM pg_roles 
WHERE rolname NOT LIKE 'pg_%'
ORDER BY rolname;
EOF
}

# Show user permissions
show_user_permissions() {
    local username="$1"
    
    if [ -z "$username" ]; then
        error "Username required"
    fi
    
    log "Showing permissions for user: $username"
    
    # Database permissions
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" << EOF
-- Database permissions
SELECT 
    datname as database,
    privilege_type,
    grantee
FROM information_schema.role_usage_grants 
WHERE grantee = '$username'
UNION
SELECT 
    'DATABASE' as datname,
    privilege_type,
    grantee
FROM information_schema.database_privileges 
WHERE grantee = '$username'
ORDER BY datname, privilege_type;
EOF

    # Schema permissions
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" << EOF
-- Schema permissions
SELECT 
    table_schema as schema,
    privilege_type,
    table_name as object
FROM information_schema.table_privileges 
WHERE grantee = '$username'
ORDER BY schema, table_name;
EOF
}

# Update user password
update_user_password() {
    local username="$1"
    local new_password="$2"
    
    if [ -z "$username" ]; then
        error "Username required"
    fi
    
    if [ -z "$new_password" ]; then
        new_password=$(generate_password)
        log "Generated new password: $new_password"
    fi
    
    log "Updating password for user: $username"
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" << EOF
ALTER USER "$username" WITH PASSWORD '$new_password';
EOF
    
    echo "========================================="
    echo "Password Updated!"
    echo "========================================="
    echo "Username: $username"
    echo "New Password: $new_password"
    echo "========================================="
    echo
}

# Revoke user access
revoke_user_access() {
    local username="$1"
    
    if [ -z "$username" ]; then
        error "Username required"
    fi
    
    log "Revoking access for user: $username"
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" << EOF
-- Revoke all privileges
REVOKE ALL PRIVILEGES ON DATABASE $DB_NAME FROM "$username";
REVOKE ALL PRIVILEGES ON SCHEMA public FROM "$username";
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM "$username";
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM "$username";
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM "$username";

-- Remove from default privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM "$username";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM "$username";
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM "$username";
EOF

    echo "========================================="
    echo "User Access Revoked!"
    echo "========================================="
    echo "Username: $username"
    echo "All privileges revoked from $DB_NAME database"
    echo "========================================="
    echo
}

# Drop user
drop_user() {
    local username="$1"
    
    if [ -z "$username" ]; then
        error "Username required"
    fi
    
    warning "This will permanently delete user: $username"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log "User deletion cancelled"
        return
    fi
    
    log "Dropping user: $username"
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" << EOF
DROP USER "$username";
EOF
    
    log "User '$username' has been dropped"
}

# Show usage statistics
show_user_stats() {
    log "User connection statistics..."
    
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$ADMIN_USER" -d "$DB_NAME" << 'EOF'
SELECT 
    usename as username,
    count(*) as total_connections,
    count(*) FILTER (WHERE state = 'active') as active_connections,
    count(*) FILTER (WHERE state = 'idle') as idle_connections,
    max(now() - state_change) as longest_idle_time
FROM pg_stat_activity 
GROUP BY usename 
ORDER BY total_connections DESC;
EOF
}

# Main menu
show_menu() {
    echo
    echo "========================================="
    echo "Watershed Database User Management"
    echo "========================================="
    echo "1. Create application user"
    echo "2. Create read-only user"
    echo "3. Create monitoring user"
    echo "4. List all users"
    echo "5. Show user permissions"
    echo "6. Update user password"
    echo "7. Revoke user access"
    echo "8. Drop user"
    echo "9. Show user statistics"
    echo "0. Exit"
    echo
    echo -n "Choose option: "
}

# Main script
main() {
    case "${1:-menu}" in
        "create-app")
            create_app_user "$2" "$3" "false"
            ;;
        "create-readonly")
            create_app_user "$2" "$3" "true"
            ;;
        "create-monitoring")
            create_monitoring_user
            ;;
        "list")
            list_users
            ;;
        "permissions")
            show_user_permissions "$2"
            ;;
        "update-password")
            update_user_password "$2" "$3"
            ;;
        "revoke")
            revoke_user_access "$2"
            ;;
        "drop")
            drop_user "$2"
            ;;
        "stats")
            show_user_stats
            ;;
        "help"|"--help"|"-h")
            echo "Usage: $0 [COMMAND] [OPTIONS]"
            echo
            echo "Commands:"
            echo "  create-app [username] [password]     - Create application user"
            echo "  create-readonly [username] [password] - Create read-only user"
            echo "  create-monitoring                     - Create monitoring user"
            echo "  list                                  - List all users"
            echo "  permissions <username>                - Show user permissions"
            echo "  update-password <username> [password] - Update user password"
            echo "  revoke <username>                     - Revoke user access"
            echo "  drop <username>                       - Drop user (WARNING: Permanent)"
            echo "  stats                                 - Show connection statistics"
            echo "  help                                  - Show this help"
            echo
            echo "Interactive mode:"
            echo "  $0 menu                               - Interactive menu"
            exit 0
            ;;
        "menu")
            while true; do
                show_menu
                read choice
                case $choice in
                    1)
                        read -p "Username (leave empty for auto-generated): " username
                        read -s -p "Password (leave empty for auto-generated): " password
                        echo
                        create_app_user "$username" "$password" "false"
                        ;;
                    2)
                        read -p "Username (leave empty for auto-generated): " username
                        read -s -p "Password (leave empty for auto-generated): " password
                        echo
                        create_app_user "$username" "$password" "true"
                        ;;
                    3)
                        create_monitoring_user
                        ;;
                    4)
                        list_users
                        ;;
                    5)
                        read -p "Username: " username
                        show_user_permissions "$username"
                        ;;
                    6)
                        read -p "Username: " username
                        read -s -p "New password (leave empty for auto-generated): " password
                        echo
                        update_user_password "$username" "$password"
                        ;;
                    7)
                        read -p "Username: " username
                        revoke_user_access "$username"
                        ;;
                    8)
                        read -p "Username: " username
                        drop_user "$username"
                        ;;
                    0)
                        log "Goodbye!"
                        exit 0
                        ;;
                    *)
                        warning "Invalid option"
                        ;;
                esac
                
                echo
                read -p "Press Enter to continue..."
            done
            ;;
        *)
            error "Unknown command: $1. Use '$0 help' for usage information."
            ;;
    esac
}

# Run main function
main "$@"