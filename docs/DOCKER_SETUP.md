# Docker Setup Guide

This guide explains how to set up and run the Docker GUI with integrated Nginx, Email, and DNS services.

## Quick Start

### Development Setup (with MailHog)

```bash
# 1. Copy environment file
cp .env.example .env

# 2. Edit .env and set your values
nano .env

# 3. Start all services
docker-compose -f docker-compose.full.yml up -d

# 4. Access the services
# - Docker GUI: http://localhost:3000
# - MailHog UI: http://localhost:8025
# - PowerDNS API: http://localhost:8081
# - Nginx: http://localhost:80
```

### Production Setup (with Real Email Server)

```bash
# 1. Use production compose file
docker-compose -f docker-compose.production.yml up -d
```

## Services Overview

### 1. **Docker GUI** (Port 3000)
- Main application for managing Docker resources
- Web interface for containers, images, volumes, networks
- Integrated with all services below

### 2. **Nginx Reverse Proxy** (Ports 80, 443)
- **Purpose**: Web server and reverse proxy
- **Features**:
  - SSL/TLS termination
  - Virtual hosts management
  - Load balancing
  - Static file serving
- **Volumes**:
  - `nginx-configs`: Site configurations
  - `ssl-certificates`: SSL certificates
  - `nginx-logs`: Access and error logs
- **Access**: http://localhost:80

### 3. **Email Server**

#### Development: MailHog (Ports 1025, 8025)
- **Purpose**: Email testing and debugging
- **Features**:
  - Catches all outgoing emails
  - Web UI to view emails
  - No real email sending
- **Web UI**: http://localhost:8025
- **SMTP**: localhost:1025

#### Production: Postfix (Port 587)
- **Purpose**: Real email delivery
- **Features**:
  - SMTP relay
  - Authentication
  - TLS encryption
- **Configuration**:
  - Set relay host (e.g., Gmail, SendGrid)
  - Configure authentication
  - Set allowed sender domains

### 4. **DNS Server: PowerDNS** (Ports 53, 8081)
- **Purpose**: Authoritative DNS server
- **Features**:
  - REST API for zone management
  - SQLite backend
  - DNSSEC support
- **API**: http://localhost:8081
- **API Key**: Set in `DNS_API_KEY` env var

### 5. **Certbot** (SSL Certificates)
- **Purpose**: Automatic SSL certificate management
- **Features**:
  - Let's Encrypt integration
  - Auto-renewal (every 12 hours)
  - Wildcard certificate support
- **Volumes**: Shared with Nginx

## File Structure

```
docker-gui/
├── docker-compose.yml              # Development (simple)
├── docker-compose.full.yml         # Development (with all services)
├── docker-compose.production.yml   # Production setup
├── .env                            # Environment variables
├── nginx/
│   └── templates/
│       ├── default.conf.template   # Default Nginx config
│       └── docker-gui.conf.template # Docker GUI proxy config
└── data/
    ├── docker-gui.db              # SQLite database
    ├── nginx-configs/             # Generated Nginx configs
    ├── ssl-certificates/          # SSL certificates
    └── powerdns/                  # DNS data
```

## Configuration Examples

### Nginx Site Configuration

The Docker GUI can manage Nginx sites through its web interface. Configurations are stored in the `nginx-configs` volume.

Example site:
```nginx
server {
    listen 80;
    server_name example.com;
    
    location / {
        proxy_pass http://backend:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Email Configuration

#### Using Gmail as Relay (Production):
```env
SMTP_HOST=postfix
SMTP_PORT=587
RELAY_HOST=smtp.gmail.com:587
RELAY_USERNAME=your-email@gmail.com
RELAY_PASSWORD=your-app-password
ALLOWED_SENDER_DOMAINS=yourdomain.com
```

#### Using SendGrid:
```env
RELAY_HOST=smtp.sendgrid.net:587
RELAY_USERNAME=apikey
RELAY_PASSWORD=your-sendgrid-api-key
```

### DNS Zone Management

PowerDNS API endpoint: `http://localhost:8081`

Create a zone:
```bash
curl -X POST http://localhost:8081/api/v1/servers/localhost/zones \
  -H "X-API-Key: pdns-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "example.com.",
    "kind": "Native",
    "nameservers": ["ns1.example.com."]
  }'
```

## Volume Management

### Backup Volumes
```bash
# Backup database
docker run --rm -v docker-gui-data:/data -v $(pwd):/backup alpine tar czf /backup/docker-gui-backup.tar.gz /data

# Backup Nginx configs
docker run --rm -v nginx-configs:/configs -v $(pwd):/backup alpine tar czf /backup/nginx-configs-backup.tar.gz /configs

# Backup SSL certificates
docker run --rm -v ssl-certificates:/certs -v $(pwd):/backup alpine tar czf /backup/ssl-certs-backup.tar.gz /certs
```

### Restore Volumes
```bash
# Restore database
docker run --rm -v docker-gui-data:/data -v $(pwd):/backup alpine sh -c "cd / && tar xzf /backup/docker-gui-backup.tar.gz"
```

## SSL Certificate Setup

### Let's Encrypt (Automatic)

1. **Initial certificate request:**
```bash
docker-compose -f docker-compose.production.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@yourdomain.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com \
  -d www.yourdomain.com
```

2. **Auto-renewal** is handled by the Certbot container (checks every 12 hours)

### Manual Certificates

Place your certificates in the `ssl-certificates` volume:
```
/etc/nginx/ssl/yourdomain.com/
├── fullchain.pem
└── privkey.pem
```

## Networking

All services are on the `docker-gui-network` bridge network (172.20.0.0/16):
- Enables inter-container communication
- Isolates from other Docker networks
- Custom subnet for better organization

## Monitoring & Logs

### View logs:
```bash
# Docker GUI logs
docker-compose -f docker-compose.full.yml logs -f docker-gui

# Nginx logs
docker-compose -f docker-compose.full.yml logs -f nginx-proxy

# Email logs
docker-compose -f docker-compose.full.yml logs -f mailhog
# or
docker-compose -f docker-compose.production.yml logs -f postfix

# DNS logs
docker-compose -f docker-compose.full.yml logs -f powerdns
```

### Access containers:
```bash
# Docker GUI shell
docker exec -it docker-gui sh

# Nginx shell
docker exec -it nginx-proxy sh

# Check Nginx config
docker exec nginx-proxy nginx -t
```

## Common Tasks

### Reload Nginx:
```bash
docker exec nginx-proxy nginx -s reload
```

### Test email sending:
```bash
# With MailHog (dev)
docker exec docker-gui node -e "
const nodemailer = require('nodemailer');
const transport = nodemailer.createTransport({
  host: 'mailhog',
  port: 1025
});
transport.sendMail({
  from: 'test@example.com',
  to: 'recipient@example.com',
  subject: 'Test',
  text: 'Test email'
}).then(() => console.log('Sent!'));
"
```

### Query DNS:
```bash
# Check DNS server
dig @localhost example.com

# Or using docker
docker exec powerdns pdnsutil list-all-zones
```

## Troubleshooting

### Nginx won't start:
```bash
# Check config syntax
docker exec nginx-proxy nginx -t

# View error logs
docker logs nginx-proxy

# Restart nginx
docker restart nginx-proxy
```

### Email not sending:
```bash
# Check postfix logs
docker logs postfix

# Test SMTP connection
docker exec -it postfix telnet localhost 25
```

### DNS issues:
```bash
# Check PowerDNS status
docker exec powerdns pdns_control status

# View DNS logs
docker logs powerdns
```

### Permission issues:
```bash
# Fix docker.sock permissions
sudo chmod 666 /var/run/docker.sock

# Or add user to docker group
sudo usermod -aG docker $USER
```

## Security Notes

1. **Change default passwords** in `.env`
2. **Use strong JWT_SECRET** (generate with `openssl rand -hex 32`)
3. **Enable HTTPS** in production
4. **Restrict PowerDNS API** access in production
5. **Configure firewall** rules for exposed ports
6. **Use secure relay** for email (Gmail, SendGrid, etc.)
7. **Backup volumes** regularly
8. **Keep containers updated**: `docker-compose pull && docker-compose up -d`

## Production Checklist

- [ ] Set strong `JWT_SECRET`
- [ ] Configure admin credentials
- [ ] Set up email relay (Gmail/SendGrid)
- [ ] Configure domain name
- [ ] Request SSL certificates
- [ ] Enable HTTPS redirect in Nginx
- [ ] Configure DNS zones
- [ ] Set up backups
- [ ] Configure firewall
- [ ] Set up monitoring
- [ ] Test email delivery
- [ ] Test SSL certificates
- [ ] Test DNS resolution

## Updating

```bash
# Pull latest images
docker-compose -f docker-compose.full.yml pull

# Restart with new images
docker-compose -f docker-compose.full.yml up -d

# Or rebuild Docker GUI
docker-compose -f docker-compose.full.yml up -d --build docker-gui
```

## Scaling

To run multiple instances behind a load balancer:

```yaml
docker-gui:
  deploy:
    replicas: 3
    update_config:
      parallelism: 1
      delay: 10s
    restart_policy:
      condition: on-failure
```

