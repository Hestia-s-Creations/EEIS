#!/bin/bash
# Watershed Disturbance Mapping System - SSL Certificate Management
# Complete SSL certificate setup and management script

set -e

# Configuration
CERT_DIR="/etc/ssl/watershed"
WEB_CERT_DIR="/etc/ssl/watershed/web"
VPN_CERT_DIR="/etc/ssl/watershed/vpn"
LOG_FILE="/var/log/ssl-management.log"

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

# Initialize certificate management
initialize_ssl() {
    log "Initializing SSL certificate management..." "$GREEN"
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log "This script must be run as root" "$RED"
        exit 1
    fi
    
    # Create directories
    mkdir -p "$CERT_DIR" "$WEB_CERT_DIR" "$VPN_CERT_DIR"
    mkdir -p "$CERT_DIR/backups" "$CERT_DIR/crl"
    
    # Install required packages
    if command -v apt &> /dev/null; then
        apt update
        apt install -y openssl nginx certbot ufw
    elif command -v yum &> /dev/null; then
        yum install -y openssl nginx certbot
    fi
    
    log "SSL management initialized" "$GREEN"
}

# Generate CA certificate
generate_ca() {
    log "Generating CA certificate..." "$YELLOW"
    
    # Create CA configuration
    cat > "$CERT_DIR/ca.conf" << 'EOF'
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_ca
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = Watershed Mapping Organization
OU = Certificate Authority
CN = Watershed CA
emailAddress = admin@watershed-mapping.org

[v3_ca]
basicConstraints = critical,CA:true
keyUsage = critical, digitalSignature, cRLSign, keyCertSign
subjectKeyIdentifier = hash
EOF
    
    # Generate CA private key
    openssl genrsa -out "$CERT_DIR/ca-key.pem" 4096
    chmod 600 "$CERT_DIR/ca-key.pem"
    
    # Generate CA certificate
    openssl req -new -x509 -days 3650 \
        -key "$CERT_DIR/ca-key.pem" \
        -out "$CERT_DIR/ca-cert.pem" \
        -config "$CERT_DIR/ca.conf" \
        -extensions v3_ca
    
    chmod 644 "$CERT_DIR/ca-cert.pem"
    
    log "CA certificate generated: $CERT_DIR/ca-cert.pem" "$GREEN"
}

# Generate server certificate
generate_server_cert() {
    local domain="$1"
    
    log "Generating server certificate for: $domain" "$YELLOW"
    
    # Create server configuration
    cat > "$WEB_CERT_DIR/server.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = Watershed Mapping Organization
OU = IT Department
CN = $domain
emailAddress = admin@watershed-mapping.org

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = $domain
DNS.2 = vpn.watershed-mapping.org
DNS.3 = api.watershed-mapping.org
IP.1 = 10.8.0.1
IP.2 = 10.9.0.1
EOF
    
    # Generate server private key
    openssl genrsa -out "$WEB_CERT_DIR/server-key.pem" 4096
    chmod 600 "$WEB_CERT_DIR/server-key.pem"
    
    # Generate server CSR
    openssl req -new \
        -key "$WEB_CERT_DIR/server-key.pem" \
        -out "$WEB_CERT_DIR/server-csr.pem" \
        -config "$WEB_CERT_DIR/server.conf"
    
    # Sign server certificate
    openssl x509 -req -days 825 \
        -in "$WEB_CERT_DIR/server-csr.pem" \
        -CA "$CERT_DIR/ca-cert.pem" \
        -CAkey "$CERT_DIR/ca-key.pem" \
        -CAcreateserial \
        -out "$WEB_CERT_DIR/server-cert.pem" \
        -extensions v3_req \
        -extfile "$WEB_CERT_DIR/server.conf"
    
    # Cleanup CSR
    rm -f "$WEB_CERT_DIR/server-csr.pem"
    
    # Generate certificate chain
    cat "$WEB_CERT_DIR/server-cert.pem" "$CERT_DIR/ca-cert.pem" > "$WEB_CERT_DIR/fullchain.pem"
    
    log "Server certificate generated: $WEB_CERT_DIR/server-cert.pem" "$GREEN"
}

# Generate client certificate
generate_client_cert() {
    local client_name="$1"
    local output_dir="${2:-$VPN_CERT_DIR}"
    
    log "Generating client certificate for: $client_name" "$YELLOW"
    
    # Create client configuration
    cat > "$CERT_DIR/client.conf" << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_client_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = Watershed Mapping Organization
OU = Client Certificate
CN = $client_name

[v3_client_req]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
EOF
    
    # Generate client private key
    openssl genrsa -out "$output_dir/${client_name}-key.pem" 4096
    
    # Generate client CSR
    openssl req -new \
        -key "$output_dir/${client_name}-key.pem" \
        -out "$output_dir/${client_name}-csr.pem" \
        -config "$CERT_DIR/client.conf" \
        -subj "/C=US/ST=State/L=City/O=Watershed Mapping Organization/OU=Client Certificate/CN=$client_name"
    
    # Sign client certificate
    openssl x509 -req -days 825 \
        -in "$output_dir/${client_name}-csr.pem" \
        -CA "$CERT_DIR/ca-cert.pem" \
        -CAkey "$CERT_DIR/ca-key.pem" \
        -CAcreateserial \
        -out "$output_dir/${client_name}-cert.pem" \
        -extensions v3_client_req \
        -extfile "$CERT_DIR/client.conf"
    
    # Create PKCS#12 bundle for easier import
    openssl pkcs12 -export -clcerts \
        -in "$output_dir/${client_name}-cert.pem" \
        -inkey "$output_dir/${client_name}-key.pem" \
        -CAfile "$CERT_DIR/ca-cert.pem" \
        -out "$output_dir/${client_name}.p12" \
        -name "$client_name"
    
    # Cleanup CSR
    rm -f "$output_dir/${client_name}-csr.pem"
    
    # Set permissions
    chmod 600 "$output_dir/${client_name}-key.pem"
    chmod 644 "$output_dir/${client_name}-cert.pem"
    
    log "Client certificate generated: $output_dir/${client_name}.p12" "$GREEN"
}

# Setup Let's Encrypt
setup_letsencrypt() {
    local domain="$1"
    local email="$2"
    
    log "Setting up Let's Encrypt for domain: $domain" "$YELLOW"
    
    if ! command -v certbot &> /dev/null; then
        log "certbot not installed. Installing..." "$BLUE"
        if command -v apt &> /dev/null; then
            apt update && apt install -y certbot
        elif command -v yum &> /dev/null; then
            yum install -y certbot
        fi
    fi
    
    # Generate certificate
    certbot certonly \
        --standalone \
        --agree-tos \
        --email "$email" \
        -d "$domain" \
        -d "api.watershed-mapping.org" \
        -d "mapping.watershed-mapping.org"
    
    # Setup auto-renewal
    setup_auto_renewal
    
    log "Let's Encrypt setup completed" "$GREEN"
}

# Setup auto-renewal
setup_auto_renewal() {
    log "Setting up certificate auto-renewal..." "$BLUE"
    
    # Add to crontab
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx") | crontab -
    
    log "Auto-renewal configured" "$GREEN"
}

# Check certificate expiration
check_cert_expiration() {
    local cert_file="$1"
    
    if [[ ! -f "$cert_file" ]]; then
        log "Certificate file not found: $cert_file" "$RED"
        return 1
    fi
    
    local expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
    local expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch=$(date +%s)
    local days_left=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    echo "Certificate: $cert_file"
    echo "Expires: $expiry_date"
    echo "Days remaining: $days_left"
    
    if [[ $days_left -lt 30 ]]; then
        log "WARNING: Certificate expires in $days_left days!" "$RED"
        return 1
    else
        log "Certificate is valid for $days_left more days" "$GREEN"
        return 0
    fi
}

# Renew certificate
renew_certificate() {
    local cert_file="$1"
    local key_file="$2"
    
    log "Renewing certificate..." "$YELLOW"
    
    # Generate new CSR
    openssl req -new \
        -key "$key_file" \
        -out "/tmp/renewal-csr.pem" \
        -config "$WEB_CERT_DIR/server.conf" 2>/dev/null || \
        openssl req -new \
        -key "$key_file" \
        -out "/tmp/renewal-csr.pem" \
        -subj "/C=US/ST=State/L=City/O=Watershed Mapping Organization/OU=IT Department/CN=vpn.watershed-mapping.org"
    
    # Sign new certificate
    openssl x509 -req -days 825 \
        -in "/tmp/renewal-csr.pem" \
        -CA "$CERT_DIR/ca-cert.pem" \
        -CAkey "$CERT_DIR/ca-key.pem" \
        -CAcreateserial \
        -out "$cert_file" \
        -extensions v3_req \
        -extfile "$WEB_CERT_DIR/server.conf" 2>/dev/null || \
    openssl x509 -req -days 825 \
        -in "/tmp/renewal-csr.pem" \
        -CA "$CERT_DIR/ca-cert.pem" \
        -CAkey "$CERT_DIR/ca-key.pem" \
        -CAcreateserial \
        -out "$cert_file"
    
    # Cleanup
    rm -f "/tmp/renewal-csr.pem"
    
    log "Certificate renewed successfully" "$GREEN"
}

# Generate certificate bundle
generate_bundle() {
    log "Generating certificate bundle..." "$YELLOW"
    
    # Create full chain
    cat "$WEB_CERT_DIR/server-cert.pem" "$CERT_DIR/ca-cert.pem" > "$WEB_CERT_DIR/fullchain.pem"
    
    # Create nginx configuration
    generate_nginx_config
    
    log "Certificate bundle generated" "$GREEN"
}

# Generate nginx configuration
generate_nginx_config() {
    cat > /etc/nginx/sites-available/vpn-https << 'EOF'
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name vpn.watershed-mapping.org;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/watershed/web/fullchain.pem;
    ssl_certificate_key /etc/ssl/watershed/web/server-key.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # VPN management interface
    location / {
        root /var/www/vpn-management;
        index index.html;
        try_files $uri $uri/ =404;
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
    
    # Enable site
    ln -sf /etc/nginx/sites-available/vpn-https /etc/nginx/sites-enabled/
    
    # Test configuration
    nginx -t && log "Nginx configuration is valid" "$GREEN"
}

# Generate certificate status report
generate_status_report() {
    local report_file="/opt/vpn-ssl-status.txt"
    
    log "Generating certificate status report..." "$YELLOW"
    
    cat > "$report_file" << EOF
SSL Certificate Status Report - Watershed Disturbance Mapping System
================================================================

Generated: $(date)

CA Certificate:
Location: $CERT_DIR/ca-cert.pem
EOF
    
    # Check CA certificate
    if [[ -f "$CERT_DIR/ca-cert.pem" ]]; then
        check_cert_expiration "$CERT_DIR/ca-cert.pem" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

Server Certificate:
Location: $WEB_CERT_DIR/server-cert.pem
EOF
    
    # Check server certificate
    if [[ -f "$WEB_CERT_DIR/server-cert.pem" ]]; then
        check_cert_expiration "$WEB_CERT_DIR/server-cert.pem" >> "$report_file"
    fi
    
    cat >> "$report_file" << EOF

Client Certificates:
EOF
    
    # List client certificates
    if [[ -d "$VPN_CERT_DIR" ]]; then
        for cert in "$VPN_CERT_DIR"/*.p12; do
            if [[ -f "$cert" ]]; then
                echo "- $(basename "$cert")" >> "$report_file"
            fi
        done
    fi
    
    log "Status report generated: $report_file" "$GREEN"
}

# Backup certificates
backup_certificates() {
    local backup_dir="$CERT_DIR/backups/$(date +%Y%m%d_%H%M%S)"
    
    log "Backing up certificates to: $backup_dir" "$YELLOW"
    
    mkdir -p "$backup_dir"
    cp -r "$CERT_DIR"/* "$backup_dir/" 2>/dev/null || true
    
    # Create compressed backup
    tar -czf "${backup_dir}.tar.gz" -C "$CERT_DIR" .
    
    log "Backup completed: ${backup_dir}.tar.gz" "$GREEN"
}

# Restore certificates
restore_certificates() {
    local backup_file="$1"
    
    if [[ ! -f "$backup_file" ]]; then
        log "Backup file not found: $backup_file" "$RED"
        return 1
    fi
    
    log "Restoring certificates from: $backup_file" "$YELLOW"
    
    # Create current backup
    backup_certificates
    
    # Restore from backup
    tar -xzf "$backup_file" -C "$CERT_DIR"
    
    log "Certificates restored successfully" "$GREEN"
}

# Main menu
show_menu() {
    echo ""
    echo "=== SSL Certificate Management ==="
    echo "1) Initialize SSL management"
    echo "2) Generate CA certificate"
    echo "3) Generate server certificate"
    echo "4) Generate client certificate"
    echo "5) Setup Let's Encrypt"
    echo "6) Check certificate expiration"
    echo "7) Renew certificate"
    echo "8) Generate certificate bundle"
    echo "9) Generate status report"
    echo "10) Backup certificates"
    echo "11) Restore certificates"
    echo "0) Exit"
    echo ""
}

# Handle command line arguments
case "$1" in
    init)
        initialize_ssl
        ;;
    ca)
        generate_ca
        ;;
    server)
        generate_server_cert "${2:-vpn.watershed-mapping.org}"
        ;;
    client)
        generate_client_cert "$2" "$3"
        ;;
    letsencrypt)
        setup_letsencrypt "${2:-vpn.watershed-mapping.org}" "$3"
        ;;
    check)
        check_cert_expiration "$2"
        ;;
    renew)
        renew_certificate "$2" "$3"
        ;;
    bundle)
        generate_bundle
        ;;
    status)
        generate_status_report
        ;;
    backup)
        backup_certificates
        ;;
    restore)
        restore_certificates "$2"
        ;;
    *)
        echo "Usage: $0 {init|ca|server|client|letsencrypt|check|renew|bundle|status|backup|restore} [options]"
        echo ""
        echo "Commands:"
        echo "  init <domain>           - Initialize SSL management"
        echo "  ca                      - Generate CA certificate"
        echo "  server [domain]         - Generate server certificate"
        echo "  client <name> [dir]     - Generate client certificate"
        echo "  letsencrypt <domain> <email> - Setup Let's Encrypt"
        echo "  check <cert_file>       - Check certificate expiration"
        echo "  renew <cert> <key>      - Renew certificate"
        echo "  bundle                  - Generate certificate bundle"
        echo "  status                  - Generate status report"
        echo "  backup                  - Backup all certificates"
        echo "  restore <backup_file>   - Restore certificates"
        echo ""
        
        # Interactive mode
        while true; do
            show_menu
            read -p "Select option: " choice
            case $choice in
                1) initialize_ssl ;;
                2) generate_ca ;;
                3) read -p "Enter domain: " domain; generate_server_cert "$domain" ;;
                4) read -p "Enter client name: " name; generate_client_cert "$name" ;;
                5) read -p "Enter domain: " domain; read -p "Enter email: " email; setup_letsencrypt "$domain" "$email" ;;
                6) read -p "Enter certificate file: " cert; check_cert_expiration "$cert" ;;
                7) read -p "Enter certificate file: " cert; read -p "Enter key file: " key; renew_certificate "$cert" "$key" ;;
                8) generate_bundle ;;
                9) generate_status_report ;;
                10) backup_certificates ;;
                11) read -p "Enter backup file: " backup; restore_certificates "$backup" ;;
                0) exit 0 ;;
                *) echo "Invalid option" ;;
            esac
            echo ""
            read -p "Press Enter to continue..."
        done
        ;;
esac
