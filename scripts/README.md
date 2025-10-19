# Scripts Documentation

All utility scripts for Docker GUI installation, configuration, and maintenance.

## Setup Scripts

### setup-interactive.sh

**Interactive setup wizard** - Guides you through complete configuration.

```bash
./scripts/setup-interactive.sh
```

Features:
- Asks for all configuration options
- Creates `config.yml` from your answers
- Generates `.env` from config
- Validates configuration
- Provides next steps

Configures:
- Web UI port and hostname
- Admin user credentials
- Docker socket path
- Nginx integration
- Email server (SMTP)
- DNS provider
- SSL certificates
- Performance tuning
- Backup settings

### config-to-env.sh

**Convert config.yml to .env** - Generates environment variables from YAML config.

```bash
./scripts/config-to-env.sh
```

- Reads `config.yml`
- Generates `.env` file
- Validates YAML syntax
- Preserves comments
- Safe to run multiple times

### validate-config.sh

**Validate configuration** - Checks config.yml for errors.

```bash
./scripts/validate-config.sh
```

Checks:
- YAML syntax
- Required fields
- Value formats (email, port, URL)
- File permissions
- Dependencies

### setup-services.sh

**Setup Docker services** - Interactive Docker Compose setup.

```bash
./scripts/setup-services.sh
```

Options:
1. Simple development (GUI only)
2. Full development (GUI + Nginx + MailHog + DNS)
3. Production (GUI + Nginx + Postfix + DNS + SSL)

## Installation Scripts

### install.sh

**Native installation** (Linux/macOS) - Installs without Docker.

```bash
sudo ./scripts/install.sh
```

What it does:
- Installs Node.js 18+ (if needed)
- Installs Yarn package manager
- Creates `dockergui` system user
- Installs app to `/opt/docker-gui`
- Creates systemd service
- Starts service automatically
- Configures firewall (optional)

Requirements:
- Root/sudo access
- Ubuntu 20.04+ / Debian 11+ / CentOS 8+ / macOS 12+
- 2GB RAM minimum
- 10GB disk space

Post-install:
```bash
# Check status
sudo systemctl status docker-gui

# View logs
sudo journalctl -u docker-gui -f

# Restart service
sudo systemctl restart docker-gui
```

### uninstall.sh

**Uninstall native installation** - Removes the native install.

```bash
sudo ./scripts/uninstall.sh
```

What it removes:
- Systemd service
- Application files from `/opt/docker-gui`
- `dockergui` system user
- Configuration files (optional)

Options:
- `-k, --keep-config`: Keep configuration files
- `-d, --keep-data`: Keep database and data

### install-windows.ps1

**Native installation** (Windows PowerShell) - Installs on Windows.

```powershell
.\scripts\install-windows.ps1
```

What it does:
- Installs Node.js (if needed)
- Installs Yarn
- Creates Windows service
- Configures firewall
- Starts service

Requirements:
- PowerShell 5.1+ (Run as Administrator)
- Windows 10/11 or Windows Server 2016+
- 2GB RAM minimum
- 10GB disk space

## Maintenance Scripts

### nginx-reload.sh

**Reload Nginx configuration** - Applies Nginx config changes.

```bash
./scripts/nginx-reload.sh
```

Use after:
- Adding/editing site configs
- Updating SSL certificates
- Changing proxy settings

```bash
# Edit Nginx config
nano nginx/templates/mysite.conf.template

# Apply changes
./scripts/nginx-reload.sh
```

### backup.sh

**Backup all data** - Creates timestamped backup.

```bash
./scripts/backup.sh [backup-directory]
```

Backs up:
- SQLite database
- Configuration files
- Nginx configs
- SSL certificates
- User uploads

Default backup location: `./backups/`

```bash
# Backup to default location
./scripts/backup.sh

# Backup to specific directory
./scripts/backup.sh /mnt/backups

# Restore backup
tar -xzf backups/backup-2025-10-19-12-00-00.tar.gz -C /
```

### ssl-request.sh

**Request SSL certificate** - Automates Let's Encrypt certificate request.

```bash
./scripts/ssl-request.sh <domain> [email]
```

Example:
```bash
./scripts/ssl-request.sh example.com admin@example.com
```

Requirements:
- Domain must point to your server
- Port 80 accessible from internet
- Valid email address

Features:
- Automatic DNS validation
- Installs certificate
- Configures Nginx
- Sets up auto-renewal

## Docker Helper Scripts

### docker-dev-entrypoint.sh

**Docker development entrypoint** - Used internally by Docker dev container.

Runs:
1. Database migrations
2. Database seeding
3. Development server

## Usage Examples

### Complete Setup Workflow

```bash
# 1. Interactive setup
./scripts/setup-interactive.sh

# 2. Validate configuration
./scripts/validate-config.sh

# 3. Start with Docker
docker-compose -f docker-compose.full.yml up -d

# 4. Request SSL certificate
./scripts/ssl-request.sh myapp.com admin@myapp.com

# 5. Setup automated backups (cron)
crontab -e
# Add: 0 2 * * * /path/to/docker-gui/scripts/backup.sh /backups
```

### Native Installation Workflow

```bash
# 1. Configure
./scripts/setup-interactive.sh

# 2. Install
sudo ./scripts/install.sh

# 3. Verify
sudo systemctl status docker-gui

# 4. View logs
sudo journalctl -u docker-gui -f
```

### Configuration Change Workflow

```bash
# 1. Edit config
nano config.yml

# 2. Validate
./scripts/validate-config.sh

# 3. Apply
./scripts/config-to-env.sh

# 4. Restart
docker-compose restart
# OR
sudo systemctl restart docker-gui
```

### Nginx Management Workflow

```bash
# 1. Add site config
nano nginx/templates/mysite.conf.template

# 2. Reload Nginx
./scripts/nginx-reload.sh

# 3. Test
curl -I http://mysite.local

# 4. Request SSL
./scripts/ssl-request.sh mysite.local admin@mysite.local
```

## Troubleshooting

### Script Permissions

```bash
# Make scripts executable
chmod +x scripts/*.sh
```

### YAML Syntax Errors

```bash
# Validate YAML
./scripts/validate-config.sh

# Check for tabs (use spaces only)
cat -A config.yml | grep "\^I"
```

### Service Not Starting

```bash
# Check logs
sudo journalctl -u docker-gui -f

# Check status
sudo systemctl status docker-gui

# Restart
sudo systemctl restart docker-gui
```

### Nginx Reload Fails

```bash
# Check Nginx logs
docker logs nginx-proxy

# Test config
docker exec nginx-proxy nginx -t

# Manual reload
docker exec nginx-proxy nginx -s reload
```

## Environment Variables

All scripts respect these environment variables:

- `APP_DIR`: Application directory (default: current directory)
- `CONFIG_FILE`: Config file path (default: config.yml)
- `ENV_FILE`: Environment file path (default: .env)
- `BACKUP_DIR`: Backup directory (default: ./backups)

Example:
```bash
APP_DIR=/opt/docker-gui ./scripts/config-to-env.sh
```

## See Also

- [Installation Guide](../docs/INSTALLATION.md)
- [Configuration Guide](../docs/CONFIGURATION.md)
- [Docker Setup Guide](../docs/DOCKER_SETUP.md)
- [Command Reference](../docs/COMMANDS.md)
