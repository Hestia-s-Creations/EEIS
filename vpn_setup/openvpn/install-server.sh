#!/bin/bash
# Watershed Disturbance Mapping System - OpenVPN Server Setup
# Installation and configuration script for OpenVPN server

set -e

# Configuration variables
OVPN_PORT=1194
OVPN_NETWORK="10.9.0.0"
OVPN_NETMASK="255.255.255.0"
LOG_FILE="/var/log/openvpn-setup.log"
EASYRSA_DIR="/etc/openvpn/easyrsa"

# Colors for output
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

log "Starting OpenVPN server installation..." "$GREEN"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log "This script must be run as root (use sudo)" "$RED"
   exit 1
fi

# Install OpenVPN and dependencies
if [[ -f /etc/debian_version ]]; then
    log "Installing OpenVPN on Debian/Ubuntu..." "$BLUE"
    apt update
    apt install -y openvpn easy-rsa openssl iptables-persistent ufw qrencode
    
elif [[ -f /etc/redhat-release ]]; then
    log "Installing OpenVPN on RedHat/CentOS..." "$BLUE"
    yum install -y epel-release
    yum install -y openvpn easy-rsa openssl iptables-services
    systemctl enable iptables
    systemctl start iptables
else
    log "Unsupported operating system" "$RED"
    exit 1
fi

# Create PKI (Public Key Infrastructure)
log "Setting up PKI infrastructure..." "$YELLOW"

# Initialize EasyRSA
mkdir -p "$EASYRSA_DIR"
cd "$EASYRSA_DIR"

# Create EasyRSA configuration
cat > "$EASYRSA_DIR/vars" << 'EOF'
# EasyRSA configuration for Watershed Mapping System
set_var EASYRSA_REQ_COUNTRY "US"
set_var EASYRSA_REQ_PROVINCE "State"
set_var EASYRSA_REQ_CITY "City"
set_var EASYRSA_REQ_ORG "Watershed Mapping Organization"
set_var EASYRSA_REQ_EMAIL "admin@watershed-mapping.org"
set_var EASYRSA_REQ_OU "IT Department"
set_var EASYRSA_KEY_SIZE 2048
set_var EASYRSA_CA_EXPIRE 3650
set_var EASYRSA_CERT_EXPIRE 365
set_var EASYRSA_DIGEST "sha256"
EOF

# Initialize PKI
./easyrsa init-pki

# Generate CA certificate
log "Generating CA certificate..." "$YELLOW"
echo "Watershed-CA" | ./easyrsa gen-req ca nopass

# Sign CA certificate
echo "yes" | ./easyrsa sign-req ca "Watershed-CA"

# Generate server certificate
log "Generating server certificate..." "$YELLOW"
echo "openvpn-server" | ./easyrsa gen-req server nopass

# Sign server certificate
echo "yes" | ./easyrsa sign-req server openvpn-server

# Generate Diffie-Hellman parameters
log "Generating Diffie-Hellman parameters..." "$YELLOW"
./easyrsa gen-dh

# Generate TLS-Auth key
log "Generating TLS-Auth key..." "$YELLOW"
openvpn --genkey secret /etc/openvpn/ta.key

# Move certificates to OpenVPN directory
log "Moving certificates to OpenVPN directory..." "$BLUE"
cp "$EASYRSA_DIR/pki/ca.crt" /etc/openvpn/
cp "$EASYRSA_DIR/pki/issued/openvpn-server.crt" /etc/openvpn/
cp "$EASYRSA_DIR/pki/private/openvpn-server.key" /etc/openvpn/
cp "$EASYRSA_DIR/pki/dh.pem" /etc/openvpn/dh2048.pem

# Create OpenVPN server configuration
log "Creating OpenVPN server configuration..." "$YELLOW"

cat > /etc/openvpn/server.conf << EOF
# Watershed Disturbance Mapping System - OpenVPN Server
port $OVPN_PORT
proto udp
dev tun

# Certificates and keys
ca ca.crt
cert openvpn-server.crt
key openvpn-server.key
dh dh2048.pem
tls-auth ta.key 0

# Network configuration
server $OVPN_NETWORK $OVPN_NETMASK
ifconfig-pool-persist ipp.txt

# Push routes to clients
push "route 192.168.1.0 255.255.255.0"
push "dhcp-option DNS 10.9.0.1"
push "dhcp-option DNS 8.8.8.8"

# Watershed-specific routes
push "route 10.8.0.0 255.255.255.0"

# Connection settings
keepalive 10 120
comp-lzo
user nobody
group nogroup

# Persistence
persist-key
persist-tun

# Logging
status /var/log/openvpn-status.log
log-append /var/log/openvpn.log
verb 3

# Security
cipher AES-256-CBC
auth SHA256
key-direction 0
EOF

# Create client configuration directory
mkdir -p /etc/openvpn/ccd

# Configure NAT and routing
log "Configuring NAT and routing..." "$YELLOW"

# Enable IP forwarding
echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf
sysctl -p

# Configure iptables rules for NAT
iptables -A FORWARD -i tun0 -j ACCEPT
iptables -t nat -A POSTROUTING -s $OVPN_NETWORK/24 -o eth0 -j MASQUERADE

# Save iptables rules
if command -v iptables-save > /dev/null 2>&1; then
    iptables-save > /etc/iptables/rules.v4
fi

# Create client configuration generator
cat > /opt/openvpn/gen-client.sh << 'EOF'
#!/bin/bash
# OpenVPN Client Configuration Generator

CA_DIR="/etc/openvpn/easyrsa"
OVPN_DIR="/etc/openvpn"
CLIENT_NAME="$1"

if [[ -z "$CLIENT_NAME" ]]; then
    echo "Usage: $0 <client_name>"
    exit 1
fi

cd "$CA_DIR"

# Generate client certificate
echo "$CLIENT_NAME" | ./easyrsa gen-req "$CLIENT_NAME" nopass

# Sign client certificate
echo "yes" | ./easyrsa sign-req client "$CLIENT_NAME"

# Generate client configuration
cat > "${OVPN_DIR}/${CLIENT_NAME}.ovpn" << OVPN_EOF
# Watershed Disturbance Mapping System - Client Configuration
# Client: $CLIENT_NAME
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
$(cat ${OVPN_DIR}/ca.crt)
</ca>

<cert>
$(cat ${OVPN_DIR}/pki/issued/${CLIENT_NAME}.crt)
</cert>

<key>
$(cat ${OVPN_DIR}/pki/private/${CLIENT_NAME}.key)
</key>

<tls-auth>
$(cat ${OVPN_DIR}/ta.key)
</tls-auth>
key-direction 1
OVPN_EOF

echo "Client configuration generated: ${OVPN_DIR}/${CLIENT_NAME}.ovpn"
echo "Generate QR code: qrencode -t ansiutf8 < ${OVPN_DIR}/${CLIENT_NAME}.ovpn"
EOF

chmod +x /opt/openvpn/gen-client.sh

# Configure firewall
log "Configuring firewall..." "$YELLOW"

if command -v ufw &> /dev/null; then
    ufw --force reset
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 1194/udp comment "OpenVPN"
    ufw allow ssh
    ufw --force enable
fi

# Create directories and set permissions
mkdir -p /var/log
mkdir -p /etc/openvpn/ccd
chmod 600 /etc/openvpn/*.key /etc/openvpn/*.crt
chmod 644 /etc/openvpn/*.conf /etc/openvpn/*.crt

# Enable and start OpenVPN service
log "Enabling and starting OpenVPN service..." "$YELLOW"
systemctl enable openvpn@server
systemctl start openvpn@server

# Check service status
if systemctl is-active --quiet openvpn@server; then
    log "OpenVPN service started successfully" "$GREEN"
else
    log "Failed to start OpenVPN service" "$RED"
    systemctl status openvpn@server
    exit 1
fi

# Display service information
log "OpenVPN Server Information:" "$GREEN"
log "Status: $(systemctl is-active openvpn@server)" "$BLUE"
log "Port: $OVPN_PORT" "$BLUE"
log "Protocol: UDP" "$BLUE"
log "Network: $OVPN_NETWORK/24" "$BLUE"
log "Log files: /var/log/openvpn.log" "$BLUE"

# Show active connections
log "Active connections:" "$BLUE"
if [[ -f "/var/log/openvpn-status.log" ]]; then
    tail -20 /var/log/openvpn-status.log
fi

# Save server information
cat > /opt/openvpn/server-info.txt << EOF
OpenVPN Server Information - Watershed Disturbance Mapping System
=============================================================

Server Configuration:
- Port: $OVPN_PORT
- Protocol: UDP
- Network: $OVPN_NETWORK/24
- Interface: tun0

Certificates:
- CA Certificate: /etc/openvpn/ca.crt
- Server Certificate: /etc/openvpn/openvpn-server.crt
- Server Key: /etc/openvpn/openvpn-server.key
- Diffie-Hellman: /etc/openvpn/dh2048.pem
- TLS-Auth: /etc/openvpn/ta.key

Client Management:
- Generate client: /opt/openvpn/gen-client.sh <client_name>
- Client configurations: /etc/openvpn/*.ovpn

Logs:
- OpenVPN log: /var/log/openvpn.log
- Status log: /var/log/openvpn-status.log

Setup completed: $(date)
EOF

log "Installation completed successfully!" "$GREEN"
log "Server information saved to: /opt/openvpn/server-info.txt" "$BLUE"
log "Generate client config: /opt/openvpn/gen-client.sh <client_name>" "$YELLOW"

echo ""
echo "=== OpenVPN Server Setup Complete ==="
echo "Client commands:"
echo "1. Generate client: /opt/openvpn/gen-client.sh <client_name>"
echo "2. Share .ovpn file with client"
echo "3. Client imports .ovpn file into OpenVPN client"
echo ""
