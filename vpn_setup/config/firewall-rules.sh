#!/bin/bash
# Watershed Disturbance Mapping System - Firewall Configuration
# Comprehensive firewall setup for VPN infrastructure

set -e

# Configuration
PRIMARY_IF="${PRIMARY_IF:-eth0}"
WG_INTERFACE="${WG_INTERFACE:-wg0}"
OVPN_INTERFACE="${OVPN_INTERFACE:-tun0}"
WG_PORT=51820
OVPN_PORT=1194
WEB_PORT=80
WEB_SSL_PORT=443
SSH_PORT=22

# Network ranges
WG_NETWORK="10.8.0.0/24"
OVPN_NETWORK="10.9.0.0/24"
MAPPING_SYSTEM="172.16.0.0/12"
LOCAL_NETWORK="192.168.0.0/16"
PRIVATE_NETS="10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"

LOG_FILE="/var/log/vpn-firewall.log"
BACKUP_DIR="/etc/firewall/backups"

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

# Backup current firewall rules
backup_firewall_rules() {
    log "Backing up current firewall rules..." "$YELLOW"
    
    mkdir -p "$BACKUP_DIR"
    local backup_file="${BACKUP_DIR}/firewall-backup-$(date +%Y%m%d_%H%M%S).rules"
    
    # Backup iptables rules
    iptables-save > "$backup_file"
    
    # Create restore script
    cat > "${backup_file}.restore" << EOF
#!/bin/bash
# Restore firewall rules from backup
iptables-restore < "$backup_file"
echo "Firewall rules restored from backup"
EOF
    chmod +x "${backup_file}.restore"
    
    log "Firewall rules backed up to: $backup_file" "$GREEN"
    echo "$backup_file"
}

# Clear all existing rules
clear_firewall_rules() {
    log "Clearing existing firewall rules..." "$YELLOW"
    
    # Flush all chains
    iptables -F
    iptables -X
    iptables -t nat -F
    iptables -t nat -X
    iptables -t mangle -F
    iptables -t mangle -X
    
    # Reset counters
    iptables -Z
    
    # Set default policies to DROP
    iptables -P INPUT DROP
    iptables -P FORWARD DROP
    iptables -P OUTPUT ACCEPT
    
    log "All firewall rules cleared" "$GREEN"
}

# Configure basic firewall rules
configure_basic_rules() {
    log "Configuring basic firewall rules..." "$YELLOW"
    
    # Allow loopback
    iptables -A INPUT -i lo -j ACCEPT
    iptables -A OUTPUT -o lo -j ACCEPT
    
    # Allow established and related connections
    iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
    iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
    iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
    
    log "Basic firewall rules configured" "$GREEN"
}

# Configure SSH access
configure_ssh_access() {
    log "Configuring SSH access on port $SSH_PORT..." "$BLUE"
    
    # Allow SSH with rate limiting
    iptables -A INPUT -p tcp --dport "$SSH_PORT" -m conntrack --ctstate NEW -m limit --limit 6/min --limit-burst 8 -j ACCEPT
    
    # Block repeated SSH attempts (fail2ban style)
    iptables -A INPUT -p tcp --dport "$SSH_PORT" -m conntrack --ctstate NEW -m recent --set --name SSH
    iptables -A INPUT -p tcp --dport "$SSH_PORT" -m conntrack --ctstate NEW -m recent --update --seconds 60 --hitcount 4 --rttl --name SSH -j DROP
    
    log "SSH access configured with rate limiting" "$GREEN"
}

# Configure VPN access
configure_vpn_access() {
    log "Configuring VPN access..." "$YELLOW"
    
    # WireGuard
    iptables -A INPUT -p udp --dport "$WG_PORT" -j ACCEPT
    log "WireGuard port $WG_PORT allowed" "$BLUE"
    
    # OpenVPN
    iptables -A INPUT -p udp --dport "$OVPN_PORT" -j ACCEPT
    log "OpenVPN port $OVPN_PORT allowed" "$BLUE"
    
    # Allow VPN interfaces
    iptables -A INPUT -i "$WG_INTERFACE" -j ACCEPT
    iptables -A INPUT -i "$OVPN_INTERFACE" -j ACCEPT
    iptables -A FORWARD -i "$WG_INTERFACE" -j ACCEPT
    iptables -A FORWARD -i "$OVPN_INTERFACE" -j ACCEPT
    iptables -A FORWARD -o "$WG_INTERFACE" -j ACCEPT
    iptables -A FORWARD -o "$OVPN_INTERFACE" -j ACCEPT
    
    log "VPN interface access configured" "$GREEN"
}

# Configure web services
configure_web_services() {
    log "Configuring web services..." "$YELLOW"
    
    # HTTP
    iptables -A INPUT -p tcp --dport "$WEB_PORT" -j ACCEPT
    
    # HTTPS
    iptables -A INPUT -p tcp --dport "$WEB_SSL_PORT" -j ACCEPT
    
    # WebSocket support
    iptables -A INPUT -p tcp --dport 8443 -j ACCEPT
    
    # Web interface rate limiting
    iptables -A INPUT -p tcp --dport "$WEB_PORT" -m limit --limit 10/sec --limit-burst 20 -j ACCEPT
    iptables -A INPUT -p tcp --dport "$WEB_SSL_PORT" -m limit --limit 10/sec --limit-burst 20 -j ACCEPT
    
    log "Web services configured" "$GREEN"
}

# Configure DNS
configure_dns_access() {
    log "Configuring DNS access..." "$YELLOW"
    
    # Allow DNS queries
    iptables -A INPUT -p tcp --dport 53 -j ACCEPT
    iptables -A INPUT -p udp --dport 53 -j ACCEPT
    
    # Allow DNS from VPN clients
    iptables -A FORWARD -s "$WG_NETWORK" -d "$PRIMARY_IF" -p tcp --dport 53 -j ACCEPT
    iptables -A FORWARD -s "$WG_NETWORK" -d "$PRIMARY_IF" -p udp --dport 53 -j ACCEPT
    
    log "DNS access configured" "$GREEN"
}

# Configure NAT and routing
configure_nat_routing() {
    log "Configuring NAT and routing..." "$YELLOW"
    
    # Enable IP forwarding
    echo 1 > /proc/sys/net/ipv4/ip_forward
    
    # NAT for VPN networks
    iptables -t nat -A POSTROUTING -s "$WG_NETWORK" -o "$PRIMARY_IF" -j MASQUERADE
    iptables -t nat -A POSTROUTING -s "$OVPN_NETWORK" -o "$PRIMARY_IF" -j MASQUERADE
    
    # Allow forwarding from VPN networks
    iptables -A FORWARD -s "$WG_NETWORK" -j ACCEPT
    iptables -A FORWARD -s "$OVPN_NETWORK" -j ACCEPT
    
    log "NAT and routing configured" "$GREEN"
}

# Configure access control rules
configure_access_control() {
    log "Configuring access control rules..." "$YELLOW"
    
    # Allow VPN clients access to mapping system
    iptables -A FORWARD -s "$WG_NETWORK" -d "$MAPPING_SYSTEM" -j ACCEPT
    iptables -A FORWARD -s "$OVPN_NETWORK" -d "$MAPPING_SYSTEM" -j ACCEPT
    
    # Allow specific services access
    # Mapping system web interface
    iptables -A FORWARD -s "$WG_NETWORK" -d 172.16.10.0/24 -p tcp --dport 8080 -j ACCEPT
    iptables -A FORWARD -s "$WG_NETWORK" -d 172.16.10.0/24 -p tcp --dport 8443 -j ACCEPT
    
    # Research database
    iptables -A FORWARD -s "$WG_NETWORK" -d 172.16.20.0/24 -p tcp --dport 5432 -j ACCEPT
    
    # API services
    iptables -A FORWARD -s "$WG_NETWORK" -d 172.16.30.0/24 -p tcp --dport 3000 -j ACCEPT
    iptables -A FORWARD -s "$WG_NETWORK" -d 172.16.30.0/24 -p tcp --dport 5000 -j ACCEPT
    
    # Admin full access (specific IP)
    iptables -A FORWARD -s 10.8.0.2/32 -d 0.0.0.0/0 -j ACCEPT
    
    log "Access control rules configured" "$GREEN"
}

# Configure blocking rules
configure_blocking_rules() {
    log "Configuring blocking rules..." "$YELLOW"
    
    # Block private networks from VPN clients (except internal)
    iptables -A FORWARD -s "$WG_NETWORK" -d 10.0.0.0/8 -j DROP
    iptables -A FORWARD -s "$WG_NETWORK" -d 172.16.0.0/12 -j DROP
    iptables -A FORWARD -s "$WG_NETWORK" -d 192.168.0.0/16 -j DROP
    
    # Block localhost and multicast
    iptables -A FORWARD -s "$WG_NETWORK" -d 127.0.0.0/8 -j DROP
    iptables -A FORWARD -s "$WG_NETWORK" -d 224.0.0.0/4 -j DROP
    
    # Block common attack ports
    iptables -A FORWARD -s "$WG_NETWORK" -p tcp --dport 135,139,445 -j DROP
    iptables -A FORWARD -s "$WG_NETWORK" -p udp --dport 135,137,138 -j DROP
    
    # Block SMB traffic
    iptables -A FORWARD -s "$WG_NETWORK" -p tcp --dport 445 -j DROP
    iptables -A FORWARD -s "$WG_NETWORK" -p udp --dport 137,138 -j DROP
    
    # Block FTP
    iptables -A FORWARD -s "$WG_NETWORK" -p tcp --dport 21,20 -j DROP
    
    # Block Telnet
    iptables -A FORWARD -s "$WG_NETWORK" -p tcp --dport 23 -j DROP
    
    log "Blocking rules configured" "$GREEN"
}

# Configure rate limiting
configure_rate_limiting() {
    log "Configuring rate limiting..." "$YELLOW"
    
    # Connection limiting per IP
    iptables -A INPUT -p tcp --dport 80 -m connlimit --connlimit-above 20 -j REJECT
    iptables -A INPUT -p tcp --dport 443 -m connlimit --connlimit-above 20 -j REJECT
    
    # Packet rate limiting
    iptables -A INPUT -p tcp --dport 80 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
    iptables -A INPUT -p tcp --dport 443 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT
    
    # VPN connection limiting
    iptables -A INPUT -p udp --dport "$WG_PORT" -m limit --limit 10/second --limit-burst 20 -j ACCEPT
    iptables -A INPUT -p udp --dport "$OVPN_PORT" -m limit --limit 10/second --limit-burst 20 -j ACCEPT
    
    # SSH brute force protection
    iptables -A INPUT -p tcp --dport "$SSH_PORT" -m state --state NEW -m recent --set
    iptables -A INPUT -p tcp --dport "$SSH_PORT" -m state --state NEW -m recent --update --seconds 60 --hitcount 4 --rttl -j DROP
    
    log "Rate limiting configured" "$GREEN"
}

# Configure logging
configure_logging() {
    log "Configuring firewall logging..." "$YELLOW"
    
    # Log dropped packets (limited rate)
    iptables -A INPUT -m limit --limit 5/min -j LOG --log-prefix "FIREWALL_DROP: " --log-level 4
    iptables -A FORWARD -m limit --limit 5/min -j LOG --log-prefix "FORWARD_DROP: " --log-level 4
    
    # Log VPN connection attempts
    iptables -A INPUT -p udp --dport "$WG_PORT" -j LOG --log-prefix "WIREGUARD_CONNECT: " --log-level 4
    iptables -A INPUT -p udp --dport "$OVPN_PORT" -j LOG --log-prefix "OPENVPN_CONNECT: " --log-level 4
    
    # Log SSH attempts
    iptables -A INPUT -p tcp --dport "$SSH_PORT" -j LOG --log-prefix "SSH_ATTEMPT: " --log-level 4
    
    # Log invalid connections
    iptables -A INPUT -m conntrack --ctstate INVALID -j LOG --log-prefix "INVALID_CONN: " --log-level 4
    iptables -A FORWARD -m conntrack --ctstate INVALID -j LOG --log-prefix "INVALID_FWD: " --log-level 4
    
    # Log port scans (slow scan detection)
    iptables -A INPUT -m recent --name portscan --rcheck --seconds 86400 -j DROP
    
    log "Firewall logging configured" "$GREEN"
}

# Configure port forwarding
configure_port_forwarding() {
    log "Configuring port forwarding..." "$YELLOW"
    
    # Forward VPN management interface
    iptables -t nat -A PREROUTING -p tcp --dport 8080 -d "$PRIMARY_IF" -j DNAT --to-destination 172.16.10.10:8080
    iptables -A FORWARD -p tcp --dport 8080 -d 172.16.10.10 -j ACCEPT
    
    # Forward API ports
    iptables -t nat -A PREROUTING -p tcp --dport 8443 -d "$PRIMARY_IF" -j DNAT --to-destination 172.16.10.10:8443
    iptables -A FORWARD -p tcp --dport 8443 -d 172.16.10.10 -j ACCEPT
    
    log "Port forwarding configured" "$GREEN"
}

# Configure DDoS protection
configure_ddos_protection() {
    log "Configuring DDoS protection..." "$YELLOW"
    
    # SYN flood protection
    iptables -A INPUT -p tcp --syn -m limit --limit 2/s --limit-burst 30 -j ACCEPT
    
    # Ping flood protection
    iptables -A INPUT -p icmp --icmp-type echo-request -m limit --limit 1/s --limit-burst 2 -j ACCEPT
    
    # Fragmented packet protection
    iptables -A INPUT -f -j DROP
    
    # New connection limits
    iptables -A INPUT -p tcp --dport 80 -m conntrack --ctstate NEW -m limit --limit 10/sec --limit-burst 20 -j ACCEPT
    iptables -A INPUT -p tcp --dport 443 -m conntrack --ctstate NEW -m limit --limit 10/sec --limit-burst 20 -j ACCEPT
    
    log "DDoS protection configured" "$GREEN"
}

# Configure geo-blocking (if GeoIP is available)
configure_geo_blocking() {
    if command -v xt_geoip &> /dev/null; then
        log "Configuring geo-blocking..." "$YELLOW"
        
        # Block certain countries (example: China, Russia)
        # Note: Requires xt_geoip module and database
        
        # Block specific countries
        # iptables -A INPUT -m geoip --src-cc CN -j DROP
        # iptables -A INPUT -m geoip --src-cc RU -j DROP
        
        log "Geo-blocking module detected but not configured" "$YELLOW"
    else
        log "Geo-blocking not available (xt_geoip not installed)" "$BLUE"
    fi
}

# Save firewall configuration
save_firewall_config() {
    log "Saving firewall configuration..." "$YELLOW"
    
    # Create firewall configuration directory
    mkdir -p /etc/firewall
    
    # Save current rules
    iptables-save > /etc/firewall/rules.v4
    
    # Create systemd service for firewall
    cat > /etc/systemd/system/vpn-firewall.service << 'EOF'
[Unit]
Description=VPN Firewall Rules
Before=network-pre.target
Wants=network-pre.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/sbin/iptables-restore /etc/firewall/rules.v4
ExecStop=/sbin/iptables-restore /etc/firewall/rules.backup
StandardOutput=journal

[Install]
WantedBy=multi-user.target
EOF

    # Enable firewall service
    systemctl enable vpn-firewall.service
    
    # Create restore script
    cat > /usr/local/bin/restore-firewall.sh << 'EOF'
#!/bin/bash
# Restore firewall rules
if [[ -f /etc/firewall/rules.v4 ]]; then
    iptables-restore < /etc/firewall/rules.v4
    echo "Firewall rules restored from /etc/firewall/rules.v4"
else
    echo "No firewall rules found"
    exit 1
fi
EOF
    chmod +x /usr/local/bin/restore-firewall.sh
    
    log "Firewall configuration saved" "$GREEN"
}

# Show firewall status
show_firewall_status() {
    echo "=== Firewall Status ==="
    echo "Primary Interface: $PRIMARY_IF"
    echo "WireGuard Interface: $WG_INTERFACE"
    echo "OpenVPN Interface: $OVPN_INTERFACE"
    echo ""
    
    echo "Current Rules:"
    echo "================"
    echo "INPUT Rules:"
    iptables -L INPUT -n -v --line-numbers | head -20
    echo ""
    echo "FORWARD Rules:"
    iptables -L FORWARD -n -v --line-numbers | head -20
    echo ""
    echo "NAT Rules:"
    iptables -t nat -L -n -v --line-numbers | head -20
    
    echo ""
    echo "Connection Statistics:"
    echo "======================="
    ss -tuln | grep -E ":$WG_PORT|:$OVPN_PORT|:$WEB_PORT|:$WEB_SSL_PORT|:$SSH_PORT" || echo "No VPN/web services listening"
}

# Monitor firewall
monitor_firewall() {
    log "Monitoring firewall activity..." "$BLUE"
    
    # Show recent drops
    echo "Recent Dropped Packets:"
    echo "======================="
    tail -50 /var/log/syslog | grep -E "FIREWALL_DROP|FORWARD_DROP|INVALID" | tail -10 || echo "No recent drops logged"
    
    echo ""
    echo "VPN Connection Attempts:"
    echo "========================"
    tail -50 /var/log/syslog | grep -E "WIREGUARD_CONNECT|OPENVPN_CONNECT|SSH_ATTEMPT" | tail -10 || echo "No recent connection attempts"
    
    echo ""
    echo "Active Connections:"
    echo "==================="
    ss -tn | grep -E ":$WG_PORT|:$OVPN_PORT" | head -10 || echo "No active VPN connections"
}

# Test firewall rules
test_firewall_rules() {
    log "Testing firewall rules..." "$YELLOW"
    
    # Test basic connectivity
    echo "Testing basic connectivity..."
    ping -c 1 -W 1 127.0.0.1 && echo "✓ Loopback OK" || echo "✗ Loopback FAILED"
    ping -c 1 -W 1 8.8.8.8 && echo "✓ Internet OK" || echo "✗ Internet FAILED"
    
    # Test SSH port
    nc -z localhost "$SSH_PORT" && echo "✓ SSH port OK" || echo "✗ SSH port FAILED"
    
    # Test VPN ports
    nc -z localhost "$WG_PORT" && echo "✓ WireGuard port OK" || echo "✗ WireGuard port FAILED"
    nc -z localhost "$OVPN_PORT" && echo "✓ OpenVPN port OK" || echo "✗ OpenVPN port FAILED"
    
    # Test web ports
    nc -z localhost "$WEB_PORT" && echo "✓ HTTP port OK" || echo "✗ HTTP port FAILED"
    nc -z localhost "$WEB_SSL_PORT" && echo "✓ HTTPS port OK" || echo "✗ HTTPS port FAILED"
    
    log "Firewall test completed" "$GREEN"
}

# Complete firewall setup
setup_firewall() {
    log "Starting complete firewall setup..." "$GREEN"
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log "This script must be run as root" "$RED"
        exit 1
    fi
    
    # Backup existing rules
    backup_firewall_rules
    
    # Clear existing rules
    clear_firewall_rules
    
    # Configure all rule sets
    configure_basic_rules
    configure_ssh_access
    configure_vpn_access
    configure_web_services
    configure_dns_access
    configure_nat_routing
    configure_access_control
    configure_blocking_rules
    configure_rate_limiting
    configure_logging
    configure_port_forwarding
    configure_ddos_protection
    configure_geo_blocking
    
    # Save configuration
    save_firewall_config
    
    # Test configuration
    test_firewall_rules
    
    log "Complete firewall setup finished successfully!" "$GREEN"
    
    echo ""
    echo "=== Firewall Configuration Complete ==="
    echo "Rules saved to: /etc/firewall/rules.v4"
    echo "Backup directory: $BACKUP_DIR"
    echo "Service: vpn-firewall.service"
    echo ""
    echo "Useful commands:"
    echo "  Status: iptables -L -n -v"
    echo "  Monitor: /opt/vpn-monitor.sh"
    echo "  Test: $0 test"
    echo ""
}

# Main execution
case "$1" in
    setup)
        setup_firewall
        ;;
    backup)
        backup_firewall_rules
        ;;
    status)
        show_firewall_status
        ;;
    monitor)
        monitor_firewall
        ;;
    test)
        test_firewall_rules
        ;;
    *)
        echo "Usage: $0 {setup|backup|status|monitor|test}"
        echo ""
        echo "Commands:"
        echo "  setup      - Complete firewall configuration"
        echo "  backup     - Backup current firewall rules"
        echo "  status     - Show firewall status"
        echo "  monitor    - Monitor firewall activity"
        echo "  test       - Test firewall rules"
        echo ""
        
        # Interactive mode
        if [[ $# -eq 0 ]]; then
            while true; do
                echo ""
                echo "=== VPN Firewall Management ==="
                echo "1) Setup complete firewall"
                echo "2) Backup firewall rules"
                echo "3) Show firewall status"
                echo "4) Monitor firewall activity"
                echo "5) Test firewall rules"
                echo "6) Clear all rules"
                echo "7) Restore from backup"
                echo "0) Exit"
                echo ""
                read -p "Select option: " choice
                case $choice in
                    1) setup_firewall ;;
                    2) backup_firewall_rules ;;
                    3) show_firewall_status ;;
                    4) monitor_firewall ;;
                    5) test_firewall_rules ;;
                    6) clear_firewall_rules ;;
                    7) echo "Available backups:"
                        ls -la "$BACKUP_DIR"/firewall-backup-*.rules 2>/dev/null || echo "No backups found"
                        read -p "Enter backup file: " backup
                        if [[ -f "$backup" ]]; then
                            iptables-restore < "$backup"
                            echo "Firewall restored from: $backup"
                        else
                            echo "Backup file not found"
                        fi
                        ;;
                    0) exit 0 ;;
                    *) echo "Invalid option" ;;
                esac
                echo ""
                read -p "Press Enter to continue..."
            done
        fi
        ;;
esac
