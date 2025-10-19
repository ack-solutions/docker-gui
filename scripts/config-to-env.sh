#!/bin/bash
# Convert config.yml to .env file
# Usage: ./scripts/config-to-env.sh

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

CONFIG_FILE="config.yml"
ENV_FILE=".env"

if [ ! -f "$CONFIG_FILE" ]; then
    if [ -f "config.example.yml" ]; then
        echo "config.yml not found. Creating from config.example.yml..."
        cp config.example.yml config.yml
        echo "IMPORTANT: Edit config.yml with your settings before continuing"
        echo "Or run: ./scripts/setup-interactive.sh for guided setup"
        exit 1
    else
        echo "ERROR: Neither config.yml nor config.example.yml found!"
        echo "Run: ./scripts/setup-interactive.sh to create configuration"
        exit 1
    fi
fi

# Check for yq
if ! command -v yq &> /dev/null; then
    echo "ERROR: yq is required. Install it from: https://github.com/mikefarah/yq"
    exit 1
fi

echo -e "${BLUE}Converting config.yml to .env...${NC}"

# Backup existing .env
if [ -f "$ENV_FILE" ]; then
    cp $ENV_FILE ${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)
    echo "Backed up existing .env"
fi

# Generate .env
cat > $ENV_FILE <<EOF
# Generated from config.yml
# Last updated: $(date)
# To modify: Edit config.yml and run ./scripts/config-to-env.sh

# Application
NODE_ENV=$(yq eval '.app.environment' $CONFIG_FILE)
PORT=$(yq eval '.app.port' $CONFIG_FILE)
HOSTNAME=$(yq eval '.app.hostname' $CONFIG_FILE)
LOG_LEVEL=$(yq eval '.app.log_level' $CONFIG_FILE)

# Security
JWT_SECRET=$(yq eval '.security.jwt_secret' $CONFIG_FILE)
AUTH_COOKIE_SECURE=$(yq eval '.security.cookie_secure' $CONFIG_FILE)
BCRYPT_SALT_ROUNDS=$(yq eval '.security.bcrypt_rounds' $CONFIG_FILE)

# Admin User
DEFAULT_ADMIN_EMAIL=$(yq eval '.admin.email' $CONFIG_FILE)
DEFAULT_ADMIN_PASSWORD=$(yq eval '.admin.password' $CONFIG_FILE)
DEFAULT_ADMIN_NAME=$(yq eval '.admin.name' $CONFIG_FILE)

# Database
DATABASE_TYPE=$(yq eval '.database.type' $CONFIG_FILE)
DATABASE_URL=$(yq eval '.database.path' $CONFIG_FILE | sed 's|^|file:|')

# Docker
DOCKER_HOST=$(yq eval '.docker.host' $CONFIG_FILE)
SYSTEM_METRICS_PROVIDER=$(yq eval '.docker.metrics_provider' $CONFIG_FILE)

# Nginx
NGINX_ENABLED=$(yq eval '.nginx.enabled' $CONFIG_FILE)
NGINX_CONTAINER_NAME=$(yq eval '.nginx.container_name' $CONFIG_FILE)
NGINX_CONFIG_PATH=$(yq eval '.nginx.config_path' $CONFIG_FILE)
NGINX_RELOAD_COMMAND=$(yq eval '.nginx.reload_command' $CONFIG_FILE)

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
SSL_PROVIDER=$(yq eval '.ssl.provider' $CONFIG_FILE)
LETSENCRYPT_EMAIL=$(yq eval '.ssl.email' $CONFIG_FILE)
LETSENCRYPT_TEST=$(yq eval '.ssl.test_mode' $CONFIG_FILE)
SSL_AUTO_RENEW=$(yq eval '.ssl.auto_renew' $CONFIG_FILE)

# Features
FEATURE_NGINX=$(yq eval '.features.nginx_config' $CONFIG_FILE)
FEATURE_DOMAINS=$(yq eval '.features.domain_management' $CONFIG_FILE)
FEATURE_EMAIL=$(yq eval '.features.email_management' $CONFIG_FILE)
FEATURE_SSL=$(yq eval '.features.ssl_management' $CONFIG_FILE)
FEATURE_PROXY=$(yq eval '.features.proxy_management' $CONFIG_FILE)

# Performance
CONTAINER_STATS_INTERVAL=$(yq eval '.performance.container_stats_interval' $CONFIG_FILE)
METRICS_RETENTION_DAYS=$(yq eval '.performance.metrics_retention_days' $CONFIG_FILE)
LOG_RETENTION_DAYS=$(yq eval '.performance.log_retention_days' $CONFIG_FILE)
MAX_LOG_LINES=$(yq eval '.performance.max_log_lines' $CONFIG_FILE)

# Backup
BACKUP_ENABLED=$(yq eval '.backup.enabled' $CONFIG_FILE)
BACKUP_SCHEDULE=$(yq eval '.backup.schedule' $CONFIG_FILE)
BACKUP_RETENTION_DAYS=$(yq eval '.backup.retention_days' $CONFIG_FILE)
BACKUP_PATH=$(yq eval '.backup.path' $CONFIG_FILE)
EOF

echo -e "${GREEN}✓ .env file generated successfully!${NC}"
echo ""
echo "Configuration applied:"
echo "  Port: $(yq eval '.app.port' $CONFIG_FILE)"
echo "  Environment: $(yq eval '.app.environment' $CONFIG_FILE)"
echo "  Nginx: $(yq eval '.nginx.enabled' $CONFIG_FILE)"
echo "  Email: $(yq eval '.email.enabled' $CONFIG_FILE)"
echo "  DNS: $(yq eval '.dns.enabled' $CONFIG_FILE)"
echo "  SSL: $(yq eval '.ssl.enabled' $CONFIG_FILE)"
echo ""
echo -e "${BLUE}Restart the service to apply changes${NC}"

