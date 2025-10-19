# Installation Guide

This guide covers all installation methods for Docker GUI, whether you want to use Docker or install natively on your system.

## Quick Start

### Method 1: Interactive Setup (Recommended)

```bash
# Clone repository
git clone <repository-url>
cd docker-gui

# Run interactive setup
./scripts/setup-interactive.sh

# Follow the prompts to configure:
# - Web UI port
# - Admin credentials
# - Nginx integration
# - Email settings
# - DNS management
# - SSL certificates
# - Performance tuning
```

This creates `config.yml` with all your settings and generates `.env` automatically.

### Method 2: Quick Docker Setup

```bash
./scripts/setup-services.sh
```

Choose deployment mode:
1. Development (with MailHog)
2. Production (with Postfix)
3. Simple (Docker GUI only)

### Method 3: Native Installation (No Docker)

```bash
# Linux/macOS
sudo ./scripts/install.sh

# Windows (Run as Administrator)
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

---

## Installation Methods Comparison

| Feature | Docker | Native | Interactive |
|---------|--------|--------|-------------|
| Easy setup | ✅ | ⚠️ | ✅ |
| No dependencies | ✅ | ❌ | ✅ |
| Custom port | ⚠️ | ✅ | ✅ |
| Full control | ⚠️ | ✅ | ✅ |
| Auto-updates | ✅ | ⚠️ | ⚠️ |
| Nginx included | ✅ | ✅ | ✅ |
| Email server | ✅ | ⚠️ | ✅ |
| DNS server | ✅ | ⚠️ | ✅ |

---

## Detailed Installation

### 🐳 Docker Installation (Recommended)

#### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 2GB RAM minimum
- 10GB disk space

#### Steps

**1. Clone and Configure**
```bash
git clone <repository-url>
cd docker-gui
./scripts/setup-interactive.sh
```

**2. Choose Deployment**

**Simple (GUI only):**
```bash
docker-compose up -d
```

**Full Stack (GUI + Nginx + Email + DNS):**
```bash
docker-compose -f docker-compose.full.yml up -d
```

**Production:**
```bash
docker-compose -f docker-compose.production.yml up -d
```

**3. Access**
- Web UI: http://localhost:3000
- MailHog (if using full): http://localhost:8025
- PowerDNS API (if using full): http://localhost:8081

---

### 💻 Native Installation (Without Docker)

#### Linux (Ubuntu/Debian)

**Prerequisites:**
```bash
sudo apt-get update
sudo apt-get install -y curl git build-essential python3
```

**Installation:**
```bash
# 1. Interactive configuration
./scripts/setup-interactive.sh

# 2. Install as system service
sudo ./scripts/install.sh
```

**What it does:**
- Installs Node.js 22
- Installs system dependencies
- Creates service user `dockergui`
- Installs app to `/opt/docker-gui`
- Creates systemd service
- Configures Nginx (optional)
- Starts the service

**Service Management:**
```bash
sudo systemctl start docker-gui
sudo systemctl stop docker-gui
sudo systemctl restart docker-gui
sudo systemctl status docker-gui

# View logs
sudo journalctl -u docker-gui -f
```

#### macOS

**Prerequisites:**
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**Installation:**
```bash
# 1. Interactive configuration
./scripts/setup-interactive.sh

# 2. Install as system service
sudo ./scripts/install.sh
```

**Service Management:**
```bash
sudo launchctl start com.dockergui.app
sudo launchctl stop com.dockergui.app

# View logs
tail -f /var/log/docker-gui/docker-gui.log
```

#### Windows

**Prerequisites:**
- Windows 10/11
- Administrator access
- PowerShell 5.1+

**Installation:**
```powershell
# Run as Administrator
powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
```

**Service Management:**
```powershell
# Using Windows Services GUI
services.msc

# Or PowerShell
Start-Service DockerGUI
Stop-Service DockerGUI
Restart-Service DockerGUI
Get-Service DockerGUI
```

---

## Configuration

### config.yml (Main Configuration)

All settings are in `config.yml`:

```yaml
app:
  port: 3000          # Web UI port
  hostname: "0.0.0.0" # Bind address
  environment: "production"

security:
  jwt_secret: "auto-generated"
  cookie_secure: true
  bcrypt_rounds: 12

admin:
  email: "admin@example.com"
  password: ""  # Leave empty to auto-generate
  name: "Administrator"

# ... more settings
```

### Changing Configuration

**1. Edit config.yml:**
```bash
nano config.yml
# or
vim config.yml
```

**2. Regenerate .env:**
```bash
./scripts/config-to-env.sh
```

**3. Restart service:**
```bash
# Docker
docker-compose restart

# Native Linux
sudo systemctl restart docker-gui

# Native macOS
sudo launchctl stop com.dockergui.app
sudo launchctl start com.dockergui.app

# Windows
Restart-Service DockerGUI
```

### Changing Port

**Option 1: Edit config.yml**
```yaml
app:
  port: 8080  # Change from 3000 to 8080
```

Then run:
```bash
./scripts/config-to-env.sh
# Restart service
```

**Option 2: Edit .env directly**
```bash
PORT=8080
```

**Option 3: Docker port mapping**
```yaml
# docker-compose.yml
ports:
  - "8080:3000"  # External:Internal
```

---

## Feature Configuration

### Enable/Disable Features

Edit `config.yml`:

```yaml
features:
  containers: true
  images: true
  volumes: true
  networks: true
  logs: true
  terminal: true
  file_browser: true
  metrics: true
  nginx_config: true        # Set to false to disable
  domain_management: true   # Set to false to disable
  email_management: true    # Set to false to disable
  ssl_management: true      # Set to false to disable
  proxy_management: true    # Set to false to disable
  user_management: true
```

### Nginx Integration

```yaml
nginx:
  enabled: true
  container_name: "nginx-proxy"
  config_path: "/etc/nginx-managed"
  reload_command: "docker exec nginx-proxy nginx -s reload"
```

### Email Integration

```yaml
email:
  enabled: true
  smtp:
    host: "smtp.gmail.com"
    port: 587
    secure: true
    user: "your-email@gmail.com"
    password: "your-app-password"
    from: "noreply@yourdomain.com"
```

### DNS Integration

```yaml
dns:
  enabled: true
  provider: "powerdns"  # or cloudflare, route53
  api_url: "http://powerdns:8081"
  api_key: "your-api-key"
```

---

## Uninstallation

### Docker
```bash
# Stop and remove containers
docker-compose down

# Remove volumes (WARNING: deletes all data)
docker-compose down -v
```

### Native Installation
```bash
# Linux/macOS
sudo ./scripts/uninstall.sh

# Windows (as Administrator)
powershell -ExecutionPolicy Bypass -File scripts\uninstall-windows.ps1
```

The uninstall script will:
- Stop the service
- Remove application files
- Optionally backup data before removal
- Optionally preserve data directory
- Remove service user
- Clean up configurations

---

## Troubleshooting

### Port Already in Use

**Change the port in config.yml:**
```yaml
app:
  port: 8080  # Use different port
```

Then regenerate .env and restart.

### Permission Denied (Docker Socket)

```bash
# Linux
sudo chmod 666 /var/run/docker.sock

# Or add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# macOS
# Docker Desktop handles this automatically
```

### Service Won't Start

**Check logs:**
```bash
# Docker
docker-compose logs docker-gui

# Linux
sudo journalctl -u docker-gui -n 50

# macOS
tail -f /var/log/docker-gui/docker-gui.log

# Windows
Get-Content C:\ProgramData\DockerGUI\logs\docker-gui.log -Tail 50
```

### Database Migration Failed

```bash
# Docker
docker-compose exec docker-gui yarn db:migrate

# Native
cd /opt/docker-gui
sudo -u dockergui yarn db:migrate
```

### Can't Access Web UI

1. **Check if service is running:**
   ```bash
   # Docker
   docker-compose ps
   
   # Linux
   sudo systemctl status docker-gui
   
   # Windows
   Get-Service DockerGUI
   ```

2. **Check port configuration:**
   ```bash
   cat config.yml | grep port
   ```

3. **Check firewall:**
   ```bash
   # Linux
   sudo ufw allow 3000
   
   # Windows
   New-NetFirewallRule -DisplayName "Docker GUI" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   ```

---

## Updating

### Docker
```bash
git pull
docker-compose down
docker-compose up -d --build
```

### Native
```bash
# Stop service first
sudo systemctl stop docker-gui

# Update
cd /opt/docker-gui
git pull
yarn install
yarn build
yarn db:migrate

# Restart
sudo systemctl start docker-gui
```

---

## Advanced Configuration

### Using PostgreSQL Instead of SQLite

**1. Update config.yml:**
```yaml
database:
  type: "postgres"
  host: "localhost"
  port: 5432
  username: "dockergui"
  password: "secure-password"
  database: "dockergui"
```

**2. Update DATABASE_URL in .env:**
```bash
DATABASE_URL=postgresql://dockergui:secure-password@localhost:5432/dockergui
```

### Remote Docker Host

**config.yml:**
```yaml
docker:
  host: "tcp://remote-host:2375"
  # For TLS:
  # host: "tcp://remote-host:2376"
  # tls_verify: true
  # cert_path: "/path/to/certs"
```

### Custom Installation Paths

**Native installation with custom paths:**
```bash
sudo ./scripts/install.sh \
  --app-dir /custom/app/path \
  --data-dir /custom/data/path \
  --log-dir /custom/log/path
```

### Behind Corporate Proxy

**Add to config.yml:**
```yaml
app:
  http_proxy: "http://proxy.company.com:8080"
  https_proxy: "http://proxy.company.com:8080"
  no_proxy: "localhost,127.0.0.1"
```

---

## Backup & Restore

### Automated Backup
```bash
# Run backup script
./scripts/backup.sh

# Backups saved to: ./backups/
```

### Manual Backup

**Docker:**
```bash
# Backup volumes
docker run --rm \
  -v docker-gui-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/backup-$(date +%Y%m%d).tar.gz /data
```

**Native:**
```bash
# Backup database and configs
sudo tar czf backup-$(date +%Y%m%d).tar.gz \
  /var/lib/docker-gui \
  /etc/nginx-managed \
  /etc/ssl-managed
```

### Restore

```bash
# Extract backup
tar xzf backup-20241019.tar.gz -C /

# Restart service
sudo systemctl restart docker-gui
```

---

## Security Hardening

### 1. Change Default Secrets

Edit `config.yml`:
```yaml
security:
  jwt_secret: "$(openssl rand -hex 32)"
```

### 2. Enable HTTPS

```yaml
ssl:
  enabled: true
  provider: "letsencrypt"
  email: "admin@yourdomain.com"
```

### 3. Restrict Access

**Use Nginx authentication:**
```nginx
location / {
    auth_basic "Restricted";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://localhost:3000;
}
```

### 4. Firewall Rules

```bash
# Allow only specific IP
sudo ufw allow from 192.168.1.0/24 to any port 3000
```

---

## System Requirements

### Minimum
- CPU: 1 core
- RAM: 1GB
- Disk: 5GB
- OS: Linux, macOS, Windows

### Recommended
- CPU: 2+ cores
- RAM: 2GB+
- Disk: 20GB+
- SSD storage

### Supported Platforms
- ✅ Ubuntu 20.04+
- ✅ Debian 11+
- ✅ CentOS 8+
- ✅ RHEL 8+
- ✅ Fedora 35+
- ✅ macOS 12+
- ✅ Windows 10/11
- ✅ Docker (any platform)

---

## Getting Help

- 📚 Documentation: See README.md
- 🐳 Docker Setup: See DOCKER_SETUP.md
- 📱 PWA/Mobile: See PWA_SETUP.md (deleted)
- 🐛 Issues: Create GitHub issue
- 💬 Discussions: GitHub Discussions

---

## Comparison: Docker vs Native

### Use Docker When:
- ✅ Quick setup needed
- ✅ Want isolation
- ✅ Need Nginx + Email + DNS together
- ✅ Multiple environments
- ✅ Easy cleanup

### Use Native When:
- ✅ Better performance needed
- ✅ Custom port/path requirements
- ✅ Integration with existing services
- ✅ Full system control
- ✅ No Docker overhead

Both methods are fully supported and reliable! ✨

