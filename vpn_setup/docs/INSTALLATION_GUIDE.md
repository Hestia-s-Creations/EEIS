# Watershed Disturbance Mapping System - VPN Infrastructure Setup Guide

## Overview

This comprehensive guide provides step-by-step instructions for setting up a complete VPN infrastructure for secure remote access to the Watershed Disturbance Mapping System. The setup includes WireGuard and OpenVPN servers, SSL certificates, firewall configuration, user management, monitoring, and backup/recovery procedures.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Installation](#detailed-installation)
4. [Configuration](#configuration)
5. [User Management](#user-management)
6. [Monitoring](#monitoring)
7. [Backup and Recovery](#backup-and-recovery)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)
10. [Maintenance](#maintenance)

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04+, Debian 11+, CentOS 8+, or RHEL 8+
- **RAM**: Minimum 2GB, Recommended 4GB
- **Storage**: Minimum 20GB available space
- **Network**: Public IP address with ports 22, 80, 443, 51820, 1194 open
- **Privileges**: Root access or sudo privileges

### Required Ports

| Port | Protocol | Service | Purpose |
|------|----------|---------|---------|
| 22 | TCP | SSH | Remote administration |
| 80 | TCP | HTTP | Web interface (redirects to HTTPS) |
| 443 | TCP | HTTPS | Secure web interface |
| 51820 | UDP | WireGuard | WireGuard VPN server |
| 1194 | UDP | OpenVPN | OpenVPN server |

### Network Requirements

- Public IP address (static recommended)
- Ability to forward UDP ports 51820 and 1194
- NAT router configuration (if behind NAT)
- Firewall rules allowing VPN traffic

## Quick Start

For experienced administrators, use this quick setup process:

```bash
# 1. Clone or download VPN setup files
# 2. Make scripts executable
chmod +x vpn_setup/scripts/*.sh

# 3. Run complete setup
sudo vpn_setup/scripts/install-all.sh

# 4. Follow interactive prompts for configuration
```

## Detailed Installation

### Step 1: System Preparation

#### Update System

```bash
# Update package lists
sudo apt update && sudo apt upgrade -y

# Install basic utilities
sudo apt install -y curl wget vim htop net-tools
```

#### Configure Network

```bash
# Enable IP forwarding
echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# Check current network configuration
ip addr show
```

### Step 2: Initialize VPN Infrastructure

#### Run Initial Setup

```bash
# Make all scripts executable
chmod +x vpn_setup/scripts/*.sh
chmod +x vpn_setup/wireguard/*.sh
chmod +x vpn_setup/openvpn/*.sh
chmod +x vpn_setup/config/*.sh
chmod +x vpn_setup/certificates/*.sh

# Initialize the complete VPN infrastructure
sudo vpn_setup/scripts/install-all.sh
```

#### Manual Component Installation

If you prefer to install components individually:

```bash
# Install WireGuard VPN
sudo vpn_setup/wireguard/install-server.sh

# Install OpenVPN (alternative)
sudo vpn_setup/openvpn/install-server.sh

# Setup network access control
sudo vpn_setup/scripts/setup-network-access.sh

# Configure SSL certificates
sudo vpn_setup/scripts/ssl-cert-manager.sh init

# Setup firewall
sudo vpn_setup/config/firewall-rules.sh setup

# Initialize monitoring
sudo vpn_setup/scripts/monitoring-setup.sh init

# Setup backup system
sudo vpn_setup/scripts/backup-recovery.sh init
```

### Step 3: Certificate Management

#### Generate SSL Certificates

```bash
# Initialize SSL management
sudo vpn_setup/scripts/ssl-cert-manager.sh init

# Generate CA certificate
sudo vpn_setup/scripts/ssl-cert-manager.sh ca

# Generate server certificate
sudo vpn_setup/scripts/ssl-cert-manager.sh server vpn.watershed-mapping.org

# Generate certificate bundle
sudo vpn_setup/scripts/ssl-cert-manager.sh bundle

# Setup Let's Encrypt (optional)
sudo vpn_setup/scripts/ssl-cert-manager.sh letsencrypt vpn.watershed-mapping.org admin@watershed-mapping.org
```

#### Certificate Verification

```bash
# Check certificate status
sudo vpn_setup/scripts/ssl-cert-manager.sh status

# Verify certificate
openssl x509 -in /etc/ssl/watershed/web/server-cert.pem -text -noout
```

### Step 4: User Management Setup

#### Initialize User Database

```bash
# Initialize user management system
sudo vpn_setup/scripts/user-management.sh init

# Add users
sudo vpn_setup/scripts/user-management.sh add admin admin@watershed.org "Admin User" "IT" "admin"
sudo vpn_setup/scripts/user-management.sh add analyst1 analyst1@watershed.org "Analyst One" "Research" "analyst"

# Generate VPN configurations for users
sudo vpn_setup/scripts/user-management.sh generate admin both
sudo vpn_setup/scripts/user-management.sh generate analyst1 wireguard
```

#### User Access Control

```bash
# List all users
sudo vpn_setup/scripts/user-management.sh list

# Show user details
sudo vpn_setup/scripts/user-management.sh show admin

# Revoke access
sudo vpn_setup/scripts/user-management.sh revoke analyst1
```

### Step 5: WireGuard Configuration

#### Server Setup

```bash
# Install and configure WireGuard
sudo vpn_setup/wireguard/install-server.sh

# Check service status
sudo systemctl status wg-quick@wg0

# View current configuration
sudo wg show
```

#### Client Configuration Generation

```bash
# Generate client configuration
/opt/wireguard/client-manager.sh generate alice "Alice - Researcher"

# List clients
/opt/wireguard/client-manager.sh list

# Show statistics
/opt/wireguard/client-manager.sh stats
```

### Step 6: OpenVPN Configuration (Alternative)

#### Server Setup

```bash
# Install and configure OpenVPN
sudo vpn_setup/openvpn/install-server.sh

# Check service status
sudo systemctl status openvpn@server

# Generate client certificate
sudo vpn_setup/openvpn/gen-client.sh bob
```

### Step 7: Firewall Configuration

#### Apply Firewall Rules

```bash
# Setup complete firewall
sudo vpn_setup/config/firewall-rules.sh setup

# Check firewall status
sudo vpn_setup/config/firewall-rules.sh status

# Monitor firewall activity
sudo vpn_setup/config/firewall-rules.sh monitor
```

#### Custom Firewall Rules

Edit `/etc/firewall/custom-rules.sh` to add custom rules:

```bash
#!/bin/bash
# Custom firewall rules for Watershed Mapping System

# Allow access to internal services
iptables -A FORWARD -s 10.8.0.0/24 -d 172.16.10.0/24 -p tcp --dport 8080 -j ACCEPT

# Allow database access for analysts
iptables -A FORWARD -s 10.8.0.0/24 -d 172.16.20.0/24 -p tcp --dport 5432 -j ACCEPT
```

### Step 8: Monitoring Setup

#### Initialize Monitoring

```bash
# Setup comprehensive monitoring
sudo vpn_setup/scripts/monitoring-setup.sh init

# Check monitoring status
sudo vpn_setup/scripts/monitoring-setup.sh status

# Run manual monitoring check
/opt/vpn-monitoring/monitor-all.sh
```

#### Monitoring Dashboard

Access the monitoring dashboard at:
- HTTP: `http://YOUR_SERVER_IP/vpn-dashboard`
- HTTPS: `https://YOUR_SERVER_IP/vpn-dashboard` (recommended)

### Step 9: Backup Configuration

#### Setup Automated Backups

```bash
# Initialize backup system
sudo vpn_setup/scripts/backup-recovery.sh init

# Run initial full backup
sudo vpn_setup/scripts/backup-recovery.sh full

# Verify backup
sudo vpn_setup/scripts/backup-recovery.sh verify

# Check backup status
sudo vpn_setup/scripts/backup-recovery.sh status
```

#### Backup Verification

```bash
# Verify all backups
sudo vpn_setup/scripts/backup-recovery.sh verify

# Check backup health
sudo vpn_setup/scripts/backup-recovery.sh verify health

# Generate backup report
sudo vpn_setup/scripts/backup-recovery.sh report
```

## Configuration

### Server Configuration

#### WireGuard Server Config (`/etc/wireguard/wg0.conf`)

```ini
[Interface]
PrivateKey = [SERVER_PRIVATE_KEY]
Address = 10.8.0.1/24
ListenPort = 51820

# NAT and forwarding
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE

# Client peers
[Peer]
PublicKey = [CLIENT_PUBLIC_KEY]
AllowedIPs = 10.8.0.2/32
```

#### OpenVPN Server Config (`/etc/openvpn/server.conf`)

```conf
port 1194
proto udp
dev tun

# Certificates
ca ca.crt
cert server.crt
key server.key
dh dh.pem

# Network
server 10.9.0.0 255.255.255.0

# Push routes
push "route 172.16.0.0 255.240.0.0"
push "dhcp-option DNS 10.9.0.1"
```

### Client Configuration

#### WireGuard Client Config

```ini
[Interface]
PrivateKey = [CLIENT_PRIVATE_KEY]
Address = 10.8.0.2/24
DNS = 10.8.0.1, 1.1.1.1

[Peer]
PublicKey = [SERVER_PUBLIC_KEY]
Endpoint = YOUR_SERVER_IP:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
```

#### OpenVPN Client Config

```conf
client
dev tun
proto udp
remote YOUR_SERVER_IP 1194
resolv-retry infinite
nobind

# Certificates
<ca>
[CA_CERT]
</ca>
<cert>
[CLIENT_CERT]
</cert>
<key>
[CLIENT_KEY]
</key>
```

### SSL Configuration

#### Nginx SSL Configuration

```nginx
server {
    listen 443 ssl http2;
    server_name vpn.watershed-mapping.org;
    
    ssl_certificate /etc/ssl/watershed/web/fullchain.pem;
    ssl_certificate_key /etc/ssl/watershed/web/server-key.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    location / {
        root /var/www/vpn-management;
        index index.html;
    }
}
```

## User Management

### Adding Users

```bash
# Add admin user
sudo vpn_setup/scripts/user-management.sh add \
    admin \
    admin@watershed.org \
    "Administrator" \
    "IT" \
    "admin" \
    "both"

# Add analyst user
sudo vpn_setup/scripts/user-management.sh add \
    analyst1 \
    analyst1@watershed.org \
    "Research Analyst" \
    "Research" \
    "analyst" \
    "wireguard"
```

### Generating VPN Configurations

```bash
# Generate configuration for user
sudo vpn_setup/scripts/user-management.sh generate alice wireguard

# Generate for both VPN types
sudo vpn_setup/scripts/user-management.sh generate bob both

# List generated configurations
ls -la /etc/wireguard/clients/
ls -la /etc/openvpn/
```

### Role-Based Access Control

| Role | Network Access | VPN Type | Privileges |
|------|----------------|----------|------------|
| admin | Full (0.0.0.0/0) | Both | Full access to all systems |
| analyst | 172.16.0.0/12 | WireGuard | Mapping system access |
| researcher | 10.8.0.0/24 | Both | Limited network access |
| emergency | Full (0.0.0.0/0) | Both | Emergency access only |

## Monitoring

### System Monitoring

#### Real-time Monitoring

```bash
# Monitor VPN connections
wg show

# Monitor OpenVPN connections
cat /var/log/openvpn-status.log

# Monitor firewall logs
tail -f /var/log/syslog | grep FIREWALL
```

#### Performance Monitoring

```bash
# Run performance monitor
/opt/vpn-monitoring/performance-monitor.sh

# Check resource usage
htop
iotop
nethogs
```

#### Security Monitoring

```bash
# Run security monitor
/opt/vpn-monitoring/security-monitor.sh

# Check failed logins
grep "Failed password" /var/log/auth.log

# Monitor VPN access attempts
tail -f /var/log/vpn/security/vpn-access.log
```

### Alerting

#### Alert Configuration

Edit `/opt/vpn-monitoring/alert-system.sh`:

```bash
# Set alert email
ALERT_EMAIL="admin@watershed-mapping.org"

# Configure thresholds
CPU_THRESHOLD=80
MEMORY_THRESHOLD=85
DISK_THRESHOLD=90
```

#### Alert Types

- **CRITICAL**: Service downtime, SSL certificate expiration < 7 days
- **WARNING**: High resource usage, multiple failed logins
- **INFO**: New connections, successful logins

## Backup and Recovery

### Automated Backups

Backups are automatically created:
- **Full backup**: Daily at 2:00 AM
- **Incremental backup**: Every 6 hours
- **Backup verification**: Weekly at 4:00 AM Sunday

### Manual Backup

```bash
# Run full backup
sudo vpn_setup/scripts/backup-recovery.sh full

# Run incremental backup
sudo vpn_setup/scripts/backup-recovery.sh incremental

# Verify backup integrity
sudo vpn_setup/scripts/backup-recovery.sh verify
```

### Recovery Procedures

#### Full System Recovery

```bash
# List available backups
sudo vpn_setup/scripts/backup-recovery.sh restore list

# Restore from backup
sudo vpn_setup/scripts/backup-recovery.sh restore full

# Follow interactive prompts
```

#### Component-Specific Recovery

```bash
# Restore WireGuard only
sudo vpn_setup/scripts/backup-recovery.sh restore wireguard

# Restore user database
sudo vpn_setup/scripts/backup-recovery.sh restore database

# Restore SSL certificates
sudo vpn_setup/scripts/backup-recovery.sh restore ssl
```

### Backup Verification

```bash
# Verify backup integrity
sudo vpn_setup/scripts/backup-recovery.sh verify /path/to/backup/file.tar.gz.gpg

# Check backup health
sudo vpn_setup/scripts/backup-recovery.sh verify health

# Generate backup report
sudo vpn_setup/scripts/backup-recovery.sh report
```

## Troubleshooting

### Common Issues

#### WireGuard Connection Issues

```bash
# Check WireGuard status
sudo systemctl status wg-quick@wg0

# View WireGuard configuration
sudo wg show

# Check logs
sudo journalctl -u wg-quick@wg0

# Restart WireGuard
sudo systemctl restart wg-quick@wg0
```

#### OpenVPN Connection Issues

```bash
# Check OpenVPN status
sudo systemctl status openvpn@server

# View OpenVPN logs
sudo tail -f /var/log/openvpn.log

# Check OpenVPN status log
tail -f /var/log/openvpn-status.log
```

#### Firewall Issues

```bash
# Check firewall rules
sudo iptables -L -n -v

# Test specific port
sudo nc -zv localhost 51820

# Check firewall logs
sudo tail -f /var/log/syslog | grep FIREWALL

# Restore from backup
sudo iptables-restore < /etc/firewall/rules.backup.YYYYMMDD_HHMMSS.rules
```

#### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in /etc/ssl/watershed/web/server-cert.pem -text -noout

# Renew Let's Encrypt certificate
sudo certbot renew

# Generate new certificate
sudo vpn_setup/scripts/ssl-cert-manager.sh renew \
    /etc/ssl/watershed/web/server-cert.pem \
    /etc/ssl/watershed/web/server-key.pem
```

### Log Locations

| Service | Log Location |
|---------|--------------|
| WireGuard | `/var/log/syslog`, `journalctl -u wg-quick@wg0` |
| OpenVPN | `/var/log/openvpn.log` |
| Firewall | `/var/log/syslog` |
| Monitoring | `/var/log/vpn/monitor.log` |
| Backup | `/var/log/vpn-backup.log` |
| User Management | `/var/log/vpn-user-management.log` |

### Performance Issues

#### High CPU Usage

```bash
# Check CPU usage
top

# Monitor VPN processes
htop -p $(pgrep -d, "wireguard\|openvpn")

# Check connection count
ss -tuln | grep -E ":51820|:1194" | wc -l
```

#### Network Performance

```bash
# Monitor bandwidth usage
nethogs -d 1

# Check interface statistics
cat /proc/net/dev | grep -E "wg|tun"

# Monitor VPN traffic
iftop -i wg0
```

### Security Issues

#### Failed Authentication Attempts

```bash
# Check SSH failures
grep "Failed password" /var/log/auth.log

# Check VPN access attempts
grep -E "WireGuard|OPENVPN" /var/log/syslog

# Block suspicious IPs
sudo ufw deny from SUSPICIOUS_IP
```

#### Certificate Expiration

```bash
# Check SSL certificate expiry
sudo vpn_setup/scripts/ssl-cert-manager.sh check \
    /etc/ssl/watershed/web/server-cert.pem

# Renew certificate
sudo vpn_setup/scripts/ssl-cert-manager.sh renew \
    /etc/ssl/watershed/web/server-cert.pem \
    /etc/ssl/watershed/web/server-key.pem
```

## Security Considerations

### Hardening Recommendations

1. **Strong Passwords**: Use complex passwords for all accounts
2. **Key Management**: Secure private keys and certificates
3. **Access Control**: Implement principle of least privilege
4. **Regular Updates**: Keep system and packages updated
5. **Monitoring**: Enable comprehensive logging and monitoring
6. **Backup Encryption**: Use encrypted backups for sensitive data
7. **Network Segmentation**: Isolate VPN networks from production

### Security Checklist

- [ ] All default passwords changed
- [ ] SSH key-based authentication enabled
- [ ] Unnecessary services disabled
- [ ] Firewall rules configured
- [ ] SSL certificates properly configured
- [ ] VPN logging enabled
- [ ] Regular security updates applied
- [ ] Backup encryption enabled
- [ ] Access logging enabled
- [ ] Emergency access procedures documented

### Incident Response

#### Security Breach Response

1. **Immediate Actions**:
   - Disconnect compromised connections
   - Block suspicious IP addresses
   - Preserve logs for investigation

2. **Investigation**:
   - Review access logs
   - Check for unauthorized access
   - Verify system integrity

3. **Recovery**:
   - Restore from clean backup if needed
   - Regenerate keys and certificates
   - Update firewall rules
   - Notify stakeholders

## Maintenance

### Regular Maintenance Tasks

#### Daily
- [ ] Check system resource usage
- [ ] Review security logs
- [ ] Monitor VPN connections
- [ ] Verify backup completion

#### Weekly
- [ ] Update system packages
- [ ] Review user access
- [ ] Test backup restoration
- [ ] Analyze performance metrics
- [ ] Review SSL certificate status

#### Monthly
- [ ] Security audit
- [ ] User access review
- [ ] Certificate renewal check
- [ ] Documentation updates
- [ ] Disaster recovery test

### Update Procedures

#### System Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update specific services
sudo systemctl restart wg-quick@wg0
sudo systemctl restart openvpn@server
sudo systemctl reload nginx
```

#### VPN Configuration Updates

```bash
# Update WireGuard configuration
sudo wg syncconf wg0 /etc/wireguard/wg0.conf

# Update OpenVPN configuration
sudo systemctl reload openvpn@server
```

### Documentation Maintenance

Keep documentation updated for:
- User access records
- Network topology
- Emergency procedures
- Configuration changes
- Security incidents

### Contact Information

**System Administrator**: admin@watershed-mapping.org  
**Emergency Contact**: emergency@watershed-mapping.org  
**Support Team**: support@watershed-mapping.org

## Support

For technical support:
1. Check troubleshooting section
2. Review log files
3. Contact system administrator
4. Follow incident response procedures

## License

This VPN infrastructure setup is provided for the Watershed Disturbance Mapping System. Please refer to individual component licenses for details.

---

**Last Updated**: $(date '+%Y-%m-%d')  
**Version**: 1.0  
**Maintained By**: Watershed Mapping IT Department
