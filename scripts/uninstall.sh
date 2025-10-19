#!/bin/bash
# Docker GUI - Uninstallation Script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="/opt/docker-gui"
DATA_DIR="/var/lib/docker-gui"
LOG_DIR="/var/log/docker-gui"
SERVICE_USER="dockergui"

# Detect OS
if [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    OS="linux"
fi

echo -e "${RED}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${RED}║                                                    ║${NC}"
echo -e "${RED}║        Docker GUI - Uninstallation                 ║${NC}"
echo -e "${RED}║                                                    ║${NC}"
echo -e "${RED}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will remove Docker GUI and all its data!${NC}"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to confirm) " -r
echo
if [[ ! $REPLY == "yes" ]]; then
    echo "Uninstallation cancelled."
    exit 0
fi

# Create backup option
echo ""
read -p "Create backup before uninstalling? (Y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    if [ -f "./scripts/backup.sh" ]; then
        echo "Creating backup..."
        ./scripts/backup.sh || echo -e "${YELLOW}Backup failed, continuing...${NC}"
    else
        echo -e "${YELLOW}Backup script not found, skipping...${NC}"
    fi
fi

echo ""
echo -e "${BLUE}Uninstalling Docker GUI...${NC}"

# Stop and remove service
if [[ "$OS" == "macos" ]]; then
    echo "Stopping launchd service..."
    launchctl unload /Library/LaunchDaemons/com.dockergui.app.plist 2>/dev/null || true
    rm -f /Library/LaunchDaemons/com.dockergui.app.plist
    echo -e "${GREEN}✓ Service removed${NC}"
else
    echo "Stopping systemd service..."
    systemctl stop docker-gui 2>/dev/null || true
    systemctl disable docker-gui 2>/dev/null || true
    rm -f /etc/systemd/system/docker-gui.service
    systemctl daemon-reload
    echo -e "${GREEN}✓ Service removed${NC}"
fi

# Remove Nginx config
if [ -f /etc/nginx/sites-enabled/docker-gui ]; then
    echo "Removing Nginx configuration..."
    rm -f /etc/nginx/sites-enabled/docker-gui
    rm -f /etc/nginx/sites-available/docker-gui
    nginx -t && nginx -s reload || true
    echo -e "${GREEN}✓ Nginx config removed${NC}"
fi

# Remove application files
echo "Removing application files..."
rm -rf $APP_DIR
echo -e "${GREEN}✓ Application files removed${NC}"

# Ask about data removal
echo ""
read -p "Remove data directory ($DATA_DIR)? This deletes the database! (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf $DATA_DIR
    echo -e "${GREEN}✓ Data directory removed${NC}"
else
    echo -e "${YELLOW}⚠️  Data directory preserved at $DATA_DIR${NC}"
fi

# Remove logs
echo "Removing logs..."
rm -rf $LOG_DIR
echo -e "${GREEN}✓ Logs removed${NC}"

# Remove user
if id "$SERVICE_USER" &>/dev/null; then
    echo "Removing service user..."
    if [[ "$OS" == "macos" ]]; then
        dscl . -delete /Users/$SERVICE_USER 2>/dev/null || true
    else
        userdel $SERVICE_USER 2>/dev/null || true
    fi
    echo -e "${GREEN}✓ Service user removed${NC}"
fi

echo ""
echo -e "${GREEN}✓ Uninstallation complete!${NC}"
echo ""
if [ -d "$DATA_DIR" ]; then
    echo -e "${YELLOW}📁 Data preserved at: $DATA_DIR${NC}"
    echo "   To completely remove: sudo rm -rf $DATA_DIR"
fi

