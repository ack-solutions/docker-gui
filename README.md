# Docker GUI

A modern web interface for managing Docker infrastructure with integrated Nginx, Email, DNS, and SSL management. Built with Next.js and Material UI, featuring a responsive design that works as a mobile PWA.

## Features

**Docker Management**
- Container management with real-time metrics
- Image catalog with pull/push operations  
- Volume and network management
- Live log viewer with filtering
- Interactive terminal access
- File browser for containers

**Infrastructure Tools**
- Nginx reverse proxy configuration
- Domain and DNS management (PowerDNS)
- Email account management (SMTP)
- SSL certificate automation (Let's Encrypt)
- Proxy and load balancer setup

**Modern Interface**
- Responsive mobile-first design
- PWA support (installable as app)
- Bottom navigation on mobile
- Dark/light theme
- Real-time updates

## Quick Start

### Interactive Setup (Recommended)

```bash
# 1. Configure everything (asks for port, admin, features, etc.)
./scripts/setup-interactive.sh

# 2. Start with Docker
docker-compose -f docker-compose.full.yml up -d

# 3. Open http://localhost:3000 (or your chosen port)
# 4. Login with credentials from config.yml
```

### Quick Docker Start

```bash
docker-compose up -d
# Access: http://localhost:3000
# Login: admin@example.com (check logs for password)
```

### Native Installation (No Docker)

```bash
./scripts/setup-interactive.sh
sudo ./scripts/install.sh
# Service starts automatically
```

| Method | Command | Time | Best For |
|--------|---------|------|----------|
| Interactive | `./scripts/setup-interactive.sh` | 3 min | First-time users |
| Docker Simple | `docker-compose up -d` | 2 min | Quick testing |
| Docker Full | `docker-compose -f docker-compose.full.yml up -d` | 3 min | All features |
| Native | `sudo ./scripts/install.sh` | 5 min | No Docker needed |

### Documentation

- [Quick Start Guide](./docs/QUICK_START.md) - Get running in 5 minutes
- [Installation Guide](./docs/INSTALLATION.md) - Detailed installation for all platforms
- [Configuration Reference](./docs/CONFIGURATION.md) - Complete config.yml documentation
- [Config Usage Guide](./docs/CONFIG_USAGE.md) - How to use config in code ⭐ NEW
- [Docker Setup Guide](./docs/DOCKER_SETUP.md) - Docker services explained
- [Command Reference](./docs/COMMANDS.md) - All commands in one place

## Configuration

**Docker GUI uses a centralized `config.yml` file for all settings.**

### Quick Setup

```bash
# 1. Create config from template
cp config.example.yml config.yml

# 2. Edit your settings
nano config.yml

# 3. Generate .env (if using Docker)
./scripts/config-to-env.sh

# 4. Start the app
docker-compose up -d
```

### Key Configuration Sections

```yaml
app:
  port: 3000              # Web UI port
  environment: "production"

admin:
  email: "admin@example.com"
  password: "YourPassword"

features:
  nginxManagement: false  # Enable/disable features
  emailManagement: false
  dnsManagement: false

performance:
  metricsRefreshInterval: 5000
  logsRefreshInterval: 2000
```

**See:**
- [Configuration Guide](./docs/CONFIGURATION.md) - All configuration options
- [Config Usage Guide](./docs/CONFIG_USAGE.md) - How to use config in code
- [Config System Summary](./docs/CONFIG_SYSTEM_SUMMARY.md) - Complete technical guide

## Authentication

- Login required for all features
- Default admin user created on first run
- Configure admin credentials in `config.yml`:
  ```yaml
  admin:
    email: "admin@example.com"
    password: "YourPassword"  # Leave empty to auto-generate
    name: "Administrator"
  ```
- Login at: http://localhost:3000/auth/login
- Manage users in: User Management section
- JWT-based sessions with configurable timeout

## Database

- TypeORM with SQLite (default) or PostgreSQL/MySQL
- Automatic migrations on startup
- Configurable in `config.yml`:
  ```yaml
  database:
    type: "sqlite"
    path: "/var/lib/docker-gui/docker-gui.db"
  ```

**Commands:**
```bash
yarn db:migrate         # Run migrations
yarn db:seed            # Create admin user
yarn db:migrate:revert  # Rollback
```

## Docker Compose

| File | Purpose | Services |
|------|---------|----------|
| `docker-compose.yml` | Simple dev | Docker GUI only |
| `docker-compose.full.yml` | Full dev | GUI + Nginx + MailHog + DNS |
| `docker-compose.production.yml` | Production | GUI + Nginx + Postfix + DNS + SSL |

```bash
# Simple
docker-compose up -d

# Full stack
docker-compose -f docker-compose.full.yml up -d

# Production
docker-compose -f docker-compose.production.yml up -d
```

> **Windows:** Use WSL2 for Docker socket access

See [Docker Setup Guide](./docs/DOCKER_SETUP.md) for complete service documentation.

## Integrated Services

- **Nginx**: Reverse proxy with GUI management
- **Email**: MailHog (dev) or Postfix (prod)
- **DNS**: PowerDNS with API integration
- **SSL**: Let's Encrypt automation

## Helper Scripts

```bash
./scripts/setup-interactive.sh    # Interactive setup wizard
./scripts/config-to-env.sh        # Convert config.yml to .env  
./scripts/validate-config.sh      # Validate configuration
./scripts/nginx-reload.sh         # Reload Nginx
./scripts/backup.sh               # Backup data
./scripts/ssl-request.sh          # Request SSL certificate
sudo ./scripts/install.sh         # Native installation
```

See [scripts/README.md](./scripts/README.md) for detailed documentation.

## Available Scripts

```bash
# Setup
yarn setup              # Interactive configuration wizard
yarn config:generate    # Generate .env from config.yml
yarn config:validate    # Validate configuration

# Development
yarn dev                # Start development server
yarn build              # Build for production
yarn start              # Run production build
yarn lint               # Lint code

# Database
yarn db:migrate         # Run migrations
yarn db:seed            # Seed database
yarn db:migrate:revert  # Rollback migration

# Utilities
yarn nginx:reload       # Reload Nginx configuration
yarn backup             # Backup all data
yarn ssl:request        # Request SSL certificate
```

## Requirements

- Node.js 18.18+ (automatically installed by install scripts)
- Docker 20.10+ (if using Docker installation)
- 2GB RAM minimum
- 10GB disk space

## Project Structure

```
docker-gui/
├── src/
│   ├── app/            # Next.js App Router pages
│   ├── client/         # React components, features, stores
│   ├── server/         # Server-side code, database, services
│   └── types/          # Shared TypeScript types
├── docs/               # Documentation
├── scripts/            # Installation and utility scripts
├── config.example.yml  # Configuration template
└── config.yml          # Active configuration (user creates this)
```

## Development

```bash
# Clone and install
git clone <repo-url>
cd docker-gui
yarn install

# Configure
cp .env.example .env
nano .env

# Setup database
yarn db:migrate
yarn db:seed

# Start development server
yarn dev
```

Access: http://localhost:3000/auth/login

## Support & Documentation

All documentation is in the [docs/](./docs/) directory:

- [Quick Start](./docs/QUICK_START.md) - Get started in 5 minutes
- [Installation](./docs/INSTALLATION.md) - Detailed installation guide
- [Configuration](./docs/CONFIGURATION.md) - Configuration reference
- [Docker Setup](./docs/DOCKER_SETUP.md) - Docker services guide
- [Commands](./docs/COMMANDS.md) - Command reference
- [Scripts](./scripts/README.md) - Utility scripts documentation
- [Config Usage](./docs/CONFIG_USAGE.md) - How to use config in code
- [Config System](./docs/CONFIG_SYSTEM_SUMMARY.md) - Complete config system guide

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT
