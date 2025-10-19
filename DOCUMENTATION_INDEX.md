#  Docker GUI Documentation Index

Complete guide to all features and setup instructions.

---

##  Quick Start

### First Time Setup:
1. **[START_HERE.md](START_HERE.md)** - Complete setup guide
2. **[QUICK_START.md](QUICK_START.md)** - Quick reference

### Start Services:
```bash
docker-compose up -d
```

### Access:
- **Docker GUI**: http://localhost:3000
- **MailHog**: http://localhost:8025

---

##  DNS & Domain Setup

### Essential Reading:

**[DNS_QUICK_SETUP.md](DNS_QUICK_SETUP.md)** 
- **TL;DR version** - Quick steps for each DNS mode
- Choose your scenario and follow simple steps
- **Start here if you want to point domains to this server**

**[DNS_RECORDS_GUIDE.md](DNS_RECORDS_GUIDE.md)** 
- **Complete DNS configuration guide**
- What DNS records to create at your registrar
- Nameserver delegation instructions
- Testing and troubleshooting

**[MULTI_PROVIDER_DNS.md](MULTI_PROVIDER_DNS.md)**
- Use different DNS providers per domain
- Enable multiple providers simultaneously
- Configuration examples

**[COMPLETE_DNS_SETUP.md](COMPLETE_DNS_SETUP.md)**
- All three DNS modes explained
- Status and availability
- Feature comparison

---

##  Detailed Guides

### Configuration:
- **[config.yml](config.yml)** - Current configuration (with inline docs)
- **[config.example.yml](config.example.yml)** - Complete examples

### Features:
- **Container Management** - Built-in, see Docker page
- **Image Management** - Built-in, see Images page
- **Volume Management** - Built-in, see Volumes page
- **Network Management** - Built-in, see Networks page
- **Domain/Nginx Management** - See DNS guides above
- **SSL/TLS** - Automatic with Let's Encrypt
- **Email** - Configured with MailHog
- **System Metrics** - Real-time monitoring
- **User Management** - Multi-user support

---

##  Common Use Cases

### Use Case 1: Map Domain to Container

**Quick Steps:**
```bash
# 1. Start container
docker run -d --name my-app --network docker-gui_docker-gui-network nginx

# 2. Set DNS record (if using Manual mode):
#    yourdomain.com  A  YOUR_SERVER_IP

# 3. In Docker GUI:
#    Domains  Add Domain  Select mode  Choose container

# 4. Access: http://yourdomain.com
```

**Detailed Guide:** [DNS_QUICK_SETUP.md](DNS_QUICK_SETUP.md)

---

### Use Case 2: Self-Hosted DNS with PowerDNS

**Quick Steps:**
```bash
# 1. Point nameservers (at registrar):
#    ns1.yourdomain.com  YOUR_SERVER_IP
#    ns2.yourdomain.com  YOUR_SERVER_IP

# 2. Wait 24-48 hours

# 3. In Docker GUI:
#    Domains  Add Domain  "Manage DNS Here"
```

**Detailed Guide:** [DNS_RECORDS_GUIDE.md](DNS_RECORDS_GUIDE.md)  Scenario A

---

### Use Case 3: Multiple Domains, Different Providers

**Quick Steps:**
```yaml
# 1. Enable providers in config.yml:
dns:
  powerdns:
    enabled: true
  cloudflare:
    enabled: true

# 2. Restart Docker GUI

# 3. Create domains:
#    - Domain A  "Manage DNS Here" (PowerDNS)
#    - Domain B  "External Provider"  Cloudflare
```

**Detailed Guide:** [MULTI_PROVIDER_DNS.md](MULTI_PROVIDER_DNS.md)

---

##  Configuration Reference

### DNS Providers:

| Provider | Config Key | Guide |
|----------|-----------|-------|
| PowerDNS (Self-hosted) | `powerdns` | DNS_RECORDS_GUIDE.md |
| AWS Route53 | `route53` | MULTI_PROVIDER_DNS.md |
| Cloudflare | `cloudflare` | MULTI_PROVIDER_DNS.md |
| Azure DNS | `azure` | MULTI_PROVIDER_DNS.md |
| DigitalOcean | `digitalocean` | MULTI_PROVIDER_DNS.md |
| Manual/Proxy Only | N/A | DNS_QUICK_SETUP.md |

### Enable/Disable:

```yaml
# config.yml
dns:
  powerdns:
    enabled: true  # Show in UI
  cloudflare:
    enabled: false  # Hide from UI
```

---

##  Testing & Troubleshooting

### DNS Testing:
```bash
# Check DNS resolution
dig yourdomain.com

# Check nameservers
dig NS yourdomain.com

# Test PowerDNS directly
dig @localhost -p 15353 yourdomain.com
```

### Service Health:
```bash
# Check all services
docker ps

# Check logs
docker logs docker-gui-full
docker logs nginx-proxy
docker logs powerdns
```

### Common Issues:

| Problem | Solution | Guide |
|---------|----------|-------|
| Domain not resolving | Check DNS records | DNS_RECORDS_GUIDE.md |
| Port 5353 in use | Using port 15353 | docker-compose.yml |
| PowerDNS API key? | It's `pdns-secret-key` | config.yml |
| Nginx not routing | Check nginx config | docker exec nginx-proxy nginx -t |

---

##  Architecture Overview

```
User  DNS Provider  Your Server IP  Nginx (port 80/443)  Container

DNS Options:
1. PowerDNS (self-hosted on this server)
2. Cloudflare/AWS/Azure (external, managed via API)
3. Manual (you manage, nginx just proxies)
```

---

##  Learning Path

### Beginner:
1. Read [DNS_QUICK_SETUP.md](DNS_QUICK_SETUP.md) - Scenario 3 (Proxy Only)
2. Create first domain with manual DNS
3. Test with your container

### Intermediate:
1. Read [MULTI_PROVIDER_DNS.md](MULTI_PROVIDER_DNS.md)
2. Enable external provider (Cloudflare recommended)
3. Create domain with auto DNS sync

### Advanced:
1. Read [DNS_RECORDS_GUIDE.md](DNS_RECORDS_GUIDE.md) - Scenario A
2. Set up PowerDNS with nameserver delegation
3. Full self-hosted DNS solution

---

##  Quick Reference

### Ports:
- **3000** - Docker GUI
- **80/443** - Nginx (your domains)
- **8081** - PowerDNS API
- **15353** - PowerDNS DNS (TCP/UDP)
- **8025** - MailHog UI
- **1025** - MailHog SMTP

### Default Credentials:
- **Docker GUI**: admin@gmail.com / Admin@123
- **PowerDNS API Key**: pdns-secret-key

### Commands:
```bash
# Start
docker-compose up -d

# Stop
docker-compose down

# Restart Docker GUI
docker-compose restart docker-gui-full

# View logs
docker-compose logs -f

# Check status
docker ps
```

---

## ‚ File Structure

```
/Users/chetan/project/dev-tools/docker-gui/
 README.md                      # Project overview
 DOCUMENTATION_INDEX.md         # This file
‚
 Quick Start Guides:
 DNS_QUICK_SETUP.md            #  DNS TL;DR - start here!
 DNS_RECORDS_GUIDE.md          #  Complete DNS guide
 MULTI_PROVIDER_DNS.md         # Multi-provider setup
 COMPLETE_DNS_SETUP.md         # DNS feature status
‚
 Configuration:
 config.yml                    # Active config
 config.example.yml            # Example config
 docker-compose.yml            # Docker services
‚
 Additional Docs:
 docs/                         # Technical documentation
‚    DOCKER_SETUP.md
‚    CONFIGURATION.md
‚    ...
‚
 Scripts:
     scripts/                  # Utility scripts
     ...
```

---

##  Getting Help

### Check Documentation:
1. **Quick answer?**  [DNS_QUICK_SETUP.md](DNS_QUICK_SETUP.md)
2. **DNS setup?**  [DNS_RECORDS_GUIDE.md](DNS_RECORDS_GUIDE.md)
3. **Multi-provider?**  [MULTI_PROVIDER_DNS.md](MULTI_PROVIDER_DNS.md)

### Check Logs:
```bash
# Docker GUI logs
docker logs docker-gui-full -f

# Nginx logs
docker logs nginx-proxy -f

# All logs
docker-compose logs -f
```

### Common Commands:
```bash
# Restart everything
docker-compose restart

# Fresh start
docker-compose down && docker-compose up -d

# Check configuration
docker exec nginx-proxy nginx -t

# Test DNS
dig yourdomain.com
```

---

##  Feature Checklist

What's available in your setup:

-  Docker Container Management
-  Domain/Nginx Management
-  DNS Management (3 modes)
-  SSL/TLS (Let's Encrypt)
-  Email (MailHog)
-  System Metrics
-  User Management
-  Multi-provider DNS
-  Automatic nginx config
-  Container auto-discovery

**Everything is configured and ready to use!** 

---

##  Summary

| What | Where | Status |
|------|-------|--------|
| **Quick DNS Setup** | DNS_QUICK_SETUP.md |  Ready |
| **Complete DNS Guide** | DNS_RECORDS_GUIDE.md |  Ready |
| **Multi-provider Setup** | MULTI_PROVIDER_DNS.md |  Ready |
| **PowerDNS** | Port 15353, API 8081 |  Running |
| **Nginx** | Port 80/443 |  Running |
| **Docker GUI** | Port 3000 |  Running |

**Start with [DNS_QUICK_SETUP.md](DNS_QUICK_SETUP.md) to point your domains here!** 

