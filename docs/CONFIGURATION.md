# Configuration Guide

Docker GUI uses `config.yml` as the primary configuration file. All settings are centralized here for easy management.

## Configuration File

### Primary: config.yml

This is your main configuration file. Edit this to change any settings.

```yaml
app:
  port: 3000              # Web UI port - change this!
  hostname: "0.0.0.0"     # Bind address
  environment: "production"

admin:
  email: "admin@example.com"  # Your admin email
  password: "YourPassword"    # Your password (leave empty to auto-generate)
```

### Generated: .env

This file is AUTO-GENERATED from `config.yml`. Do not edit directly!

To regenerate:
```bash
./scripts/config-to-env.sh
```

## Initial Setup

### Method 1: Interactive (Recommended)

```bash
./scripts/setup-interactive.sh
```

This will:
1. Copy `config.example.yml` to `config.yml`
2. Ask you questions about each setting
3. Update `config.yml` with your answers
4. Auto-generate secure secrets
5. Create `.env` from `config.yml`

### Method 2: Manual

```bash
# 1. Copy example
cp config.example.yml config.yml

# 2. Edit with your favorite editor
nano config.yml
# or
vim config.yml

# 3. Generate .env
./scripts/config-to-env.sh

# 4. Validate
./scripts/validate-config.sh
```

## Changing Configuration

### Change Web UI Port

**1. Edit config.yml:**
```yaml
app:
  port: 8080  # Changed from 3000
```

**2. Apply changes:**
```bash
./scripts/config-to-env.sh
docker-compose restart
# or
sudo systemctl restart docker-gui
```

### Enable/Disable Features

**Edit config.yml:**
```yaml
features:
  nginx_config: true        # Enable Nginx management
  email_management: false   # Disable email features
  domain_management: true   # Enable DNS/domain features
  ssl_management: true      # Enable SSL certificate management
```

**Apply:**
```bash
./scripts/config-to-env.sh
# Restart application
```

### Configure Email (Gmail Example)

**config.yml:**
```yaml
email:
  enabled: true
  smtp:
    host: "smtp.gmail.com"
    port: 587
    secure: true
    user: "your-email@gmail.com"
    password: "your-app-password"  # Use App Password, not regular password
    from: "noreply@yourdomain.com"
```

**Apply:**
```bash
./scripts/config-to-env.sh
docker-compose restart
```

### Configure Nginx

**config.yml:**
```yaml
nginx:
  enabled: true
  container_name: "nginx-proxy"      # Container name if using Docker
  config_path: "/etc/nginx-managed"  # Where configs are stored
  reload_command: "docker exec nginx-proxy nginx -s reload"
  
# For native Nginx (not Docker):
#  reload_command: "sudo systemctl reload nginx"
```

### Configure DNS (PowerDNS)

**config.yml:**
```yaml
dns:
  enabled: true
  provider: "powerdns"
  api_url: "http://powerdns:8081"
  api_key: "your-api-key"  # Auto-generated during setup
```

### Configure SSL (Let's Encrypt)

**config.yml:**
```yaml
ssl:
  enabled: true
  provider: "letsencrypt"
  email: "admin@yourdomain.com"
  test_mode: false          # Set to true for testing
  auto_renew: true
  renew_days_before: 30
```

## Configuration Reference

### Application Settings

```yaml
app:
  name: "Docker Control Center"  # Application name
  port: 3000                     # Web UI port (1-65535)
  hostname: "0.0.0.0"            # 0.0.0.0 = all interfaces, 127.0.0.1 = localhost only
  environment: "production"      # production or development
  log_level: "info"              # debug, info, warn, error
```

### Security Settings

```yaml
security:
  jwt_secret: "auto-generated"   # JWT signing key (32+ characters)
  cookie_secure: true            # Require HTTPS for cookies
  bcrypt_rounds: 12              # Password hashing rounds (10-14)
  session_timeout: 86400         # Session duration in seconds
```

### Admin User

```yaml
admin:
  email: "admin@example.com"     # Login email
  password: ""                   # Leave empty to auto-generate
  name: "Administrator"          # Display name
```

### Database

```yaml
database:
  type: "sqlite"                                  # sqlite, postgres, mysql
  path: "/var/lib/docker-gui/docker-gui.db"       # SQLite path
  
  # For PostgreSQL:
  # type: "postgres"
  # host: "localhost"
  # port: 5432
  # username: "dockergui"
  # password: "secure-password"
  # database: "dockergui"
```

### Docker Integration

```yaml
docker:
  host: "unix:///var/run/docker.sock"  # Local Unix socket
  # host: "tcp://remote:2375"           # Remote Docker daemon
  metrics_provider: "docker"            # docker, system, or mock
```

### Performance Tuning

```yaml
performance:
  container_stats_interval: 10000   # Stats refresh (milliseconds)
  metrics_retention_days: 30        # Keep metrics for X days
  log_retention_days: 7             # Keep logs for X days
  max_log_lines: 10000              # Max lines to display
```

### Backup Configuration

```yaml
backup:
  enabled: false                    # Enable automatic backups
  schedule: "0 2 * * *"             # Cron schedule (2 AM daily)
  retention_days: 7                 # Keep backups for X days
  path: "/var/backups/docker-gui"   # Backup location
```

## Validation

Always validate after editing:

```bash
./scripts/validate-config.sh
```

This checks:
- YAML syntax
- Required fields
- Valid port numbers
- Security warnings
- Feature dependencies

## Troubleshooting

### Config not taking effect

```bash
# 1. Validate config
./scripts/validate-config.sh

# 2. Regenerate .env
./scripts/config-to-env.sh

# 3. Restart application
docker-compose restart
# or
sudo systemctl restart docker-gui
```

### Reset to defaults

```bash
# Backup current config
cp config.yml config.yml.backup

# Copy example
cp config.example.yml config.yml

# Run interactive setup
./scripts/setup-interactive.sh
```

### Manual .env override

While config.yml is the primary source, you can override specific values in .env:

```bash
# In .env (takes precedence)
PORT=8080

# This overrides config.yml port setting
```

## Best Practices

1. **Always edit config.yml**, not .env
2. **Run `config-to-env.sh`** after changes
3. **Validate** before applying: `validate-config.sh`
4. **Backup** before major changes: `cp config.yml config.yml.backup`
5. **Version control** config.yml (but not .env!)
6. **Document** custom changes in comments

## Environment Variables vs Config.yml

| Aspect | config.yml | .env |
|--------|-----------|------|
| **Primary source** | YES | No |
| **Edit directly** | YES | No (auto-generated) |
| **Human-readable** | YES | Less so |
| **Commented** | YES | Limited |
| **Version control** | YES | No (secrets!) |
| **Single source** | YES | No |

**Rule: Edit config.yml, let scripts handle .env**

## Examples

### Complete Production Setup

```yaml
app:
  port: 80
  environment: "production"
  log_level: "warn"

security:
  cookie_secure: true
  bcrypt_rounds: 14

admin:
  email: "admin@mycompany.com"
  password: "SuperSecure123!"

nginx:
  enabled: true
  config_path: "/etc/nginx/sites-enabled"
  reload_command: "sudo systemctl reload nginx"

email:
  enabled: true
  smtp:
    host: "smtp.sendgrid.net"
    port: 587
    secure: true
    user: "apikey"
    password: "SG.xxxxxxxxxxxx"
    from: "noreply@mycompany.com"

dns:
  enabled: true
  provider: "cloudflare"
  api_token: "your-cloudflare-token"

ssl:
  enabled: true
  provider: "letsencrypt"
  email: "admin@mycompany.com"
  test_mode: false

features:
  nginx_config: true
  domain_management: true
  email_management: true
  ssl_management: true
```

### Development Setup

```yaml
app:
  port: 3000
  environment: "development"
  log_level: "debug"

security:
  cookie_secure: false
  bcrypt_rounds: 10

email:
  enabled: true
  smtp:
    host: "mailhog"
    port: 1025
    secure: false

dns:
  enabled: false

ssl:
  enabled: false
```

## Configuration Migration

If upgrading from an old version:

```bash
# 1. Backup current .env
cp .env .env.backup

# 2. Create config.yml from answers
./scripts/setup-interactive.sh

# 3. Or manually create config.yml and import values from .env
cp config.example.yml config.yml
# Edit config.yml with values from .env.backup

# 4. Generate new .env
./scripts/config-to-env.sh
```

