#!/bin/bash
# Interactive Setup Script for Docker GUI
# This script guides users through configuration

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

CONFIG_FILE="config.yml"
CONFIG_EXAMPLE="config.example.yml"
ENV_FILE=".env"

echo -e "${BLUE}"
echo "======================================================"
echo "                                                      "
echo "        Docker GUI - Interactive Setup Wizard        "
echo "                                                      "
echo "======================================================"
echo -e "${NC}"

# Check if config.example.yml exists
if [ ! -f "$CONFIG_EXAMPLE" ]; then
    echo -e "${RED}ERROR: config.example.yml not found!${NC}"
    exit 1
fi

# Check if yq is available
install_yq() {
    if ! command -v yq &> /dev/null; then
        echo -e "${YELLOW}Installing yq for YAML processing...${NC}"
        case "$OSTYPE" in
            linux*)
                wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
                chmod +x /usr/local/bin/yq
                ;;
            darwin*)
                if command -v brew &> /dev/null; then
                    brew install yq
                else
                    wget -qO /usr/local/bin/yq https://github.com/mikefarah/yq/releases/latest/download/yq_darwin_amd64
                    chmod +x /usr/local/bin/yq
                fi
                ;;
        esac
        echo -e "${GREEN}✓ yq installed${NC}"
    fi
}

# Function to ask yes/no questions
ask_yes_no() {
    local question=$1
    local default=${2:-"n"}
    local answer
    
    if [ "$default" = "y" ]; then
        read -p "$(echo -e ${CYAN}$question [Y/n]: ${NC})" answer
        answer=${answer:-y}
    else
        read -p "$(echo -e ${CYAN}$question [y/N]: ${NC})" answer
        answer=${answer:-n}
    fi
    
    [[ "$answer" =~ ^[Yy]$ ]]
}

# Function to ask for input with default
ask_input() {
    local question=$1
    local default=$2
    local answer
    
    read -p "$(echo -e ${CYAN}$question [$default]: ${NC})" answer
    echo ${answer:-$default}
}

# Copy config template
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${GREEN}Creating config.yml from template...${NC}"
    cp $CONFIG_EXAMPLE $CONFIG_FILE
else
    if ask_yes_no "config.yml exists. Overwrite?" "n"; then
        echo -e "${YELLOW}Backing up existing config...${NC}"
        cp $CONFIG_FILE ${CONFIG_FILE}.backup.$(date +%Y%m%d_%H%M%S)
        cp $CONFIG_EXAMPLE $CONFIG_FILE
    else
        echo -e "${GREEN}Using existing config.yml${NC}"
        echo ""
        echo -e "${BLUE}Current configuration:${NC}"
        cat $CONFIG_FILE
        echo ""
        if ! ask_yes_no "Continue with this configuration?" "y"; then
            exit 0
        fi
        # Still run config-to-env at the end
        ./scripts/config-to-env.sh
        exit 0
    fi
fi

install_yq

echo ""
echo -e "${BLUE}--- Application Configuration ---${NC}"
echo ""

# Application port
APP_PORT=$(ask_input "Which port should the web UI run on?" "3000")
yq eval ".app.port = $APP_PORT" -i $CONFIG_FILE

# Hostname
APP_HOSTNAME=$(ask_input "Hostname to bind to (0.0.0.0 for all interfaces)" "0.0.0.0")
yq eval ".app.hostname = \"$APP_HOSTNAME\"" -i $CONFIG_FILE

# Environment
echo ""
echo "Select environment:"
echo "  1) Production (optimized, secure)"
echo "  2) Development (debug mode, hot reload)"
read -p "Choice [1]: " ENV_CHOICE
ENV_CHOICE=${ENV_CHOICE:-1}

if [ "$ENV_CHOICE" = "2" ]; then
    yq eval ".app.environment = \"development\"" -i $CONFIG_FILE
    yq eval ".app.log_level = \"debug\"" -i $CONFIG_FILE
else
    yq eval ".app.environment = \"production\"" -i $CONFIG_FILE
    yq eval ".app.log_level = \"info\"" -i $CONFIG_FILE
fi

echo ""
echo -e "${BLUE}--- Security Configuration ---${NC}"
echo ""

# Generate JWT secret
JWT_SECRET=$(openssl rand -hex 32)
yq eval ".security.jwt_secret = \"$JWT_SECRET\"" -i $CONFIG_FILE
echo -e "${GREEN}✓ Generated JWT secret${NC}"

# Admin user
echo ""
ADMIN_EMAIL=$(ask_input "Admin email address" "admin@example.com")
yq eval ".admin.email = \"$ADMIN_EMAIL\"" -i $CONFIG_FILE

ADMIN_NAME=$(ask_input "Admin user name" "Super Administrator")
yq eval ".admin.name = \"$ADMIN_NAME\"" -i $CONFIG_FILE

if ask_yes_no "Set admin password now? (leave empty to auto-generate)" "n"; then
    read -sp "$(echo -e ${CYAN}Enter admin password: ${NC})" ADMIN_PASSWORD
    echo ""
    yq eval ".admin.password = \"$ADMIN_PASSWORD\"" -i $CONFIG_FILE
else
    yq eval ".admin.password = \"\"" -i $CONFIG_FILE
    echo -e "${YELLOW}Password will be auto-generated and shown in logs${NC}"
fi

echo ""
echo -e "${BLUE}--- Feature Configuration ---${NC}"
echo ""

# Nginx
if ask_yes_no "Enable Nginx configuration management?" "y"; then
    yq eval ".nginx.enabled = true" -i $CONFIG_FILE
    yq eval ".features.nginx_config = true" -i $CONFIG_FILE
    
    NGINX_CONTAINER=$(ask_input "Nginx container name (if using Docker)" "nginx-proxy")
    yq eval ".nginx.container_name = \"$NGINX_CONTAINER\"" -i $CONFIG_FILE
    
    NGINX_PATH=$(ask_input "Nginx config path" "/etc/nginx-managed")
    yq eval ".nginx.config_path = \"$NGINX_PATH\"" -i $CONFIG_FILE
else
    yq eval ".nginx.enabled = false" -i $CONFIG_FILE
    yq eval ".features.nginx_config = false" -i $CONFIG_FILE
fi

# Email
echo ""
if ask_yes_no "Enable email notifications?" "n"; then
    yq eval ".email.enabled = true" -i $CONFIG_FILE
    yq eval ".features.email_management = true" -i $CONFIG_FILE
    
    echo ""
    echo "Email provider:"
    echo "  1) MailHog (Development - email testing)"
    echo "  2) Gmail"
    echo "  3) SendGrid"
    echo "  4) Custom SMTP"
    read -p "Choice [1]: " EMAIL_CHOICE
    EMAIL_CHOICE=${EMAIL_CHOICE:-1}
    
    case $EMAIL_CHOICE in
        1)
            yq eval ".email.smtp.host = \"mailhog\"" -i $CONFIG_FILE
            yq eval ".email.smtp.port = 1025" -i $CONFIG_FILE
            yq eval ".email.smtp.secure = false" -i $CONFIG_FILE
            echo -e "${GREEN}✓ Configured for MailHog${NC}"
            ;;
        2)
            GMAIL_USER=$(ask_input "Gmail address" "your-email@gmail.com")
            read -sp "$(echo -e ${CYAN}Gmail app password: ${NC})" GMAIL_PASS
            echo ""
            yq eval ".email.smtp.host = \"smtp.gmail.com\"" -i $CONFIG_FILE
            yq eval ".email.smtp.port = 587" -i $CONFIG_FILE
            yq eval ".email.smtp.secure = true" -i $CONFIG_FILE
            yq eval ".email.smtp.user = \"$GMAIL_USER\"" -i $CONFIG_FILE
            yq eval ".email.smtp.password = \"$GMAIL_PASS\"" -i $CONFIG_FILE
            echo -e "${GREEN}✓ Configured for Gmail${NC}"
            ;;
        3)
            read -sp "$(echo -e ${CYAN}SendGrid API key: ${NC})" SENDGRID_KEY
            echo ""
            yq eval ".email.smtp.host = \"smtp.sendgrid.net\"" -i $CONFIG_FILE
            yq eval ".email.smtp.port = 587" -i $CONFIG_FILE
            yq eval ".email.smtp.secure = true" -i $CONFIG_FILE
            yq eval ".email.smtp.user = \"apikey\"" -i $CONFIG_FILE
            yq eval ".email.smtp.password = \"$SENDGRID_KEY\"" -i $CONFIG_FILE
            echo -e "${GREEN}✓ Configured for SendGrid${NC}"
            ;;
        4)
            SMTP_HOST=$(ask_input "SMTP host" "smtp.example.com")
            SMTP_PORT=$(ask_input "SMTP port" "587")
            SMTP_USER=$(ask_input "SMTP username" "")
            read -sp "$(echo -e ${CYAN}SMTP password: ${NC})" SMTP_PASS
            echo ""
            SMTP_SECURE=$(ask_yes_no "Use TLS/SSL?" "y")
            
            yq eval ".email.smtp.host = \"$SMTP_HOST\"" -i $CONFIG_FILE
            yq eval ".email.smtp.port = $SMTP_PORT" -i $CONFIG_FILE
            yq eval ".email.smtp.secure = $SMTP_SECURE" -i $CONFIG_FILE
            yq eval ".email.smtp.user = \"$SMTP_USER\"" -i $CONFIG_FILE
            yq eval ".email.smtp.password = \"$SMTP_PASS\"" -i $CONFIG_FILE
            echo -e "${GREEN}✓ Custom SMTP configured${NC}"
            ;;
    esac
    
    EMAIL_FROM=$(ask_input "From email address" "noreply@yourdomain.com")
    yq eval ".email.smtp.from = \"$EMAIL_FROM\"" -i $CONFIG_FILE
else
    yq eval ".email.enabled = false" -i $CONFIG_FILE
    yq eval ".features.email_management = false" -i $CONFIG_FILE
fi

# DNS
echo ""
if ask_yes_no "Enable DNS/Domains?" "n"; then
    yq eval ".dns.enabled = true" -i $CONFIG_FILE
    yq eval ".features.domain_management = true" -i $CONFIG_FILE
    
    echo ""
    echo "DNS provider:"
    echo "  1) PowerDNS (Self-hosted)"
    echo "  2) Cloudflare"
    echo "  3) AWS Route53"
    read -p "Choice [1]: " DNS_CHOICE
    DNS_CHOICE=${DNS_CHOICE:-1}
    
    case $DNS_CHOICE in
        1)
            DNS_API_KEY=$(openssl rand -hex 16)
            yq eval ".dns.provider = \"powerdns\"" -i $CONFIG_FILE
            yq eval ".dns.api_url = \"http://localhost:8081\"" -i $CONFIG_FILE
            yq eval ".dns.api_key = \"$DNS_API_KEY\"" -i $CONFIG_FILE
            echo -e "${GREEN}✓ Configured for PowerDNS${NC}"
            ;;
        2)
            read -sp "$(echo -e ${CYAN}Cloudflare API token: ${NC})" CF_TOKEN
            echo ""
            yq eval ".dns.provider = \"cloudflare\"" -i $CONFIG_FILE
            yq eval ".dns.api_token = \"$CF_TOKEN\"" -i $CONFIG_FILE
            echo -e "${GREEN}✓ Configured for Cloudflare${NC}"
            ;;
        3)
            AWS_KEY=$(ask_input "AWS Access Key ID" "")
            read -sp "$(echo -e ${CYAN}AWS Secret Access Key: ${NC})" AWS_SECRET
            echo ""
            AWS_REGION=$(ask_input "AWS Region" "us-east-1")
            yq eval ".dns.provider = \"route53\"" -i $CONFIG_FILE
            yq eval ".dns.access_key_id = \"$AWS_KEY\"" -i $CONFIG_FILE
            yq eval ".dns.secret_access_key = \"$AWS_SECRET\"" -i $CONFIG_FILE
            yq eval ".dns.region = \"$AWS_REGION\"" -i $CONFIG_FILE
            echo -e "${GREEN}✓ Configured for AWS Route53${NC}"
            ;;
    esac
else
    yq eval ".dns.enabled = false" -i $CONFIG_FILE
    yq eval ".features.domain_management = false" -i $CONFIG_FILE
fi

# SSL
echo ""
if ask_yes_no "Enable SSL certificate management?" "n"; then
    yq eval ".ssl.enabled = true" -i $CONFIG_FILE
    yq eval ".features.ssl_management = true" -i $CONFIG_FILE
    
    SSL_EMAIL=$(ask_input "Email for SSL certificates" "$ADMIN_EMAIL")
    yq eval ".ssl.email = \"$SSL_EMAIL\"" -i $CONFIG_FILE
    
    if ask_yes_no "Use Let's Encrypt staging (for testing)?" "n"; then
        yq eval ".ssl.test_mode = true" -i $CONFIG_FILE
    else
        yq eval ".ssl.test_mode = false" -i $CONFIG_FILE
    fi
else
    yq eval ".ssl.enabled = false" -i $CONFIG_FILE
    yq eval ".features.ssl_management = false" -i $CONFIG_FILE
fi

# Performance tuning
echo ""
if ask_yes_no "Configure performance settings?" "n"; then
    STATS_INTERVAL=$(ask_input "Container stats refresh interval (ms)" "10000")
    yq eval ".performance.container_stats_interval = $STATS_INTERVAL" -i $CONFIG_FILE
    
    METRICS_RETENTION=$(ask_input "Metrics retention (days)" "30")
    yq eval ".performance.metrics_retention_days = $METRICS_RETENTION" -i $CONFIG_FILE
    
    LOG_RETENTION=$(ask_input "Log retention (days)" "7")
    yq eval ".performance.log_retention_days = $LOG_RETENTION" -i $CONFIG_FILE
fi

# Backup
echo ""
if ask_yes_no "Enable automatic backups?" "n"; then
    yq eval ".backup.enabled = true" -i $CONFIG_FILE
    
    BACKUP_PATH=$(ask_input "Backup storage path" "/var/backups/docker-gui")
    yq eval ".backup.path = \"$BACKUP_PATH\"" -i $CONFIG_FILE
    
    BACKUP_RETENTION=$(ask_input "Backup retention (days)" "7")
    yq eval ".backup.retention_days = $BACKUP_RETENTION" -i $CONFIG_FILE
    
    echo -e "${GREEN}✓ Backups configured${NC}"
    echo -e "${YELLOW}Note: Set up cron job for automatic backups${NC}"
else
    yq eval ".backup.enabled = false" -i $CONFIG_FILE
fi

# Generate .env from config.yml
echo ""
echo -e "${BLUE}Generating .env file from configuration...${NC}"

cat > $ENV_FILE <<EOF
# Generated from config.yml by setup script
# To modify, edit config.yml and run: ./scripts/config-to-env.sh

# Application
NODE_ENV=$(yq eval '.app.environment' $CONFIG_FILE)
PORT=$(yq eval '.app.port' $CONFIG_FILE)
HOSTNAME=$(yq eval '.app.hostname' $CONFIG_FILE)
LOG_LEVEL=$(yq eval '.app.log_level' $CONFIG_FILE)

# Security
JWT_SECRET=$(yq eval '.security.jwt_secret' $CONFIG_FILE)
AUTH_COOKIE_SECURE=$(yq eval '.security.cookie_secure' $CONFIG_FILE)
BCRYPT_SALT_ROUNDS=$(yq eval '.security.bcrypt_rounds' $CONFIG_FILE)

# Admin
DEFAULT_ADMIN_EMAIL=$(yq eval '.admin.email' $CONFIG_FILE)
DEFAULT_ADMIN_PASSWORD=$(yq eval '.admin.password' $CONFIG_FILE)
DEFAULT_ADMIN_NAME=$(yq eval '.admin.name' $CONFIG_FILE)

# Database
DATABASE_URL=$(yq eval '.database.path' $CONFIG_FILE | sed 's|^|file:|')

# Docker
DOCKER_HOST=$(yq eval '.docker.host' $CONFIG_FILE)
SYSTEM_METRICS_PROVIDER=$(yq eval '.docker.metrics_provider' $CONFIG_FILE)

# Nginx
NGINX_ENABLED=$(yq eval '.nginx.enabled' $CONFIG_FILE)
NGINX_CONTAINER_NAME=$(yq eval '.nginx.container_name' $CONFIG_FILE)
NGINX_CONFIG_PATH=$(yq eval '.nginx.config_path' $CONFIG_FILE)

# Email
EMAIL_ENABLED=$(yq eval '.email.enabled' $CONFIG_FILE)
SMTP_HOST=$(yq eval '.email.smtp.host' $CONFIG_FILE)
SMTP_PORT=$(yq eval '.email.smtp.port' $CONFIG_FILE)
SMTP_SECURE=$(yq eval '.email.smtp.secure' $CONFIG_FILE)
SMTP_USER=$(yq eval '.email.smtp.user' $CONFIG_FILE)
SMTP_PASSWORD=$(yq eval '.email.smtp.password' $CONFIG_FILE)
SMTP_FROM=$(yq eval '.email.smtp.from' $CONFIG_FILE)

# DNS
DNS_ENABLED=$(yq eval '.dns.enabled' $CONFIG_FILE)
DNS_PROVIDER=$(yq eval '.dns.provider' $CONFIG_FILE)
DNS_API_URL=$(yq eval '.dns.api_url' $CONFIG_FILE)
DNS_API_KEY=$(yq eval '.dns.api_key' $CONFIG_FILE)

# SSL
SSL_ENABLED=$(yq eval '.ssl.enabled' $CONFIG_FILE)
LETSENCRYPT_EMAIL=$(yq eval '.ssl.email' $CONFIG_FILE)
LETSENCRYPT_TEST=$(yq eval '.ssl.test_mode' $CONFIG_FILE)

# Performance
CONTAINER_STATS_INTERVAL=$(yq eval '.performance.container_stats_interval' $CONFIG_FILE)
METRICS_RETENTION_DAYS=$(yq eval '.performance.metrics_retention_days' $CONFIG_FILE)
LOG_RETENTION_DAYS=$(yq eval '.performance.log_retention_days' $CONFIG_FILE)

# Backup
BACKUP_ENABLED=$(yq eval '.backup.enabled' $CONFIG_FILE)
BACKUP_PATH=$(yq eval '.backup.path' $CONFIG_FILE)
BACKUP_RETENTION_DAYS=$(yq eval '.backup.retention_days' $CONFIG_FILE)
EOF

echo -e "${GREEN}✓ .env file generated${NC}"

echo ""
echo -e "${GREEN}=====================================================${NC}"
echo -e "${GREEN}                                                     ${NC}"
echo -e "${GREEN}           Configuration Complete!                   ${NC}"
echo -e "${GREEN}                                                     ${NC}"
echo -e "${GREEN}=====================================================${NC}"
echo ""
echo -e "${BLUE}Configuration saved to:${NC}"
echo "   - config.yml (main configuration - edit this)"
echo "   - .env (auto-generated from config.yml)"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "   1. Review and adjust config.yml if needed"
echo "   2. Run installation:"
echo "      With Docker:    ./scripts/setup-services.sh"
echo "      Without Docker: sudo ./scripts/install.sh"
echo ""
echo -e "${BLUE}If you have issues:${NC}"
echo "   - Edit config.yml manually"
echo "   - Run: ./scripts/config-to-env.sh"
echo "   - Validate: ./scripts/validate-config.sh"
echo ""
echo -e "${BLUE}To make changes later:${NC}"
echo "   1. Edit config.yml"
echo "   2. Run: ./scripts/config-to-env.sh"
echo "   3. Restart the application"
echo ""

