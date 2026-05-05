# Roadmap

A 12-week phased rebuild. Each phase produces something releasable and tested
on its own. Weeks are calendar-week budget assuming one full-time developer;
slip is normal — the *order* matters more than the dates.

The first public release (`v0.1.0`, alpha) ships at the end of Phase 5.
A general-availability `v1.0.0` ships after Phase 7.

---

## Phase 0 — Foundation (Weeks 1–2)

**Goal:** make the codebase a place where new features can be added safely.
No new features; only structural fixes.

**Deliverables**
- Monorepo scaffold: `apps/web`, `apps/api`, `apps/cli`, `packages/shared`,
  `packages/ui`, `packages/config`, Yarn workspaces + Turborepo
- Fastify API skeleton bound to `127.0.0.1:4000` with health endpoint
- Next.js app with `next.config.mjs` set to proxy `/api/*` to the Fastify port
  in dev (production proxying is handled by Caddy)
- Strict TypeScript everywhere: `strict: true`, `noUncheckedIndexedAccess: true`,
  `exactOptionalPropertyTypes: true`. Zero `any` in shared types
- zod schema and shared error-code enum in `packages/shared`
- ESLint config that bans `child_process.exec`, `eval`, raw template strings
  in `execFile` args, and `as any` (warn → error gradient)
- Vitest set up for `apps/api`, `apps/web`, `packages/shared`
- Playwright e2e harness, one smoke test (login → dashboard)
- GitHub Actions CI: lint + typecheck + test on every PR
- Prisma schema migrated as-is; SQLite for dev, Postgres-compatible for prod
- Auth port: JWT issuance + verification; argon2id; refresh tokens; rate limit
- Boot validator: refuses to start if `JWT_SECRET` missing, weak, or default
- Audit log writer wired into a Fastify `onResponse` hook for state-changing
  routes
- Dockerfiles: `Dockerfile.api`, `Dockerfile.web`, `Dockerfile.combined`
- `compose.dev.yml` for local dev, `compose.yml` for production

**Tests written**
- Auth: login flow, JWT verify, refresh rotation, lockout after N fails
- Boot validator: every required env var
- Rate limit: 429 after threshold
- Health endpoint
- One Playwright e2e: login → dashboard renders

**Acceptance**
- `yarn dev` runs both apps with hot reload
- `docker compose -f compose.yml up -d` runs production locally
- `yarn test` passes; CI green
- `curl http://localhost:4000/api/v1/health` returns `{ data: { ok: true } }`
- Login works end-to-end

**Risks**
- Migrating data from current SQLite/Postgres app DB. Mitigation: write a
  migration script; current schema is mostly compatible.

---

## Phase 1 — Docker + Storage (Week 3)

**Goal:** rebuild the two best-existing features cleanly and ship a usable
"Docker + S3 manager" alpha.

**Deliverables**
- Port `dockerode` service to `apps/api/src/services/docker/`
- Routes: list/inspect/create/start/stop/restart/remove containers, images,
  volumes, networks; prune; logs (HTTP tail + WebSocket follow); exec
  (WebSocket TTY); file browser via archive APIs
- Container stats stream over WebSocket (multiplexed)
- Port MinIO service; harden inputs with zod
- Bucket browser with upload (multipart), download, delete, presigned URLs
- Service account + policy editor (visual + JSON)
- `apps/web` pages: `/docker/containers`, `/docker/images`, `/docker/volumes`,
  `/docker/networks`, `/storage/buckets`, `/storage/buckets/[name]`
- Resource list base component (already in progress on the current branch —
  finish and standardize)

**Tests**
- Each Docker service method: integration test against a real Docker daemon
  in CI (using a Docker-in-Docker service)
- MinIO service: integration test against `minio/minio` container
- One Playwright e2e: create container from UI, see it in list, exec into it,
  remove it
- One Playwright e2e: create bucket, upload file, download it, delete

**Acceptance**
- All Docker UI flows work without errors in browser console
- WebSocket terminal survives browser tab being backgrounded for 5 minutes
- Bucket upload succeeds for a 1 GB file
- Container creation respects RBAC (Viewer cannot create)

**Risks**
- WebSocket reconnect logic is fiddly. Budget 1 day for tuning.

---

## Phase 2 — Domains, Caddy, SSL (Weeks 4–5)

**Goal:** Caddy replaces nginx as the reverse proxy. Domain wizard works end
to end with automatic HTTPS.

**Deliverables**
- Caddy admin-API client in `apps/api/src/services/caddy/`
- `Site` model (renamed from `NginxSite`)
- Caddy config renderer: takes a list of `Site` rows + DB `Setting` overrides
  and produces a JSON config posted to Caddy
- Domain wizard:
  1. Enter domain
  2. Pick DNS mode (manual / Cloudflare)
  3. Show records to add (manual) or auto-create (Cloudflare)
  4. Wait for DNS propagation (live dig poll)
  5. Pick upstream (existing container / external URL / static folder)
  6. Caddy issues TLS automatically
- Cloudflare adapter (real impl): zones list, records CRUD, propagation poll
- DNS health checker: drift detection between desired and live records
- Custom cert upload (cert + key → Caddy `load_files`)
- nginx code path removed; data migrated to `Site` rows

**Tests**
- Caddy renderer: snapshot tests for common site shapes
- Cloudflare adapter: mocked HTTP integration tests; live test gated by env
- Domain wizard: Playwright walks through against a test domain controlled by
  the project (a real DNS test domain we own)

**Acceptance**
- Add a brand-new subdomain pointing at a container; HTTPS works in <2 min
- Removing a site removes the Caddy route and (optionally) the DNS record
- Migrated nginx sites continue to work after swap

**Risks**
- Caddy TLS issuance can fail silently if upstream is on a non-public port
  during the ACME challenge. Mitigation: use HTTP-01 with Caddy's built-in
  handling; fall back to DNS-01 when DNS adapter is configured.

---

## Phase 3 — Database GUI (Week 6)

**Goal:** browse and manage Postgres / MySQL databases living in containers
on this server, plus external connections.

**Deliverables**
- "Databases" page lists discovered DB containers (label heuristic +
  image-name match) and external connection profiles
- "Connect" action launches a `sosedoff/pgweb` sidecar bound to the chosen
  DB, exposed under `/plugins/pgweb/<id>/` via Caddy + auth check
- For MySQL: `phpmyadmin` sidecar with the same pattern
- Inline SQL editor (single query, table render) using the `pg` / `mysql2`
  driver — for quick lookups without spinning up a sidecar
- Per-DB backup: one-shot `pg_dump` container writes to MinIO bucket
- Per-DB restore: one-shot `pg_restore` container reads from MinIO
- Backup history table + UI (`BackupJob` model)
- Scheduled backups via node-cron (config in `Setting`)

**Tests**
- pgweb sidecar lifecycle: launch, hit, kill, ensure no zombie
- Backup → restore round-trip on a real Postgres container in CI
- Auth proxy: unauthenticated request to pgweb sidecar is rejected

**Acceptance**
- Click "Open" on a Postgres container → pgweb loads in <3s already logged in
- A scheduled nightly backup runs and shows up in MinIO
- Restoring a backup repopulates the DB

**Risks**
- Sidecar resource leaks if user closes tab without closing connection.
  Mitigation: idle TTL on each launched sidecar (auto-stop after 30m idle).

---

## Phase 4 — Email server (Weeks 7–9)

**Goal:** "Click to deploy mail server for my domain" works end to end.

**Deliverables**
- Email-backend interface: `EmailBackend` (abstract) with two impls:
  - `MailuBackend` (default)
  - `MailcowBackend` (alt)
- Mail-deploy wizard:
  1. Pick backend (Mailu / Mailcow)
  2. Pick primary domain + hostname (e.g. `mail.example.com`)
  3. Pick storage path (default `/var/lib/docker-gui/mail`)
  4. Pick TLS mode (Caddy front / direct Let's Encrypt)
  5. Confirm DNS records to be created (MX, SPF, DKIM, DMARC, autoconfig)
  6. Auto-create records via DNS adapter (or show for manual)
  7. Generate compose file from template; start stack; run setup
  8. Wait for healthchecks
  9. Create postmaster account
- Account / alias / forward UI on top of the chosen backend's admin API
- Quota + storage usage view
- Per-account spam stats (Rspamd metrics)
- DKIM key rotation flow (regenerate + update DNS)
- Mailbox client (existing IMAP/SMTP UI) is updated to default to the new
  on-prem server

**Tests**
- Mailu adapter: mocked admin API + one live integration test in CI
  (deploy + create account + send + receive within a contained network)
- Wizard: Playwright walks through with a test domain

**Acceptance**
- New user with a fresh server can have working email in <15 min
- Sending a test email from the deployed server scores ≥9/10 on `mail-tester.com`
  (DKIM, SPF, DMARC all pass)
- Creating an account, alias, forward all work via our UI
- Existing mailbox client (read mail) works against the deployed server

**Risks**
- Self-hosted email is the hardest feature. Set explicit expectations: the
  user's outbound IP must not be on RBLs (we display a check); residential
  IPs / cloud IPs with reverse-DNS issues will fail. We refuse to deploy if
  port 25 outbound is blocked (we test at install).

---

## Phase 5 — Logs, system, alerts (Week 10)

**Goal:** observability.

**Deliverables**
- Aggregated log view: filter by container / system / app; search; tail
- Log retention via Loki (optional, opt-in) — without Loki we keep the last
  N MB per container in dockerode's native journal
- System metrics dashboard (CPU, memory, disk, network) with 7-day history
- Per-container stats with sparklines
- Alerts: thresholds + email + webhook delivery
- Health endpoint exposes Prometheus metrics for users with their own stack

**Tests**
- Log search: known events appear in results
- Alert trigger: inject 95% CPU → alert fires within 60s
- Prometheus scrape: metrics exposed in correct format

**Acceptance**
- Log search across 100k lines returns in <1s
- A misbehaving container produces an alert within a minute

---

## Phase 6 — CLI + distribution (Week 11)

**Goal:** install with one command on any modern Linux server.

**Deliverables**
- `apps/cli` (oclif) with the commands listed in §7.10 of ARCHITECTURE.md
- `scripts/install.sh` — detects OS, installs Docker if missing, pulls
  images, generates secrets, writes `/etc/docker-gui/`, starts the stack,
  prints URL + admin password
- `scripts/update.sh` — pulls new image tags, runs migrations, rolling restart
- `scripts/backup.sh` and `restore.sh` — wrap the CLI commands
- `scripts/uninstall.sh` — clean removal with optional data preservation
- Multi-arch images on GHCR: `ghcr.io/<owner>/docker-gui:<version>` for
  `amd64` and `arm64`
- Docs: `docs/SETUP.md` (production), `docs/DEVELOPMENT.md` (local)
- Demo screencast (3 min): install → first admin → deploy a site

**Tests**
- `install.sh` tested against fresh Ubuntu 22.04, 24.04, Debian 12,
  RHEL 9 / Rocky 9 in CI VMs
- `update.sh` tested by running it against an older image tag
- Backup → wipe → restore round-trip

**Acceptance**
- A user with sudo on a fresh Ubuntu VPS can run one curl command and have a
  working panel reachable on a domain in under 5 minutes
- `docker-gui doctor` diagnoses common issues with actionable fixes

---

## Phase 7 — Open source launch (Week 12)

**Goal:** make the project welcoming to outside contributors and users.

**Deliverables**
- Repo polish: `README.md` (with screenshots and one-line install),
  `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `LICENSE`
- Issue templates (bug, feature, security)
- PR template with checklist
- GitHub Discussions enabled
- Docs site at `docs.docker-gui.io` (Mintlify or Docusaurus, hosted on Pages)
- Landing page at `docker-gui.io` with one-line install command
- 2FA TOTP for admin accounts
- OIDC SSO (GitHub + Google + generic provider)
- Plugin SDK preview (one example plugin: a Discord notifier for alerts)
- Public alpha announcement (Hacker News, r/selfhosted, Show HN)

**Acceptance**
- 10+ external installs in the first week
- Zero P0 issues open after first 14 days
- Contribution flow: fork → PR → CI green → review → merge under 24h average

---

## Versioning & release strategy

- Semantic versioning. `0.x.y` until v1.
- Releases tagged as `v0.x.y` on `main`. Docker images published with both
  the version tag and `latest`.
- Auto-generated changelog from conventional commits.
- LTS branch policy decided after v1.

## What's explicitly *out* of v1 scope

- Kubernetes / Swarm
- Multi-server fleet management (one panel = one server)
- Native mobile apps
- Marketplace / paid plugins
- Built-in app store ("install Wordpress in one click") — Phase 8+ idea

## Decision log (to be filled as we go)

| Date       | Decision                              | Rationale                          |
| ---------- | ------------------------------------- | ---------------------------------- |
| 2026-05-04 | Caddy over nginx                      | JSON admin API, auto-HTTPS         |
| 2026-05-04 | Fastify backend, Next.js frontend only | WebSockets + clean separation     |
| 2026-05-04 | SQLite default, Postgres optional      | Zero-setup install                 |
| 2026-05-04 | Mailu default email backend            | Lighter than Mailcow, Docker-native |
| 2026-05-04 | argon2id over bcrypt                   | Modern, audited                    |
