# docker-gui

Self-hosted server management. One UI for Docker, reverse proxy + SSL,
databases, on-premise email, S3-compatible storage, DNS, and system
metrics.

> **Status: alpha.** Phases 0–3 shipped: auth, Docker resources
> (containers / images / volumes / networks), Sites with Caddy + auto-HTTPS,
> production deployment via a one-line installer + CLI. See
> [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.

---

## Install

On your Linux server (Ubuntu 22.04+, Debian 11+, RHEL 9+ — fresh or
existing), paste this and press Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/ack-solutions/docker-gui/develop/scripts/install.sh | sudo bash
```

That's it. The installer takes 3–5 minutes and:

- Installs Docker if it isn't already
- Downloads the latest release (or `develop` if no release is published yet)
- Generates random secrets in `/opt/docker-gui/.env`
- Builds and starts the api / web / caddy containers
- Installs the `docker-gui` CLI to `/usr/local/bin`

When it finishes you'll see your URL and a one-time setup secret. Open
the URL, paste the secret, create your admin — you're in.

**Re-run the same command to upgrade.** Your data, secrets, and config
are preserved.

Custom port, install dir, air-gapped install, inspect-script-first: see
**[docs/INSTALL.md](docs/INSTALL.md)**.

---

## Day-to-day

After install, every common operation is one command.

```bash
docker-gui status            # see what's running
docker-gui logs api          # tail logs
docker-gui config            # edit /opt/docker-gui/config.yml + auto-restart
docker-gui doctor            # diagnose problems
docker-gui update            # upgrade to the latest version
docker-gui backup            # tarball the database
docker-gui admin reset alice@example.com 'NewPass1'
```

CLI reference: **[docs/CLI.md](docs/CLI.md)**

---

## What works today

| Area                              | Status     |
| --------------------------------- | ---------- |
| Auth (login, refresh, RBAC)       | ✅ shipped |
| First-admin bootstrap from UI     | ✅ shipped |
| Container management              | ✅ shipped |
| Image pull / list / remove        | ✅ shipped |
| Volume + Network manage + prune   | ✅ shipped |
| Health dashboard + system metrics | ✅ shipped |
| Sites: domains + auto-HTTPS (Caddy)| ✅ shipped|
| DNS automation (Cloudflare)       | ✅ shipped |
| Live container log streaming (WS) | ✅ shipped |
| Production install / update / CLI | ✅ shipped |
| YAML config + secrets separation  | ✅ shipped |
| Container exec terminal (xterm)   | 🛠 next    |
| Postgres GUI                      | 🛠 later   |
| Email server (Mailu wizard)       | 🛠 later   |
| MinIO / S3 storage                | 🛠 later   |

---

## Documentation

### For users

- **[INSTALL.md](docs/INSTALL.md)** — install, update, troubleshoot, uninstall
- **[CONFIG.md](docs/CONFIG.md)** — `config.yml` + `.env` reference
- **[CLI.md](docs/CLI.md)** — `docker-gui` command reference

### For contributors

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — what we're building, why,
  tech stack, security model
- **[ROADMAP.md](docs/ROADMAP.md)** — phased plan
- **[DEVELOPMENT.md](docs/DEVELOPMENT.md)** — local dev workflow + tests
- **[COMPONENTS.md](docs/COMPONENTS.md)** — UI design system

---

## Repo layout

```
docker-gui/
├── apps/
│   └── api/                 # Fastify backend (Docker, auth, sites, system)
├── src/                     # Next.js web app (UI only)
│   ├── app/                 # Pages: /login, /containers, /images,
│   │                        # /volumes, /networks, /sites, /health
│   ├── components/          # Design system primitives
│   └── lib/v2/              # Auth client + API helpers
├── docker/                  # Production Dockerfiles + Caddy bootstrap
├── docker-compose.yml       # Production stack: api + web + caddy
├── config.yml               # User config template (well-commented)
├── scripts/
│   ├── install.sh           # One-line installer
│   ├── cli.sh               # `docker-gui` command (installed to /usr/local/bin)
│   ├── doctor.sh            # Health diagnostics
│   └── uninstall.sh         # Clean removal
└── docs/                    # All the manuals above
```

---

## Local development

```bash
# Terminal 1 — API (Fastify, port 4000)
cd apps/api
yarn install
cp .env.example .env
npx prisma migrate deploy
yarn dev

# Terminal 2 — Web (Next.js, port 3000)
yarn install
yarn dev
```

Open <http://localhost:3000>. Tests + typecheck:

```bash
yarn api:test        # 193 backend tests, ~3s
yarn api:typecheck   # strict TS, zero errors
yarn typecheck       # web, strict, zero errors
yarn build           # production build, all routes dynamic
```

Full guide: **[DEVELOPMENT.md](docs/DEVELOPMENT.md)**

---

## License

MIT
