#!/bin/bash
# Watershed Disturbance Mapping System - Complete VPN Infrastructure Installation
# Master installation script for all VPN components

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VPN_SETUP_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/var/log/vpn-installation.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ASCII Banner
show_banner() {
    clear
    echo -e "${CYAN}"
    cat << 'EOF'
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║     Watershed Disturbance Mapping System                     ║
║     VPN Infrastructure Installation                          ║
║                                                              ║
║     Secure Remote Access Setup                               ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo ""
}

# Logging function
log() {
    local message="$1"
    local level="${2:-INFO}"
    echo -e "${3}[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $message" >> "$LOG_FILE"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log "This script must be run as root. Please use sudo." "$ERROR" "$RED"
        exit 1
    fi
}

# Check system requirements
check_system_requirements() {
    log "Checking system requirements..." "$INFO" "$BLUE"
    
    # Check OS
    if [[ ! -f /etc/os-release ]]; then
        log "Cannot determine OS version" "$ERROR" "$RED"
        exit 1
    fi
    
    source /etc/os-release
    log "Detected OS: $PRETTY_NAME" "$INFO" "$GREEN"
    
    # Check architecture
    local arch=$(uname -m)
    log "Architecture: $arch" "$INFO" "$BLUE"
    
    # Check available disk space (minimum 10GB)
    local available_space=$(df / | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 10485760 ]]; then  # 10GB in KB
        log "Insufficient disk space. Minimum 10GB required." "$ERROR" "$RED"
        exit 1
    fi
    
    # Check available memory (minimum 1GB)
    local memory_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    if [[ $memory_kb -lt 1048576 ]]; then  # 1GB in KB
        log "Insufficient memory. Minimum 1GB required." "$WARNING" "$YELLOW"
    fi
    
    # Check network connectivity
    if ! ping -c 1 8.8.8.8 &> /dev/null; then
        log "No internet connectivity detected" "$WARNING" "$YELLOW"
    fi
    
    log "System requirements check completed" "$SUCCESS" "$GREEN"
}

# Update system packages
update_system() {
    log "Updating system packages..." "$INFO" "$BLUE"
    
    export DEBIAN_FRONTEND=noninteractive
    
    if [[ -f /etc/debian_version ]]; then
        apt update
        apt upgrade -y
        apt install -y curl wget vim htop net-tools iptables-persistent ufw \
                       sqlite3 bc openssl gnupg2 rsync tar gzip jq \
                       ca-certificates software-properties-common
    elif [[ -f /etc/redhat-release ]]; then
        yum update -y
        yum install -y curl wget vim htop net-tools iptables-services \
                      sqlite bc openssl gnupg2 rsync tar gzip jq \
                      ca-certificates
    else
        log "Unsupported package manager" "$ERROR" "$RED"
        exit 1
    fi
    
    log "System packages updated successfully" "$SUCCESS" "$GREEN"
}

# Setup directory structure
setup_directories() {
    log "Creating directory structure..." "$INFO" "$BLUE"
    
    local dirs=(
        "/etc/vpn"
        "/etc/vpn-backup"
        "/opt/wireguard"
        "/opt/openvpn"
        "/opt/network"
        "/opt/vpn-monitoring"
        "/var/log/vpn"
        "/var/log/vpn/connections"
        "/var/log/vpn/performance"
        "/var/log/vpn/security"
        "/var/log/vpn/alerts"
        "/var/www/vpn-management"
    )
    
    for dir in "${dirs[@]}"; do
        mkdir -p "$dir"
        log "Created directory: $dir" "$DEBUG" "$BLUE"
    done
    
    # Set appropriate permissions
    chown -R root:root /etc/vpn /etc/vpn-backup
    chmod 700 /etc/vpn /etc/vpn-backup
    
    log "Directory structure created" "$SUCCESS" "$GREEN"
}

# Install WireGuard
install_wireguard() {
    log "Installing WireGuard..." "$INFO" "$BLUE"
    
    if [[ -f /etc/debian_version ]]; then
        apt install -y wireguard wireguard-tools qrencode
    elif [[ -f /etc/redhat-release ]]; then
        yum install -y epel-release
        yum install -y wireguard-tools qrencode
    fi
    
    # Copy WireGuard configuration
    if [[ -f "$VPN_SETUP_DIR/wireguard/server.conf" ]]; then
        cp "$VPN_SETUP_DIR/wireguard/server.conf" /etc/wireguard/wg0.conf
        log "WireGuard server configuration copied" "$SUCCESS" "$GREEN"
    fi
    
    # Copy WireGuard installation script
    if [[ -f "$VPN_SETUP_DIR/wireguard/install-server.sh" ]]; then
        cp "$VPN_SETUP_DIR/wireguard/install-server.sh" /opt/wireguard/install.sh
        chmod +x /opt/wireguard/install.sh
        log "WireGuard installation script copied" "$SUCCESS" "$GREEN"
    fi
    
    log "WireGuard installation completed" "$SUCCESS" "$GREEN"
}

# Install OpenVPN
install_openvpn() {
    log "Installing OpenVPN..." "$INFO" "$BLUE"
    
    if [[ -f /etc/debian_version ]]; then
        apt install -y openvpn easy-rsa openssl
    elif [[ -f /etc/redhat-release ]]; then
        yum install -y openvpn easy-rsa openssl
    fi
    
    # Copy OpenVPN configuration
    if [[ -f "$VPN_SETUP_DIR/openvpn/server.conf" ]]; then
        cp "$VPN_SETUP_DIR/openvpn/server.conf" /etc/openvpn/server.conf
        log "OpenVPN server configuration copied" "$SUCCESS" "$GREEN"
    fi
    
    # Copy OpenVPN installation script
    if [[ -f "$VPN_SETUP_DIR/openvpn/install-server.sh" ]]; then
        cp "$VPN_SETUP_DIR/openvpn/install-server.sh" /opt/openvpn/install.sh
        chmod +x /opt/openvpn/install.sh
        log "OpenVPN installation script copied" "$SUCCESS" "$GREEN"
    fi
    
    log "OpenVPN installation completed" "$SUCCESS" "$GREEN"
}

# Setup SSL certificates
setup_ssl_certificates() {
    log "Setting up SSL certificates..." "$INFO" "$BLUE"
    
    # Copy SSL management script
    cp "$VPN_SETUP_DIR/scripts/ssl-cert-manager.sh" /opt/ssl-cert-manager.sh
    chmod +x /opt/ssl-cert-manager.sh
    
    # Initialize SSL management
    /opt/ssl-cert-manager.sh init
    
    log "SSL certificate setup completed" "$SUCCESS" "$GREEN"
}

# Setup user management
setup_user_management() {
    log "Setting up user management..." "$INFO" "$BLUE"
    
    # Copy user management script
    cp "$VPN_SETUP_DIR/scripts/user-management.sh" /opt/user-management.sh
    chmod +x /opt/user-management.sh
    
    # Initialize user database
    /opt/user-management.sh init
    
    log "User management setup completed" "$SUCCESS" "$GREEN"
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..." "$INFO" "$BLUE"
    
    # Copy firewall script
    cp "$VPN_SETUP_DIR/config/firewall-rules.sh" /opt/firewall-manager.sh
    chmod +x /opt/firewall-manager.sh
    
    # Setup firewall
    /opt/firewall-manager.sh setup
    
    log "Firewall configuration completed" "$SUCCESS" "$GREEN"
}

# Setup network access control
setup_network_access() {
    log "Setting up network access control..." "$INFO" "$BLUE"
    
    # Copy network access script
    cp "$VPN_SETUP_DIR/scripts/setup-network-access.sh" /opt/setup-network.sh
    chmod +x /opt/setup-network.sh
    
    # Setup network access control
    /opt/setup-network.sh
    
    log "Network access control setup completed" "$SUCCESS" "$GREEN"
}

# Setup monitoring
setup_monitoring() {
    log "Setting up monitoring..." "$INFO" "$BLUE"
    
    # Copy monitoring script
    cp "$VPN_SETUP_DIR/scripts/monitoring-setup.sh" /opt/monitoring-setup.sh
    chmod +x /opt/monitoring-setup.sh
    
    # Initialize monitoring
    /opt/monitoring-setup.sh init
    
    log "Monitoring setup completed" "$SUCCESS" "$GREEN"
}

# Setup backup system
setup_backup_system() {
    log "Setting up backup system..." "$INFO" "$BLUE"
    
    # Copy backup script
    cp "$VPN_SETUP_DIR/scripts/backup-recovery.sh" /opt/backup-manager.sh
    chmod +x /opt/backup-manager.sh
    
    # Initialize backup system
    /opt/backup-manager.sh init
    
    log "Backup system setup completed" "$SUCCESS" "$GREEN"
}

# Generate final configuration files
generate_final_configs() {
    log "Generating final configuration files..." "$INFO" "$BLUE"
    
    # Create system information file
    cat > /opt/vpn-system-info.txt << EOF
Watershed Disturbance Mapping System - VPN Infrastructure
=======================================================

Installation Date: $(date)
Hostname: $(hostname)
Public IP: $(curl -s ifconfig.me 2>/dev/null || echo "Not detected")

Services:
- WireGuard: systemctl status wg-quick@wg0
- OpenVPN: systemctl status openvpn@server
- Nginx: systemctl status nginx
- Firewall: systemctl status vpn-firewall
- Monitoring: systemctl status vpn-monitoring.timer

Configuration Files:
- WireGuard: /etc/wireguard/wg0.conf
- OpenVPN: /etc/openvpn/server.conf
- SSL: /etc/ssl/watershed/
- User Database: /etc/vpn/users.db
- Firewall: /etc/firewall/rules.v4

Management Scripts:
- User Management: /opt/user-management.sh
- SSL Management: /opt/ssl-cert-manager.sh
- Firewall: /opt/firewall-manager.sh
- Monitoring: /opt/monitoring-setup.sh
- Backup: /opt/backup-manager.sh

Log Files:
- Installation: $LOG_FILE
- VPN Logs: /var/log/vpn/
- System Logs: /var/log/syslog

Default Credentials:
- Admin User: Create via /opt/user-management.sh
- Web Interface: Access via https://$(curl -s ifconfig.me 2>/dev/null || echo "YOUR_SERVER_IP")

Next Steps:
1. Generate SSL certificates: /opt/ssl-cert-manager.sh ca
2. Add VPN users: /opt/user-management.sh add [username] [email] [name] [dept] [role]
3. Generate VPN configurations: /opt/user-management.sh generate [username]
4. Start VPN services: systemctl start wg-quick@wg0 openvpn@server
5. Verify installation: /opt/vpn-installation.sh verify

Support: admin@watershed-mapping.org
EOF
    
    # Create quick start guide
    cat > /opt/vpn-quick-start.txt << 'EOF'
VPN Infrastructure Quick Start Guide
====================================

1. Generate SSL Certificates:
   /opt/ssl-cert-manager.sh ca
   /opt/ssl-cert-manager.sh server vpn.watershed-mapping.org

2. Add VPN Users:
   /opt/user-management.sh add admin admin@watershed.org "Admin User" "IT" "admin"
   /opt/user-management.sh add analyst analyst@watershed.org "Analyst User" "Research" "analyst"

3. Generate VPN Configurations:
   /opt/user-management.sh generate admin both
   /opt/user-management.sh generate analyst wireguard

4. Start Services:
   systemctl start wg-quick@wg0
   systemctl start openvpn@server
   systemctl start nginx

5. Check Status:
   /opt/user-management.sh list
   wg show
   systemctl status wg-quick@wg0

6. Monitor System:
   /opt/monitoring-setup.sh status
   /opt/monitoring-setup.sh report

Configuration Files Location:
- WireGuard clients: /etc/wireguard/clients/
- OpenVPN clients: /etc/openvpn/
- SSL certificates: /etc/ssl/watershed/

For detailed documentation, see: /opt/vpn-system-info.txt
EOF
    
    log "Final configuration files generated" "$SUCCESS" "$GREEN"
}

# Verify installation
verify_installation() {
    log "Verifying installation..." "$INFO" "$BLUE"
    
    local errors=0
    
    # Check required files
    local required_files=(
        "/opt/user-management.sh"
        "/opt/ssl-cert-manager.sh"
        "/opt/firewall-manager.sh"
        "/opt/monitoring-setup.sh"
        "/opt/backup-manager.sh"
        "/etc/vpn/users.db"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            log "✓ Found: $file" "$SUCCESS" "$GREEN"
        else
            log "✗ Missing: $file" "$ERROR" "$RED"
            errors=$((errors + 1))
        fi
    done
    
    # Check directories
    local required_dirs=(
        "/etc/wireguard"
        "/etc/openvpn"
        "/etc/ssl/watershed"
        "/var/log/vpn"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            log "✓ Found: $dir" "$SUCCESS" "$GREEN"
        else
            log "✗ Missing: $dir" "$ERROR" "$RED"
            errors=$((errors + 1))
        fi
    done
    
    # Check permissions
    local scripts=(
        "/opt/user-management.sh"
        "/opt/ssl-cert-manager.sh"
        "/opt/firewall-manager.sh"
        "/opt/monitoring-setup.sh"
        "/opt/backup-manager.sh"
    )
    
    for script in "${scripts[@]}"; do
        if [[ -x "$script" ]]; then
            log "✓ Executable: $script" "$SUCCESS" "$GREEN"
        else
            log "✗ Not executable: $script" "$WARNING" "$YELLOW"
            errors=$((errors + 1))
        fi
    done
    
    if [[ $errors -eq 0 ]]; then
        log "Installation verification: SUCCESS" "$SUCCESS" "$GREEN"
        return 0
    else
        log "Installation verification: FAILED ($errors errors)" "$ERROR" "$RED"
        return 1
    fi
}

# Show installation summary
show_summary() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}║                INSTALLATION COMPLETED                        ║${NC}"
    echo -e "${GREEN}║                                                              ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}System Information:${NC}"
    echo "  Hostname: $(hostname)"
    echo "  Public IP: $(curl -s ifconfig.me 2>/dev/null || echo 'Not detected')"
    echo "  Date: $(date)"
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo "  1. Generate SSL certificates:"
    echo "     ${YELLOW}/opt/ssl-cert-manager.sh ca${NC}"
    echo "     ${YELLOW}/opt/ssl-cert-manager.sh server vpn.watershed-mapping.org${NC}"
    echo ""
    echo "  2. Add VPN users:"
    echo "     ${YELLOW}/opt/user-management.sh add admin admin@watershed.org \"Admin User\" \"IT\" \"admin\"${NC}"
    echo ""
    echo "  3. Generate VPN configurations:"
    echo "     ${YELLOW}/opt/user-management.sh generate admin both${NC}"
    echo ""
    echo "  4. Start VPN services:"
    echo "     ${YELLOW}systemctl start wg-quick@wg0${NC}"
    echo "     ${YELLOW}systemctl start openvpn@server${NC}"
    echo ""
    echo -e "${CYAN}Configuration Files:${NC}"
    echo "  User Database: /etc/vpn/users.db"
    echo "  WireGuard Config: /etc/wireguard/wg0.conf"
    echo "  OpenVPN Config: /etc/openvpn/server.conf"
    echo "  SSL Certificates: /etc/ssl/watershed/"
    echo ""
    echo -e "${CYAN}Documentation:${NC}"
    echo "  System Info: /opt/vpn-system-info.txt"
    echo "  Quick Start: /opt/vpn-quick-start.txt"
    echo "  Full Guide: $VPN_SETUP_DIR/docs/INSTALLATION_GUIDE.md"
    echo ""
    echo -e "${CYAN}Support:${NC}"
    echo "  Email: admin@watershed-mapping.org"
    echo "  Log File: $LOG_FILE"
    echo ""
    echo -e "${GREEN}✓ Installation completed successfully!${NC}"
    echo ""
}

# Interactive menu
show_menu() {
    echo ""
    echo -e "${CYAN}Watershed VPN Infrastructure Installation${NC}"
    echo "=========================================="
    echo ""
    echo -e "${YELLOW}1)${NC} Full Installation (Recommended)"
    echo -e "${YELLOW}2)${NC} Install WireGuard only"
    echo -e "${YELLOW}3)${NC} Install OpenVPN only"
    echo -e "${YELLOW}4)${NC} Install SSL certificates"
    echo -e "${YELLOW}5)${NC} Install user management"
    echo -e "${YELLOW}6)${NC} Configure firewall"
    echo -e "${YELLOW}7)${NC} Setup monitoring"
    echo -e "${YELLOW}8)${NC} Setup backup system"
    echo -e "${YELLOW}9)${NC} Verify installation"
    echo -e "${YELLOW}10)${NC} Show installation summary"
    echo -e "${YELLOW}0)${NC} Exit"
    echo ""
}

# Handle user input
handle_choice() {
    case $1 in
        1)
            log "Starting full installation..." "$INFO" "$BLUE"
            update_system
            setup_directories
            install_wireguard
            install_openvpn
            setup_ssl_certificates
            setup_user_management
            configure_firewall
            setup_network_access
            setup_monitoring
            setup_backup_system
            generate_final_configs
            verify_installation
            show_summary
            ;;
        2)
            update_system
            install_wireguard
            log "WireGuard installation completed" "$SUCCESS" "$GREEN"
            ;;
        3)
            update_system
            install_openvpn
            log "OpenVPN installation completed" "$SUCCESS" "$GREEN"
            ;;
        4)
            setup_ssl_certificates
            log "SSL certificate setup completed" "$SUCCESS" "$GREEN"
            ;;
        5)
            setup_user_management
            log "User management setup completed" "$SUCCESS" "$GREEN"
            ;;
        6)
            configure_firewall
            log "Firewall configuration completed" "$SUCCESS" "$GREEN"
            ;;
        7)
            setup_monitoring
            log "Monitoring setup completed" "$SUCCESS" "$GREEN"
            ;;
        8)
            setup_backup_system
            log "Backup system setup completed" "$SUCCESS" "$GREEN"
            ;;
        9)
            verify_installation
            ;;
        10)
            show_summary
            ;;
        0)
            log "Installation cancelled by user" "$INFO" "$YELLOW"
            exit 0
            ;;
        *)
            log "Invalid choice: $1" "$ERROR" "$RED"
            ;;
    esac
}

# Main execution
main() {
    show_banner
    
    # Initial checks
    check_root
    check_system_requirements
    
    # Show welcome message
    echo -e "${GREEN}Welcome to the Watershed VPN Infrastructure Installation!${NC}"
    echo ""
    echo -e "${BLUE}This script will install and configure a complete VPN infrastructure including:${NC}"
    echo "  • WireGuard and OpenVPN servers"
    echo "  • SSL certificate management"
    echo "  • User management and access control"
    echo "  • Firewall configuration"
    echo "  • Network access control"
    echo "  • Monitoring and logging"
    echo "  • Backup and recovery system"
    echo ""
    
    # Handle command line arguments
    if [[ $# -eq 0 ]]; then
        # Interactive mode
        while true; do
            show_menu
            read -p "Please select an option (0-10): " choice
            handle_choice "$choice"
            echo ""
            read -p "Press Enter to continue..."
        done
    else
        # Command line mode
        handle_choice "$1"
    fi
}

# Create symbolic links for easy access
create_symlinks() {
    log "Creating symbolic links..." "$INFO" "$BLUE"
    
    # Create links in /usr/local/bin
    local links=(
        "/opt/user-management.sh:/usr/local/bin/vpn-user"
        "/opt/ssl-cert-manager.sh:/usr/local/bin/vpn-ssl"
        "/opt/firewall-manager.sh:/usr/local/bin/vpn-firewall"
        "/opt/monitoring-setup.sh:/usr/local/bin/vpn-monitor"
        "/opt/backup-manager.sh:/usr/local/bin/vpn-backup"
    )
    
    for link in "${links[@]}"; do
        local source="${link%:*}"
        local target="${link#*:}"
        if [[ -f "$source" ]]; then
            ln -sf "$source" "$target"
            log "Created symlink: $target -> $source" "$SUCCESS" "$GREEN"
        fi
    done
    
    log "Symbolic links created" "$SUCCESS" "$GREEN"
}

# Initialize logging
mkdir -p "$(dirname "$LOG_FILE")"
touch "$LOG_FILE"

# Create installation completion marker
mark_completion() {
    cat > /opt/vpn-installation-complete.flag << EOF
Installation completed on: $(date)
Hostname: $(hostname)
Public IP: $(curl -s ifconfig.me 2>/dev/null || echo 'Not detected')
Installation script: $0
Log file: $LOG_FILE
EOF
    chmod 600 /opt/vpn-installation-complete.flag
}

# Run main function
main "$@"

# Mark installation as complete
mark_completion
