#!/bin/bash
# Docker GUI - Native Installation Script
# Supports: Ubuntu/Debian, CentOS/RHEL, macOS
# Requirements: sudo access, internet connection

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="docker-gui"
APP_DIR="/opt/docker-gui"
DATA_DIR="/var/lib/docker-gui"
LOG_DIR="/var/log/docker-gui"
SERVICE_USER="dockergui"
NODE_VERSION="22"
REQUIRED_NODE_VERSION="18.18.0"

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            OS=$ID
            VERSION=$VERSION_ID
        else
            echo -e "${RED}Unable to detect Linux distribution${NC}"
            exit 1
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        VERSION=$(sw_vers -productVersion)
    else
        echo -e "${RED}Unsupported operating system: $OSTYPE${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Detected OS: $OS $VERSION${NC}"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo -e "${RED}This script must be run as root (use sudo)${NC}"
        exit 1
    fi
}

# Install Node.js
install_nodejs() {
    echo -e "${BLUE}Installing Node.js ${NODE_VERSION}...${NC}"
    
    if command -v node &> /dev/null; then
        CURRENT_VERSION=$(node -v | sed 's/v//')
        if [ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$CURRENT_VERSION" | sort -V | head -n1)" = "$REQUIRED_NODE_VERSION" ]; then
            echo -e "${GREEN}✓ Node.js $(node -v) is already installed${NC}"
            return
        fi
    fi
    
    case $OS in
        ubuntu|debian)
            curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
            apt-get install -y nodejs
            ;;
        centos|rhel|fedora)
            curl -fsSL https://rpm.nodesource.com/setup_${NODE_VERSION}.x | bash -
            yum install -y nodejs
            ;;
        macos)
            if ! command -v brew &> /dev/null; then
                echo -e "${YELLOW}Installing Homebrew...${NC}"
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            brew install node@${NODE_VERSION}
            ;;
    esac
    
    echo -e "${GREEN}✓ Node.js installed: $(node -v)${NC}"
}

# Install Yarn
install_yarn() {
    echo -e "${BLUE}Installing Yarn...${NC}"
    
    if command -v yarn &> /dev/null; then
        echo -e "${GREEN}✓ Yarn is already installed: $(yarn -v)${NC}"
        return
    fi
    
    npm install -g yarn
    echo -e "${GREEN}✓ Yarn installed: $(yarn -v)${NC}"
}

# Install system dependencies
install_dependencies() {
    echo -e "${BLUE}Installing system dependencies...${NC}"
    
    case $OS in
        ubuntu|debian)
            apt-get update
            apt-get install -y \
                build-essential \
                python3 \
                pkg-config \
                libcairo2-dev \
                libjpeg-dev \
                libpango1.0-dev \
                libgif-dev \
                libsqlite3-dev \
                git \
                curl \
                wget \
                nginx \
                sqlite3
            ;;
        centos|rhel|fedora)
            yum groupinstall -y "Development Tools"
            yum install -y \
                python3 \
                pkg-config \
                cairo-devel \
                libjpeg-turbo-devel \
                pango-devel \
                giflib-devel \
                sqlite-devel \
                git \
                curl \
                wget \
                nginx \
                sqlite
            ;;
        macos)
            brew install \
                pkg-config \
                cairo \
                pango \
                libpng \
                jpeg \
                giflib \
                librsvg \
                sqlite3 \
                nginx
            ;;
    esac
    
    echo -e "${GREEN}✓ System dependencies installed${NC}"
}

# Create service user
create_user() {
    echo -e "${BLUE}Creating service user...${NC}"
    
    if id "$SERVICE_USER" &>/dev/null; then
        echo -e "${GREEN}✓ User $SERVICE_USER already exists${NC}"
        return
    fi
    
    case $OS in
        ubuntu|debian|centos|rhel|fedora)
            useradd -r -s /bin/false -d $APP_DIR $SERVICE_USER
            # Add to docker group if exists
            if getent group docker > /dev/null 2>&1; then
                usermod -aG docker $SERVICE_USER
            fi
            ;;
        macos)
            # macOS user creation
            dscl . -create /Users/$SERVICE_USER
            dscl . -create /Users/$SERVICE_USER UserShell /usr/bin/false
            dscl . -create /Users/$SERVICE_USER RealName "Docker GUI Service"
            dscl . -create /Users/$SERVICE_USER UniqueID 510
            dscl . -create /Users/$SERVICE_USER PrimaryGroupID 20
            dscl . -create /Users/$SERVICE_USER NFSHomeDirectory $APP_DIR
            ;;
    esac
    
    echo -e "${GREEN}✓ User $SERVICE_USER created${NC}"
}

# Create directories
create_directories() {
    echo -e "${BLUE}Creating application directories...${NC}"
    
    mkdir -p $APP_DIR
    mkdir -p $DATA_DIR
    mkdir -p $LOG_DIR
    mkdir -p /etc/nginx-managed
    mkdir -p /etc/ssl-managed
    
    # Set permissions
    chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
    chown -R $SERVICE_USER:$SERVICE_USER $DATA_DIR
    chown -R $SERVICE_USER:$SERVICE_USER $LOG_DIR
    
    echo -e "${GREEN}✓ Directories created${NC}"
}

# Install application
install_app() {
    echo -e "${BLUE}Installing Docker GUI application...${NC}"
    
    # Copy application files
    cp -r ./* $APP_DIR/
    cd $APP_DIR
    
    # Install dependencies
    echo "Installing npm packages..."
    sudo -u $SERVICE_USER yarn install --frozen-lockfile
    
    # Build application
    echo "Building application..."
    sudo -u $SERVICE_USER yarn build
    
    # Run migrations
    echo "Running database migrations..."
    sudo -u $SERVICE_USER yarn db:migrate
    
    # Seed database
    echo "Seeding database..."
    sudo -u $SERVICE_USER yarn db:seed
    
    echo -e "${GREEN}✓ Application installed${NC}"
}

# Setup configuration
setup_config() {
    echo -e "${BLUE}Configuring application...${NC}"
    
    # Copy config.example.yml to config.yml if not exists
    if [ ! -f "$APP_DIR/config.yml" ]; then
        if [ -f "$APP_DIR/config.example.yml" ]; then
            cp $APP_DIR/config.example.yml $APP_DIR/config.yml
            
            # Auto-configure for production
            if command -v yq &> /dev/null; then
                # Generate secure secrets
                JWT_SECRET=$(openssl rand -hex 32)
                DNS_KEY=$(openssl rand -hex 16)
                
                yq eval ".security.jwt_secret = \"$JWT_SECRET\"" -i $APP_DIR/config.yml
                yq eval ".dns.api_key = \"$DNS_KEY\"" -i $APP_DIR/config.yml
                yq eval ".app.environment = \"production\"" -i $APP_DIR/config.yml
                yq eval ".database.path = \"$DATA_DIR/docker-gui.db\"" -i $APP_DIR/config.yml
                
                echo -e "${GREEN}✓ Configuration auto-generated${NC}"
            else
                echo -e "${YELLOW}WARNING: yq not available, using defaults${NC}"
                echo -e "${YELLOW}Edit $APP_DIR/config.yml manually${NC}"
            fi
            
            chown $SERVICE_USER:$SERVICE_USER $APP_DIR/config.yml
            chmod 600 $APP_DIR/config.yml
        else
            echo -e "${RED}ERROR: config.example.yml not found!${NC}"
            exit 1
        fi
    else
        echo -e "${GREEN}config.yml already exists${NC}"
    fi
    
    # Generate .env from config.yml
    echo "Generating .env from config.yml..."
    cd $APP_DIR
    if [ -f "./scripts/config-to-env.sh" ]; then
        sudo -u $SERVICE_USER bash ./scripts/config-to-env.sh
    else
        echo -e "${YELLOW}WARNING: config-to-env.sh not found, .env may need manual creation${NC}"
    fi
}

# Create systemd service (Linux)
create_systemd_service() {
    echo -e "${BLUE}Creating systemd service...${NC}"
    
    cat > /etc/systemd/system/docker-gui.service <<EOF
[Unit]
Description=Docker GUI - Web interface for Docker management
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node $APP_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=append:$LOG_DIR/docker-gui.log
StandardError=append:$LOG_DIR/docker-gui-error.log

# Security
NoNewPrivileges=true
PrivateTmp=true

# Resource limits
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable docker-gui
    
    echo -e "${GREEN}✓ Systemd service created${NC}"
}

# Create launchd service (macOS)
create_launchd_service() {
    echo -e "${BLUE}Creating launchd service...${NC}"
    
    cat > /Library/LaunchDaemons/com.dockergui.app.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.dockergui.app</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>$APP_DIR/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$APP_DIR</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/docker-gui.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/docker-gui-error.log</string>
</dict>
</plist>
EOF

    launchctl load /Library/LaunchDaemons/com.dockergui.app.plist
    
    echo -e "${GREEN}✓ Launchd service created${NC}"
}

# Configure Nginx
setup_nginx() {
    echo -e "${BLUE}Configuring Nginx...${NC}"
    
    # Create Nginx config
    cat > /etc/nginx/sites-available/docker-gui <<'EOF'
upstream docker_gui {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://docker_gui;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        
        client_max_body_size 100M;
    }
}
EOF

    # Enable site
    if [ -d /etc/nginx/sites-enabled ]; then
        ln -sf /etc/nginx/sites-available/docker-gui /etc/nginx/sites-enabled/
    fi
    
    # Test Nginx config
    nginx -t
    
    # Reload Nginx
    if command -v systemctl &> /dev/null; then
        systemctl reload nginx
    else
        nginx -s reload
    fi
    
    echo -e "${GREEN}✓ Nginx configured${NC}"
}

# Display summary
show_summary() {
    echo ""
    echo -e "${GREEN}====================================================${NC}"
    echo -e "${GREEN}                                                    ${NC}"
    echo -e "${GREEN}     Docker GUI Installation Complete!             ${NC}"
    echo -e "${GREEN}                                                    ${NC}"
    echo -e "${GREEN}====================================================${NC}"
    echo ""
    echo -e "${BLUE}Installation Details:${NC}"
    echo "   Application: $APP_DIR"
    echo "   Data: $DATA_DIR"
    echo "   Logs: $LOG_DIR"
    echo "   User: $SERVICE_USER"
    echo ""
    echo -e "${BLUE}Access:${NC}"
    echo "   Local: http://localhost:3000"
    echo "   Via Nginx: http://localhost"
    echo ""
    echo -e "${BLUE}Admin Credentials:${NC}"
    echo "   Check $APP_DIR/config.yml for admin email and password"
    echo "   If password is empty, check logs: sudo journalctl -u docker-gui -n 50"
    echo ""
    echo -e "${BLUE}Service Management:${NC}"
    
    if [[ "$OS" == "macos" ]]; then
        echo "   Start:   sudo launchctl start com.dockergui.app"
        echo "   Stop:    sudo launchctl stop com.dockergui.app"
        echo "   Status:  sudo launchctl list | grep dockergui"
        echo "   Logs:    tail -f $LOG_DIR/docker-gui.log"
    else
        echo "   Start:   sudo systemctl start docker-gui"
        echo "   Stop:    sudo systemctl stop docker-gui"
        echo "   Restart: sudo systemctl restart docker-gui"
        echo "   Status:  sudo systemctl status docker-gui"
        echo "   Logs:    sudo journalctl -u docker-gui -f"
    fi
    
    echo ""
    echo -e "${BLUE}Updates:${NC}"
    echo "   cd $APP_DIR && git pull && yarn install && yarn build"
    echo "   Then restart the service"
    echo ""
    echo -e "${BLUE}Documentation:${NC}"
    echo "   Installation: $APP_DIR/INSTALLATION.md"
    echo "   Quick Start: $APP_DIR/QUICK_START.md"
    echo "   Docker Setup: $APP_DIR/DOCKER_SETUP.md"
    echo ""
    echo -e "${GREEN}Installation complete!${NC}"
}

# Main installation flow
main() {
    echo -e "${BLUE}====================================================${NC}"
    echo -e "${BLUE}                                                    ${NC}"
    echo -e "${BLUE}        Docker GUI - Native Installation           ${NC}"
    echo -e "${BLUE}                                                    ${NC}"
    echo -e "${BLUE}====================================================${NC}"
    echo ""
    
    detect_os
    check_root
    
    echo ""
    read -p "This will install Docker GUI to $APP_DIR. Continue? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    
    echo ""
    echo -e "${BLUE}Starting installation...${NC}"
    echo ""
    
    # Installation steps
    install_nodejs
    install_yarn
    install_dependencies
    create_user
    create_directories
    install_app
    setup_config
    
    # Create service
    if [[ "$OS" == "macos" ]]; then
        create_launchd_service
    else
        create_systemd_service
    fi
    
    # Optional: Setup Nginx
    echo ""
    read -p "Configure Nginx reverse proxy? (recommended) (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        setup_nginx
    fi
    
    # Start service
    echo ""
    read -p "Start Docker GUI service now? (Y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Nn]$ ]]; then
        if [[ "$OS" == "macos" ]]; then
            launchctl start com.dockergui.app
        else
            systemctl start docker-gui
        fi
        echo -e "${GREEN}✓ Service started${NC}"
        sleep 2
        
        # Check if service is running
        if [[ "$OS" == "macos" ]]; then
            if launchctl list | grep -q dockergui; then
                echo -e "${GREEN}✓ Service is running${NC}"
            else
                echo -e "${YELLOW}⚠️  Service may not be running. Check logs.${NC}"
            fi
        else
            systemctl --no-pager status docker-gui || true
        fi
    fi
    
    show_summary
}

# Run main installation
main

