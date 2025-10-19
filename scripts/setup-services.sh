#!/bin/bash
set -e

echo "Docker GUI Services Setup Script"
echo "===================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if config.yml exists
if [ ! -f config.yml ]; then
    echo -e "${YELLOW}WARNING: config.yml not found. Running interactive setup...${NC}"
    ./scripts/setup-interactive.sh
    echo ""
    echo -e "${YELLOW}Setup complete. Continuing with service deployment...${NC}"
    echo ""
fi

# Ensure .env is generated from config.yml
if [ ! -f .env ]; then
    echo -e "${BLUE}Generating .env from config.yml...${NC}"
    ./scripts/config-to-env.sh
fi

echo ""
echo "Select deployment mode:"
echo "1) Development (with MailHog - email testing)"
echo "2) Production (with Postfix - real email)"
echo "3) Simple (Docker GUI only)"
read -p "Enter choice [1-3]: " DEPLOY_MODE

case $DEPLOY_MODE in
    1)
        COMPOSE_FILE="docker-compose.full.yml"
        echo -e "${GREEN}Using MailHog for email (dev mode)${NC}"
        ;;
    2)
        COMPOSE_FILE="docker-compose.production.yml"
        echo -e "${YELLOW}Using Postfix for email (production mode)${NC}"
        echo -e "${YELLOW}WARNING: Make sure to configure SMTP relay in config.yml${NC}"
        ;;
    3)
        COMPOSE_FILE="docker-compose.prod.yml"
        echo -e "${GREEN}Simple setup - Docker GUI only${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice. Exiting.${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Starting services...${NC}"
docker-compose -f $COMPOSE_FILE up -d

echo ""
echo "Waiting for services to be healthy..."
sleep 5

# Check service status
echo ""
echo "Service Status:"
docker-compose -f $COMPOSE_FILE ps

echo ""
echo -e "${GREEN}Setup complete!${NC}"
echo ""
echo "Access Points:"
echo "  - Docker GUI: http://localhost:3000"

if [ "$DEPLOY_MODE" = "1" ] || [ "$DEPLOY_MODE" = "2" ]; then
    echo "  - Nginx Proxy: http://localhost:80"
    
    if [ "$DEPLOY_MODE" = "1" ]; then
        echo "  - MailHog UI: http://localhost:8025"
    fi
    
    echo "  - PowerDNS API: http://localhost:8081"
fi

echo ""
echo "Next Steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Login with your admin credentials from config.yml"
echo "  3. Start managing your Docker infrastructure!"

if [ "$DEPLOY_MODE" = "1" ]; then
    echo "  4. View test emails at http://localhost:8025"
fi

echo ""
echo "For more information, see:"
echo "  - docs/INSTALLATION.md - Installation guide"
echo "  - docs/DOCKER_SETUP.md - Docker services documentation"
echo "  - docs/CONFIGURATION.md - Configuration reference"
echo "  - config.yml - Main configuration file"

echo ""
echo -e "${GREEN}Installation complete!${NC}"

