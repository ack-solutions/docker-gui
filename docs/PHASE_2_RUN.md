# Phase 2 — Docker images/volumes/networks + production deployment

Building on Phase 1 (auth + containers + health), this slice rounds out
Docker management and ships the production deployment story.

---

## What's new

### Backend (`apps/api/`)

- **Images** — list, inspect, pull (synchronous), remove (with force)
- **Volumes** — list, inspect, remove, prune (with bytes reclaimed)
- **Networks** — list, inspect, remove, prune
- All endpoints: bearer auth required; mutations require operator role
- Validation: zod schemas for every body / query / params payload

### Web (`src/app/`)

- `/images` — full CRUD: pull from registry (with progress bar), remove
  with force. Status chip per image (tagged / dangling).
- `/volumes` — list with mount point + driver + in-use count. Remove,
  prune unused.
- `/networks` — list with driver + scope + subnets + container count.
  Remove (predefined networks blocked), prune unused.
- `<PageShell>` nav now spans Containers · Images · Volumes · Networks · Health.

### Production deployment

- [docker/Dockerfile.api](../docker/Dockerfile.api) — multi-stage Node 22
  alpine build, `tini` for signal handling, runs `prisma migrate deploy` on
  every boot, healthcheck against `/health/live`, runs as non-root.
- [docker/Dockerfile.web](../docker/Dockerfile.web) — multi-stage Next.js
  standalone build, also non-root.
- [docker-compose.yml](../docker-compose.yml) — production stack: `api`
  + `web`, named volume for `/data`, read-only Docker socket mount, web
  exposes `3000` only.
- [.dockerignore](../.dockerignore) — keeps the build context lean.

### Operational scripts

- [scripts/install.sh](../scripts/install.sh) — one-line installer.
  Detects OS, installs Docker if missing, generates secrets, builds + starts
  the stack, prints URL + setup secret. Idempotent — re-run to upgrade.
- [scripts/doctor.sh](../scripts/doctor.sh) — diagnoses host + service
  health. Sections: `os`, `docker`, `system`, `ports`, `service`. Plain
  output by default, `--json` for monitoring.
- [scripts/uninstall.sh](../scripts/uninstall.sh) — clean removal with
  `--keep-data` or `--purge`.

Detail in [SCRIPTS.md](SCRIPTS.md).

---

## Run it

### Local dev (unchanged from Phase 1)

```bash
# Terminal 1
cd apps/api && yarn dev      # API on :4000

# Terminal 2 (root)
yarn dev                     # Web on :3000
```

### Production (the new path)

On a fresh Linux server:

```bash
# Either: one-line from a public install URL
curl -fsSL https://get.docker-gui.io/install.sh | sudo bash

# Or: from a local checkout (e.g. you cloned the repo manually)
sudo ./scripts/install.sh
```

The installer ends with a banner like:

```
================================================================
  docker-gui is running

  URL:           http://203.0.113.10:3000
  Setup secret:  ab12cd34ef56...

  Health check:  /opt/docker-gui/scripts/doctor.sh
  Logs:          docker compose -f /opt/docker-gui/docker-compose.yml logs -f
  Update:        sudo /opt/docker-gui/scripts/install.sh
  Uninstall:     sudo /opt/docker-gui/scripts/uninstall.sh
================================================================
```

Open the URL → login page detects no admin exists → switches to bootstrap
mode → paste the setup secret + your details → you're in.

### Production (manual, no install script)

For users who don't want to run a curl-pipe-bash:

```bash
git clone https://github.com/your-org/docker-gui.git /opt/docker-gui
cd /opt/docker-gui

# Generate secrets
cat > .env <<EOF
JWT_SECRET=$(openssl rand -hex 32)
SETUP_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 .env

# Build + start
docker compose up -d --build
```

---

## Verify

```bash
./scripts/doctor.sh
```

Sample output on a healthy install:

```
== OS ==
  ✓ Linux

== Docker ==
  ✓ docker CLI (Docker version 24.0.7, ...)
  ✓ docker daemon running
  ✓ docker compose plugin
  ✓ docker socket readable (/var/run/docker.sock)

== System ==
  ✓ memory 7340 MB available
  ✓ disk 87 GB free at /
  ✓ curl installed
  ✓ openssl installed

== Ports ==
  ✓ port 3000 in use (probably docker-gui)
  ✓ port 4000 free

== Service ==
  ✓ install dir exists (/opt/docker-gui)
  ✓ .env present (mode 600)
  ✓ JWT_SECRET set (32+ chars)
  ✓ SETUP_SECRET set
  ✓ API /health/live responds
  ✓ overall status: ok

Summary:  13 passed  0 warned  0 failed
```

---

## API surface (new in Phase 2)

| Method | Path                                          | Auth     | Purpose                                    |
| ------ | --------------------------------------------- | -------- | ------------------------------------------ |
| GET    | `/api/v1/docker/images`                       | bearer   | List images                                |
| GET    | `/api/v1/docker/images/:id`                   | bearer   | Inspect (raw dockerode output)             |
| POST   | `/api/v1/docker/images/pull`                  | operator | Pull from registry (sync)                  |
| DELETE | `/api/v1/docker/images/:id?force=`            | operator | Remove image                               |
| GET    | `/api/v1/docker/volumes`                      | bearer   | List volumes (with in-use count)           |
| GET    | `/api/v1/docker/volumes/:name`                | bearer   | Inspect                                    |
| DELETE | `/api/v1/docker/volumes/:name?force=`         | operator | Remove                                     |
| POST   | `/api/v1/docker/volumes/prune`                | operator | Remove unused volumes                      |
| GET    | `/api/v1/docker/networks`                     | bearer   | List networks                              |
| GET    | `/api/v1/docker/networks/:id`                 | bearer   | Inspect                                    |
| DELETE | `/api/v1/docker/networks/:id`                 | operator | Remove (rejects predefined: bridge/host/none) |
| POST   | `/api/v1/docker/networks/prune`               | operator | Remove unused networks                     |

Errors use the standard envelope with codes you can match in clients:
`docker.image_in_use`, `docker.volume_in_use`, `docker.network_predefined`,
`docker.unavailable`, `not_found`, `validation_error`.

---

## Test count

| Suite                              | Tests | Time   |
| ---------------------------------- | ----- | ------ |
| (Phase 1 carry-over)               | 112   | ~2.0s  |
| `docker-images.service.test.ts`    | 12    | <100ms |
| `docker-volumes.service.test.ts`   | 13    | <100ms |
| `docker-networks.service.test.ts`  | 9     | <100ms |
| `docker.routes.test.ts` (extended) | +6    | +500ms |
| **Total**                          | **150** | **~2.2s** |

```bash
yarn api:test         # all backend tests
yarn api:typecheck    # strict TS, zero errors
yarn typecheck        # web, strict, zero errors
yarn build            # production build, all 7 routes dynamic
```

---

## Known limitations (deferred to later phases)

- **Image pull is synchronous.** The route waits for the pull to complete
  before responding. Big images can take minutes. Phase 4 (logs +
  WebSockets) introduces streaming pulls.
- **No image prune endpoint yet.** Easy add — file-level pattern is
  `volumes.prune` and `networks.prune`.
- **No bind-mount volume creation.** Removing existing volumes works;
  creating new ones is not in v1 (use the host or `docker compose` for
  named volumes you want at install time).
- **Network creation not exposed.** Removal + prune cover the common
  cleanup case; creation is mostly done via compose anyway.
- **No image inspect UI.** The endpoint exists but there's no per-image
  detail page yet. Phase 4 ergonomics work.
- **Production install assumes Docker on the host.** Bare-metal install
  (no Docker) is not supported and probably never will be.

---

## What's next

[ROADMAP.md](ROADMAP.md) Phase 3 onwards: **Caddy + domains + SSL** is the
next big surface (replaces nginx in the prototype's defunct world). Then
**database GUI (pgweb)**, then **Mailu email wizard**, then **logs +
WebSockets**, then **CLI + image publishing**.

The component library and API conventions are stable enough now that
adding a new feature is mostly: write a service + tests, register a route,
add a page that imports `<DataTable>` + `<PageShell>` + `<AuthGuard>`.
