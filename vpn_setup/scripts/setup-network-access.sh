#!/bin/bash
# Watershed Disturbance Mapping System - Network Access Control Setup
# Apply network access control and routing rules

set -e

# Configuration variables
PRIMARY_IF="${PRIMARY_IF:-eth0}"
WG_INTERFACE="${WG_INTERFACE:-wg0}"
OVPN_INTERFACE="${OVPN_INTERFACE:-tun0}"
WG_NETWORK="10.8.0.0/24"
OVPN_NETWORK="10.9.0.0/24"
MAPPING_SYSTEM_NETWORK="172.16.0.0/12"
LOCAL_NETWORK="192.168.1.0/24"
LOG_FILE="/var/log/network-access-control.log"

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

log "Starting network access control setup..." "$GREEN"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log "This script must be run as root (use sudo)" "$RED"
   exit 1
fi

# Detect actual network interface
log "Detecting primary network interface..." "$BLUE"
if [[ -z "$PRIMARY_IF" || "$PRIMARY_IF" = "auto" ]]; then
    PRIMARY_IF=$(ip route | grep default | head -1 | awk '{print $5}')
    log "Detected primary interface: $PRIMARY_IF" "$BLUE"
fi

# Backup existing iptables rules
log "Backing up existing iptables rules..." "$YELLOW"
iptables-save > "/etc/iptables/rules.backup.$(date +%Y%m%d_%H%M%S)"

# Clear existing rules
log "Clearing existing iptables rules..." "$YELLOW"
iptables -F
iptables -X
iptables -t nat -F
iptables -t nat -X
iptables -t mangle -F
iptables -t mangle -X

# Set default policies
log "Setting default policies..." "$YELLOW"
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT

# Enable kernel modules
log "Loading kernel modules..." "$YELLOW"
modprobe iptable_nat
modprobe iptable_filter
modprobe iptable_mangle
modprobe ip_tables

# ===============================================
# BASIC FIREWALL RULES
# ===============================================

log "Applying basic firewall rules..." "$YELLOW"

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established and related connections
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# Allow SSH (adjust port if needed)
log "Allowing SSH access..." "$BLUE"
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow WireGuard VPN
log "Allowing WireGuard VPN..." "$BLUE"
iptables -A INPUT -p udp --dport 51820 -j ACCEPT

# Allow OpenVPN
log "Allowing OpenVPN..." "$BLUE"
iptables -A INPUT -p udp --dport 1194 -j ACCEPT

# Allow HTTP/HTTPS for web interface
log "Allowing HTTP/HTTPS..." "$BLUE"
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow DNS queries
log "Allowing DNS..." "$BLUE"
iptables -A INPUT -p tcp --dport 53 -j ACCEPT
iptables -A INPUT -p udp --dport 53 -j ACCEPT

# Rate limiting
log "Applying rate limiting..." "$YELLOW"
iptables -A INPUT -p tcp --dport 22 -m limit --limit 6/min --limit-burst 8 -j ACCEPT
iptables -A INPUT -p udp --dport 51820 -m limit --limit 10/sec --limit-burst 20 -j ACCEPT
iptables -A INPUT -p udp --dport 1194 -m limit --limit 10/sec --limit-burst 20 -j ACCEPT

# ===============================================
# VPN NETWORK CONFIGURATION
# ===============================================

log "Configuring VPN networks..." "$YELLOW"

# Enable IP forwarding
echo 1 > /proc/sys/net/ipv4/ip_forward

# WireGuard interface configuration
iptables -A FORWARD -i "$WG_INTERFACE" -j ACCEPT
iptables -A FORWARD -o "$WG_INTERFACE" -j ACCEPT

# OpenVPN interface configuration
iptables -A FORWARD -i "$OVPN_INTERFACE" -j ACCEPT
iptables -A FORWARD -o "$OVPN_INTERFACE" -j ACCEPT

# NAT for VPN networks
iptables -t nat -A POSTROUTING -s "$WG_NETWORK" -o "$PRIMARY_IF" -j MASQUERADE
iptables -t nat -A POSTROUTING -s "$OVPN_NETWORK" -o "$PRIMARY_IF" -j MASQUERADE

# ===============================================
# ACCESS CONTROL RULES
# ===============================================

log "Applying access control rules..." "$YELLOW"

# Allow VPN clients access to internal network
iptables -A FORWARD -s "$WG_NETWORK" -d "$MAPPING_SYSTEM_NETWORK" -j ACCEPT
iptables -A FORWARD -s "$OVPN_NETWORK" -d "$MAPPING_SYSTEM_NETWORK" -j ACCEPT

# Allow access to specific internal services
# Mapping system web interface
iptables -A FORWARD -s "$WG_NETWORK" -d 172.16.10.0/24 -p tcp --dport 8080 -j ACCEPT
iptables -A FORWARD -s "$WG_NETWORK" -d 172.16.10.0/24 -p tcp --dport 8443 -j ACCEPT

# Research database access
iptables -A FORWARD -s "$WG_NETWORK" -d 172.16.20.0/24 -p tcp --dport 5432 -j ACCEPT

# API services
iptables -A FORWARD -s "$WG_NETWORK" -d 172.16.30.0/24 -p tcp --dport 3000 -j ACCEPT
iptables -A FORWARD -s "$WG_NETWORK" -d 172.16.30.0/24 -p tcp --dport 5000 -j ACCEPT

# Allow admin access (client IP: 10.8.0.2)
iptables -A FORWARD -s 10.8.0.2/32 -d 0.0.0.0/0 -j ACCEPT

# Allow DNS from VPN clients
iptables -A FORWARD -s "$WG_NETWORK" -d "$PRIMARY_IF" -p tcp --dport 53 -j ACCEPT
iptables -A FORWARD -s "$WG_NETWORK" -d "$PRIMARY_IF" -p udp --dport 53 -j ACCEPT

# ===============================================
# BLOCKING RULES
# ===============================================

log "Applying blocking rules..." "$YELLOW"

# Block private networks from VPN clients
iptables -A FORWARD -s "$WG_NETWORK" -d 10.0.0.0/8 -j DROP
iptables -A FORWARD -s "$WG_NETWORK" -d 172.16.0.0/12 -j DROP
iptables -A FORWARD -s "$WG_NETWORK" -d 192.168.0.0/16 -j DROP

# Block localhost and multicast
iptables -A FORWARD -s "$WG_NETWORK" -d 127.0.0.0/8 -j DROP
iptables -A FORWARD -s "$WG_NETWORK" -d 224.0.0.0/4 -j DROP

# Block common attack ports
iptables -A FORWARD -s "$WG_NETWORK" -p tcp --dport 135,139,445 -j DROP
iptables -A FORWARD -s "$WG_NETWORK" -p udp --dport 135,137,138 -j DROP

# ===============================================
# LOGGING RULES
# ===============================================

log "Configuring logging..." "$YELLOW"

# Log dropped packets
iptables -A INPUT -m limit --limit 5/min -j LOG --log-prefix "iptables denied: " --log-level 4
iptables -A FORWARD -m limit --limit 5/min -j LOG --log-prefix "iptables denied: " --log-level 4

# Log VPN connection attempts
iptables -A INPUT -p udp --dport 51820 -j LOG --log-prefix "WireGuard: "
iptables -A INPUT -p udp --dport 1194 -j LOG --log-prefix "OpenVPN: "

# Log invalid connections
iptables -A FORWARD -m conntrack --ctstate INVALID -j LOG --log-prefix "INVALID: "
iptables -A FORWARD -m conntrack --ctstate INVALID -j DROP

# ===============================================
# QUALITY OF SERVICE
# ===============================================

log "Configuring QoS..." "$YELLOW"

# If tc is available, configure traffic control
if command -v tc &> /dev/null; then
    # Remove any existing qdiscs
    tc qdisc del dev "$WG_INTERFACE" root 2>/dev/null || true
    
    # Add hierarchical token bucket
    tc qdisc add dev "$WG_INTERFACE" root handle 1: htb default 30
    
    # Create classes
    tc class add dev "$WG_INTERFACE" parent 1: classid 1:10 htb rate 5mbit ceil 10mbit
    tc class add dev "$WG_INTERFACE" parent 1: classid 1:20 htb rate 3mbit ceil 8mbit
    tc class add dev "$WG_INTERFACE" parent 1: classid 1:30 htb rate 2mbit ceil 5mbit
    
    # Add filters
    tc filter add dev "$WG_INTERFACE" protocol ip parent 1:0 prio 1 u32 match ip protocol 1 0xff flowid 1:10  # ICMP
    tc filter add dev "$WG_INTERFACE" protocol ip parent 1:0 prio 2 u32 match ip dport 53 0xffff flowid 1:20   # DNS
fi

# ===============================================
# SAVE CONFIGURATION
# ===============================================

log "Saving iptables configuration..." "$YELLOW"

# Save rules for persistence
if command -v iptables-save > /dev/null 2>&1; then
    iptables-save > /etc/iptables/rules.v4
    log "Rules saved to /etc/iptables/rules.v4" "$BLUE"
fi

# Create ruleset restore script
cat > /etc/network/if-pre-up.d/watershed-vpn << 'EOF'
#!/bin/bash
# Restore VPN firewall rules on interface up
if [[ -f /etc/iptables/rules.v4 ]]; then
    iptables-restore < /etc/iptables/rules.v4
fi
EOF

chmod +x /etc/network/if-pre-up.d/watershed-vpn

# ===============================================
# MONITORING AND STATISTICS
# ===============================================

log "Setting up monitoring..." "$YELLOW"

# Create monitoring script
cat > /opt/network/monitor-vpn.sh << 'EOF'
#!/bin/bash
# VPN Network Monitoring Script

WG_INTERFACE="wg0"
OVPN_INTERFACE="tun0"

echo "=== VPN Network Status ==="
echo "Timestamp: $(date)"
echo ""

echo "Interface Status:"
ifconfig "$WG_INTERFACE" 2>/dev/null | grep "inet " || echo "$WG_INTERFACE: Down"
ifconfig "$OVPN_INTERFACE" 2>/dev/null | grep "inet " || echo "$OVPN_INTERFACE: Down"
echo ""

echo "Routing Table:"
ip route | grep -E "(wg|tun)" || echo "No VPN routes found"
echo ""

echo "Active Connections:"
iptables -L FORWARD -n -v | head -20
echo ""

echo "NAT Translations:"
iptables -t nat -L POSTROUTING -n -v | head -10
echo ""

echo "Connection Statistics:"
ss -tuln | grep -E "(51820|1194)" || echo "No VPN listening services found"
EOF

chmod +x /opt/network/monitor-vpn.sh

# Create network status function
log "Testing configuration..." "$YELLOW"

# Test ping to VPN networks
if ping -c 1 -W 1 "10.8.0.1" &> /dev/null; then
    log "WireGuard network reachable" "$GREEN"
else
    log "WireGuard network not reachable (expected if no clients connected)" "$YELLOW"
fi

# Display current configuration
log "Current iptables rules:" "$BLUE"
iptables -L -n -v | head -30

# Create comprehensive status report
cat > /opt/network/vpn-network-status.txt << EOF
VPN Network Status Report - Watershed Disturbance Mapping System
============================================================

Configuration Date: $(date)
Primary Interface: $PRIMARY_IF
WireGuard Interface: $WG_INTERFACE
OpenVPN Interface: $OVPN_INTERFACE

Network Ranges:
- WireGuard Network: $WG_NETWORK
- OpenVPN Network: $OVPN_NETWORK
- Mapping System: $MAPPING_SYSTEM_NETWORK
- Local Network: $LOCAL_NETWORK

IP Forwarding: $(cat /proc/sys/net/ipv4/ip_forward)
Current Rules: $(iptables -L | wc -l) rules loaded

Monitoring Commands:
- Check status: /opt/network/monitor-vpn.sh
- View rules: iptables -L -n -v
- View NAT: iptables -t nat -L -n -v
- Check logs: tail -f /var/log/network-access-control.log
EOF

log "Network access control setup completed successfully!" "$GREEN"
log "Status report: /opt/network/vpn-network-status.txt" "$BLUE"
log "Monitor script: /opt/network/monitor-vpn.sh" "$YELLOW"

# Create directories
mkdir -p /opt/network /var/log

echo ""
echo "=== Network Access Control Setup Complete ==="
echo "Primary Interface: $PRIMARY_IF"
echo "WireGuard Network: $WG_NETWORK"
echo "OpenVPN Network: $OVPN_NETWORK"
echo ""
echo "Quick Commands:"
echo "  Check status: /opt/network/monitor-vpn.sh"
echo "  View rules: iptables -L -n -v"
echo "  Backup rules: iptables-save > /root/iptables-backup.txt"
echo "  Restore rules: iptables-restore < /root/iptables-backup.txt"
echo ""
