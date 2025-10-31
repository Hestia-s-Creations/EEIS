# Watershed Disturbance Mapping System - VPN Infrastructure

[![Security](https://img.shields.io/badge/security-high-green.svg)](https://github.com/watershed-mapping/vpn-infrastructure)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-1.0.0-brightgreen.svg)](CHANGELOG.md)

A comprehensive, enterprise-grade VPN infrastructure solution designed specifically for secure remote access to the Watershed Disturbance Mapping System. This setup provides dual VPN protocol support (WireGuard and OpenVPN), advanced security features, user management, monitoring, and automated backup/recovery capabilities.

## 🚀 Features

### Core VPN Infrastructure
- **WireGuard VPN Server** - Modern, fast, and secure VPN protocol
- **OpenVPN Server** - Reliable alternative with broad compatibility
- **Dual Protocol Support** - Both WireGuard and OpenVPN configured
- **Automatic Failover** - Seamless switching between VPN protocols

### Security Features
- **SSL/TLS Certificate Management** - Automated certificate generation and renewal
- **Firewall Configuration** - Comprehensive firewall rules and NAT setup
- **Access Control** - Role-based user permissions and network segmentation
- **Encryption** - Strong encryption for all VPN traffic
- **Network Isolation** - Proper network segmentation and routing

### User Management
- **SQLite Database** - Centralized user management
- **Role-Based Access Control** - Admin, Analyst, Researcher, Emergency roles
- **Automated IP Assignment** - Dynamic IP allocation for users
- **Client Configuration Generation** - Automated client configuration files
- **Access Logging** - Comprehensive audit trails

### Monitoring & Logging
- **Real-time Monitoring** - Connection status and performance metrics
- **Security Monitoring** - Authentication failures and suspicious activity
- **Alert System** - Email alerts for critical events
- **Performance Monitoring** - Resource usage and network statistics
- **Log Management** - Centralized logging with rotation

### Backup & Recovery
- **Automated Backups** - Scheduled full and incremental backups
- **Encrypted Backups** - Secure backup storage
- **Backup Verification** - Integrity checking for all backups
- **Disaster Recovery** - Complete system restoration procedures
- **Retention Management** - Configurable backup retention policies

### Web Management Interface
- **Nginx Integration** - SSL-enabled web interface
- **Monitoring Dashboard** - Real-time system status
- **User Management UI** - Web-based user administration
- **Configuration Management** - Web-based VPN configuration

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Architecture](#architecture)
- [Security](#security)
- [Monitoring](#monitoring)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

## 🔧 Prerequisites

### System Requirements
- **Operating System**: Ubuntu 20.04+, Debian 11+, CentOS 8+, or RHEL 8+
- **RAM**: Minimum 2GB, Recommended 4GB
- **Storage**: Minimum 20GB available space
- **Network**: Public IP address with required ports open
- **Privileges**: Root access or sudo privileges

### Network Requirements
- **Public IP**: Static IP recommended
- **Ports**: TCP/UDP 22, 80, 443, 51820, 1194
- **Firewall**: Ability to configure firewall rules
- **DNS**: Access to DNS servers

### Required Software
- Bash shell
- OpenSSL
- SQLite3
- Git (optional, for cloning repository)

## ⚡ Quick Start

### Automated Installation

```bash
# 1. Download and extract the VPN setup
wget https://github.com/watershed-mapping/vpn-infrastructure/archive/main.zip
unzip main.zip
cd vpn-infrastructure-main

# 2. Run the complete installation
sudo ./vpn_setup/scripts/install-all.sh

# 3. Follow the interactive prompts
# Select option 1 for full installation
```

### Manual Installation (Step by Step)

```bash
# 1. Make scripts executable
chmod +x vpn_setup/scripts/*.sh

# 2. Run full installation
sudo vpn_setup/scripts/install-all.sh

# 3. Generate SSL certificates
sudo /opt/ssl-cert-manager.sh ca
sudo /opt/ssl-cert-manager.sh server vpn.watershed-mapping.org

# 4. Add VPN users
sudo /opt/user-management.sh add admin admin@watershed.org "Admin User" "IT" "admin"

# 5. Generate VPN configurations
sudo /opt/user-management.sh generate admin both

# 6. Start VPN services
sudo systemctl start wg-quick@wg0
sudo systemctl start openvpn@server
```

## 📚 Installation

### Directory Structure

```
vpn_setup/
├── wireguard/
│   ├── server.conf          # WireGuard server configuration
│   └── install-server.sh    # WireGuard installation script
├── openvpn/
│   ├── server.conf          # OpenVPN server configuration
│   └── install-server.sh    # OpenVPN installation script
├── scripts/
│   ├── install-all.sh       # Master installation script
│   ├── user-management.sh   # User management system
│   ├── ssl-cert-manager.sh  # SSL certificate management
│   ├── monitoring-setup.sh  # Monitoring system
│   ├── backup-recovery.sh   # Backup and recovery
│   ├── setup-network-access.sh # Network configuration
│   └── ...
├── config/
│   ├── network-access-control.conf # Network ACL rules
│   └── firewall-rules.sh    # Firewall configuration
├── certificates/
│   └── ssl-management.sh    # SSL management scripts
├── templates/
│   ├── wireguard-windows.conf # Windows client template
│   ├── wireguard-linux.conf   # Linux client template
│   ├── wireguard-macos.conf   # macOS client template
│   └── wireguard-mobile.conf  # Mobile client template
└── docs/
    └── INSTALLATION_GUIDE.md # Detailed installation guide
```

### Installation Components

#### 1. VPN Servers
- **WireGuard Server** - UDP port 51820
- **OpenVPN Server** - UDP port 1194
- **Service Management** - Systemd service integration

#### 2. Security Infrastructure
- **SSL/TLS Certificates** - Certificate Authority setup
- **Firewall Configuration** - iptables/UFW rules
- **Network Access Control** - Routing and NAT

#### 3. User Management
- **Database System** - SQLite-based user storage
- **Access Control** - Role-based permissions
- **Configuration Generation** - Automated client configs

#### 4. Monitoring System
- **Connection Monitoring** - VPN connection tracking
- **Performance Monitoring** - System resource usage
- **Security Monitoring** - Authentication and access logs
- **Alert System** - Email notifications

#### 5. Backup System
- **Automated Backups** - Scheduled backup jobs
- **Encryption** - GPG-encrypted backup storage
- **Recovery Tools** - Complete restoration procedures

### Post-Installation Setup

After running the installation script, complete the setup:

```bash
# 1. Generate SSL certificates
sudo /opt/ssl-cert-manager.sh init
sudo /opt/ssl-cert-manager.sh ca
sudo /opt/ssl-cert-manager.sh server vpn.watershed-mapping.org

# 2. Add users
sudo /opt/user-management.sh init
sudo /opt/user-management.sh add alice alice@watershed.org "Alice Smith" "Research" "analyst"
sudo /opt/user-management.sh add bob bob@watershed.org "Bob Johnson" "IT" "admin"

# 3. Generate client configurations
sudo /opt/user-management.sh generate alice wireguard
sudo /opt/user-management.sh generate bob both

# 4. Start services
sudo systemctl enable wg-quick@wg0 openvpn@server nginx
sudo systemctl start wg-quick@wg0 openvpn@server nginx

# 5. Verify installation
sudo /opt/user-management.sh list
sudo wg show
```

## ⚙️ Configuration

### WireGuard Configuration

The WireGuard server is configured with:
- **Network Range**: 10.8.0.0/24
- **Port**: 51820 (UDP)
- **Interface**: wg0
- **DNS**: 10.8.0.1, 1.1.1.1, 8.8.8.8

```ini
[Interface]
PrivateKey = [SERVER_PRIVATE_KEY]
Address = 10.8.0.1/24
ListenPort = 51820

# Client peer configuration
[Peer]
PublicKey = [CLIENT_PUBLIC_KEY]
AllowedIPs = 10.8.0.2/32
```

### OpenVPN Configuration

The OpenVPN server is configured with:
- **Network Range**: 10.9.0.0/24
- **Port**: 1194 (UDP)
- **Interface**: tun0
- **Cipher**: AES-256-CBC
- **Authentication**: SHA256

```conf
port 1194
proto udp
dev tun
server 10.9.0.0 255.255.255.0
push "route 172.16.0.0 255.240.0.0"
cipher AES-256-CBC
auth SHA256
```

### SSL Certificate Configuration

SSL certificates are managed through:
- **Certificate Authority**: Self-signed CA or Let's Encrypt
- **Certificate Validity**: 2 years (configurable)
- **Key Size**: 4096 bits RSA
- **Algorithm**: SHA256

### Firewall Configuration

Comprehensive firewall rules include:
- **VPN Traffic**: WireGuard and OpenVPN ports
- **SSH Access**: Port 22 with rate limiting
- **Web Services**: HTTP/HTTPS (80/443)
- **Network Segmentation**: Proper routing and NAT
- **Security**: DDoS protection and logging

## 📖 Usage

### User Management

#### Add New Users
```bash
# Add admin user
sudo /opt/user-management.sh add \
    admin \
    admin@watershed.org \
    "Administrator" \
    "IT" \
    "admin" \
    "both"

# Add analyst user
sudo /opt/user-management.sh add \
    analyst1 \
    analyst1@watershed.org \
    "Research Analyst" \
    "Research" \
    "analyst" \
    "wireguard"
```

#### Generate VPN Configurations
```bash
# Generate WireGuard configuration
sudo /opt/user-management.sh generate alice wireguard

# Generate OpenVPN configuration
sudo /opt/user-management.sh generate bob openvpn

# Generate both
sudo /opt/user-management.sh generate admin both
```

#### List and Manage Users
```bash
# List all users
sudo /opt/user-management.sh list

# Show user details
sudo /opt/user-management.sh show alice

# Revoke access
sudo /opt/user-management.sh revoke analyst1
```

### VPN Client Configuration

#### WireGuard Clients
1. **Windows**: Import `.conf` file into WireGuard app
2. **macOS**: Import into WireGuard app from App Store
3. **Linux**: Use `wg-quick` command
4. **Mobile**: Import via QR code or file

#### OpenVPN Clients
1. **Import .ovpn file**: Use OpenVPN client
2. **Import PKCS#12 bundle**: For easier setup
3. **Mobile**: Import via OpenVPN Connect app

### Monitoring

#### Real-time Monitoring
```bash
# Check VPN status
sudo wg show
cat /var/log/openvpn-status.log

# Monitor connections
sudo /opt/monitoring-setup.sh status

# View logs
tail -f /var/log/vpn/monitor.log
```

#### Performance Monitoring
```bash
# System resources
htop
iotop
nethogs

# Network monitoring
iftop -i wg0
vnstat -i wg0
```

#### Security Monitoring
```bash
# Check failed logins
grep "Failed password" /var/log/auth.log

# Monitor VPN access
sudo /opt/monitoring-setup.sh monitor

# View security logs
tail -f /var/log/vpn/security/alerts.log
```

### Backup and Recovery

#### Manual Backup
```bash
# Run full backup
sudo /opt/backup-manager.sh full

# Run incremental backup
sudo /opt/backup-manager.sh incremental

# Verify backups
sudo /opt/backup-manager.sh verify
```

#### Recovery Procedures
```bash
# List available backups
sudo /opt/backup-manager.sh restore list

# Restore from backup
sudo /opt/backup-manager.sh restore full

# Restore specific component
sudo /opt/backup-manager.sh restore wireguard
```

## 🏗️ Architecture

### Network Topology

```
Internet
    │
    ├── Firewall (iptables/UFW)
    ├── Load Balancer (optional)
    ├── Web Server (nginx)
    ├── WireGuard Server (10.8.0.1/24)
    ├── OpenVPN Server (10.9.0.0/24)
    └── Monitoring System
```

### User Access Flow

1. **Authentication** - User authenticates via VPN client
2. **Authorization** - Role-based access control applied
3. **Network Access** - Proper routing and NAT
4. **Monitoring** - All activity logged and monitored
5. **Audit Trail** - Complete access history maintained

### Security Layers

1. **Network Security** - Firewall rules and access control
2. **Encryption** - VPN traffic encrypted with modern ciphers
3. **Authentication** - Certificate-based client authentication
4. **Authorization** - Role-based access control
5. **Monitoring** - Real-time security monitoring
6. **Auditing** - Complete audit trails

## 🔒 Security

### Security Features

- **Strong Encryption** - AES-256, ChaCha20-Poly1305
- **Certificate Management** - Automated PKI setup
- **Access Control** - Role-based permissions
- **Network Segmentation** - Proper VLAN isolation
- **DDoS Protection** - Rate limiting and flood protection
- **Audit Logging** - Comprehensive access logging
- **Intrusion Detection** - Failed login monitoring

### Security Best Practices

1. **Regular Updates** - Keep system and software updated
2. **Strong Passwords** - Use complex passwords for all accounts
3. **Key Management** - Secure private keys and certificates
4. **Access Review** - Regular review of user access rights
5. **Monitoring** - Enable comprehensive logging and monitoring
6. **Backup Security** - Encrypt backups and store securely
7. **Incident Response** - Have procedures for security incidents

### Compliance

The VPN infrastructure follows security best practices and can support compliance requirements for:
- **ISO 27001** - Information Security Management
- **NIST Cybersecurity Framework** - Identify, Protect, Detect, Respond, Recover
- **SOC 2** - Security, Availability, Confidentiality controls

## 📊 Monitoring

### Monitoring Components

1. **Connection Monitoring** - VPN connection status and metrics
2. **Performance Monitoring** - System resource usage
3. **Security Monitoring** - Authentication and access logs
4. **Network Monitoring** - Traffic analysis and routing
5. **Certificate Monitoring** - SSL certificate expiration tracking
6. **Backup Monitoring** - Backup job status and verification

### Alert System

Alert levels:
- **CRITICAL** - Service downtime, security breaches
- **WARNING** - High resource usage, certificate expiration
- **INFO** - New connections, routine events

Alert methods:
- **Email** - Primary alert notification method
- **Syslog** - Integration with system logging
- **Dashboard** - Web-based monitoring interface

### Monitoring Dashboard

Access the web-based monitoring dashboard at:
- **URL**: `https://your-server-ip/vpn-dashboard`
- **Features**: Real-time status, connection logs, performance metrics
- **Authentication**: Integrated with user management system

## 💾 Backup & Recovery

### Backup Strategy

1. **Full Backups** - Daily automated full backups
2. **Incremental Backups** - Every 6 hours incremental backups
3. **Backup Encryption** - GPG encryption for all backups
4. **Retention Policy** - 30 days for daily, 90 days for weekly
5. **Offsite Storage** - Remote backup storage capability

### Backup Components

- VPN configurations (WireGuard, OpenVPN)
- SSL certificates and keys
- User database and access logs
- Firewall rules and configuration
- Monitoring data and logs
- System configuration files

### Recovery Procedures

1. **Component Recovery** - Restore individual VPN components
2. **Full System Recovery** - Complete system restoration
3. **Database Recovery** - User database restoration
4. **Certificate Recovery** - SSL certificate restoration
5. **Configuration Recovery** - System configuration restoration

## 🔧 Troubleshooting

### Common Issues

#### VPN Connection Issues
```bash
# Check WireGuard status
sudo systemctl status wg-quick@wg0
sudo wg show

# Check OpenVPN status
sudo systemctl status openvpn@server
sudo tail -f /var/log/openvpn.log

# Check firewall rules
sudo iptables -L -n -v
```

#### SSL Certificate Issues
```bash
# Check certificate validity
openssl x509 -in /etc/ssl/watershed/web/server-cert.pem -text -noout

# Renew Let's Encrypt certificate
sudo certbot renew

# Generate new certificate
sudo /opt/ssl-cert-manager.sh renew /path/to/cert /path/to/key
```

#### Performance Issues
```bash
# Check system resources
htop
iotop
nethogs

# Monitor VPN traffic
iftop -i wg0
vnstat -i wg0
```

#### User Access Issues
```bash
# Check user database
sudo /opt/user-management.sh list
sqlite3 /etc/vpn/users.db "SELECT * FROM users;"

# Check client configurations
ls -la /etc/wireguard/clients/
ls -la /etc/openvpn/
```

### Log Locations

| Service | Log File |
|---------|----------|
| Installation | `/var/log/vpn-installation.log` |
| WireGuard | `journalctl -u wg-quick@wg0` |
| OpenVPN | `/var/log/openvpn.log` |
| Monitoring | `/var/log/vpn/monitor.log` |
| Backup | `/var/log/vpn-backup.log` |
| User Management | `/var/log/vpn-user-management.log` |
| System | `/var/log/syslog` |

### Getting Help

1. **Check Logs** - Review relevant log files
2. **System Status** - Use status check commands
3. **Documentation** - Refer to installation guide
4. **Support** - Contact system administrator

## 🤝 Contributing

We welcome contributions to the Watershed VPN Infrastructure project! Please follow these guidelines:

### How to Contribute

1. **Fork the Repository**
2. **Create a Feature Branch** - `git checkout -b feature/amazing-feature`
3. **Commit Changes** - `git commit -m 'Add amazing feature'`
4. **Push to Branch** - `git push origin feature/amazing-feature`
5. **Open a Pull Request**

### Contribution Guidelines

- Follow existing code style and conventions
- Add tests for new functionality
- Update documentation as needed
- Ensure backward compatibility
- Test thoroughly before submitting

### Development Setup

```bash
# Clone the repository
git clone https://github.com/watershed-mapping/vpn-infrastructure.git
cd vpn-infrastructure

# Create development environment
sudo ./vpn_setup/scripts/install-all.sh

# Run tests
sudo ./tests/run-all-tests.sh
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

### Documentation
- **Installation Guide**: [docs/INSTALLATION_GUIDE.md](docs/INSTALLATION_GUIDE.md)
- **API Documentation**: [docs/API.md](docs/API.md)
- **Troubleshooting Guide**: [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

### Community
- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Community support and Q&A
- **Wiki**: Additional documentation and examples

### Commercial Support
For enterprise support and customization:
- **Email**: support@watershed-mapping.org
- **Phone**: +1-555-WATERSHED
- **Website**: https://watershed-mapping.org/support

## 🏆 Acknowledgments

- **WireGuard Team** - For the excellent VPN protocol
- **OpenVPN Community** - For the reliable VPN solution
- **Nginx** - For the web server and reverse proxy
- **Let's Encrypt** - For free SSL certificates
- **OpenSSL** - For cryptographic implementations

---

**Watershed Disturbance Mapping System VPN Infrastructure**
*Secure Remote Access for Environmental Research*

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/watershed-mapping/vpn-infrastructure)
[![Coverage](https://img.shields.io/badge/coverage-95%25-green.svg)](https://github.com/watershed-mapping/vpn-infrastructure)
[![Security](https://img.shields.io/badge/security-A+-green.svg)](https://github.com/watershed-mapping/vpn-infrastructure)
