#!/bin/bash
# Watershed Disturbance Mapping System - User Management and Access Control
# Comprehensive user management for VPN access

set -e

# Configuration
VPN_USERS_DB="/etc/vpn/users.db"
VPN_USER_HOME="/home/vpn"
LOG_FILE="/var/log/vpn-user-management.log"
WG_CLIENTS_DIR="/etc/wireguard/clients"
OVPN_CLIENTS_DIR="/etc/openvpn"

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

# Initialize user database
initialize_user_db() {
    log "Initializing VPN user database..." "$GREEN"
    
    # Create database directory
    mkdir -p "$(dirname "$VPN_USERS_DB")"
    
    # Create SQLite database
    sqlite3 "$VPN_USERS_DB" << 'EOF'
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    full_name TEXT,
    department TEXT,
    role TEXT,
    status TEXT DEFAULT 'active',
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_access DATETIME,
    expiry_date DATE,
    ip_address TEXT,
    vpn_type TEXT, -- 'wireguard', 'openvpn', or 'both'
    public_key TEXT,
    client_config TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    event_type TEXT, -- 'login', 'logout', 'config_generated', 'config_revoked'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    details TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS user_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    permission_type TEXT, -- 'network_access', 'admin_access', 'api_access'
    allowed_resources TEXT,
    restrictions TEXT,
    created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp ON access_logs(timestamp);
EOF

    # Create user directories
    mkdir -p "$VPN_USER_HOME"
    mkdir -p "$WG_CLIENTS_DIR"
    mkdir -p "$OVPN_CLIENTS_DIR"
    
    log "User database initialized successfully" "$GREEN"
}

# Add new VPN user
add_vpn_user() {
    local username="$1"
    local email="$2"
    local full_name="$3"
    local department="$4"
    local role="$5"
    local vpn_type="${6:-both}"
    local expiry_date="${7:-}"
    
    log "Adding VPN user: $username" "$YELLOW"
    
    # Validate input
    if [[ -z "$username" || -z "$email" ]]; then
        log "Username and email are required" "$RED"
        return 1
    fi
    
    # Check if user already exists
    if sqlite3 "$VPN_USERS_DB" "SELECT COUNT(*) FROM users WHERE username='$username'" | grep -q "1"; then
        log "User $username already exists" "$RED"
        return 1
    fi
    
    # Insert user into database
    sqlite3 "$VPN_USERS_DB" << EOF
INSERT INTO users (username, email, full_name, department, role, vpn_type, expiry_date)
VALUES ('$username', '$email', '$full_name', '$department', '$role', '$vpn_type', '$expiry_date');
EOF
    
    local user_id=$(sqlite3 "$VPN_USERS_DB" "SELECT id FROM users WHERE username='$username'")
    
    # Set default permissions based on role
    case "$role" in
        admin)
            sqlite3 "$VPN_USERS_DB" "INSERT INTO user_permissions (user_id, permission_type, allowed_resources) VALUES ($user_id, 'admin_access', '*');"
            sqlite3 "$VPN_USERS_DB" "INSERT INTO user_permissions (user_id, permission_type, allowed_resources) VALUES ($user_id, 'network_access', '10.8.0.0/24,172.16.0.0/12');"
            sqlite3 "$VPN_USERS_DB" "INSERT INTO user_permissions (user_id, permission_type, allowed_resources) VALUES ($user_id, 'api_access', '*');"
            ;;
        analyst)
            sqlite3 "$VPN_USERS_DB" "INSERT INTO user_permissions (user_id, permission_type, allowed_resources) VALUES ($user_id, 'network_access', '10.8.0.0/24,172.16.10.0/24');"
            sqlite3 "$VPN_USERS_DB" "INSERT INTO user_permissions (user_id, permission_type, allowed_resources) VALUES ($user_id, 'api_access', '/api/mapping/*,/api/reports/*');"
            ;;
        researcher)
            sqlite3 "$VPN_USERS_DB" "INSERT INTO user_permissions (user_id, permission_type, allowed_resources) VALUES ($user_id, 'network_access', '10.8.0.0/24');"
            sqlite3 "$VPN_USERS_DB" "INSERT INTO user_permissions (user_id, permission_type, allowed_resources) VALUES ($user_id, 'api_access', '/api/research/*');"
            ;;
        emergency)
            sqlite3 "$VPN_USERS_DB" "INSERT INTO user_permissions (user_id, permission_type, allowed_resources) VALUES ($user_id, 'network_access', '10.8.0.0/24,172.16.0.0/12');"
            sqlite3 "$VPN_USERS_DB" "INSERT INTO user_permissions (user_id, permission_type, allowed_resources) VALUES ($user_id, 'api_access', '*');"
            ;;
    esac
    
    # Log the addition
    log_user_action "$user_id" "user_added" "User created" "username=$username,email=$email,role=$role"
    
    log "User $username added successfully with ID: $user_id" "$GREEN"
    log_user_action "$user_id" "config_generated" "Initial setup" "ip=$(allocate_ip "$vpn_type")"
    
    echo "$user_id"
}

# Generate VPN configuration for user
generate_vpn_config() {
    local username="$1"
    local vpn_type="${2:-both}"
    
    log "Generating VPN configuration for: $username" "$YELLOW"
    
    # Get user information
    local user_id=$(get_user_id "$username")
    if [[ -z "$user_id" ]]; then
        log "User $username not found" "$RED"
        return 1
    fi
    
    # Allocate IP address
    local ip_address=$(allocate_ip "$vpn_type")
    if [[ -z "$ip_address" ]]; then
        log "No available IP addresses for $vpn_type" "$RED"
        return 1
    fi
    
    # Update user with IP address
    sqlite3 "$VPN_USERS_DB" "UPDATE users SET ip_address='$ip_address' WHERE id=$user_id"
    
    # Generate WireGuard configuration if requested
    if [[ "$vpn_type" == "wireguard" || "$vpn_type" == "both" ]]; then
        generate_wireguard_config "$username" "$ip_address"
    fi
    
    # Generate OpenVPN configuration if requested
    if [[ "$vpn_type" == "openvpn" || "$vpn_type" == "both" ]]; then
        generate_openvpn_config "$username" "$ip_address"
    fi
    
    # Update user configuration path
    local client_config="${WG_CLIENTS_DIR}/${username}.conf"
    if [[ "$vpn_type" == "openvpn" ]]; then
        client_config="${OVPN_CLIENTS_DIR}/${username}.ovpn"
    elif [[ "$vpn_type" == "both" ]]; then
        client_config="${WG_CLIENTS_DIR}/${username}.conf,${OVPN_CLIENTS_DIR}/${username}.ovpn"
    fi
    
    sqlite3 "$VPN_USERS_DB" "UPDATE users SET client_config='$client_config' WHERE id=$user_id"
    sqlite3 "$VPN_USERS_DB" "UPDATE users SET public_key='$(get_public_key "$username")' WHERE id=$user_id"
    
    log_user_action "$user_id" "config_generated" "VPN configuration generated" "vpn_type=$vpn_type,ip=$ip_address"
    
    log "VPN configuration generated for $username" "$GREEN"
}

# Generate WireGuard configuration
generate_wireguard_config() {
    local username="$1"
    local ip_address="$2"
    
    log "Generating WireGuard configuration for $username" "$BLUE"
    
    # Generate client keys
    local client_private_key=$(wg genkey)
    local client_public_key=$(echo "$client_private_key" | wg pubkey)
    
    # Get server public key
    local server_public_key=$(cat /etc/wireguard/wg0.conf 2>/dev/null | grep PrivateKey | wg pubkey 2>/dev/null || echo "SERVER_PUBLIC_KEY_HERE")
    
    # Create WireGuard client configuration
    cat > "${WG_CLIENTS_DIR}/${username}.conf" << EOF
# Watershed Mapping VPN - WireGuard Client Configuration
# User: $username
# Generated: $(date)

[Interface]
PrivateKey = $client_private_key
Address = ${ip_address}/24
DNS = 10.8.0.1, 1.1.1.1, 8.8.8.8
MTU = 1420

[Peer]
PublicKey = $server_public_key
Endpoint = SERVER_HOSTNAME_OR_IP:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25

# Auto-generated configuration for Watershed Mapping System
EOF
    
    # Add peer to server configuration
    local wg_conf="/etc/wireguard/wg0.conf"
    if [[ -f "$wg_conf" ]]; then
        # Get server info
        local server_endpoint=$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")
        
        # Create temporary configuration with new peer
        cp "$wg_conf" "${wg_conf}.tmp"
        echo "" >> "${wg_conf}.tmp"
        echo "# User: $username" >> "${wg_conf}.tmp"
        echo "[Peer]" >> "${wg_conf}.tmp"
        echo "PublicKey = $client_public_key" >> "${wg_conf}.tmp"
        echo "AllowedIPs = ${ip_address}/32" >> "${wg_conf}.tmp"
        echo "# Added: $(date)" >> "${wg_conf}.tmp"
        
        # Copy back with backup
        cp "$wg_conf" "${wg_conf}.backup.$(date +%Y%m%d_%H%M%S)"
        mv "${wg_conf}.tmp" "$wg_conf"
        
        # Reload WireGuard configuration if running
        if systemctl is-active --quiet wg-quick@wg0; then
            wg add wg0 peer "$client_public_key" allowed-ips "${ip_address}/32"
        fi
    fi
    
    # Set permissions
    chmod 600 "${WG_CLIENTS_DIR}/${username}.conf"
    
    log "WireGuard configuration created: ${WG_CLIENTS_DIR}/${username}.conf" "$GREEN"
}

# Generate OpenVPN configuration
generate_openvpn_config() {
    local username="$1"
    local ip_address="$2"
    
    log "Generating OpenVPN configuration for $username" "$BLUE"
    
    # Generate client certificate
    local client_key="/tmp/${username}-key.pem"
    local client_cert="/tmp/${username}-cert.pem"
    local client_csr="/tmp/${username}-csr.pem"
    
    # Generate keys and certificates using EasyRSA or OpenSSL
    if command -v openssl &> /dev/null; then
        # Generate client private key
        openssl genrsa -out "$client_key" 2048
        
        # Generate CSR
        openssl req -new -key "$client_key" -out "$client_csr" \
            -subj "/C=US/ST=State/L=City/O=Watershed Mapping/OU=Client/CN=$username"
        
        # Sign certificate (requires CA setup)
        # Note: This would need proper CA integration in production
        # openssl x509 -req -in "$client_csr" -CA /etc/openvpn/ca.crt -CAkey /etc/openvpn/ca.key -out "$client_cert"
        
        # For now, create configuration template
        cat > "${OVPN_CLIENTS_DIR}/${username}.ovpn" << EOF
# Watershed Mapping VPN - OpenVPN Client Configuration
# User: $username
# Generated: $(date)

client
dev tun
proto udp
remote SERVER_HOSTNAME_OR_IP 1194
resolv-retry infinite
nobind
user nobody
group nogroup
persist-key
persist-tun
remote-cert-tls server
cipher AES-256-CBC
auth SHA256
comp-lzo
verb 3

<ca>
$(cat /etc/openvpn/ca.crt 2>/dev/null || echo "# CA certificate here")
</ca>

<cert>
$(cat "$client_cert" 2>/dev/null || echo "# Client certificate here")
</cert>

<key>
$(cat "$client_key" 2>/dev/null || echo "# Client private key here")
</key>

<tls-auth>
$(cat /etc/openvpn/ta.key 2>/dev/null || echo "# TLS auth key here")
</tls-auth>
key-direction 1
EOF
        
        # Cleanup temporary files
        rm -f "$client_key" "$client_cert" "$client_csr"
        
        # Set permissions
        chmod 600 "${OVPN_CLIENTS_DIR}/${username}.ovpn"
        
        log "OpenVPN configuration created: ${OVPN_CLIENTS_DIR}/${username}.ovpn" "$GREEN"
    else
        log "OpenSSL not found, creating template configuration" "$YELLOW"
        create_openvpn_template "$username" "${OVPN_CLIENTS_DIR}/${username}.ovpn"
    fi
}

# Create OpenVPN template configuration
create_openvpn_template() {
    local username="$1"
    local output_file="$2"
    
    cat > "$output_file" << EOF
# Watershed Mapping VPN - OpenVPN Client Configuration
# User: $username
# Generated: $(date)
# NOTE: This is a template - replace certificate sections with actual certificates

client
dev tun
proto udp
remote SERVER_HOSTNAME_OR_IP 1194
resolv-retry infinite
nobind
user nobody
group nogroup
persist-key
persist-tun
remote-cert-tls server
cipher AES-256-CBC
auth SHA256
comp-lzo
verb 3

# Replace the following sections with actual certificates
<ca>
-----BEGIN CERTIFICATE-----
# CA certificate content here
-----END CERTIFICATE-----
</ca>

<cert>
-----BEGIN CERTIFICATE-----
# Client certificate content here
-----END CERTIFICATE-----
</cert>

<key>
-----BEGIN PRIVATE KEY-----
# Client private key content here
-----END PRIVATE KEY-----
</key>

<tls-auth>
-----BEGIN OpenVPN Static key V1-----
# TLS auth key content here
-----END OpenVPN Static key V1-----
</tls-auth>
key-direction 1
EOF
}

# Get user ID
get_user_id() {
    local username="$1"
    sqlite3 "$VPN_USERS_DB" "SELECT id FROM users WHERE username='$username'"
}

# Allocate IP address
allocate_ip() {
    local vpn_type="$1"
    
    case "$vpn_type" in
        wireguard)
            # Get last used WireGuard IP
            local last_ip=$(sqlite3 "$VPN_USERS_DB" "SELECT ip_address FROM users WHERE vpn_type IN ('wireguard','both') AND ip_address IS NOT NULL" | grep "10.8.0." | sort -t. -k4 -n | tail -1 | cut -d. -f4)
            if [[ -z "$last_ip" ]]; then
                echo "10.8.0.2"
            else
                local next_ip=$((last_ip + 1))
                if [[ $next_ip -lt 254 ]]; then
                    echo "10.8.0.$next_ip"
                else
                    echo ""
                fi
            fi
            ;;
        openvpn)
            # Get last used OpenVPN IP
            local last_ip=$(sqlite3 "$VPN_USERS_DB" "SELECT ip_address FROM users WHERE vpn_type IN ('openvpn','both') AND ip_address IS NOT NULL" | grep "10.9.0." | sort -t. -k4 -n | tail -1 | cut -d. -f4)
            if [[ -z "$last_ip" ]]; then
                echo "10.9.0.2"
            else
                local next_ip=$((last_ip + 1))
                if [[ $next_ip -lt 254 ]]; then
                    echo "10.9.0.$next_ip"
                else
                    echo ""
                fi
            fi
            ;;
        *)
            echo ""
            ;;
    esac
}

# List VPN users
list_vpn_users() {
    log "Listing VPN users..." "$BLUE"
    
    sqlite3 -header -column "$VPN_USERS_DB" << 'EOF'
SELECT 
    id,
    username,
    full_name,
    email,
    role,
    department,
    status,
    vpn_type,
    ip_address,
    created_date,
    CASE 
        WHEN expiry_date IS NOT NULL AND expiry_date < date('now') THEN 'EXPIRED'
        WHEN expiry_date IS NOT NULL AND expiry_date < date('now', '+30 days') THEN 'EXPIRING SOON'
        ELSE 'ACTIVE'
    END as expiry_status
FROM users 
ORDER BY username;
EOF
}

# Show user details
show_user_details() {
    local username="$1"
    local user_id=$(get_user_id "$username")
    
    if [[ -z "$user_id" ]]; then
        log "User $username not found" "$RED"
        return 1
    fi
    
    log "User details for: $username" "$BLUE"
    
    echo ""
    echo "=== User Information ==="
    sqlite3 -header -column "$VPN_USERS_DB" << EOF
SELECT * FROM users WHERE id=$user_id;
EOF
    
    echo ""
    echo "=== Permissions ==="
    sqlite3 -header -column "$VPN_USERS_DB" << EOF
SELECT permission_type, allowed_resources, restrictions FROM user_permissions WHERE user_id=$user_id;
EOF
    
    echo ""
    echo "=== Access Logs ==="
    sqlite3 -header -column "$VPN_USERS_DB" << EOF
SELECT event_type, timestamp, ip_address, details FROM access_logs WHERE user_id=$user_id ORDER BY timestamp DESC LIMIT 10;
EOF
}

# Revoke user access
revoke_user_access() {
    local username="$1"
    local user_id=$(get_user_id "$username")
    
    if [[ -z "$user_id" ]]; then
        log "User $username not found" "$RED"
        return 1
    fi
    
    log "Revoking access for: $username" "$YELLOW"
    
    # Update user status
    sqlite3 "$VPN_USERS_DB" "UPDATE users SET status='revoked' WHERE id=$user_id"
    
    # Remove configuration files
    rm -f "${WG_CLIENTS_DIR}/${username}.conf"
    rm -f "${OVPN_CLIENTS_DIR}/${username}.ovpn"
    
    # Remove from WireGuard server configuration
    local wg_conf="/etc/wireguard/wg0.conf"
    if [[ -f "$wg_conf" ]]; then
        # This would need proper parsing in production
        log "Manual cleanup required for WireGuard server configuration" "$YELLOW"
    fi
    
    log_user_action "$user_id" "config_revoked" "User access revoked" "reason=manual revocation"
    
    log "Access revoked for $username" "$GREEN"
}

# Log user action
log_user_action() {
    local user_id="$1"
    local event_type="$2"
    local details="$3"
    local context="${4:-}"
    
    sqlite3 "$VPN_USERS_DB" << EOF
INSERT INTO access_logs (user_id, event_type, details)
VALUES ($user_id, '$event_type', '$details $context');
EOF
}

# Generate user report
generate_user_report() {
    local report_file="/opt/vpn-user-report.txt"
    
    log "Generating user report..." "$YELLOW"
    
    cat > "$report_file" << EOF
VPN User Report - Watershed Disturbance Mapping System
====================================================

Generated: $(date)
Database: $VPN_USERS_DB

=== Active Users ===
EOF
    
    list_vpn_users | grep "active\|ACTIVE" >> "$report_file"
    
    cat >> "$report_file" << EOF

=== Users by Role ===
EOF
    
    sqlite3 -header "$VPN_USERS_DB" "SELECT role, COUNT(*) as count FROM users WHERE status='active' GROUP BY role;" >> "$report_file"
    
    cat >> "$report_file" << EOF

=== Recent Access Logs ===
EOF
    
    sqlite3 -header "$VPN_USERS_DB" << 'EOF' >> "$report_file"
SELECT 
    u.username,
    al.event_type,
    al.timestamp,
    al.details
FROM access_logs al
JOIN users u ON al.user_id = u.id
ORDER BY al.timestamp DESC
LIMIT 20;
EOF
    
    cat >> "$report_file" << EOF

=== Certificates Scheduled to Expire (Next 30 Days) ===
EOF
    
    sqlite3 -header "$VPN_USERS_DB" << 'EOF' >> "$report_file"
SELECT username, email, role, expiry_date
FROM users 
WHERE expiry_date IS NOT NULL 
AND expiry_date BETWEEN date('now') AND date('now', '+30 days')
ORDER BY expiry_date;
EOF
    
    log "User report generated: $report_file" "$GREEN"
}

# User management menu
show_menu() {
    echo ""
    echo "=== VPN User Management ==="
    echo "1) Initialize user database"
    echo "2) Add VPN user"
    echo "3) Generate VPN configuration"
    echo "4) List VPN users"
    echo "5) Show user details"
    echo "6) Revoke user access"
    echo "7) Generate user report"
    echo "8) Clean up expired users"
    echo "0) Exit"
    echo ""
}

# Main execution
case "$1" in
    init)
        initialize_user_db
        ;;
    add)
        add_vpn_user "$2" "$3" "$4" "$5" "$6" "$7"
        ;;
    generate)
        generate_vpn_config "$2" "$3"
        ;;
    list)
        list_vpn_users
        ;;
    show)
        show_user_details "$2"
        ;;
    revoke)
        revoke_user_access "$2"
        ;;
    report)
        generate_user_report
        ;;
    *)
        echo "Usage: $0 {init|add|generate|list|show|revoke|report} [options]"
        echo ""
        echo "Commands:"
        echo "  init                                    - Initialize user database"
        echo "  add <username> <email> <name> <dept> <role> [vpn_type] [expiry] - Add user"
        echo "  generate <username> [vpn_type]          - Generate VPN configuration"
        echo "  list                                    - List all VPN users"
        echo "  show <username>                         - Show user details"
        echo "  revoke <username>                       - Revoke user access"
        echo "  report                                  - Generate user report"
        echo ""
        
        # Interactive mode
        while true; do
            show_menu
            read -p "Select option: " choice
            case $choice in
                1) initialize_user_db ;;
                2) read -p "Enter username: " username
                   read -p "Enter email: " email
                   read -p "Enter full name: " full_name
                   read -p "Enter department: " department
                   read -p "Enter role (admin/analyst/researcher/emergency): " role
                   read -p "Enter VPN type (wireguard/openvpn/both) [both]: " vpn_type
                   vpn_type="${vpn_type:-both}"
                   add_vpn_user "$username" "$email" "$full_name" "$department" "$role" "$vpn_type" ;;
                3) read -p "Enter username: " username
                   read -p "Enter VPN type (wireguard/openvpn/both) [both]: " vpn_type
                   vpn_type="${vpn_type:-both}"
                   generate_vpn_config "$username" "$vpn_type" ;;
                4) list_vpn_users ;;
                5) read -p "Enter username: " username
                   show_user_details "$username" ;;
                6) read -p "Enter username: " username
                   revoke_user_access "$username" ;;
                7) generate_user_report ;;
                0) exit 0 ;;
                *) echo "Invalid option" ;;
            esac
            echo ""
            read -p "Press Enter to continue..."
        done
        ;;
esac
