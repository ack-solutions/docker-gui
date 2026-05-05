# Architecture

This document describes the **target architecture** for docker-gui. It is a fresh
design. The existing code is treated as a working prototype that informs the
rebuild but is not the source of truth — anything in this document overrides
prior implementation choices.

---

## 1. Goals

- Self-hosted server admin panel — a Docker-first replacement for cPanel / WHM /
  Plesk / Webmin, biased toward modern container workloads.
- One UI to manage: containers, databases, reverse proxy + SSL, on-prem email,
  S3-compatible storage on NAS, DNS, system metrics, and logs.
- Zero-friction install: one shell command on a fresh Linux server.
- Open source, MIT licensed, friendly to outside contributors.
- Easy to extend — clear plugin/integration boundary so new providers (DNS,
  email backends, storage backends) can be added without touching core.
- Secure by default — strict TypeScript, zod-validated inputs, no shell
  interpolation, JWT secret validated at boot, RBAC + audit log.

## 2. Non-goals (v1)

- Multi-tenancy. Each instance manages one server stack.
- Kubernetes / Docker Swarm orchestration. Single-host Docker Engine only.
- Native mobile apps. The web UI must be responsive; that is sufficient.
- Replacing existing IaC. We orchestrate live infra, we don't generate Terraform.
- Closed-source paid features. Everything in the repo runs without a license key.

## 3. Comparable projects

| Project    | Stack          | Strength                           | How we differ                                  |
| ---------- | -------------- | ---------------------------------- | ---------------------------------------------- |
| CapRover   | Node, Captain  | One-click app deploys              | We integrate proxy, email, DB, storage as peers |
| Coolify    | PHP / Laravel  | Beautiful UX, big community        | Lighter footprint, TypeScript end-to-end       |
| Portainer  | Go             | Mature Docker management           | We add domains, email, storage, DB GUI         |
| Cloudron   | Node           | App store + integrated email       | Open source by default, no per-app licensing   |
| Webmin     | Perl           | Mature, very broad surface         | Modern UX, Docker-native instead of bare-metal |
| Yunohost   | Bash / Python  | Strong email + DNS automation      | Container-first, not bare-metal Debian-first   |
| Mailcow    | PHP            | Best self-hosted mail UI           | We *embed* Mailcow rather than compete         |

Wedge: **Docker-native + integrated stack (proxy + DB GUI + email + storage +
DNS) + modern TypeScript codebase + truly open source**.

## 4. High-level architecture

```
┌────────────────────────────────────────────────────────────────┐
│                          Browser (UI)                          │
│        Next.js 15 (App Router) + MUI + TanStack Query          │
└──────────────┬─────────────────────────┬───────────────────────┘
               │ HTTPS (REST)            │ WSS (terminals/logs)
               ▼                         ▼
┌────────────────────────────────────────────────────────────────┐
│                 Fastify API (apps/api, port 4000)              │
│  Auth · zod validation · service layer · audit log · RBAC      │
└──┬───────────┬───────────┬──────────┬──────────┬───────────┬───┘
   │           │           │          │          │           │
   ▼           ▼           ▼          ▼          ▼           ▼
┌──────┐  ┌────────┐  ┌────────┐  ┌──────┐  ┌──────────┐  ┌──────┐
│Docker│  │ Caddy  │  │ MinIO  │  │Mailu │  │  pgweb   │  │ DNS  │
│ (UDS)│  │ admin  │  │  S3    │  │ stack│  │ sidecar  │  │ APIs │
└──────┘  └────────┘  └────────┘  └──────┘  └──────────┘  └──────┘
```

Caddy is the only inbound web edge. It auto-issues TLS and reverse proxies to
every public endpoint, including the admin panel itself. The API never opens
ports beyond a localhost socket; Caddy fronts it.

## 5. Repo structure (monorepo, Yarn workspaces + Turborepo)

```
docker-gui/
├── apps/
│   ├── web/           # Next.js 15 (UI only — no API routes)
│   ├── api/           # Fastify backend (HTTP + WebSocket + services)
│   └── cli/           # oclif-based `docker-gui` command
├── packages/
│   ├── shared/        # Types, zod schemas, error codes (web ↔ api contract)
│   ├── ui/            # Reusable React components (MUI base)
│   ├── config/        # YAML + env config loader (used by api + cli + scripts)
│   └── eslint-config/ # Shared lint preset
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   ├── Dockerfile.combined  # web+api in one image (for simple installs)
│   └── compose/
│       ├── compose.yml          # Default production
│       ├── compose.dev.yml      # Dev with hot reload
│       └── compose.full.yml     # +Mailu, +pgweb, +Loki
├── prisma/
│   └── schema.prisma  # Single Prisma schema, used by api
├── scripts/
│   ├── install.sh     # One-line install for end users
│   ├── update.sh      # Self-update
│   ├── backup.sh
│   └── restore.sh
├── docs/
├── .github/workflows/ # CI: lint, test, build, publish images
├── package.json       # Workspaces root
├── turbo.json         # Build pipeline
└── README.md
```

## 6. Tech stack & rationale

| Concern        | Choice                                | Why                                                       |
| -------------- | ------------------------------------- | --------------------------------------------------------- |
| Frontend       | Next.js 15 (App Router), React 19     | Familiar, great DX, RSC for fast page loads               |
| UI kit         | MUI v7                                | Already in use, mature, accessible                        |
| Server state   | TanStack Query                        | One source of truth — drop Redux                          |
| Client state   | Zustand (only when needed)            | Lighter than Redux, no boilerplate                        |
| Backend        | Fastify 5                             | Faster than Express, schema-first, first-class WebSocket  |
| Validation     | zod                                   | One schema reused for runtime + TS types                  |
| ORM            | Prisma 6                              | Already in use; type-safe queries                         |
| App DB         | SQLite (default), Postgres (optional) | SQLite = zero setup; Postgres for HA                      |
| Auth           | JWT (15m) + refresh (7d) + argon2id   | Modern, audited                                           |
| Reverse proxy  | Caddy                                 | Live JSON admin API; auto-HTTPS; no certbot dance         |
| Email          | Mailu (default), Mailcow (alt)        | Don't reinvent SMTP; integrate the best                   |
| DB GUI         | pgweb (sidecar)                       | Lightweight, single binary, embeds cleanly                |
| Object storage | MinIO                                 | Already integrated; mature S3-compatible                  |
| DNS            | Cloudflare API + manual               | 80% of users; Route53 added later                         |
| Logs           | Loki (optional) + native dockerode    | Loki for retention, dockerode stream for live tail        |
| Container mgmt | dockerode                             | Industry standard for Node.js                             |
| CLI            | oclif                                 | Subcommands, plugins, autocomplete                        |
| Test (unit)    | Vitest                                | Fast, ESM-native, Jest-compatible API                     |
| Test (e2e)     | Playwright                            | Cross-browser, fast, scriptable                           |
| Build          | Turborepo + tsup/esbuild              | Cached builds, parallel pipelines                         |
| Lint           | ESLint + Prettier                     | Standard                                                  |
| Distribution   | Multi-arch Docker images (amd64+arm64)| Run on any modern server, including Raspberry Pi 4+       |

## 7. Module breakdown

### 7.1 Core (`apps/api`)

- Fastify server bound to `127.0.0.1:4000` (Caddy fronts it; no public port)
- Plugins: `@fastify/jwt`, `@fastify/rate-limit`, `@fastify/cors`,
  `@fastify/websocket`, `@fastify/multipart`
- Route modules under `apps/api/src/routes/<feature>/`
- Service layer under `apps/api/src/services/<feature>/` — no DB or
  child-process calls in route handlers
- Single Prisma client instance, exposed via Fastify decorator
- Boot validation: every required env var checked before listening

### 7.2 Docker

- Wrapper around `dockerode` exposing typed methods (list, inspect, create,
  remove, exec, stats, logs, archive)
- WebSocket route `ws/docker/exec/:id` pipes a TTY through to the container
- WebSocket route `ws/docker/logs/:id` streams stdout/stderr with backpressure
- Stats poller backs the dashboard charts
- File browser uses dockerode `getArchive` / `putArchive` (no shell exec into
  containers for `ls`)

### 7.3 Reverse proxy (Caddy)

- Caddy runs as a sibling container; admin API on `127.0.0.1:2019`
- API service `caddy.service.ts` posts JSON config patches via the admin API
- Each "site" maps to one route in Caddy's `apps.http.servers["srv0"].routes`
- Auto-HTTPS by Caddy — no certbot. Custom certs uploaded → stored as
  `tls.certificates.load_files` entry
- Public ports 80/443 are owned by Caddy only
- Existing `NginxSite` Prisma model is renamed `Site` and the upstream stays
  the same; only the renderer changes

### 7.4 Domains & DNS

- Manual mode: UI shows the records to add at the registrar
- Cloudflare adapter: real implementation (zones list, DNS records CRUD)
- Route53 adapter: later
- Auto-records on email enable: MX, SPF, DKIM (key fetched from Mailu),
  DMARC, autodiscover/autoconfig
- DNS health checker: dig the live record, compare against expected, surface
  drift in UI

### 7.5 Email server (Mailu deploy wizard)

- Wizard collects: domain, postmaster email, hostname, storage path
- Generates a Mailu `docker-compose.yml` and `mailu.env` from a template
- Calls DNS adapter to create MX / SPF / DKIM / DMARC records
- Polls DNS until propagated, then starts the stack
- Our UI talks to Mailu's admin API for: domains, accounts, aliases, quotas,
  forwards. Mailu's own admin UI remains accessible at `mail.<domain>/admin`
- Mailcow adapter implements the same interface; user picks at install time

### 7.6 Database GUI

- "Databases" tab lists:
  - Postgres / MySQL containers (auto-discovered by image name + label)
  - External connection profiles (URL stored encrypted in DB)
- "Open Console" launches a `sosedoff/pgweb` (Postgres) or `phpmyadmin`
  (MySQL) sidecar, scoped to that DB, fronted by our auth via Caddy
- Per-DB backup/restore: one-shot `pg_dump` / `pg_restore` containers; output
  goes to MinIO bucket `dbgui-backups/`
- A simple SQL editor inline (using `pg` library) for quick queries; pgweb is
  the heavy tool for serious work

### 7.7 S3 Storage (MinIO)

- Existing service is a good base — port to `apps/api`
- UI: bucket list, object browser with multi-select, upload (multipart for
  large files), download, presigned URLs, lifecycle rules, versioning toggle
- Service accounts + policy editor (visual policy builder, JSON fallback)
- NAS integration: MinIO gateway mode against a mounted NFS / SMB share
- Bucket-level RBAC inside docker-gui (separate from MinIO IAM): which
  panel users can see which buckets

### 7.8 System monitoring

- CPU / memory / disk metrics from `os` + `procfs` (existing impl is fine)
- Container metrics via dockerode stats stream (one stream per container,
  multiplexed over a single WebSocket)
- Aggregated logs view: dockerode log stream + journald (via DBus) +
  optional Loki for retention beyond N days
- Alerts: simple thresholds (CPU > 80% for 5m, disk > 90%, container
  unhealthy) → email + webhook

### 7.9 Auth & users

- JWT (15m TTL) + refresh token (7d, rotating) — refresh stored hashed in DB
- argon2id password hashing (parameters tuned for 100ms hash time)
- RBAC: predefined roles (Owner, Admin, Operator, Viewer) + per-feature
  permission overrides
- Audit log table — every state-changing API call writes a row with actor,
  action, target, timestamp, and request ID
- 2FA TOTP — Phase 7
- SSO via OIDC (GitHub / Google / generic) — Phase 7+

### 7.10 CLI (`apps/cli`)

```
docker-gui install         # Bootstrap on a fresh server
docker-gui start | stop | restart | status
docker-gui admin reset <email>
docker-gui admin create <email> <name>
docker-gui backup [--out path]
docker-gui restore <archive>
docker-gui logs [--follow] [<feature>]
docker-gui health
docker-gui update
docker-gui doctor          # Diagnoses common issues
```

The CLI is the *same* binary used by `install.sh`. It reads the same config.

## 8. Data model

Existing Prisma schema is the starting point. Renames and additions:

- `NginxSite` → `Site` (proxy-agnostic; renderer is Caddy)
- New: `RefreshToken` (id, userHash, tokenHash, expiresAt, revokedAt)
- New: `AuditLog` (id, actor, action, targetType, targetId, payload, ip, ts)
- New: `BackupJob` (id, type, status, output, sizeBytes, createdAt)
- New: `Plugin` (id, name, version, enabled, config)
- New: `DatabaseConnection` (id, type, host, port, user, passwordEnc, name, ssl)
- Existing `EmailAccount` stays for the *client* mailbox feature; the *server*
  is delegated to Mailu and surfaced via API only (no Prisma mirror)

App DB defaults to SQLite at `/var/lib/docker-gui/app.db` (single file —
trivial backup). Postgres is supported for HA setups.

## 9. API conventions

- All routes under `/api/v1/<feature>/...`
- Request schema validated by Fastify's `schema` option (zod adapter)
- Response shape:
  - Success: `{ data: T, meta?: { page, total } }`
  - Failure: `{ error: { code, message, details? } }`
- Error codes are namespaced strings: `auth.invalid_token`,
  `docker.container.not_found`, `domain.dns_not_propagated`
- Auth via `Authorization: Bearer <jwt>`; WebSocket via `?token=` query param
  (browsers cannot set headers on WS)
- Pagination: `?page=1&pageSize=50`; max 200
- Idempotency: `Idempotency-Key` header honored on all POSTs that create
  external state (DNS records, container creates)

## 10. Security model

| Risk                              | Mitigation                                                       |
| --------------------------------- | ---------------------------------------------------------------- |
| Shell injection                   | `execFile` with array args only; lint rule bans `exec`/`spawn`   |
| Missing JWT secret in prod        | Validated at boot; ≥32 bytes; entropy check; refuses to start    |
| Weak passwords                    | argon2id, min 12 chars, zxcvbn score ≥3                          |
| CSRF                              | SameSite=Strict cookies + custom `x-dgui-csrf` header on writes  |
| Brute-force login                 | Per-IP and per-account rate limit; lockout after 10 fails        |
| Unauthenticated Docker socket use | Socket only mounted in api container; never exposed to UI        |
| Hardcoded MinIO defaults          | Generated at install time with `openssl rand -hex 32`            |
| Dependency CVEs                   | Renovate bot; weekly `npm audit` in CI                           |
| Container image tampering         | Images signed with cosign; verified at pull                      |
| Data at rest                      | Volume-level encryption is user responsibility; secrets at rest  |
|                                   | encrypted with key from env var                                  |
| Accidental public exposure        | Caddy is the only inbound port; admin panel requires auth + IP   |
|                                   | allowlist option                                                 |
| Audit                             | Every state change written to AuditLog; queryable from UI        |

## 11. Configuration model

Three layers, in precedence order:

1. **Environment variables** — secrets and overrides
   (`JWT_SECRET`, `DATABASE_URL`, `CLOUDFLARE_API_TOKEN`, …)
2. **`config.yml`** — operational config (ports, feature flags, paths,
   default domain, retention windows). Versioned in git for the user.
3. **DB `Setting` table** — runtime settings changed via the UI.

All three are loaded into a single typed `Config` object validated by zod at
boot. If validation fails the API exits with a clear error message and
non-zero exit code so systemd / Docker restart loops give immediate signal.

Config file path: `/etc/docker-gui/config.yml` (Linux), `./config.yml` (dev).
`.env` lives next to it. Both are referenced by `config-loader` from
`packages/config`.

## 12. Plugin model (v2 goal — design now to avoid lock-in)

A plugin is a Docker image plus a manifest that registers:

- Routes it wants exposed under `/plugins/<name>/...`
- Hooks it subscribes to (`onContainerCreate`, `onSiteApply`, etc.)
- Permissions it needs (Docker socket, FS path, network)
- An optional UI panel mounted via iframe sandbox

Core ships without plugins. Cloudflare DNS is a plugin. Mailu is a plugin.
This keeps the core small and lets the community ship adapters.

## 13. What we keep from the current code

| Keep                                                       | Action                                  |
| ---------------------------------------------------------- | --------------------------------------- |
| `prisma/schema.prisma` (most models)                       | Extend, rename `NginxSite` → `Site`     |
| `src/server/docker/service.ts`                             | Port to `apps/api`, drop direct shell   |
| `src/server/storage/minio.service.ts`                      | Port to `apps/api`, harden inputs       |
| `src/server/system/metrics-service.ts`                     | Port; tighten types                     |
| Auth core (JWT logic) in `src/server/auth/`                | Port; add refresh tokens; argon2id      |
| MUI theme & component patterns under `src/client/`         | Move to `packages/ui/`                  |
| Domain / nginx data model                                  | Keep schema; swap renderer to Caddy     |

## 14. What we throw away

- All `src/app/api/**/route.ts` Next.js API routes (move to Fastify)
- Redux store and slices
- `child_process.exec` callsites in routes (rewrite as service calls)
- Current `tsconfig.json` (start fresh, strict mode on)
- Mock email admin provider (replaced by real Mailu adapter)
- `src/app/api/proxies/**` (replaced by Caddy-backed Site routes)
