#!/bin/bash
# Watershed Disturbance Mapping System - Monitoring and Logging Setup
# Comprehensive monitoring solution for VPN infrastructure

set -e

# Configuration
LOG_DIR="/var/log/vpn"
MONITORING_DIR="/opt/vpn-monitoring"
WG_INTERFACE="${WG_INTERFACE:-wg0}"
OVPN_INTERFACE="${OVPN_INTERFACE:-tun0}"
WG_PORT=51820
OVPN_PORT=1194
ALERT_EMAIL="${ALERT_EMAIL:-admin@watershed-mapping.org}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging function
log() {
    echo -e "${2}[$(date '+%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "${LOG_DIR}/monitor.log"
}

# Initialize monitoring system
initialize_monitoring() {
    log "Initializing VPN monitoring system..." "$GREEN"
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log "This script must be run as root" "$RED"
        exit 1
    fi
    
    # Create directories
    mkdir -p "$LOG_DIR" "$MONITORING_DIR"
    mkdir -p "$LOG_DIR/{connections,performance,security,alerts}"
    
    # Install monitoring tools
    if command -v apt &> /dev/null; then
        log "Installing monitoring packages..." "$BLUE"
        apt update
        apt install -y htop iotop nethogs vnstat tcpdump nload iftop \
                        sysstat iotop fail2ban logwatch mailutils \
                        jq curl nc netcat-openbsd mtr-tiny dnsutils
    elif command -v yum &> /dev/null; then
        log "Installing monitoring packages..." "$BLUE"
        yum install -y htop iotop nethogs vnstat tcpdump nload iftop \
                       sysstat iotop fail2ban logwatch mailx \
                       jq curl nc netcat bind-utils mtr
    fi
    
    # Create logrotate configuration
    create_logrotate_config
    
    # Create monitoring scripts
    create_connection_monitor
    create_performance_monitor
    create_security_monitor
    create_alert_system
    create_dashboard
    
    # Setup system monitoring
    setup_system_monitoring
    
    log "Monitoring system initialized successfully" "$GREEN"
}

# Create logrotate configuration
create_logrotate_config() {
    log "Creating logrotate configuration..." "$YELLOW"
    
    cat > /etc/logrotate.d/vpn-monitoring << 'EOF'
/var/log/vpn/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
    postrotate
        /bin/kill -HUP `cat /var/run/rsyslogd.pid 2> /dev/null` 2>/dev/null || true
    endscript
}

/var/log/vpn/connections/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
    create 644 root root
}

/var/log/vpn/security/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 600 root root
}
EOF
}

# Create connection monitor
create_connection_monitor() {
    log "Creating connection monitor..." "$YELLOW"
    
    cat > "$MONITORING_DIR/connection-monitor.sh" << 'EOF'
#!/bin/bash
# VPN Connection Monitor

WG_INTERFACE="wg0"
OVPN_INTERFACE="tun0"
LOG_DIR="/var/log/vpn/connections"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Create log directory
mkdir -p "$LOG_DIR"

# Monitor WireGuard connections
monitor_wireguard() {
    if ip link show "$WG_INTERFACE" >/dev/null 2>&1; then
        # Get active peers
        wg show "$WG_INTERFACE" > "${LOG_DIR}/wg-peers-${TIMESTAMP}.log" 2>&1
        
        # Get connection statistics
        wg show "$WG_INTERFACE" transfer >> "${LOG_DIR}/wg-stats-${TIMESTAMP}.log" 2>&1
        
        # Log active connections
        if wg show "$WG_INTERFACE" | grep -q "peer:"; then
            echo "[$TIMESTAMP] WireGuard connection active" >> "${LOG_DIR}/wg-status.log"
            wg show "$WG_INTERFACE" latest-handshakes >> "${LOG_DIR}/wg-handshakes.log"
        else
            echo "[$TIMESTAMP] No active WireGuard connections" >> "${LOG_DIR}/wg-status.log"
        fi
    fi
}

# Monitor OpenVPN connections
monitor_openvpn() {
    if [[ -f "/var/log/openvpn-status.log" ]]; then
        # Copy OpenVPN status
        cp /var/log/openvpn-status.log "${LOG_DIR}/ovpn-status-${TIMESTAMP}.log" 2>/dev/null || true
        
        # Analyze connections
        if [[ -f "/var/log/openvpn-status.log" ]]; then
            echo "[$TIMESTAMP] OpenVPN status check" >> "${LOG_DIR}/ovpn-status-main.log"
            grep -E "CLIENT_LIST|ROUTING_TABLE" /var/log/openvpn-status.log >> "${LOG_DIR}/ovpn-connections.log" 2>/dev/null || true
        fi
    fi
}

# Monitor network interface statistics
monitor_interfaces() {
    # Get interface statistics
    ip -s link show "$WG_INTERFACE" > "${LOG_DIR}/wg-interface-${TIMESTAMP}.log" 2>&1
    ip -s link show "$OVPN_INTERFACE" > "${LOG_DIR}/ovpn-interface-${TIMESTAMP}.log" 2>&1
    
    # Monitor bandwidth usage
    if command -v vnstat &> /dev/null; then
        vnstat --live 10 --style compact >> "${LOG_DIR}/bandwidth-${TIMESTAMP}.log" 2>&1
    fi
}

# Log current connections
log_connections() {
    echo "[$TIMESTAMP] === Connection Monitoring ===" >> "${LOG_DIR}/connections.log"
    
    # Active connections by port
    ss -tuln | grep -E ":$WG_PORT|:$OVPN_PORT" >> "${LOG_DIR}/connections.log"
    
    # Connected clients
    wg show "$WG_INTERFACE" >> "${LOG_DIR}/connections.log" 2>&1 || echo "WireGuard not active" >> "${LOG_DIR}/connections.log"
    
    # Traffic statistics
    echo "=== Traffic Statistics ===" >> "${LOG_DIR}/connections.log"
    ip -s link show | grep -A1 "$WG_INTERFACE\|$OVPN_INTERFACE" >> "${LOG_DIR}/connections.log" 2>&1
    
    echo "" >> "${LOG_DIR}/connections.log"
}

# Run monitoring functions
monitor_wireguard
monitor_openvpn
monitor_interfaces
log_connections

echo "[$TIMESTAMP] Connection monitoring completed"
EOF
    
    chmod +x "$MONITORING_DIR/connection-monitor.sh"
}

# Create performance monitor
create_performance_monitor() {
    log "Creating performance monitor..." "$YELLOW"
    
    cat > "$MONITORING_DIR/performance-monitor.sh" << 'EOF'
#!/bin/bash
# VPN Performance Monitor

LOG_DIR="/var/log/vpn/performance"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
DISK_THRESHOLD=90

mkdir -p "$LOG_DIR"

# Monitor CPU usage
monitor_cpu() {
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    echo "[$TIMESTAMP] CPU Usage: ${cpu_usage}%" >> "${LOG_DIR}/cpu.log"
    
    # Check if CPU usage is high
    if (( $(echo "$cpu_usage > $CPU_THRESHOLD" | bc -l 2>/dev/null || echo 0) )); then
        echo "[$TIMESTAMP] WARNING: High CPU usage: ${cpu_usage}%" >> "${LOG_DIR}/alerts.log"
    fi
}

# Monitor memory usage
monitor_memory() {
    local memory_info=$(free -m | awk 'NR==2{printf "%.1f", $3*100/$2}')
    local memory_used=$(free -m | awk 'NR==2{print $3}')
    local memory_total=$(free -m | awk 'NR==2{print $2}')
    
    echo "[$TIMESTAMP] Memory Usage: ${memory_info}% (${memory_used}MB/${memory_total}MB)" >> "${LOG_DIR}/memory.log"
    
    # Check if memory usage is high
    if (( $(echo "$memory_info > $MEMORY_THRESHOLD" | bc -l 2>/dev/null || echo 0) )); then
        echo "[$TIMESTAMP] WARNING: High memory usage: ${memory_info}%" >> "${LOG_DIR}/alerts.log"
    fi
}

# Monitor disk usage
monitor_disk() {
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    echo "[$TIMESTAMP] Disk Usage: ${disk_usage}%" >> "${LOG_DIR}/disk.log"
    
    # Check if disk usage is high
    if [[ $disk_usage -gt $DISK_THRESHOLD ]]; then
        echo "[$TIMESTAMP] WARNING: High disk usage: ${disk_usage}%" >> "${LOG_DIR}/alerts.log"
    fi
}

# Monitor network performance
monitor_network() {
    # Network interface statistics
    cat /proc/net/dev > "${LOG_DIR}/network-devices-${TIMESTAMP}.log"
    
    # Connection tracking
    local conn_count=$(ss -tuln | wc -l)
    echo "[$TIMESTAMP] Active connections: $conn_count" >> "${LOG_DIR}/connections.log"
    
    # VPN interface statistics
    if ip link show wg0 >/dev/null 2>&1; then
        local rx_bytes=$(cat /sys/class/net/wg0/statistics/rx_bytes 2>/dev/null || echo 0)
        local tx_bytes=$(cat /sys/class/net/wg0/statistics/tx_bytes 2>/dev/null || echo 0)
        echo "[$TIMESTAMP] WireGuard traffic - RX: $rx_bytes bytes, TX: $tx_bytes bytes" >> "${LOG_DIR}/network.log"
    fi
}

# Monitor system load
monitor_load() {
    local load_avg=$(uptime | awk -F'load average:' '{print $2}')
    echo "[$TIMESTAMP] System Load: $load_avg" >> "${LOG_DIR}/load.log"
    
    # Log detailed system information
    {
        echo "=== System Information [$TIMESTAMP] ==="
        echo "Uptime: $(uptime -p)"
        echo "CPU: $(lscpu | grep "Model name" | awk '{print $3,$4,$5,$6,$7,$8,$9}')"
        echo "Memory: $(free -h | awk 'NR==2{print $2 " total, " $3 " used, " $7 " available"}')"
        echo "Load Average: $(uptime | awk -F'load average:' '{print $2}')"
        echo ""
    } >> "${LOG_DIR}/system.log"
}

# Monitor process performance
monitor_processes() {
    # Top processes by CPU
    ps aux --sort=-%cpu | head -10 > "${LOG_DIR}/top-cpu-${TIMESTAMP}.log"
    
    # Top processes by memory
    ps aux --sort=-%mem | head -10 > "${LOG_DIR}/top-memory-${TIMESTAMP}.log"
    
    # VPN-related processes
    ps aux | grep -E "(wireguard|openvpn)" | grep -v grep > "${LOG_DIR}/vpn-processes-${TIMESTAMP}.log"
}

# Run all monitoring functions
monitor_cpu
monitor_memory
monitor_disk
monitor_network
monitor_load
monitor_processes

echo "[$TIMESTAMP] Performance monitoring completed"
EOF
    
    chmod +x "$MONITORING_DIR/performance-monitor.sh"
}

# Create security monitor
create_security_monitor() {
    log "Creating security monitor..." "$YELLOW"
    
    cat > "$MONITORING_DIR/security-monitor.sh" << 'EOF'
#!/bin/bash
# VPN Security Monitor

LOG_DIR="/var/log/vpn/security"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
FAILED_LOGIN_THRESHOLD=5
PORT_SCAN_THRESHOLD=20

mkdir -p "$LOG_DIR"

# Monitor authentication failures
monitor_auth_failures() {
    # Check SSH login failures
    local ssh_failures=$(grep "Failed password" /var/log/auth.log 2>/dev/null | tail -10 | wc -l)
    echo "[$TIMESTAMP] SSH login failures: $ssh_failures" >> "${LOG_DIR}/auth.log"
    
    if [[ $ssh_failures -gt $FAILED_LOGIN_THRESHOLD ]]; then
        echo "[$TIMESTAMP] ALERT: Multiple SSH login failures detected: $ssh_failures" >> "${LOG_DIR}/alerts.log"
    fi
}

# Monitor port scanning activity
monitor_port_scans() {
    # Check for multiple connection attempts to different ports
    local port_scan_count=$(netstat -an | grep -E "51820|1194" | wc -l)
    echo "[$TIMESTAMP] Port access attempts: $port_scan_count" >> "${LOG_DIR}/port-scan.log"
    
    # Analyze connection patterns
    ss -tuln | grep -E ":$WG_PORT|:$OVPN_PORT" | while read line; do
        echo "[$TIMESTAMP] $line" >> "${LOG_DIR}/vpn-access.log"
    done
}

# Monitor unusual traffic patterns
monitor_traffic_patterns() {
    # Check for unusual packet sizes
    tcpdump -r /tmp/vpn-capture.pcap -nn 2>/dev/null | head -10 > "${LOG_DIR}/packet-analysis-${TIMESTAMP}.log" || true
    
    # Monitor DNS queries
    tcpdump -i any port 53 -c 10 2>/dev/null > "${LOG_DIR}/dns-queries-${TIMESTAMP}.log" || true
}

# Check for suspicious processes
monitor_suspicious_processes() {
    # Look for unusual network processes
    netstat -tuln | grep LISTEN > "${LOG_DIR}/listening-ports-${TIMESTAMP}.log"
    
    # Check for processes using VPN ports
    lsof -i :51820 > "${LOG_DIR}/wg-processes-${TIMESTAMP}.log" 2>/dev/null || echo "No WireGuard processes found" > "${LOG_DIR}/wg-processes-${TIMESTAMP}.log"
    lsof -i :1194 > "${LOG_DIR}/ovpn-processes-${TIMESTAMP}.log" 2>/dev/null || echo "No OpenVPN processes found" > "${LOG_DIR}/ovpn-processes-${TIMESTAMP}.log"
    
    # Check for root processes
    ps aux | grep "^root" | wc -l > "${LOG_DIR}/root-processes-count.log"
}

# Monitor file integrity
monitor_file_integrity() {
    # Check key files
    local key_files=("/etc/wireguard/privatekey" "/etc/openvpn/server.key")
    
    for file in "${key_files[@]}"; do
        if [[ -f "$file" ]]; then
            local checksum=$(md5sum "$file" | awk '{print $1}')
            echo "[$TIMESTAMP] $file checksum: $checksum" >> "${LOG_DIR}/file-integrity.log"
        fi
    done
}

# Monitor firewall logs
monitor_firewall_logs() {
    # Parse firewall logs for security events
    if [[ -f "/var/log/syslog" ]]; then
        grep -E "FIREWALL_DROP|FORWARD_DROP|INVALID_CONN" /var/log/syslog | tail -20 > "${LOG_DIR}/firewall-events-${TIMESTAMP}.log" || true
    fi
}

# Check SSL certificate expiry
monitor_ssl_certificates() {
    local ssl_files=("/etc/ssl/watershed/web/server-cert.pem")
    
    for cert in "${ssl_files[@]}"; do
        if [[ -f "$cert" ]]; then
            local expiry_date=$(openssl x509 -enddate -noout -in "$cert" 2>/dev/null | cut -d= -f2)
            local expiry_epoch=$(date -d "$expiry_date" +%s)
            local current_epoch=$(date +%s)
            local days_left=$(( (expiry_epoch - current_epoch) / 86400 ))
            
            echo "[$TIMESTAMP] SSL certificate expires in $days_left days" >> "${LOG_DIR}/ssl-expiry.log"
            
            if [[ $days_left -lt 30 ]]; then
                echo "[$TIMESTAMP] ALERT: SSL certificate expires soon ($days_left days)" >> "${LOG_DIR}/alerts.log"
            fi
        fi
    done
}

# Generate security report
generate_security_report() {
    {
        echo "=== Security Report $TIMESTAMP ==="
        echo ""
        echo "Failed Authentication Attempts:"
        tail -10 "${LOG_DIR}/auth.log" 2>/dev/null || echo "No data"
        echo ""
        echo "VPN Port Access:"
        tail -10 "${LOG_DIR}/vpn-access.log" 2>/dev/null || echo "No data"
        echo ""
        echo "Suspicious Activities:"
        tail -10 "${LOG_DIR}/alerts.log" 2>/dev/null || echo "No alerts"
    } > "${LOG_DIR}/security-report-${TIMESTAMP}.txt"
}

# Run all security monitoring functions
monitor_auth_failures
monitor_port_scans
monitor_traffic_patterns
monitor_suspicious_processes
monitor_file_integrity
monitor_firewall_logs
monitor_ssl_certificates
generate_security_report

echo "[$TIMESTAMP] Security monitoring completed"
EOF
    
    chmod +x "$MONITORING_DIR/security-monitor.sh"
}

# Create alert system
create_alert_system() {
    log "Creating alert system..." "$YELLOW"
    
    cat > "$MONITORING_DIR/alert-system.sh" << 'EOF'
#!/bin/bash
# VPN Alert System

ALERT_EMAIL="${ALERT_EMAIL:-admin@watershed-mapping.org}"
LOG_DIR="/var/log/vpn/alerts"
ALERT_LOG="$LOG_DIR/alerts.log"

mkdir -p "$LOG_DIR"

# Send email alert
send_email_alert() {
    local subject="$1"
    local message="$2"
    local severity="${3:-WARNING}"
    
    # Log the alert
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$severity] $subject: $message" >> "$ALERT_LOG"
    
    # Send email if mail command is available
    if command -v mail &> /dev/null; then
        echo "$message" | mail -s "[$severity] VPN Alert: $subject" "$ALERT_EMAIL"
    fi
    
    # Also log to syslog
    logger -t "VPN-Alert" "[$severity] $subject: $message"
}

# Check for critical alerts
check_critical_alerts() {
    local alerts_found=0
    
    # Check for system resources
    local cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
    if (( $(echo "$cpu_usage > 90" | bc -l 2>/dev/null || echo 0) )); then
        send_email_alert "High CPU Usage" "CPU usage is at ${cpu_usage}%" "CRITICAL"
        alerts_found=$((alerts_found + 1))
    fi
    
    # Check disk space
    local disk_usage=$(df -h / | awk 'NR==2{print $5}' | sed 's/%//')
    if [[ $disk_usage -gt 95 ]]; then
        send_email_alert "High Disk Usage" "Disk usage is at ${disk_usage}%" "CRITICAL"
        alerts_found=$((alerts_found + 1))
    fi
    
    # Check VPN services
    if ! systemctl is-active --quiet wg-quick@wg0 && systemctl is-enabled --quiet wg-quick@wg0 2>/dev/null; then
        send_email_alert "WireGuard Service Down" "WireGuard service is not running" "CRITICAL"
        alerts_found=$((alerts_found + 1))
    fi
    
    if ! systemctl is-active --quiet openvpn@server && systemctl is-enabled --quiet openvpn@server 2>/dev/null; then
        send_email_alert "OpenVPN Service Down" "OpenVPN service is not running" "CRITICAL"
        alerts_found=$((alerts_found + 1))
    fi
    
    # Check SSL certificate expiry
    if [[ -f "/etc/ssl/watershed/web/server-cert.pem" ]]; then
        local expiry_date=$(openssl x509 -enddate -noout -in "/etc/ssl/watershed/web/server-cert.pem" 2>/dev/null | cut -d= -f2)
        local expiry_epoch=$(date -d "$expiry_date" +%s 2>/dev/null)
        local current_epoch=$(date +%s 2>/dev/null)
        local days_left=$(( (expiry_epoch - current_epoch) / 86400 2>/dev/null || echo 999))
        
        if [[ $days_left -lt 7 ]]; then
            send_email_alert "SSL Certificate Expiring" "SSL certificate expires in $days_left days" "CRITICAL"
            alerts_found=$((alerts_found + 1))
        elif [[ $days_left -lt 30 ]]; then
            send_email_alert "SSL Certificate Expiring" "SSL certificate expires in $days_left days" "WARNING"
            alerts_found=$((alerts_found + 1))
        fi
    fi
    
    # Check for authentication failures
    local recent_failures=$(grep "Failed password" /var/log/auth.log 2>/dev/null | tail -100 | wc -l)
    if [[ $recent_failures -gt 20 ]]; then
        send_email_alert "Multiple Authentication Failures" "$recent_failures failed login attempts in last 100 entries" "WARNING"
        alerts_found=$((alerts_found + 1))
    fi
    
    # Check for suspicious network activity
    local suspicious_connections=$(ss -tuln | grep -E ":$WG_PORT|:$OVPN_PORT" | grep -v "127.0.0.1" | wc -l)
    if [[ $suspicious_connections -gt 50 ]]; then
        send_email_alert "High VPN Connection Count" "$suspicious_connections VPN connection attempts" "WARNING"
        alerts_found=$((alerts_found + 1))
    fi
    
    return $alerts_found
}

# Generate daily security report
generate_daily_report() {
    local report_file="$LOG_DIR/daily-report-$(date +%Y-%m-%d).txt"
    
    cat > "$report_file" << EOF
VPN Infrastructure Daily Security Report
========================================
Generated: $(date)
Server: $(hostname)

=== System Status ===
$(systemctl status wg-quick@wg0 --no-pager 2>/dev/null || echo "WireGuard not configured")
$(systemctl status openvpn@server --no-pager 2>/dev/null || echo "OpenVPN not configured")

=== Active Connections ===
WireGuard Peers:
$(wg show wg0 2>/dev/null || echo "WireGuard not active")

OpenVPN Connections:
$(tail -20 /var/log/openvpn-status.log 2>/dev/null || echo "OpenVPN not active")

=== Security Events ===
Recent Alerts:
$(tail -20 "$ALERT_LOG" 2>/dev/null || echo "No alerts")

Authentication Failures:
$(grep "Failed password" /var/log/auth.log 2>/dev/null | tail -10 || echo "No failures")

=== Resource Usage ===
CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')
Memory: $(free -h | awk 'NR==2{print $3 "/" $2}')
Disk: $(df -h / | awk 'NR==2{print $3 "/" $2 " (" $5 " used)"}')

=== Network Statistics ===
$(ss -tuln | grep -E ":$WG_PORT|:$OVPN_PORT" | head -10 || echo "No active VPN connections")

Report generated automatically by VPN monitoring system.
EOF
    
    # Send daily report
    if command -v mail &> /dev/null && [[ -n "$ALERT_EMAIL" ]]; then
        cat "$report_file" | mail -s "VPN Daily Report - $(date '+%Y-%m-%d')" "$ALERT_EMAIL" 2>/dev/null || true
    fi
}

# Main alert check
check_critical_alerts

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Alert check completed"

# Generate daily report if it's the right time
if [[ $(date +%H) == "08" && $(date +%M) == "00" ]]; then
    generate_daily_report
fi
EOF
    
    chmod +x "$MONITORING_DIR/alert-system.sh"
}

# Create monitoring dashboard
create_dashboard() {
    log "Creating monitoring dashboard..." "$YELLOW"
    
    cat > "$MONITORING_DIR/dashboard.html" << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Watershed VPN Dashboard</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .stat-card { background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        .stat-value { font-size: 2em; font-weight: bold; color: #2c3e50; }
        .stat-label { color: #7f8c8d; margin-top: 5px; }
        .section { background: white; padding: 20px; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); margin-bottom: 20px; }
        .status-ok { color: #27ae60; }
        .status-warning { color: #f39c12; }
        .status-error { color: #e74c3c; }
        .log-content { background: #ecf0f1; padding: 10px; border-radius: 3px; font-family: monospace; max-height: 300px; overflow-y: auto; }
    </style>
    <script>
        function refreshDashboard() {
            location.reload();
        }
        
        setInterval(refreshDashboard, 30000); // Refresh every 30 seconds
    </script>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Watershed Disturbance Mapping System - VPN Dashboard</h1>
            <p>Real-time monitoring and status updates</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value" id="wg-peers">-</div>
                <div class="stat-label">WireGuard Peers</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="vpn-status">-</div>
                <div class="stat-label">VPN Status</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="cpu-usage">-</div>
                <div class="stat-label">CPU Usage (%)</div>
            </div>
            <div class="stat-card">
                <div class="stat-value" id="memory-usage">-</div>
                <div class="stat-label">Memory Usage (%)</div>
            </div>
        </div>
        
        <div class="section">
            <h2>System Information</h2>
            <div id="system-info">
                Loading system information...
            </div>
        </div>
        
        <div class="section">
            <h2>Recent Logs</h2>
            <h3>Connection Logs</h3>
            <div class="log-content" id="connection-logs">
                Loading connection logs...
            </div>
            <h3>Security Logs</h3>
            <div class="log-content" id="security-logs">
                Loading security logs...
            </div>
        </div>
    </div>
    
    <script>
        // This would be populated by a backend API in a real implementation
        // For demonstration purposes, showing static content
        document.getElementById('wg-peers').textContent = '3';
        document.getElementById('vpn-status').innerHTML = '<span class="status-ok">Online</span>';
        document.getElementById('cpu-usage').textContent = '25';
        document.getElementById('memory-usage').textContent = '45';
        
        document.getElementById('system-info').innerHTML = `
            <p><strong>Uptime:</strong> 5 days, 12 hours</p>
            <p><strong>Load Average:</strong> 1.2, 1.1, 0.9</p>
            <p><strong>Disk Usage:</strong> 45%</p>
            <p><strong>Network Interfaces:</strong> eth0, wg0, tun0</p>
        `;
    </script>
</body>
</html>
EOF
}

# Setup system monitoring
setup_system_monitoring() {
    log "Setting up system monitoring..." "$YELLOW"
    
    # Create monitoring crontab entries
    (crontab -l 2>/dev/null; echo "*/5 * * * * $MONITORING_DIR/connection-monitor.sh") | crontab -
    (crontab -l 2>/dev/null; echo "*/10 * * * * $MONITORING_DIR/performance-monitor.sh") | crontab -
    (crontab -l 2>/dev/null; echo "*/15 * * * * $MONITORING_DIR/security-monitor.sh") | crontab -
    (crontab -l 2>/dev/null; echo "*/30 * * * * $MONITORING_DIR/alert-system.sh") | crontab -
    (crontab -l 2>/dev/null; echo "0 8 * * * $MONITORING_DIR/alert-system.sh") | crontab -  # Daily report
    
    # Create systemd timer for monitoring
    cat > /etc/systemd/system/vpn-monitoring.service << 'EOF'
[Unit]
Description=VPN Monitoring Service
After=network.target

[Service]
Type=oneshot
ExecStart=/opt/vpn-monitoring/monitor-all.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF
    
    cat > /etc/systemd/system/vpn-monitoring.timer << 'EOF'
[Unit]
Description=VPN Monitoring Timer
Requires=vpn-monitoring.service

[Timer]
OnBootSec=5min
OnUnitActiveSec=5min

[Install]
WantedBy=timers.target
EOF
    
    systemctl enable vpn-monitoring.timer
    systemctl start vpn-monitoring.timer
}

# Create master monitoring script
cat > "$MONITORING_DIR/monitor-all.sh" << 'EOF'
#!/bin/bash
# Master VPN monitoring script

SCRIPT_DIR="/opt/vpn-monitoring"
LOG_FILE="/var/log/vpn/monitor-all.log"

echo "[$(date)] Starting VPN monitoring cycle" >> "$LOG_FILE"

# Run all monitoring scripts
"$SCRIPT_DIR/connection-monitor.sh" >> "$LOG_FILE" 2>&1
"$SCRIPT_DIR/performance-monitor.sh" >> "$LOG_FILE" 2>&1
"$SCRIPT_DIR/security-monitor.sh" >> "$LOG_FILE" 2>&1
"$SCRIPT_DIR/alert-system.sh" >> "$LOG_FILE" 2>&1

echo "[$(date)] VPN monitoring cycle completed" >> "$LOG_FILE"
EOF

chmod +x "$MONITORING_DIR/monitor-all.sh"

# Show monitoring status
show_monitoring_status() {
    echo "=== VPN Monitoring Status ==="
    echo "Monitoring Directory: $MONITORING_DIR"
    echo "Log Directory: $LOG_DIR"
    echo ""
    
    echo "Active Monitoring Scripts:"
    ls -la "$MONITORING_DIR"/*.sh
    
    echo ""
    echo "Crontab Entries:"
    crontab -l | grep vpn-monitoring
    
    echo ""
    echo "Recent Logs:"
    echo "============="
    echo "Monitor Log:"
    tail -5 "${LOG_DIR}/monitor.log" 2>/dev/null || echo "No monitor log yet"
    
    echo ""
    echo "Alert Log:"
    tail -5 "${LOG_DIR}/alerts/alerts.log" 2>/dev/null || echo "No alerts yet"
    
    echo ""
    echo "Systemd Timer:"
    systemctl status vpn-monitoring.timer --no-pager -l
}

# Generate monitoring report
generate_monitoring_report() {
    local report_file="/opt/vpn-monitoring-report.txt"
    
    log "Generating monitoring report..." "$YELLOW"
    
    cat > "$report_file" << EOF
VPN Monitoring Report - Watershed Disturbance Mapping System
===========================================================

Generated: $(date)

=== System Status ===
Uptime: $(uptime -p)
Load: $(uptime | awk -F'load average:' '{print $2}')
CPU: $(top -bn1 | grep "Cpu(s)" | awk '{print $2}')
Memory: $(free -h | awk 'NR==2{print $3 "/" $2}')
Disk: $(df -h / | awk 'NR==2{print $3 "/" $2 " (" $5 " used)"}')

=== VPN Services ===
WireGuard Status: $(systemctl is-active wg-quick@wg0 2>/dev/null || echo "Not configured")
OpenVPN Status: $(systemctl is-active openvpn@server 2>/dev/null || echo "Not configured")

=== Active Connections ===
$(ss -tuln | grep -E ":51820|:1194" || echo "No active VPN connections")

=== Recent Alerts ===
$(tail -10 "${LOG_DIR}/alerts/alerts.log" 2>/dev/null || echo "No alerts")

=== Performance Summary ===
$(tail -10 "${LOG_DIR}/performance/cpu.log" 2>/dev/null || echo "No CPU data")
$(tail -10 "${LOG_DIR}/performance/memory.log" 2>/dev/null || echo "No memory data")

=== Security Summary ===
$(tail -10 "${LOG_DIR}/security/auth.log" 2>/dev/null || echo "No auth data")

Monitoring configuration:
- Connection monitoring: every 5 minutes
- Performance monitoring: every 10 minutes
- Security monitoring: every 15 minutes
- Alert system: every 30 minutes
- Daily report: 8:00 AM

EOF
    
    log "Monitoring report generated: $report_file" "$GREEN"
}

# Main execution
case "$1" in
    init)
        initialize_monitoring
        ;;
    status)
        show_monitoring_status
        ;;
    report)
        generate_monitoring_report
        ;;
    *)
        echo "Usage: $0 {init|status|report}"
        echo ""
        echo "Commands:"
        echo "  init     - Initialize monitoring system"
        echo "  status   - Show monitoring status"
        echo "  report   - Generate monitoring report"
        echo ""
        
        # Interactive mode
        if [[ $# -eq 0 ]]; then
            while true; do
                echo ""
                echo "=== VPN Monitoring Management ==="
                echo "1) Initialize monitoring system"
                echo "2) Show monitoring status"
                echo "3) Generate monitoring report"
                echo "4) Run connection monitor"
                echo "5) Run performance monitor"
                echo "6) Run security monitor"
                echo "7) Run alert system"
                echo "8) View recent logs"
                echo "0) Exit"
                echo ""
                read -p "Select option: " choice
                case $choice in
                    1) initialize_monitoring ;;
                    2) show_monitoring_status ;;
                    3) generate_monitoring_report ;;
                    4) "$MONITORING_DIR/connection-monitor.sh" ;;
                    5) "$MONITORING_DIR/performance-monitor.sh" ;;
                    6) "$MONITORING_DIR/security-monitor.sh" ;;
                    7) "$MONITORING_DIR/alert-system.sh" ;;
                    8) echo "Recent monitor log:"
                        tail -20 "${LOG_DIR}/monitor.log" 2>/dev/null || echo "No log file found"
                        echo ""
                        echo "Recent alerts:"
                        tail -20 "${LOG_DIR}/alerts/alerts.log" 2>/dev/null || echo "No alerts"
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
