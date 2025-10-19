# Quick Start Guide

Get Docker GUI up and running in 5 minutes! 🚀

## Choose Your Path

### 🎯 Path 1: I Want Everything Configured Interactively

```bash
# 1. Run interactive setup
./scripts/setup-interactive.sh

# 2. Answer the prompts:
#    - Which port? (default: 3000)
#    - Admin email and password
#    - Enable Nginx? Email? DNS? SSL?
#    - Performance settings

# 3. Start with Docker
docker-compose -f docker-compose.full.yml up -d

# 4. Open http://localhost:3000
```

**Time: ~3 minutes** ⏱️

---

### 🐳 Path 2: Quick Docker Start (Defaults)

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Start services
docker-compose up -d

# 3. Open http://localhost:3000
# 4. Login with: admin@example.com
#    (Password will be in logs: docker-compose logs docker-gui)
```

**Time: ~2 minutes** ⏱️

---

### 💻 Path 3: Native Installation (No Docker)

```bash
# 1. Interactive configuration
./scripts/setup-interactive.sh

# 2. Install as system service
sudo ./scripts/install.sh

# 3. Service starts automatically
# 4. Open http://localhost:3000
```

**Time: ~5 minutes** ⏱️

---

### ⚙️ Path 4: Custom Configuration First

```bash
# 1. Edit config.yml with your preferences
nano config.yml

# Change any settings:
app:
  port: 8080              # ← Change port
  
admin:
  email: "me@company.com" # ← Your email
  password: "MyPass123"   # ← Your password

# 2. Generate .env from config
./scripts/config-to-env.sh

# 3. Start application
docker-compose up -d
```

**Time: ~3 minutes** ⏱️

---

## What Gets Installed?

### Docker Method (Full Stack)
- ✅ Docker GUI (Web Interface)
- ✅ Nginx (Reverse Proxy)
- ✅ MailHog (Email Testing)
- ✅ PowerDNS (DNS Server)
- ✅ Certbot (SSL Certificates)

### Native Method
- ✅ Docker GUI application
- ✅ Node.js 22
- ✅ SQLite database
- ✅ System service (systemd/launchd/Windows Service)
- ✅ Nginx (optional)

---

## First Steps After Installation

### 1. **Login**
- Open: http://localhost:3000
- Default: admin@example.com
- Password: Check logs or `.env` file

### 2. **Change Default Password**
- Go to: User menu → Settings
- Update password immediately

### 3. **Explore Features**
- 📦 **Containers**: View and manage running containers
- 🖼️ **Images**: Pull and manage Docker images
- 💾 **Volumes**: Manage persistent storage
- 🌐 **Networks**: Configure Docker networks
- 📝 **Logs**: View container logs
- ⚙️ **Terminal**: Interactive shell access

### 4. **Optional: Configure Services**

**Nginx Sites:**
- Go to: Nginx Config
- Add new site configurations
- Auto-reload on save

**Email Accounts:**
- Go to: Email
- Configure email accounts
- Test email sending

**Domains:**
- Go to: Domains
- Add DNS zones
- Manage records

**SSL Certificates:**
- Go to: SSL Certificates
- Request Let's Encrypt certificates
- Auto-renewal configured

---

## Configuration Files

| File | Purpose | When to Edit |
|------|---------|--------------|
| `config.yml` | Main settings | ✅ Edit this |
| `.env` | Environment vars | ⚠️ Auto-generated |
| `docker-compose.yml` | Docker services | Advanced only |

**Golden Rule:** Edit `config.yml`, then run `./scripts/config-to-env.sh`

---

## Common Configurations

### Change Port to 8080

**config.yml:**
```yaml
app:
  port: 8080
```

```bash
./scripts/config-to-env.sh
docker-compose restart
```

### Enable All Features

**config.yml:**
```yaml
nginx:
  enabled: true
email:
  enabled: true
dns:
  enabled: true
ssl:
  enabled: true
```

```bash
./scripts/config-to-env.sh
docker-compose -f docker-compose.full.yml up -d
```

### Production Ready Setup

```bash
# 1. Interactive setup
./scripts/setup-interactive.sh

# Select:
# - Environment: Production
# - Admin: Your real email
# - Nginx: Yes
# - Email: Gmail/SendGrid
# - SSL: Yes
# - DNS: Yes (if managing domains)

# 2. Deploy
docker-compose -f docker-compose.production.yml up -d

# 3. Request SSL
./scripts/ssl-request.sh yourdomain.com www.yourdomain.com

# 4. Done! ✨
```

---

## Stopping/Starting

### Docker
```bash
# Stop all
docker-compose down

# Start all
docker-compose up -d

# Restart
docker-compose restart

# View logs
docker-compose logs -f
```

### Native Linux
```bash
sudo systemctl stop docker-gui
sudo systemctl start docker-gui
sudo systemctl restart docker-gui
sudo systemctl status docker-gui
```

### Native macOS
```bash
sudo launchctl stop com.dockergui.app
sudo launchctl start com.dockergui.app
```

### Native Windows
```powershell
Stop-Service DockerGUI
Start-Service DockerGUI
Restart-Service DockerGUI
Get-Service DockerGUI
```

---

## Uninstall

### Docker
```bash
docker-compose down -v  # -v removes volumes (all data!)
```

### Native
```bash
# Linux/macOS
sudo ./scripts/uninstall.sh

# Windows (as Administrator)
powershell -ExecutionPolicy Bypass -File scripts\uninstall-windows.ps1
```

Creates backup before removing (optional).

---

## Getting Help

**Service won't start?**
```bash
# Check logs
docker-compose logs docker-gui
# or
sudo journalctl -u docker-gui -n 50
```

**Port in use?**
```bash
# Edit config.yml, change port, then:
./scripts/config-to-env.sh
docker-compose restart
```

**Forgot admin password?**
```bash
# Check logs for auto-generated password
docker-compose logs docker-gui | grep -i password
```

**Want to reset everything?**
```bash
docker-compose down -v
rm config.yml .env
./scripts/setup-interactive.sh
```

---

## Next: Advanced Features

After basic setup, explore:
- 🔧 [Docker Setup Guide](DOCKER_SETUP.md) - All services explained
- 📋 [Installation Details](INSTALLATION.md) - Full documentation
- 📚 [README](README.md) - Features and API

Happy Docker managing! 🐳✨

