#!/bin/bash
# Watershed Disturbance Mapping System - WireGuard Server Setup
# Installation and configuration script for WireGuard VPN server

set -e

# Configuration variables
WG_INTERFACE="wg0"
WG_CONFIG="/etc/wireguard/${WG_INTERFACE}.conf"
SERVICE_NAME="wg-quick@${WG_INTERFACE}"
LOG_FILE="/var/log/wireguard-setup.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${2}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

log "Starting WireGuard server installation..." "$GREEN"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log "This script must be run as root (use sudo)" "$RED"
   exit 1
fi

# Detect OS and install WireGuard
if [[ -f /etc/debian_version ]]; then
    log "Detected Debian/Ubuntu system" "$BLUE"
    apt update
    apt install -y wireguard wireguard-tools iptables-persistent ufw qrencode
elif [[ -f /etc/redhat-release ]]; then
    log "Detected RedHat/CentOS system" "$BLUE"
    yum install -y epel-release
    yum install -y wireguard-tools iptables-services qrencode
    systemctl enable iptables
    systemctl start iptables
else
    log "Unsupported operating system" "$RED"
    exit 1
fi

# Enable IP forwarding
echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf
sysctl -p

# Generate server key pair
log "Generating WireGuard server keys..." "$YELLOW"
SERVER_PRIVATE_KEY=$(wg genkey)
SERVER_PUBLIC_KEY=$(echo "$SERVER_PRIVATE_KEY" | wg pubkey)

log "Server private key: $SERVER_PRIVATE_KEY" "$YELLOW"
log "Server public key: $SERVER_PUBLIC_KEY" "$GREEN"

# Create WireGuard configuration
log "Creating WireGuard server configuration..." "$YELLOW"

# Backup existing configuration if it exists
if [[ -f "$WG_CONFIG" ]]; then
    cp "$WG_CONFIG" "${WG_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
    log "Existing configuration backed up" "$BLUE"
fi

# Create new configuration
cat > "$WG_CONFIG" << EOF
# Watershed Disturbance Mapping System - WireGuard Server
[Interface]
PrivateKey = $SERVER_PRIVATE_KEY
Address = 10.8.0.1/24
ListenPort = 51820
SaveConfig = false

# Enable NAT and forwarding
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE; iptables -A FORWARD -p tcp --dport 53 -j ACCEPT; iptables -A FORWARD -p udp --dport 53 -j ACCEPT
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE; iptables -D FORWARD -p tcp --dport 53 -j ACCEPT; iptables -D FORWARD -p udp --dport 53 -j ACCEPT

# Logging and performance
LogLevel = 3
Table = off
EOF

# Set proper permissions
chmod 600 "$WG_CONFIG"
chown root:root "$WG_CONFIG"

# Configure firewall
log "Configuring firewall..." "$YELLOW"

# Configure UFW if available
if command -v ufw &> /dev/null; then
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 51820/udp comment "WireGuard VPN"
    ufw allow ssh
    ufw --force enable
fi

# Configure iptables if UFW not available
if ! command -v ufw &> /dev/null; then
    iptables -A INPUT -p udp --dport 51820 -j ACCEPT
    iptables -A INPUT -p tcp --dport 22 -j ACCEPT
    iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
fi

# Enable and start WireGuard service
log "Enabling WireGuard service..." "$YELLOW"
systemctl enable "${SERVICE_NAME}"
systemctl start "${SERVICE_NAME}"

# Check service status
if systemctl is-active --quiet "${SERVICE_NAME}"; then
    log "WireGuard service started successfully" "$GREEN"
else
    log "Failed to start WireGuard service" "$RED"
    systemctl status "${SERVICE_NAME}"
    exit 1
fi

# Show service information
log "WireGuard Server Information:" "$GREEN"
log "Status: $(systemctl is-active ${SERVICE_NAME})" "$BLUE"
log "Interface: $WG_INTERFACE" "$BLUE"
log "Port: 51820" "$BLUE"
log "Server IP: 10.8.0.1/24" "$BLUE"
log "Server Public Key: $SERVER_PUBLIC_KEY" "$BLUE"

# Display current peer connections
log "Current peer connections:" "$BLUE"
wg show "$WG_INTERFACE"

# Create client configuration script
cat > /opt/wireguard/client-manager.sh << 'EOF'
#!/bin/bash
# WireGuard Client Configuration Manager

WG_INTERFACE="wg0"
WG_CONFIG="/etc/wireguard/${WG_INTERFACE}.conf"
CLIENTS_DIR="/etc/wireguard/clients"

# Generate new client configuration
generate_client() {
    local client_name="$1"
    local description="$2"
    
    if [[ -z "$client_name" ]]; then
        echo "Usage: $0 generate <client_name> [description]"
        exit 1
    fi
    
    # Generate client keys
    CLIENT_PRIVATE_KEY=$(wg genkey)
    CLIENT_PUBLIC_KEY=$(echo "$CLIENT_PRIVATE_KEY" | wg pubkey)
    
    # Get next available IP
    LAST_IP=$(grep -o 'AllowedIPs = 10\.8\.0\.[0-9]*' "$WG_CONFIG" | grep -o '[0-9]*$' | sort -n -t. -k4 | tail -1)
    if [[ -z "$LAST_IP" ]]; then
        NEXT_IP="10.8.0.2"
    else
        NEXT_IP="10.8.0.$((LAST_IP + 1))"
    fi
    
    # Create client configuration
    cat > "${CLIENTS_DIR}/${client_name}.conf" << EOF
# Client: $client_name
# Description: ${description:-"No description"}
# Generated: $(date)
[Interface]
PrivateKey = $CLIENT_PRIVATE_KEY
Address = ${NEXT_IP}/24
DNS = 10.8.0.1, 1.1.1.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY_HERE
Endpoint = SERVER_ENDPOINT_HERE:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
EOF
    
    # Add peer to server configuration
    cat >> "$WG_CONFIG" << EOF

# Client: $client_name
[Peer]
PublicKey = $CLIENT_PUBLIC_KEY
AllowedIPs = ${NEXT_IP}/32
EOF
    
    # Add peer dynamically (requires wg tool)
    wg set "$WG_INTERFACE" peer "$CLIENT_PUBLIC_KEY" allowed-ips "${NEXT_IP}/32"
    
    echo "Client configuration generated: ${CLIENTS_DIR}/${client_name}.conf"
    echo "Client IP: $NEXT_IP"
    echo "Public Key: $CLIENT_PUBLIC_KEY"
}

# List all clients
list_clients() {
    echo "Configured clients:"
    wg show "$WG_INTERFACE" | grep -A 20 "peer:"
}

# Revoke client access
revoke_client() {
    local client_name="$1"
    local client_ip="$2"
    
    if [[ -z "$client_name" || -z "$client_ip" ]]; then
        echo "Usage: $0 revoke <client_name> <client_ip>"
        exit 1
    fi
    
    # Remove client configuration file
    rm -f "${CLIENTS_DIR}/${client_name}.conf"
    
    # Remove peer from server configuration
    sed -i "/# Client: $client_name/,/AllowedIPs = ${client_ip}\/32/d" "$WG_CONFIG"
    
    echo "Client access revoked: $client_name"
}

# Show connection statistics
show_stats() {
    echo "WireGuard Connection Statistics:"
    echo "================================"
    wg show "$WG_INTERFACE" all
}

# Handle command line arguments
case "$1" in
    generate)
        generate_client "$2" "$3"
        ;;
    list)
        list_clients
        ;;
    revoke)
        revoke_client "$2" "$3"
        ;;
    stats)
        show_stats
        ;;
    *)
        echo "Usage: $0 {generate|list|revoke|stats}"
        echo ""
        echo "Commands:"
        echo "  generate <name> [description]  - Generate new client configuration"
        echo "  list                         - List all connected clients"
        echo "  revoke <name> <ip>           - Revoke client access"
        echo "  stats                        - Show connection statistics"
        exit 1
        ;;
esac
EOF

chmod +x /opt/wireguard/client-manager.sh

# Create clients directory
mkdir -p "$CLIENTS_DIR"

# Save server information for reference
cat > /opt/wireguard/server-info.txt << EOF
WireGuard Server Information - Watershed Disturbance Mapping System
===============================================================

Server Public Key: $SERVER_PUBLIC_KEY
Server Endpoint: YOUR_SERVER_IP:51820
Internal IP: 10.8.0.1/24
Configuration File: $WG_CONFIG
Log File: $LOG_FILE

Client Management:
- Generate client: /opt/wireguard/client-manager.sh generate <name> [description]
- List clients: /opt/wireguard/client-manager.sh list
- Show stats: /opt/wireguard/client-manager.sh stats

Default DNS Servers:
- 10.8.0.1 (local)
- 1.1.1.1 (Cloudflare)

Setup completed: $(date)
EOF

log "Installation completed successfully!" "$GREEN"
log "Server information saved to: /opt/wireguard/server-info.txt" "$BLUE"
log "Use '/opt/wireguard/client-manager.sh' to manage clients" "$YELLOW"

echo ""
echo "=== WireGuard Server Setup Complete ==="
echo "Server Public Key: $SERVER_PUBLIC_KEY"
echo "Next steps:"
echo "1. Update firewall rules if using custom firewall"
echo "2. Generate client configurations: /opt/wireguard/client-manager.sh generate <name>"
echo "3. Share client configurations securely with users"
echo "4. Test VPN connection from client device"
echo ""
