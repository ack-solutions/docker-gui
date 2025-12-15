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
- Domain and DNS management (Cloudflare, Route53, or Manual)
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
docker-compose -f docker-compose.yml up -d

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
| Native | `sudo ./scripts/install.sh` | 5 min | No Docker needed |

## Configuration

**Docker GUI uses `.env` for secrets/database plus `config.yml` for feature toggles.**

> Tip: You can reference host environment variables anywhere inside `config.yml` using `${VAR}` or `${VAR:-fallback}`.  
> Example: `port: ${APP_PORT:-3000}` or `jwtSecret: "${JWT_SECRET:-change-me}"`.

### Quick Setup

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Edit .env values (port, secrets, database, SMTP, ...)
nano .env

# 3. Adjust config overrides if needed
nano config.yml

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

## Authentication

- Login required for all features
- Bootstrap and maintenance are done via CLI scripts
- Login at: http://localhost:3000/auth/login
- Manage users in: User Management section
- JWT-based sessions with configurable timeout

## Database

- Prisma ORM with SQLite (default)
- Automatic migrations on startup via `yarn db:migrate`
- Configurable in `config.yml`:
  ```yaml
  database:
    type: "sqlite"
    path: "/var/lib/docker-gui/docker-gui.db"
  ```

**Commands:**
```bash
yarn db:migrate         # Run migrations
yarn db:seed            # Ensure base settings
yarn db:migrate:reset   # Reset database (DANGEROUS)
```

## Local Setup

If you prefer an interactive bootstrap, run:

```bash
./setup.sh
```

The helper installs dependencies, runs migrations/seeds, and creates the first administrator after prompting for credentials.

1. **Copy env template:** `cp .env.example .env` and fill in secrets (setup + JWT), database URL, SMTP, etc.
2. **Optionally adjust `config.yml` for hostnames/feature flags.**
3. **Install dependencies:** `yarn install`
4. **Prepare the database:**  
   ```bash
   yarn prisma:generate   # optional, runs automatically on postinstall
   yarn db:migrate
   yarn db:seed
   ```
5. **Start the dev server:** `yarn dev`
6. **Bootstrap the first administrator (CLI):**
   ```bash
   # Using direct tsx
   npx tsx scripts/create-admin.ts admin@example.com "Super Administrator" "ChangeMe123!"

   # Or via package scripts
   yarn user:create-admin admin@example.com "Super Administrator" "ChangeMe123!"
   ```
   Then sign in at `/auth/login`.

   Need to reset a password later?
   ```bash
   # Using direct tsx
   npx tsx scripts/reset-password.ts admin@example.com "NewStrongPass123!"

   # Or via package scripts
   yarn user:reset-password admin@example.com "NewStrongPass123!"
   ```

## Domain Management

- Three DNS workflows per domain:
  1. **Nameserver managed** – update your registrar to point NS records at Docker GUI and manage all records here.
  2. **Provider API** – connect Cloudflare (zone ID + API token) or other providers and the platform synchronizes desired records automatically.
  3. **Manual / proxy-only** – keep DNS elsewhere while still routing traffic through nginx/SSL managed here.
- Cloudflare is supported out of the box (zone-scoped API token + zone ID with DNS:Edit permissions). Additional providers share the same pluggable adapter.
- Subdomains can inherit or override their parent configuration. Link entries via the *Parent Domain* selector and point each child at different upstream ports or services.
- Advanced nginx directives per domain/subdomain (custom blocks injected in the generated server config).
- SSL options: Let’s Encrypt automation, reuse uploaded certificates across domains, or manually assign certificates per subdomain.

## Production Deployment

1. **Provision infrastructure** – a Linux host with Docker Engine or Kubernetes works; ensure ports 80/443 are reachable if you want Let’s Encrypt.
2. **Deploy a production `config.yml`** with the secrets you intend to use:
   ```yaml
   setup:
     initialSecret: "super-long-random-secret"
   security:
     jwtSecret: "another-long-secret"
   database:
     type: "sqlite"
     path: "/app/data/docker-gui.db"   # or configure postgres/mysql here
   ```
   Extend the file with SMTP/DNS/NGINX settings as required by your environment.
3. **Build and launch the stack** (Docker example):
   ```bash
   docker compose -f docker-compose.production.yml up -d --build
   ```
4. **Run migrations once** (if you disable the entrypoint hook): `docker compose exec docker-gui yarn db:migrate && yarn db:seed`
5. **Bootstrap the administrator** using the public hostname:
   ```bash
   curl -X POST https://your-domain.com/api/setup/bootstrap \
     -H "Content-Type: application/json" \
     -H "x-setup-secret: <setup.initialSecret>" \
     -d '{"email":"admin@your-domain.com","password":"ChangeMe123!","name":"Operations"}'
   ```
6. **Point DNS** – either change your NS records to the addresses shown on the installation page (managed mode) or connect Cloudflare/Route53 via the new Domain editor (provider mode).

Once the first admin is created you can finish the installation checklist inside the UI (domain provisioning, nginx configuration, SSL upload/issuance, etc.).

## Docker Compose

| File | Purpose | Services |
|------|---------|----------|
| `docker-compose.yml` | Simple dev | Docker GUI only |
| `docker-compose.yml` | Full dev | GUI + Nginx |
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
- **Email**: Configure SMTP settings (Postfix in production)
- **DNS**: Cloudflare, Route53, or Manual DNS management
- **SSL**: Let's Encrypt automation

## Helper Scripts

```bash
./scripts/setup-interactive.sh    # Interactive setup wizard
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
yarn config:validate    # Validate configuration

# Development
yarn dev                # Start development server
yarn build              # Build for production
yarn start              # Run production build
yarn lint               # Lint code

# Database
yarn db:migrate         # Run migrations
yarn db:seed            # Seed database
yarn db:migrate:reset   # Drop & reapply migrations (DANGEROUS)

# Utilities
yarn nginx:reload       # Reload Nginx configuration
yarn backup             # Backup all data
yarn ssl:request        # Request SSL certificate

# Tests
yarn test:domains       # Validate domain + SSL/Nginx API flows (creates temporary records)
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
├── .env.example        # Environment template
└── config.yml          # Active configuration overrides
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
nano config.yml

# Setup database
yarn db:migrate
yarn db:seed

# Start development server
yarn dev
```

Access: http://localhost:3000/auth/login


## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT
