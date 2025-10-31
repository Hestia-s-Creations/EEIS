# Watershed Disturbance Mapping System - SSL Certificate Management
# Automated SSL certificate generation and management for web interface

# ===============================================
# CONFIGURATION VARIABLES
# ===============================================

# Certificate paths
CERT_DIR="/etc/ssl/watershed"
WEB_CERT_DIR="/etc/ssl/watershed/web"
VPN_CERT_DIR="/etc/ssl/watershed/vpn"

# Domain configuration
DOMAIN="vpn.watershed-mapping.org"
ALT_NAMES="DNS.1=vpn.watershed-mapping.org,DNS.2=api.watershed-mapping.org,DNS.3=mapping.watershed-mapping.org"

# Organization details
ORG_NAME="Watershed Mapping Organization"
ORG_UNIT="IT Department"
CITY="City"
STATE="State"
COUNTRY="US"
EMAIL="admin@watershed-mapping.org"

# Certificate validity periods
CA_VALIDITY=3650  # 10 years
SERVER_VALIDITY=825  # ~2.25 years (recommended for Let's Encrypt)
CLIENT_VALIDITY=825  # ~2.25 years

# Key sizes and algorithms
RSA_KEY_SIZE=4096
ECC_CURVE="prime256v1"

# ===============================================
# OPENSSL CONFIGURATION
# ===============================================

# Create OpenSSL configuration file
cat > "$CERT_DIR/openssl.cnf" << 'EOF'
# Watershed Mapping System - OpenSSL Configuration

[req]
default_bits = 4096
default_md = sha256
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = Watershed Mapping Organization
OU = IT Department
CN = Watershed VPN Server
emailAddress = admin@watershed-mapping.org

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth, clientAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = vpn.watershed-mapping.org
DNS.2 = api.watershed-mapping.org
DNS.3 = mapping.watershed-mapping.org
DNS.4 = *.watershed-mapping.org
IP.1 = 10.8.0.1
IP.2 = 10.9.0.1

[v3_ca]
basicConstraints = critical, CA:true
keyUsage = critical, digitalSignature, cRLSign, keyCertSign

[v3_client]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
EOF

# Client configuration
cat > "$CERT_DIR/client.cnf" << 'EOF'
# Client certificate configuration

[req]
default_bits = 4096
default_md = sha256
distinguished_name = req_distinguished_name
req_extensions = v3_client_req
prompt = no

[req_distinguished_name]
C = US
ST = State
L = City
O = Watershed Mapping Organization
OU = Client Certificate
CN = Client

[v3_client_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth
EOF

# ===============================================
# CA CERTIFICATE GENERATION
# ===============================================

# Generate CA private key
generate_ca_key() {
    log "Generating CA private key..." "$YELLOW"
    openssl genrsa -out "$CERT_DIR/ca-key.pem" $RSA_KEY_SIZE
    chmod 600 "$CERT_DIR/ca-key.pem"
}

# Generate CA certificate
generate_ca_cert() {
    log "Generating CA certificate..." "$YELLOW"
    openssl req -new -x509 -days $CA_VALIDITY \
        -key "$CERT_DIR/ca-key.pem" \
        -out "$CERT_DIR/ca-cert.pem" \
        -config "$CERT_DIR/openssl.cnf" \
        -extensions v3_ca \
        -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG_NAME/OU=$ORG_UNIT/CN=$DOMAIN-CA/emailAddress=$EMAIL"
}

# ===============================================
# SERVER CERTIFICATE GENERATION
# ===============================================

# Generate server private key
generate_server_key() {
    log "Generating server private key..." "$YELLOW"
    openssl genrsa -out "$WEB_CERT_DIR/server-key.pem" $RSA_KEY_SIZE
    chmod 600 "$WEB_CERT_DIR/server-key.pem"
}

# Generate server certificate signing request
generate_server_csr() {
    log "Generating server certificate signing request..." "$YELLOW"
    openssl req -new \
        -key "$WEB_CERT_DIR/server-key.pem" \
        -out "$WEB_CERT_DIR/server-csr.pem" \
        -config "$CERT_DIR/openssl.cnf" \
        -extensions v3_req
}

# Sign server certificate
sign_server_cert() {
    log "Signing server certificate..." "$YELLOW"
    openssl x509 -req -days $SERVER_VALIDITY \
        -in "$WEB_CERT_DIR/server-csr.pem" \
        -CA "$CERT_DIR/ca-cert.pem" \
        -CAkey "$CERT_DIR/ca-key.pem" \
        -CAcreateserial \
        -out "$WEB_CERT_DIR/server-cert.pem" \
        -extensions v3_req \
        -extfile "$CERT_DIR/openssl.cnf"
}

# ===============================================
# CLIENT CERTIFICATE GENERATION
# ===============================================

# Generate client certificate
generate_client_cert() {
    local client_name="$1"
    local output_dir="$2"
    
    log "Generating client certificate for: $client_name" "$YELLOW"
    
    # Generate client key
    openssl genrsa -out "$output_dir/${client_name}-key.pem" $RSA_KEY_SIZE
    
    # Generate client CSR
    openssl req -new \
        -key "$output_dir/${client_name}-key.pem" \
        -out "$output_dir/${client_name}-csr.pem" \
        -config "$CERT_DIR/client.cnf" \
        -subj "/C=$COUNTRY/ST=$STATE/L=$CITY/O=$ORG_NAME/OU=Client/CN=$client_name"
    
    # Sign client certificate
    openssl x509 -req -days $CLIENT_VALIDITY \
        -in "$output_dir/${client_name}-csr.pem" \
        -CA "$CERT_DIR/ca-cert.pem" \
        -CAkey "$CERT_DIR/ca-key.pem" \
        -CAcreateserial \
        -out "$output_dir/${client_name}-cert.pem" \
        -extensions v3_client \
        -extfile "$CERT_DIR/client.cnf"
    
    # Create PKCS#12 bundle for easier client import
    openssl pkcs12 -export -clcerts \
        -in "$output_dir/${client_name}-cert.pem" \
        -inkey "$output_dir/${client_name}-key.pem" \
        -CAfile "$CERT_DIR/ca-cert.pem" \
        -out "$output_dir/${client_name}.p12" \
        -name "$client_name"
    
    # Cleanup CSR file
    rm -f "$output_dir/${client_name}-csr.pem"
    
    # Set permissions
    chmod 600 "$output_dir/${client_name}-key.pem"
    chmod 644 "$output_dir/${client_name}-cert.pem"
    
    log "Client certificate generated: $output_dir/${client_name}.p12" "$GREEN"
}

# ===============================================
# CERTIFICATE MANAGEMENT FUNCTIONS
# ===============================================

# Verify certificate
verify_cert() {
    local cert_file="$1"
    local ca_file="$2"
    
    log "Verifying certificate: $cert_file" "$BLUE"
    openssl verify -CAfile "$ca_file" "$cert_file"
}

# Check certificate expiration
check_expiration() {
    local cert_file="$1"
    local expiry_date=$(openssl x509 -enddate -noout -in "$cert_file" | cut -d= -f2)
    local expiry_epoch=$(date -d "$expiry_date" +%s)
    local current_epoch=$(date +%s)
    local days_left=$(( (expiry_epoch - current_epoch) / 86400 ))
    
    echo "Certificate expires: $expiry_date"
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
renew_cert() {
    local cert_file="$1"
    local key_file="$2"
    
    log "Renewing certificate..." "$YELLOW"
    
    # Generate new CSR with existing key
    openssl req -new \
        -key "$key_file" \
        -out "/tmp/renewal-csr.pem" \
        -config "$CERT_DIR/openssl.cnf"
    
    # Sign new certificate
    openssl x509 -req -days $SERVER_VALIDITY \
        -in "/tmp/renewal-csr.pem" \
        -CA "$CERT_DIR/ca-cert.pem" \
        -CAkey "$CERT_DIR/ca-key.pem" \
        -CAcreateserial \
        -out "$cert_file" \
        -extensions v3_req \
        -extfile "$CERT_DIR/openssl.cnf"
    
    # Cleanup
    rm -f "/tmp/renewal-csr.pem"
    
    log "Certificate renewed successfully" "$GREEN"
}

# ===============================================
# LETS ENCRYPT INTEGRATION (OPTIONAL)
# ===============================================

# Generate Let's Encrypt certificate
generate_letsencrypt() {
    if command -v certbot &> /dev/null; then
        log "Generating Let's Encrypt certificate..." "$YELLOW"
        certbot certonly \
            --standalone \
            --agree-tos \
            --email "$EMAIL" \
            -d "$DOMAIN" \
            -d "api.watershed-mapping.org" \
            -d "mapping.watershed-mapping.org"
    else
        log "certbot not found. Install with: apt install certbot" "$RED"
        return 1
    fi
}

# Auto-renew Let's Encrypt certificates
setup_auto_renewal() {
    if command -v certbot &> /dev/null; then
        log "Setting up auto-renewal for Let's Encrypt certificates..." "$BLUE"
        
        # Add to crontab
        (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet && systemctl reload nginx") | crontab -
        
        log "Auto-renewal configured (daily at noon)" "$GREEN"
    else
        log "certbot not available for auto-renewal setup" "$YELLOW"
    fi
}

# ===============================================
# EXPORT AND BACKUP FUNCTIONS
# ===============================================

# Export certificate bundle
export_bundle() {
    local output_file="$1"
    
    log "Exporting certificate bundle..." "$YELLOW"
    
    cat > "$output_file" << EOF
-----BEGIN CERTIFICATE-----
$(cat "$WEB_CERT_DIR/server-cert.pem")
-----END CERTIFICATE-----

-----BEGIN CERTIFICATE-----
$(cat "$CERT_DIR/ca-cert.pem")
-----END CERTIFICATE-----
EOF
    
    log "Certificate bundle exported: $output_file" "$GREEN"
}

# Backup all certificates
backup_certs() {
    local backup_dir="$CERT_DIR/backups/$(date +%Y%m%d_%H%M%S)"
    
    log "Backing up certificates to: $backup_dir" "$YELLOW"
    
    mkdir -p "$backup_dir"
    cp -r "$CERT_DIR"/* "$backup_dir/" 2>/dev/null || true
    tar -czf "${backup_dir}.tar.gz" -C "$CERT_DIR" . || true
    
    log "Backup completed: ${backup_dir}.tar.gz" "$GREEN"
}

# ===============================================
# WEB SERVER CONFIGURATION
# ===============================================

# Generate nginx configuration
generate_nginx_config() {
    cat > /etc/nginx/sites-available/vpn-https << 'EOF'
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    server_name vpn.watershed-mapping.org;
    
    # SSL Configuration
    ssl_certificate /etc/ssl/watershed/web/server-cert.pem;
    ssl_certificate_key /etc/ssl/watershed/web/server-key.pem;
    ssl_trusted_certificate /etc/ssl/watershed/ca-cert.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=63072000" always;
    
    # VPN management interface
    location / {
        root /var/www/vpn-management;
        index index.html;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/vpn-https /etc/nginx/sites-enabled/
    
    log "Nginx configuration generated" "$GREEN"
}

# Generate Apache configuration
generate_apache_config() {
    cat > /etc/apache2/sites-available/vpn-https.conf << 'EOF'
<VirtualHost *:443>
    ServerName vpn.watershed-mapping.org
    
    SSLEngine on
    SSLCertificateFile /etc/ssl/watershed/web/server-cert.pem
    SSLCertificateKeyFile /etc/ssl/watershed/web/server-key.pem
    SSLCertificateChainFile /etc/ssl/watershed/ca-cert.pem
    
    # Modern SSL configuration
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256
    SSLHonorCipherOrder off
    
    DocumentRoot /var/www/vpn-management
    
    <Directory /var/www/vpn-management>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
    
    # Security headers
    Header always set Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-Content-Type-Options "nosniff"
    
    ErrorLog ${APACHE_LOG_DIR}/vpn-ssl-error.log
    CustomLog ${APACHE_LOG_DIR}/vpn-ssl-access.log combined
</VirtualHost>
EOF

    # Enable SSL and headers modules
    a2enmod ssl headers
    a2ensite vpn-https
    
    log "Apache configuration generated" "$GREEN"
}
