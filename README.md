# docker-gui

Self-hosted server management. One UI for Docker, reverse proxy + SSL,
databases, on-premise email, S3-compatible storage, DNS, and system
metrics.

> **Status: alpha.** Phases 0–3 shipped: auth, Docker resources
> (containers / images / volumes / networks), Sites with Caddy + auto-HTTPS,
> production deployment via a one-line installer + CLI. See
> [docs/ROADMAP.md](docs/ROADMAP.md) for what's next.

---

## Install on a fresh Linux server

> **Alpha note:** until pre-built images ship, the install runs a build
> step on the target server. The eventual public one-liner is
> `curl -fsSL https://get.docker-gui.io/install.sh | sudo bash`; today
> you point the installer at your own copy of the source.

Simplest path right now — copy the source to the server and run with
`DOCKER_GUI_LOCAL=1`:

```bash
# On your laptop (in this repo):
tar czf /tmp/docker-gui.tar.gz \
  --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude='apps/api/data' --exclude='apps/api/node_modules' .
scp /tmp/docker-gui.tar.gz user@your-server:/tmp/

# On the server:
ssh user@your-server
mkdir -p /tmp/dgui-src && cd /tmp/dgui-src
tar xzf /tmp/docker-gui.tar.gz
DOCKER_GUI_LOCAL=1 sudo -E ./scripts/install.sh
```

The installer generates secrets, builds the Docker images, starts the
stack, installs the `docker-gui` CLI, and prints your URL + a one-time
setup secret. Open the URL, paste the secret, create the first admin,
you're in.

Other paths (GitHub fork, explicit tarball URL, manual compose):
**[docs/INSTALL.md](docs/INSTALL.md)**

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

- **[INSTALL.md](docs/INSTALL.md)** — install on any Linux server
- **[CONFIG.md](docs/CONFIG.md)** — `config.yml` + `.env` reference
- **[UPDATE.md](docs/UPDATE.md)** — updating, rolling back, automation
- **[CLI.md](docs/CLI.md)** — `docker-gui` command reference
- **[SCRIPTS.md](docs/SCRIPTS.md)** — install / doctor / uninstall internals

### For contributors

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — what we're building, why,
  tech stack, security model
- **[ROADMAP.md](docs/ROADMAP.md)** — phased plan
- **[DEVELOPMENT.md](docs/DEVELOPMENT.md)** — local dev workflow + tests
- **[COMPONENTS.md](docs/COMPONENTS.md)** — UI design system

### Phase notes (delivery log)

- [PHASE_0_RUN.md](docs/PHASE_0_RUN.md) — foundation
- [PHASE_1_RUN.md](docs/PHASE_1_RUN.md) — auth + containers
- [PHASE_2_RUN.md](docs/PHASE_2_RUN.md) — images + volumes + networks + production stack
- [PHASE_3_RUN.md](docs/PHASE_3_RUN.md) — Sites + Caddy

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
