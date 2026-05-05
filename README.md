# docker-gui

Self-hosted server management. One UI for Docker, databases, reverse
proxy, on-premise email, S3-compatible storage, DNS, and system metrics.

> **Status: alpha — under active rebuild.** Phases 0–2 are shipped:
> auth + containers + images + volumes + networks + health, with
> production deployment via a one-line installer. See
> [docs/ROADMAP.md](docs/ROADMAP.md) for the rest.

## One-line install (Linux)

```bash
curl -fsSL https://get.docker-gui.io/install.sh | sudo bash
```

The installer detects your OS, installs Docker if missing, generates
secrets, builds the images, starts the stack, and prints your setup
secret. Open `http://<your-server>:3000`, paste the secret to create the
first admin, you're in.

Detail in [docs/SETUP.md](docs/SETUP.md).

## Local dev (macOS / Linux)

```bash
# Terminal 1 — API
cd apps/api
yarn install                # first time
cp .env.example .env        # first time
npx prisma migrate deploy   # first time
yarn dev                    # http://127.0.0.1:4000

# Terminal 2 — Web (repo root)
yarn install                # first time
yarn dev                    # http://localhost:3000
```

Detail in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Repo layout

```
docker-gui/
├── apps/
│   └── api/                  # Fastify backend — Docker, auth, system
├── src/                      # Next.js web app — UI only
│   ├── app/                  # Pages: /login, /containers, /images,
│   │                         # /volumes, /networks, /health
│   ├── components/           # Design system — single source of UI primitives
│   └── lib/v2/               # Auth client + API helpers
├── docker/                   # Production Dockerfiles (api + web)
├── docker-compose.yml        # Production stack
├── scripts/
│   ├── install.sh            # One-line installer
│   ├── doctor.sh             # Health diagnostics
│   └── uninstall.sh          # Clean removal
└── docs/                     # Architecture, roadmap, setup, dev, components
```

## Run tests + checks

```bash
yarn api:test        # 150 backend tests, ~2s
yarn api:typecheck   # strict TS, zero errors
yarn typecheck       # web, strict, zero errors
yarn build           # production build, 7 dynamic routes

./scripts/doctor.sh  # diagnose your install or your host
```

## Documentation

Read in this order:

1. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — what we're building, why,
   tech stack rationale, security model, repo structure
2. [docs/ROADMAP.md](docs/ROADMAP.md) — 12-week phased plan
3. [docs/SETUP.md](docs/SETUP.md) — production install on any Linux server
4. [docs/SCRIPTS.md](docs/SCRIPTS.md) — install, doctor, uninstall reference
5. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) — local dev workflow + tests
6. [docs/COMPONENTS.md](docs/COMPONENTS.md) — UI design system
7. Phase notes:
   [PHASE_0_RUN.md](docs/PHASE_0_RUN.md) ·
   [PHASE_1_RUN.md](docs/PHASE_1_RUN.md) ·
   [PHASE_2_RUN.md](docs/PHASE_2_RUN.md)

## What works today

| Feature                      | Status     |
| ---------------------------- | ---------- |
| Auth (login, refresh, RBAC)  | ✅ shipped |
| First-admin bootstrap        | ✅ shipped |
| Container management         | ✅ shipped |
| Image pull / list / remove   | ✅ shipped |
| Volume list / remove / prune | ✅ shipped |
| Network list / remove / prune| ✅ shipped |
| Health dashboard + metrics   | ✅ shipped |
| Production Docker deployment | ✅ shipped |
| Doctor / install / uninstall | ✅ shipped |
| Reverse proxy (Caddy + SSL)  | 🛠 Phase 3 |
| Postgres GUI                 | 🛠 Phase 4 |
| Email server (Mailu wizard)  | 🛠 Phase 5 |
| MinIO / S3 storage           | 🛠 Phase 6 |
| Real-time terminals + logs   | 🛠 Phase 7 |
| CLI + image publishing       | 🛠 Phase 8 |

## License

MIT
