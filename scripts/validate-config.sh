#!/bin/bash
# Validate config.yml syntax and required fields

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

CONFIG_FILE="config.yml"

echo -e "${BLUE}Validating configuration...${NC}"
echo ""

# If config.yml doesn't exist, check for config.example.yml
if [ ! -f "$CONFIG_FILE" ] && [ -f "config.example.yml" ]; then
    echo -e "${YELLOW}config.yml not found. Copy config.example.yml to config.yml${NC}"
    echo "Run: cp config.example.yml config.yml"
    exit 1
fi

# Check if config exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}✗ config.yml not found!${NC}"
    echo "Run: ./scripts/setup-interactive.sh to create it"
    exit 1
fi

# Check for yq
if ! command -v yq &> /dev/null; then
    echo -e "${YELLOW}⚠️  yq not found, skipping YAML validation${NC}"
    echo "Install from: https://github.com/mikefarah/yq"
else
    # Validate YAML syntax
    if yq eval '.' $CONFIG_FILE > /dev/null 2>&1; then
        echo -e "${GREEN}✓ YAML syntax is valid${NC}"
    else
        echo -e "${RED}✗ YAML syntax error!${NC}"
        exit 1
    fi
    
    # Check required fields
    echo -e "${BLUE}Checking required fields...${NC}"
    
    ERRORS=0
    
    # Port
    PORT=$(yq eval '.app.port' $CONFIG_FILE)
    if [ "$PORT" = "null" ] || [ -z "$PORT" ]; then
        echo -e "${RED}✗ app.port is required${NC}"
        ERRORS=$((ERRORS + 1))
    elif [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
        echo -e "${RED}✗ app.port must be between 1-65535${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓ app.port: $PORT${NC}"
    fi
    
    # JWT Secret
    JWT=$(yq eval '.security.jwt_secret' $CONFIG_FILE)
    if [ "$JWT" = "change-me-in-production" ] || [ "$JWT" = "null" ]; then
        echo -e "${YELLOW}⚠️  security.jwt_secret should be changed!${NC}"
        echo "   Generate one with: openssl rand -hex 32"
    else
        echo -e "${GREEN}✓ security.jwt_secret is set${NC}"
    fi
    
    # Admin email
    EMAIL=$(yq eval '.admin.email' $CONFIG_FILE)
    if [ "$EMAIL" = "null" ] || [ -z "$EMAIL" ]; then
        echo -e "${RED}✗ admin.email is required${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓ admin.email: $EMAIL${NC}"
    fi
    
    # Database path
    DB_PATH=$(yq eval '.database.path' $CONFIG_FILE)
    if [ "$DB_PATH" = "null" ] || [ -z "$DB_PATH" ]; then
        echo -e "${RED}✗ database.path is required${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓ database.path: $DB_PATH${NC}"
    fi
    
    # Feature flags
    echo ""
    echo -e "${BLUE}Enabled features:${NC}"
    
    NGINX_EN=$(yq eval '.nginx.enabled' $CONFIG_FILE)
    [ "$NGINX_EN" = "true" ] && echo -e "${GREEN}  ✓ Nginx configuration${NC}" || echo -e "  ✗ Nginx configuration"
    
    EMAIL_EN=$(yq eval '.email.enabled' $CONFIG_FILE)
    [ "$EMAIL_EN" = "true" ] && echo -e "${GREEN}  ✓ Email management${NC}" || echo -e "  ✗ Email management"
    
    DNS_EN=$(yq eval '.dns.enabled' $CONFIG_FILE)
    [ "$DNS_EN" = "true" ] && echo -e "${GREEN}  ✓ DNS management${NC}" || echo -e "  ✗ DNS management"
    
    SSL_EN=$(yq eval '.ssl.enabled' $CONFIG_FILE)
    [ "$SSL_EN" = "true" ] && echo -e "${GREEN}  ✓ SSL management${NC}" || echo -e "  ✗ SSL management"
    
    echo ""
    
    if [ $ERRORS -gt 0 ]; then
        echo -e "${RED}✗ Validation failed with $ERRORS error(s)${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Configuration is valid!${NC}"
echo ""
echo -e "${BLUE}To apply configuration:${NC}"
echo "  1. ./scripts/config-to-env.sh"
echo "  2. Restart the application"

