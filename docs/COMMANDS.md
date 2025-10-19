# Command Reference

Quick reference for all Docker GUI commands.

## First Time Setup

```bash
# Interactive configuration (recommended)
./scripts/setup-interactive.sh

# Then choose deployment:
docker-compose -f docker-compose.full.yml up -d    # Full stack
# OR
sudo ./scripts/install.sh                          # Native (no Docker)
```

## Configuration

```bash
# Edit configuration
nano config.yml

# Validate configuration
./scripts/validate-config.sh

# Apply configuration changes
./scripts/config-to-env.sh

# Restart to apply
docker-compose restart                   # Docker
sudo systemctl restart docker-gui        # Linux native
sudo launchctl stop com.dockergui.app && sudo launchctl start com.dockergui.app  # macOS
```

## Docker Commands

```bash
# Start services
docker-compose up -d                                    # Simple
docker-compose -f docker-compose.full.yml up -d         # Full stack
docker-compose -f docker-compose.production.yml up -d   # Production

# Stop services
docker-compose down
docker-compose down -v    # Also remove volumes (WARNING: deletes data)

# View logs
docker-compose logs -f
docker-compose logs -f docker-gui    # Specific service

# Restart
docker-compose restart
docker-compose restart docker-gui    # Specific service

# Service status
docker-compose ps

# Access container
docker-compose exec docker-gui sh
```

## Native Service Commands

### Linux (systemd)
```bash
sudo systemctl start docker-gui
sudo systemctl stop docker-gui
sudo systemctl restart docker-gui
sudo systemctl status docker-gui
sudo systemctl enable docker-gui     # Auto-start on boot
sudo systemctl disable docker-gui    # Disable auto-start

# Logs
sudo journalctl -u docker-gui -f
sudo journalctl -u docker-gui -n 100
```

### macOS (launchd)
```bash
sudo launchctl start com.dockergui.app
sudo launchctl stop com.dockergui.app
sudo launchctl list | grep dockergui

# Logs
tail -f /var/log/docker-gui/docker-gui.log
tail -n 100 /var/log/docker-gui/docker-gui-error.log
```

### Windows (Service)
```powershell
Start-Service DockerGUI
Stop-Service DockerGUI
Restart-Service DockerGUI
Get-Service DockerGUI

# Logs
Get-Content C:\ProgramData\DockerGUI\logs\docker-gui.log -Tail 100 -Wait
```

## Database Commands

```bash
# Run migrations
yarn db:migrate
docker-compose exec docker-gui yarn db:migrate    # Docker

# Seed database
yarn db:seed
docker-compose exec docker-gui yarn db:seed       # Docker

# Revert migration
yarn db:migrate:revert
docker-compose exec docker-gui yarn db:migrate:revert

# Generate new migration
yarn migration:generate src/server/database/migrations/MyMigration
```

## Nginx Commands

```bash
# Reload Nginx
./scripts/nginx-reload.sh
docker exec nginx-proxy nginx -s reload    # Direct

# Test Nginx config
docker exec nginx-proxy nginx -t

# View Nginx logs
docker-compose logs nginx-proxy
docker exec nginx-proxy cat /var/log/nginx/error.log
```

## SSL Commands

```bash
# Request certificate
./scripts/ssl-request.sh example.com www.example.com

# Manual certbot
docker-compose -f docker-compose.production.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@example.com \
  --agree-tos \
  -d example.com

# Renew certificates
docker-compose -f docker-compose.production.yml run --rm certbot renew

# List certificates
docker-compose -f docker-compose.production.yml run --rm certbot certificates
```

## Backup & Restore

```bash
# Create backup
./scripts/backup.sh
# Output: ./backups/docker-gui-backup-TIMESTAMP.tar.gz

# Manual backup (Docker)
docker run --rm \
  -v docker-gui-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/manual-backup.tar.gz /data

# Manual backup (Native)
sudo tar czf backup.tar.gz \
  /var/lib/docker-gui \
  /opt/docker-gui/config.yml

# Restore backup
tar xzf backup.tar.gz -C /
sudo systemctl restart docker-gui
```

## Maintenance

```bash
# Update application (Docker)
git pull
docker-compose down
docker-compose up -d --build

# Update application (Native)
cd /opt/docker-gui
sudo git pull
sudo -u dockergui yarn install
sudo -u dockergui yarn build
sudo -u dockergui yarn db:migrate
sudo systemctl restart docker-gui

# Clean up Docker
docker system prune -a    # Remove unused images
docker volume prune       # Remove unused volumes

# View disk usage
docker system df

# Clean up old logs
find /var/log/docker-gui -name "*.log" -mtime +30 -delete
```

## Troubleshooting

```bash
# Check if port is in use
netstat -tlnp | grep 3000
lsof -i :3000

# Check Docker socket permissions
ls -l /var/run/docker.sock
sudo chmod 666 /var/run/docker.sock

# Check service status
sudo systemctl status docker-gui
docker-compose ps

# View all logs
sudo journalctl -u docker-gui --since "1 hour ago"
docker-compose logs --tail=100

# Reset to defaults
cp config.example.yml config.yml
./scripts/config-to-env.sh
docker-compose restart

# Check configuration
./scripts/validate-config.sh
cat config.yml
cat .env

# Check database
sqlite3 /var/lib/docker-gui/docker-gui.db ".tables"
docker-compose exec docker-gui sqlite3 /app/data/docker-gui.db ".tables"
```

## Uninstall

```bash
# Docker
docker-compose down -v    # -v removes volumes (all data)

# Native
sudo ./scripts/uninstall.sh    # Interactive, can preserve data
```

## Development

```bash
# Local development (without Docker)
yarn install
yarn db:migrate
yarn db:seed
yarn dev
# Access: http://localhost:3000

# With Docker (hot reload)
docker-compose up
# Code changes trigger rebuild

# Type checking
yarn lint

# Build for production
yarn build
yarn start
```

## Quick Fixes

```bash
# Forgot admin password
grep DEFAULT_ADMIN_PASSWORD .env
# OR
sudo journalctl -u docker-gui | grep -i password
# OR
cat config.yml | grep -A 3 "admin:"

# Change port
nano config.yml # Change app.port
./scripts/config-to-env.sh
docker-compose restart

# Reset admin password
# Edit config.yml, set new password
./scripts/config-to-env.sh
docker-compose restart

# Service won't start
sudo journalctl -u docker-gui -n 50    # Check logs
./scripts/validate-config.sh           # Check config
netstat -tlnp | grep PORT               # Check port conflict
```

## File Locations

### Docker
- Config: `./config.yml`
- Data: Docker volume `docker-gui-data`
- Logs: `docker-compose logs`
- Nginx configs: Docker volume `nginx-configs`
- SSL certs: Docker volume `ssl-certificates`

### Native Linux
- Config: `/opt/docker-gui/config.yml`
- Data: `/var/lib/docker-gui/`
- Logs: `/var/log/docker-gui/`
- Service: `/etc/systemd/system/docker-gui.service`
- Nginx configs: `/etc/nginx-managed/`

### Native macOS
- Config: `/opt/docker-gui/config.yml`
- Data: `/var/lib/docker-gui/`
- Logs: `/var/log/docker-gui/`
- Service: `/Library/LaunchDaemons/com.dockergui.app.plist`

### Native Windows
- Config: `C:\Program Files\DockerGUI\config.yml`
- Data: `C:\ProgramData\DockerGUI\`
- Logs: `C:\ProgramData\DockerGUI\logs\`
- Service: Windows Services (services.msc)

## Performance Tuning

Edit config.yml:
```yaml
performance:
  container_stats_interval: 5000   # Faster updates (5 seconds)
  metrics_retention_days: 90       # Keep metrics longer
  log_retention_days: 30           # Keep logs longer
  max_log_lines: 50000             # Show more log lines
```

Apply:
```bash
./scripts/config-to-env.sh
docker-compose restart
```

## Security Hardening

```bash
# Change JWT secret
openssl rand -hex 32    # Generate new secret
nano config.yml         # Update security.jwt_secret
./scripts/config-to-env.sh
docker-compose restart

# Enable HTTPS
# 1. Request SSL certificate
./scripts/ssl-request.sh yourdomain.com

# 2. Update Nginx config to use HTTPS
# 3. Reload: ./scripts/nginx-reload.sh

# Restrict access
# Add to Nginx config:
# allow 192.168.1.0/24;
# deny all;
```

## Helpful Aliases

Add to ~/.bashrc or ~/.zshrc:

```bash
# Docker GUI aliases
alias dg-start='cd ~/docker-gui && docker-compose up -d'
alias dg-stop='cd ~/docker-gui && docker-compose down'
alias dg-logs='cd ~/docker-gui && docker-compose logs -f'
alias dg-restart='cd ~/docker-gui && docker-compose restart'
alias dg-config='cd ~/docker-gui && nano config.yml && ./scripts/config-to-env.sh'
alias dg-backup='cd ~/docker-gui && ./scripts/backup.sh'
```

## Environment Variables Override

While config.yml is primary, you can override specific values:

```bash
# Start with custom port (one-time)
PORT=8080 docker-compose up

# Or set in .env (permanent override)
echo "PORT=8080" >> .env
docker-compose restart
```

Note: config.yml values are used by default, .env overrides them.

