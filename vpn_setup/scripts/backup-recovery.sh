#!/bin/bash
# Watershed Disturbance Mapping System - Backup and Recovery
# Comprehensive backup and recovery solution for VPN infrastructure

set -e

# Configuration
BACKUP_DIR="/opt/vpn-backups"
RETENTION_DAYS=30
ENCRYPTION_KEY_FILE="/etc/vpn-backup/.backup-key"
LOG_FILE="/var/log/vpn-backup.log"

# VPN Configuration paths
WG_CONFIG_PATH="/etc/wireguard"
OVPN_CONFIG_PATH="/etc/openvpn"
SSL_CERT_PATH="/etc/ssl/watershed"
USERS_DB_PATH="/etc/vpn/users.db"
FIREWALL_CONFIG="/etc/firewall"
MONITORING_CONFIG="/opt/vpn-monitoring"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    echo -e "${2}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Initialize backup system
initialize_backup_system() {
    log "Initializing VPN backup system..." "$GREEN"
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log "This script must be run as root" "$RED"
        exit 1
    fi
    
    # Create backup directories
    mkdir -p "$BACKUP_DIR"{daily,weekly,monthly,critical}
    mkdir -p "$(dirname "$ENCRYPTION_KEY_FILE")"
    
    # Create encryption key if it doesn't exist
    if [[ ! -f "$ENCRYPTION_KEY_FILE" ]]; then
        log "Creating encryption key..." "$YELLOW"
        openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
        chmod 600 "$ENCRYPTION_KEY_FILE"
    fi
    
    # Install required tools
    if command -v apt &> /dev/null; then
        log "Installing backup tools..." "$BLUE"
        apt update
        apt install -y rsync tar gzip gpg duplicity python3-pip bc
    elif command -v yum &> /dev/null; then
        log "Installing backup tools..." "$BLUE"
        yum install -y rsync tar gzip gnupg2 duplicity bc
    fi
    
    # Create backup scripts
    create_full_backup_script
    create_incremental_backup_script
    create_restore_script
    create_verification_script
    
    # Setup automated backups
    setup_automated_backups
    
    # Test backup system
    test_backup_system
    
    log "Backup system initialized successfully" "$GREEN"
}

# Create full backup script
create_full_backup_script() {
    log "Creating full backup script..." "$YELLOW"
    
    cat > "$BACKUP_DIR/full-backup.sh" << 'EOF'
#!/bin/bash
# VPN Full Backup Script

set -e

BACKUP_DIR="/opt/vpn-backups/daily"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_NAME="vpn-full-backup-${TIMESTAMP}"
TEMP_DIR="/tmp/vpn-backup-${TIMESTAMP}"
ENCRYPTION_KEY="/etc/vpn-backup/.backup-key"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${2}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "/var/log/vpn-backup.log"
}

log "Starting full VPN backup: $BACKUP_NAME" "$GREEN"

# Create temporary directory
mkdir -p "$TEMP_DIR"

# Backup WireGuard configuration
backup_wireguard() {
    log "Backing up WireGuard configuration..." "$BLUE"
    
    if [[ -d "/etc/wireguard" ]]; then
        mkdir -p "$TEMP_DIR/wireguard"
        cp -r /etc/wireguard/* "$TEMP_DIR/wireguard/" 2>/dev/null || true
        
        # Generate client configuration backup
        if [[ -f "/etc/wireguard/wg0.conf" ]]; then
            echo "# WireGuard Server Configuration Backup" > "$TEMP_DIR/wireguard/server-config.conf"
            cat /etc/wireguard/wg0.conf >> "$TEMP_DIR/wireguard/server-config.conf"
        fi
    fi
}

# Backup OpenVPN configuration
backup_openvpn() {
    log "Backing up OpenVPN configuration..." "$BLUE"
    
    if [[ -d "/etc/openvpn" ]]; then
        mkdir -p "$TEMP_DIR/openvpn"
        cp -r /etc/openvpn/* "$TEMP_DIR/openvpn/" 2>/dev/null || true
        
        # Copy EasyRSA PKI if exists
        if [[ -d "/etc/openvpn/easyrsa" ]]; then
            cp -r /etc/openvpn/easyrsa "$TEMP_DIR/openvpn/" 2>/dev/null || true
        fi
    fi
}

# Backup SSL certificates
backup_ssl_certificates() {
    log "Backing up SSL certificates..." "$BLUE"
    
    if [[ -d "/etc/ssl/watershed" ]]; then
        mkdir -p "$TEMP_DIR/ssl"
        cp -r /etc/ssl/watershed/* "$TEMP_DIR/ssl/" 2>/dev/null || true
    fi
}

# Backup user database
backup_user_database() {
    log "Backing up user database..." "$BLUE"
    
    if [[ -f "/etc/vpn/users.db" ]]; then
        mkdir -p "$TEMP_DIR/database"
        sqlite3 /etc/vpn/users.db ".backup $TEMP_DIR/database/users.db"
        
        # Export user data as CSV for additional safety
        sqlite3 /etc/vpn/users.db "SELECT * FROM users;" > "$TEMP_DIR/database/users.csv" 2>/dev/null || true
        sqlite3 /etc/vpn/users.db "SELECT * FROM access_logs;" > "$TEMP_DIR/database/access_logs.csv" 2>/dev/null || true
    fi
}

# Backup firewall configuration
backup_firewall() {
    log "Backing up firewall configuration..." "$BLUE"
    
    mkdir -p "$TEMP_DIR/firewall"
    
    # Backup iptables rules
    iptables-save > "$TEMP_DIR/firewall/iptables-rules.v4" 2>/dev/null || true
    
    # Backup firewall configuration files
    if [[ -d "/etc/firewall" ]]; then
        cp -r /etc/firewall/* "$TEMP_DIR/firewall/" 2>/dev/null || true
    fi
}

# Backup monitoring configuration
backup_monitoring() {
    log "Backing up monitoring configuration..." "$BLUE"
    
    if [[ -d "/opt/vpn-monitoring" ]]; then
        mkdir -p "$TEMP_DIR/monitoring"
        cp -r /opt/vpn-monitoring/* "$TEMP_DIR/monitoring/" 2>/dev/null || true
        
        # Backup log files
        if [[ -d "/var/log/vpn" ]]; then
            cp -r /var/log/vpn/* "$TEMP_DIR/monitoring/logs/" 2>/dev/null || true
        fi
    fi
}

# Backup system configuration
backup_system_config() {
    log "Backing up system configuration..." "$BLUE"
    
    mkdir -p "$TEMP_DIR/system"
    
    # Backup network configuration
    cp /etc/hosts "$TEMP_DIR/system/" 2>/dev/null || true
    cp /etc/hostname "$TEMP_DIR/system/" 2>/dev/null || true
    
    # Backup systemd services
    systemctl list-units --type=service --state=active | grep -E "(wireguard|openvpn|vpn)" > "$TEMP_DIR/system/vpn-services.txt" 2>/dev/null || true
    
    # Backup crontab
    crontab -l > "$TEMP_DIR/system/crontab.txt" 2>/dev/null || true
    
    # Backup network interfaces configuration
    if [[ -d "/etc/network" ]]; then
        cp -r /etc/network/* "$TEMP_DIR/system/network/" 2>/dev/null || true
    fi
}

# Create backup manifest
create_backup_manifest() {
    log "Creating backup manifest..." "$YELLOW"
    
    cat > "$TEMP_DIR/MANIFEST.txt" << EOF
VPN Backup Manifest
===================

Backup Name: $BACKUP_NAME
Backup Date: $(date)
Backup Type: Full Backup
Hostname: $(hostname)
System: $(uname -a)

Contents:
- WireGuard configuration and keys
- OpenVPN configuration and certificates
- SSL certificates and keys
- User database and access logs
- Firewall rules and configuration
- Monitoring scripts and logs
- System configuration files

Backup Size: $(du -sh "$TEMP_DIR" | cut -f1)
Total Files: $(find "$TEMP_DIR" -type f | wc -l)

Checksum Verification: SHA256
EOF

    # Generate checksums
    find "$TEMP_DIR" -type f -exec sha256sum {} \; > "$TEMP_DIR/CHECKSUMS.sha256"
}

# Compress and encrypt backup
compress_encrypt_backup() {
    log "Compressing and encrypting backup..." "$YELLOW"
    
    cd "$TEMP_DIR"
    
    # Create tar archive
    tar -czf "../${BACKUP_NAME}.tar.gz" .
    
    # Encrypt the backup if key is available
    if [[ -f "$ENCRYPTION_KEY" ]]; then
        gpg --symmetric --cipher-algo AES256 --s2k-mode 3 --s2k-count 65536 \
            --passphrase-file "$ENCRYPTION_KEY" \
            --batch --yes \
            -o "../${BACKUP_NAME}.tar.gz.gpg" \
            "${BACKUP_NAME}.tar.gz"
        
        # Remove unencrypted backup
        rm -f "../${BACKUP_NAME}.tar.gz"
    fi
    
    # Clean up temporary directory
    rm -rf "$TEMP_DIR"
}

# Calculate backup size and stats
calculate_backup_stats() {
    local backup_file="$1"
    local file_size=$(du -h "$backup_file" | cut -f1)
    local file_count=$(tar -tzf "$backup_file" 2>/dev/null | wc -l)
    
    log "Backup statistics:" "$BLUE"
    log "  File: $backup_file" "$BLUE"
    log "  Size: $file_size" "$BLUE"
    log "  Files: $file_count" "$BLUE"
    log "  Created: $(date)" "$BLUE"
}

# Perform full backup
backup_wireguard
backup_openvpn
backup_ssl_certificates
backup_user_database
backup_firewall
backup_monitoring
backup_system_config
create_backup_manifest

# Get backup file path
if [[ -f "$ENCRYPTION_KEY" ]]; then
    BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz.gpg"
else
    BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
fi

compress_encrypt_backup
calculate_backup_stats "$BACKUP_FILE"

log "Full VPN backup completed successfully: $BACKUP_FILE" "$GREEN"

# Cleanup old backups
find "$BACKUP_DIR" -name "vpn-full-backup-*.tar.gz*" -mtime +30 -delete 2>/dev/null || true

echo "Backup Location: $BACKUP_FILE"
EOF

    chmod +x "$BACKUP_DIR/full-backup.sh"
}

# Create incremental backup script
create_incremental_backup_script() {
    log "Creating incremental backup script..." "$YELLOW"
    
    cat > "$BACKUP_DIR/incremental-backup.sh" << 'EOF'
#!/bin/bash
# VPN Incremental Backup Script

set -e

BACKUP_DIR="/opt/vpn-backups/daily"
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
BACKUP_NAME="vpn-incremental-backup-${TIMESTAMP}"
LOG_FILE="/var/log/vpn-backup.log"

log() {
    echo -e "${2}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "Starting incremental backup: $BACKUP_NAME" "$GREEN"

# Use rsync for incremental backups
rsync -av --delete \
    --exclude="*.log" \
    --exclude="*.tmp" \
    /etc/wireguard/ "${BACKUP_DIR}/${BACKUP_NAME}-wireguard/" 2>/dev/null || true

rsync -av --delete \
    --exclude="*.log" \
    --exclude="*.tmp" \
    /etc/openvpn/ "${BACKUP_DIR}/${BACKUP_NAME}-openvpn/" 2>/dev/null || true

rsync -av --delete \
    /etc/ssl/watershed/ "${BACKUP_DIR}/${BACKUP_NAME}-ssl/" 2>/dev/null || true

# Backup current state of user database
if [[ -f "/etc/vpn/users.db" ]]; then
    sqlite3 /etc/vpn/users.db ".backup" "${BACKUP_DIR}/${BACKUP_NAME}-users.db"
fi

# Backup current firewall rules
iptables-save > "${BACKUP_DIR}/${BACKUP_NAME}-firewall.rules" 2>/dev/null || true

# Create manifest
cat > "${BACKUP_DIR}/${BACKUP_NAME}-MANIFEST.txt" << EOF
Incremental Backup
Date: $(date)
Type: Incremental
Host: $(hostname)
EOF

log "Incremental backup completed: ${BACKUP_DIR}/${BACKUP_NAME}-*" "$GREEN"

# Cleanup old incremental backups (keep last 7 days)
find "$BACKUP_DIR" -name "vpn-incremental-backup-*" -mtime +7 -exec rm -rf {} \; 2>/dev/null || true
EOF

    chmod +x "$BACKUP_DIR/incremental-backup.sh"
}

# Create restore script
create_restore_script() {
    log "Creating restore script..." "$YELLOW"
    
    cat > "$BACKUP_DIR/restore-backup.sh" << 'EOF'
#!/bin/bash
# VPN Restore Script

set -e

BACKUP_DIR="/opt/vpn-backups"
LOG_FILE="/var/log/vpn-restore.log"
ENCRYPTION_KEY="/etc/vpn-backup/.backup-key"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${2}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Interactive restore menu
show_restore_menu() {
    echo ""
    echo "=== VPN Backup Restore Menu ==="
    echo "1) List available backups"
    echo "2) Restore full backup"
    echo "3) Restore WireGuard configuration"
    echo "4) Restore OpenVPN configuration"
    echo "5) Restore SSL certificates"
    echo "6) Restore user database"
    echo "7) Restore firewall configuration"
    echo "8) Restore from specific file"
    echo "0) Cancel"
    echo ""
}

# List available backups
list_backups() {
    echo "Available Backups:"
    echo "=================="
    
    if [[ -d "$BACKUP_DIR/daily" ]]; then
        echo "Full Backups:"
        ls -lah "$BACKUP_DIR/daily"/vpn-full-backup-*.tar.gz* 2>/dev/null | while read line; do
            echo "  $line"
        done
        
        echo ""
        echo "Incremental Backups:"
        ls -lah "$BACKUP_DIR/daily"/vpn-incremental-backup-* 2>/dev/null | while read line; do
            echo "  $line"
        done
    fi
    
    if [[ -d "$BACKUP_DIR/weekly" ]]; then
        echo ""
        echo "Weekly Backups:"
        ls -lah "$BACKUP_DIR/weekly"/vpn-*-backup-* 2>/dev/null | while read line; do
            echo "  $line"
        done
    fi
}

# Decrypt backup file
decrypt_backup() {
    local encrypted_file="$1"
    local output_file="${encrypted_file%.gpg}"
    
    if [[ ! -f "$ENCRYPTION_KEY" ]]; then
        log "Encryption key not found" "$RED"
        return 1
    fi
    
    log "Decrypting backup file..." "$YELLOW"
    
    gpg --decrypt --passphrase-file "$ENCRYPTION_KEY" \
        --batch --yes \
        -o "$output_file" \
        "$encrypted_file" 2>/dev/null || {
        log "Failed to decrypt backup file" "$RED"
        return 1
    }
    
    echo "$output_file"
}

# Extract backup
extract_backup() {
    local backup_file="$1"
    local extract_dir="/tmp/vpn-restore-$$"
    
    mkdir -p "$extract_dir"
    
    log "Extracting backup to: $extract_dir" "$YELLOW"
    
    if [[ "$backup_file" == *.gpg ]]; then
        # Handle encrypted backup
        local decrypted_file=$(decrypt_backup "$backup_file")
        if [[ -z "$decrypted_file" || ! -f "$decrypted_file" ]]; then
            log "Failed to decrypt backup" "$RED"
            return 1
        fi
        
        tar -xzf "$decrypted_file" -C "$extract_dir"
        rm -f "$decrypted_file"
    else
        # Handle regular backup
        tar -xzf "$backup_file" -C "$extract_dir"
    fi
    
    echo "$extract_dir"
}

# Restore WireGuard configuration
restore_wireguard() {
    local extract_dir="$1"
    
    log "Restoring WireGuard configuration..." "$YELLOW"
    
    # Stop WireGuard service
    systemctl stop wg-quick@wg0 2>/dev/null || true
    
    # Backup current configuration
    if [[ -d "/etc/wireguard" ]]; then
        cp -r /etc/wireguard "/etc/wireguard.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Restore configuration
    if [[ -d "$extract_dir/wireguard" ]]; then
        mkdir -p /etc/wireguard
        cp -r "$extract_dir/wireguard/"* /etc/wireguard/ 2>/dev/null || true
        
        # Restore server configuration
        if [[ -f "$extract_dir/wireguard/server-config.conf" ]]; then
            cp "$extract_dir/wireguard/server-config.conf" /etc/wireguard/wg0.conf
        fi
        
        # Set proper permissions
        chmod 600 /etc/wireguard/*.conf 2>/dev/null || true
        chmod 600 /etc/wireguard/privatekey 2>/dev/null || true
    fi
    
    log "WireGuard configuration restored" "$GREEN"
}

# Restore OpenVPN configuration
restore_openvpn() {
    local extract_dir="$1"
    
    log "Restoring OpenVPN configuration..." "$YELLOW"
    
    # Stop OpenVPN service
    systemctl stop openvpn@server 2>/dev/null || true
    
    # Backup current configuration
    if [[ -d "/etc/openvpn" ]]; then
        cp -r /etc/openvpn "/etc/openvpn.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Restore configuration
    if [[ -d "$extract_dir/openvpn" ]]; then
        mkdir -p /etc/openvpn
        cp -r "$extract_dir/openvpn/"* /etc/openvpn/ 2>/dev/null || true
        
        # Set proper permissions
        chmod 600 /etc/openvpn/*.key 2>/dev/null || true
        chmod 644 /etc/openvpn/*.crt 2>/dev/null || true
    fi
    
    log "OpenVPN configuration restored" "$GREEN"
}

# Restore SSL certificates
restore_ssl_certificates() {
    local extract_dir="$1"
    
    log "Restoring SSL certificates..." "$YELLOW"
    
    # Backup current certificates
    if [[ -d "/etc/ssl/watershed" ]]; then
        cp -r /etc/ssl/watershed "/etc/ssl/watershed.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Restore certificates
    if [[ -d "$extract_dir/ssl" ]]; then
        mkdir -p /etc/ssl/watershed
        cp -r "$extract_dir/ssl/"* /etc/ssl/watershed/ 2>/dev/null || true
        
        # Set proper permissions
        chmod 600 /etc/ssl/watershed/*/*.key 2>/dev/null || true
        chmod 644 /etc/ssl/watershed/*/*.crt 2>/dev/null || true
    fi
    
    log "SSL certificates restored" "$GREEN"
}

# Restore user database
restore_user_database() {
    local extract_dir="$1"
    
    log "Restoring user database..." "$YELLOW"
    
    # Backup current database
    if [[ -f "/etc/vpn/users.db" ]]; then
        cp /etc/vpn/users.db "/etc/vpn/users.db.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Restore database
    if [[ -f "$extract_dir/database/users.db" ]]; then
        mkdir -p /etc/vpn
        cp "$extract_dir/database/users.db" /etc/vpn/users.db
        chmod 644 /etc/vpn/users.db
    fi
    
    log "User database restored" "$GREEN"
}

# Restore firewall configuration
restore_firewall() {
    local extract_dir="$1"
    
    log "Restoring firewall configuration..." "$YELLOW"
    
    # Backup current firewall rules
    iptables-save > "/etc/firewall/rules.backup.$(date +%Y%m%d_%H%M%S)" 2>/dev/null || true
    
    # Restore iptables rules
    if [[ -f "$extract_dir/firewall/iptables-rules.v4" ]]; then
        iptables-restore < "$extract_dir/firewall/iptables-rules.v4"
        log "Firewall rules restored from backup" "$GREEN"
    fi
    
    # Restore firewall configuration files
    if [[ -d "$extract_dir/firewall" ]]; then
        mkdir -p /etc/firewall
        cp -r "$extract_dir/firewall/"* /etc/firewall/ 2>/dev/null || true
    fi
    
    log "Firewall configuration restored" "$GREEN"
}

# Full backup restore
restore_full_backup() {
    echo "Available full backups:"
    ls -1 "$BACKUP_DIR"/daily/vpn-full-backup-*.tar.gz* 2>/dev/null | sort -r
    
    read -p "Enter full path to backup file: " backup_file
    
    if [[ ! -f "$backup_file" ]]; then
        log "Backup file not found: $backup_file" "$RED"
        return 1
    fi
    
    log "Starting full backup restore..." "$GREEN"
    
    # Confirm restoration
    echo "WARNING: This will overwrite existing VPN configurations!"
    read -p "Are you sure you want to continue? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        log "Restore cancelled by user" "$YELLOW"
        return 0
    fi
    
    local extract_dir=$(extract_backup "$backup_file")
    if [[ -z "$extract_dir" ]]; then
        log "Failed to extract backup" "$RED"
        return 1
    fi
    
    # Stop all VPN services
    systemctl stop wg-quick@wg0 openvpn@server 2>/dev/null || true
    
    # Restore components
    restore_wireguard "$extract_dir"
    restore_openvpn "$extract_dir"
    restore_ssl_certificates "$extract_dir"
    restore_user_database "$extract_dir"
    restore_firewall "$extract_dir"
    
    # Cleanup
    rm -rf "$extract_dir"
    
    log "Full backup restore completed" "$GREEN"
    log "Please restart VPN services manually" "$YELLOW"
}

# Handle user selection
case "$1" in
    list)
        list_backups
        ;;
    wireguard)
        read -p "Enter backup file path: " backup_file
        if [[ -f "$backup_file" ]]; then
            local extract_dir=$(extract_backup "$backup_file")
            restore_wireguard "$extract_dir"
            rm -rf "$extract_dir"
        fi
        ;;
    openvpn)
        read -p "Enter backup file path: " backup_file
        if [[ -f "$backup_file" ]]; then
            local extract_dir=$(extract_backup "$backup_file")
            restore_openvpn "$extract_dir"
            rm -rf "$extract_dir"
        fi
        ;;
    ssl)
        read -p "Enter backup file path: " backup_file
        if [[ -f "$backup_file" ]]; then
            local extract_dir=$(extract_backup "$backup_file")
            restore_ssl_certificates "$extract_dir"
            rm -rf "$extract_dir"
        fi
        ;;
    database)
        read -p "Enter backup file path: " backup_file
        if [[ -f "$backup_file" ]]; then
            local extract_dir=$(extract_backup "$backup_file")
            restore_user_database "$extract_dir"
            rm -rf "$extract_dir"
        fi
        ;;
    firewall)
        read -p "Enter backup file path: " backup_file
        if [[ -f "$backup_file" ]]; then
            local extract_dir=$(extract_backup "$backup_file")
            restore_firewall "$extract_dir"
            rm -rf "$extract_dir"
        fi
        ;;
    full)
        restore_full_backup
        ;;
    *)
        echo "VPN Restore Script"
        echo "=================="
        echo ""
        echo "Usage: $0 {list|wireguard|openvpn|ssl|database|firewall|full}"
        echo ""
        echo "Commands:"
        echo "  list       - List available backups"
        echo "  wireguard  - Restore WireGuard configuration"
        echo "  openvpn    - Restore OpenVPN configuration"
        echo "  ssl        - Restore SSL certificates"
        echo "  database   - Restore user database"
        echo "  firewall   - Restore firewall configuration"
        echo "  full       - Full backup restore"
        echo ""
        
        # Interactive mode
        while true; do
            show_restore_menu
            read -p "Select option: " choice
            case $choice in
                1) list_backups ;;
                2) "$0" full ;;
                3) "$0" wireguard ;;
                4) "$0" openvpn ;;
                5) "$0" ssl ;;
                6) "$0" database ;;
                7) "$0" firewall ;;
                8) read -p "Enter backup file path: " backup_file; "$0" full <<< "$backup_file" ;;
                0) exit 0 ;;
                *) echo "Invalid option" ;;
            esac
            echo ""
            read -p "Press Enter to continue..."
        done
        ;;
esac
EOF

    chmod +x "$BACKUP_DIR/restore-backup.sh"
}

# Create verification script
create_verification_script() {
    log "Creating verification script..." "$YELLOW"
    
    cat > "$BACKUP_DIR/verify-backup.sh" << 'EOF'
#!/bin/bash
# VPN Backup Verification Script

set -e

BACKUP_DIR="/opt/vpn-backups"
LOG_FILE="/var/log/vpn-backup.log"
ENCRYPTION_KEY="/etc/vpn-backup/.backup-key"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${2}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    log "Verifying backup: $backup_file" "$BLUE"
    
    # Check if file exists
    if [[ ! -f "$backup_file" ]]; then
        log "Backup file not found: $backup_file" "$RED"
        return 1
    fi
    
    # Verify checksum if available
    local checksum_file="${backup_file}.sha256"
    if [[ -f "$checksum_file" ]]; then
        log "Verifying checksum..." "$YELLOW"
        if sha256sum -c "$checksum_file" --quiet; then
            log "Checksum verification passed" "$GREEN"
        else
            log "Checksum verification failed" "$RED"
            return 1
        fi
    fi
    
    # Test archive integrity
    log "Testing archive integrity..." "$YELLOW"
    
    if [[ "$backup_file" == *.gpg ]]; then
        # Test encrypted archive
        if [[ -f "$ENCRYPTION_KEY" ]]; then
            gpg --list-packets "$backup_file" >/dev/null 2>&1 || {
                log "Encrypted archive verification failed" "$RED"
                return 1
            }
        else
            log "Cannot verify encrypted archive: encryption key not found" "$YELLOW"
            return 1
        fi
    else
        # Test regular archive
        tar -tzf "$backup_file" >/dev/null 2>&1 || {
            log "Archive verification failed" "$RED"
            return 1
        }
    fi
    
    # Extract test (in temp directory)
    log "Performing extraction test..." "$YELLOW"
    local test_dir="/tmp/vpn-verify-$$"
    mkdir -p "$test_dir"
    
    if [[ "$backup_file" == *.gpg ]]; then
        gpg --decrypt --passphrase-file "$ENCRYPTION_KEY" --batch --yes \
            -o "${test_dir}/test.tar.gz" "$backup_file" 2>/dev/null || {
            log "Decryption failed during verification" "$RED"
            rm -rf "$test_dir"
            return 1
        }
        
        tar -xzf "${test_dir}/test.tar.gz" -C "$test_dir" >/dev/null 2>&1 || {
            log "Extraction failed during verification" "$RED"
            rm -rf "$test_dir"
            return 1
        }
    else
        tar -xzf "$backup_file" -C "$test_dir" >/dev/null 2>&1 || {
            log "Extraction failed during verification" "$RED"
            rm -rf "$test_dir"
            return 1
        }
    fi
    
    # Check expected files
    local expected_files=("MANIFEST.txt" "wireguard" "openvpn" "ssl" "firewall")
    local found_files=0
    
    for expected in "${expected_files[@]}"; do
        if [[ -e "$test_dir/$expected" ]]; then
            found_files=$((found_files + 1))
        fi
    done
    
    # Cleanup
    rm -rf "$test_dir"
    
    if [[ $found_files -gt 0 ]]; then
        log "Backup verification passed ($found_files/$(( ${#expected_files[@]} )) components found)" "$GREEN"
        return 0
    else
        log "Backup verification failed: no expected components found" "$RED"
        return 1
    fi
}

# Verify all backups
verify_all_backups() {
    log "Verifying all backups..." "$BLUE"
    
    local failed_count=0
    local total_count=0
    
    # Find all backup files
    find "$BACKUP_DIR" -name "vpn-*-backup-*.tar.gz*" -type f | while read backup_file; do
        total_count=$((total_count + 1))
        if ! verify_backup "$backup_file"; then
            failed_count=$((failed_count + 1))
        fi
    done
    
    log "Backup verification completed: $((total_count - failed_count))/$total_count passed" "$GREEN"
    
    if [[ $failed_count -gt 0 ]]; then
        log "WARNING: $failed_count backup(s) failed verification" "$YELLOW"
        return 1
    fi
    
    return 0
}

# Check backup age and size
check_backup_health() {
    log "Checking backup health..." "$BLUE"
    
    # Check for recent backups
    local latest_backup=$(find "$BACKUP_DIR" -name "vpn-full-backup-*.tar.gz*" -type f -exec ls -t {} + 2>/dev/null | head -1)
    
    if [[ -n "$latest_backup" ]]; then
        local backup_date=$(stat -c %Y "$latest_backup")
        local current_date=$(date +%s)
        local age_days=$(( (current_date - backup_date) / 86400 ))
        
        log "Latest backup age: $age_days days" "$BLUE"
        
        if [[ $age_days -gt 7 ]]; then
            log "WARNING: Latest backup is older than 7 days" "$YELLOW"
            return 1
        fi
        
        # Check backup size
        local backup_size=$(du -h "$latest_backup" | cut -f1)
        log "Latest backup size: $backup_size" "$BLUE"
    else
        log "WARNING: No backups found" "$YELLOW"
        return 1
    fi
    
    return 0
}

# Main execution
case "$1" in
    verify)
        verify_all_backups
        ;;
    health)
        check_backup_health
        ;;
    *)
        echo "VPN Backup Verification"
        echo "======================="
        echo ""
        echo "Usage: $0 {verify|health} [backup_file]"
        echo ""
        echo "Commands:"
        echo "  verify [file]  - Verify specific backup or all backups"
        echo "  health         - Check backup health and age"
        echo ""
        
        if [[ -n "$2" ]]; then
            verify_backup "$2"
        else
            verify_all_backups
        fi
        ;;
esac
EOF

    chmod +x "$BACKUP_DIR/verify-backup.sh"
}

# Setup automated backups
setup_automated_backups() {
    log "Setting up automated backups..." "$YELLOW"
    
    # Create crontab entries for automated backups
    (crontab -l 2>/dev/null; echo "0 2 * * * $BACKUP_DIR/full-backup.sh") | crontab -
    (crontab -l 2>/dev/null; echo "0 */6 * * * $BACKUP_DIR/incremental-backup.sh") | crontab -
    (crontab -l 2>/dev/null; echo "0 4 * * 0 $BACKUP_DIR/verify-backup.sh health") | crontab -
    
    # Create systemd backup service
    cat > /etc/systemd/system/vpn-backup.service << 'EOF'
[Unit]
Description=VPN Backup Service
After=network.target

[Service]
Type=oneshot
ExecStart=/opt/vpn-backups/full-backup.sh
StandardOutput=journal
StandardError=journal
User=root

[Install]
WantedBy=multi-user.target
EOF
    
    # Create systemd backup timer
    cat > /etc/systemd/system/vpn-backup.timer << 'EOF'
[Unit]
Description=VPN Backup Timer
Requires=vpn-backup.service

[Timer]
OnBootSec=1hour
OnUnitActiveSec=24h

[Install]
WantedBy=timers.target
EOF
    
    systemctl enable vpn-backup.timer
    systemctl start vpn-backup.timer
    
    log "Automated backups configured" "$GREEN"
}

# Test backup system
test_backup_system() {
    log "Testing backup system..." "$YELLOW"
    
    # Test file permissions
    if [[ -f "$ENCRYPTION_KEY" ]]; then
        log "Encryption key permissions: $(stat -c %a "$ENCRYPTION_KEY")" "$BLUE"
    fi
    
    # Test backup scripts
    if [[ -x "$BACKUP_DIR/full-backup.sh" ]]; then
        log "Full backup script: OK" "$GREEN"
    else
        log "Full backup script: FAILED" "$RED"
    fi
    
    if [[ -x "$BACKUP_DIR/restore-backup.sh" ]]; then
        log "Restore script: OK" "$GREEN"
    else
        log "Restore script: FAILED" "$RED"
    fi
    
    if [[ -x "$BACKUP_DIR/verify-backup.sh" ]]; then
        log "Verification script: OK" "$GREEN"
    else
        log "Verification script: FAILED" "$RED"
    fi
    
    # Test backup directory
    if [[ -d "$BACKUP_DIR" && -w "$BACKUP_DIR" ]]; then
        log "Backup directory: OK" "$GREEN"
    else
        log "Backup directory: FAILED" "$RED"
    fi
    
    log "Backup system test completed" "$GREEN"
}

# Show backup status
show_backup_status() {
    echo "=== VPN Backup Status ==="
    echo "Backup Directory: $BACKUP_DIR"
    echo "Retention: $RETENTION_DAYS days"
    echo "Encryption: $(if [[ -f "$ENCRYPTION_KEY_FILE" ]]; then echo "Enabled"; else echo "Disabled"; fi)"
    echo ""
    
    echo "Available Backups:"
    echo "=================="
    find "$BACKUP_DIR" -name "vpn-*-backup-*" -type f -exec ls -lah {} \; 2>/dev/null | while read line; do
        echo "  $line"
    done || echo "  No backups found"
    
    echo ""
    echo "Backup Services:"
    echo "================"
    systemctl list-timers --all | grep vpn-backup || echo "No backup timers active"
    
    echo ""
    echo "Crontab Entries:"
    echo "================"
    crontab -l | grep vpn-backup || echo "No backup crontab entries"
}

# Generate backup report
generate_backup_report() {
    local report_file="/opt/vpn-backup-report.txt"
    
    log "Generating backup report..." "$YELLOW"
    
    cat > "$report_file" << EOF
VPN Backup Report - Watershed Disturbance Mapping System
=======================================================

Generated: $(date)

=== Backup Configuration ===
Backup Directory: $BACKUP_DIR
Retention Period: $RETENTION_DAYS days
Encryption: $(if [[ -f "$ENCRYPTION_KEY_FILE" ]]; then echo "Enabled"; else echo "Disabled"; fi)

=== Recent Backups ===
EOF
    
    # List recent backups
    find "$BACKUP_DIR" -name "vpn-*-backup-*" -type f -mtime -7 -exec ls -lah {} \; 2>/dev/null >> "$report_file" || echo "No recent backups" >> "$report_file"
    
    cat >> "$report_file" << EOF

=== Backup Statistics ===
Total Backups: $(find "$BACKUP_DIR" -name "vpn-*-backup-*" -type f 2>/dev/null | wc -l)
Total Size: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)

=== Backup Services ===
$(systemctl list-units --all | grep vpn-backup || echo "No backup services found")

=== Recent Backup Logs ===
$(tail -20 /var/log/vpn-backup.log 2>/dev/null || echo "No backup logs found")

EOF
    
    log "Backup report generated: $report_file" "$GREEN"
}

# Main execution
case "$1" in
    init)
        initialize_backup_system
        ;;
    full)
        "$BACKUP_DIR/full-backup.sh"
        ;;
    incremental)
        "$BACKUP_DIR/incremental-backup.sh"
        ;;
    verify)
        if [[ -n "$2" ]]; then
            "$BACKUP_DIR/verify-backup.sh" verify "$2"
        else
            "$BACKUP_DIR/verify-backup.sh" verify
        fi
        ;;
    status)
        show_backup_status
        ;;
    restore)
        "$BACKUP_DIR/restore-backup.sh"
        ;;
    report)
        generate_backup_report
        ;;
    *)
        echo "Usage: $0 {init|full|incremental|verify|status|restore|report} [options]"
        echo ""
        echo "Commands:"
        echo "  init                     - Initialize backup system"
        echo "  full                     - Run full backup"
        echo "  incremental              - Run incremental backup"
        echo "  verify [backup_file]     - Verify backup integrity"
        echo "  status                   - Show backup status"
        echo "  restore                  - Interactive restore menu"
        echo "  report                   - Generate backup report"
        echo ""
        
        # Interactive mode
        if [[ $# -eq 0 ]]; then
            while true; do
                echo ""
                echo "=== VPN Backup Management ==="
                echo "1) Initialize backup system"
                echo "2) Run full backup"
                echo "3) Run incremental backup"
                echo "4) Verify all backups"
                echo "5) Show backup status"
                echo "6) Restore from backup"
                echo "7) Generate backup report"
                echo "8) Test backup system"
                echo "0) Exit"
                echo ""
                read -p "Select option: " choice
                case $choice in
                    1) initialize_backup_system ;;
                    2) "$BACKUP_DIR/full-backup.sh" ;;
                    3) "$BACKUP_DIR/incremental-backup.sh" ;;
                    4) "$BACKUP_DIR/verify-backup.sh" verify ;;
                    5) show_backup_status ;;
                    6) "$BACKUP_DIR/restore-backup.sh" ;;
                    7) generate_backup_report ;;
                    8) test_backup_system ;;
                    0) exit 0 ;;
                    *) echo "Invalid option" ;;
                esac
                echo ""
                read -p "Press Enter to continue..."
            done
        fi
        ;;
esac
