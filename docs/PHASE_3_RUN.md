# Phase 3 — Sites + Caddy reverse proxy

Building on Phases 0–2, this slice introduces **Sites** (reverse-proxy
rules) and integrates **Caddy** as the default web edge. With this slice,
docker-gui can serve any number of domains with automatic Let's Encrypt
TLS in front of any container or external upstream — defined and applied
through the UI.

> Domain wizard with DNS-record automation (Cloudflare etc.) is the next
> slice. This phase covers the reverse-proxy core; you still point your
> own DNS at the server.

---

## What's new

### Backend (`apps/api/`)

- **Site** Prisma model — primaryDomain, aliasDomains, upstreamUrl,
  enableHttps, forceHttps, letsEncryptEmail, enabled, status (draft /
  applied / error), lastError, lastAppliedAt
- [`lib/caddy.ts`](../apps/api/src/lib/caddy.ts) — admin-API client
  (`loadConfig`, `getConfig`, `ping`, custom `CaddyError`)
- [`services/caddy-renderer.ts`](../apps/api/src/services/caddy-renderer.ts)
  — pure function `Site[] → CaddyConfig` JSON. No I/O. Snapshot-testable.
- [`services/sites.service.ts`](../apps/api/src/services/sites.service.ts)
  — CRUD + `applyAll()` which renders → POSTs to Caddy → updates per-site
  status atomically
- [`routes/sites.routes.ts`](../apps/api/src/routes/sites.routes.ts) —
  REST endpoints, all bearer-auth-gated; mutations require `operator` role
- New env: `CADDY_ADMIN_URL`, `CADDY_DEFAULT_LE_EMAIL` (both optional in
  dev, set automatically by the production compose)

### Web (`src/app/`)

- `/sites` — list of sites with status chips, "Apply to Caddy" button at
  the top-right (disabled when no changes are pending or when the API has
  no Caddy URL configured), per-row edit/remove, and a "New site" /
  "Edit site" dialog that collects domain + alias domains + upstream + TLS
  toggles + Let's Encrypt email.
- `<PageShell>` nav now: Containers · Images · Volumes · Networks · **Sites** · Health.

### Production stack

- [`docker-compose.yml`](../docker-compose.yml) gains a third service:
  `caddy` (image `caddy:2-alpine`). Bound to `:80` and `:443` on the host.
  Bootstraps from `docker/caddy/initial.json` (admin API only) and uses
  `--resume` so the API's last-applied config survives container restarts.
- Two new named volumes: `caddy-data` (ACME certs + state) and
  `caddy-config` (the running config). Persistent across compose restarts.
- The `api` container has `CADDY_ADMIN_URL=http://caddy:2019` set by
  default — no env tweaks required.

### Doctor extension

[`scripts/doctor.sh`](../scripts/doctor.sh) gains a `caddy` section:

- `docker-gui-caddy` container running
- Caddy admin API responds inside the container
- API has `CADDY_ADMIN_URL` configured

Run with `./scripts/doctor.sh --feature caddy` to scope.

---

## Run it

### Local dev (Caddy is optional)

```bash
# Terminal 1
cd apps/api && yarn dev

# Terminal 2 (root)
yarn dev
```

Visit `/sites`. Without `CADDY_ADMIN_URL` set, you'll see a yellow banner
explaining that Caddy isn't wired — but you can still create / edit /
delete sites. The "Apply to Caddy" button is disabled.

To exercise the full apply flow locally, run Caddy yourself:

```bash
docker run -d --name caddy-dev -p 2019:2019 -p 80:80 -p 443:443 \
  -v $(pwd)/docker/caddy/initial.json:/etc/caddy/initial.json:ro \
  caddy:2-alpine caddy run --config /etc/caddy/initial.json --resume
```

Then add to `apps/api/.env`:

```
CADDY_ADMIN_URL=http://127.0.0.1:2019
```

Restart `apps/api`. The `/sites` banner disappears and "Apply to Caddy"
becomes active.

### Production (one-line install)

```bash
curl -fsSL https://get.docker-gui.io/install.sh | sudo bash
```

The installer brings up `api` + `web` + `caddy` together. Caddy listens
on `:80` and `:443`. `caddy:2019` is the admin URL inside the compose
network — only the api container can reach it.

Open `http://<your-server>:3000` (the web container's direct port) for the
first-time admin bootstrap. Then on `/sites`:

1. Click **New site**
2. Enter your real domain (e.g. `app.example.com`)
3. Set upstream to `web:80` (the docker-gui UI itself, accessible inside
   the compose network) — or any other container/URL you want behind that
   domain
4. Enable HTTPS, set your Let's Encrypt email
5. **Save**, then **Apply to Caddy**

Within a few seconds Caddy issues a real Let's Encrypt cert and starts
serving the domain — provided your DNS A/AAAA record points at the
server. The new site row flips to **Applied** with a recent timestamp.

---

## API surface (new this phase)

| Method | Path                          | Auth     | Purpose                              |
| ------ | ----------------------------- | -------- | ------------------------------------ |
| GET    | `/api/v1/sites`               | bearer   | List sites                           |
| GET    | `/api/v1/sites/status`        | bearer   | Caddy connectivity status            |
| GET    | `/api/v1/sites/:id`           | bearer   | One site                             |
| POST   | `/api/v1/sites`               | operator | Create                               |
| PATCH  | `/api/v1/sites/:id`           | operator | Update (resets status to draft)      |
| DELETE | `/api/v1/sites/:id`           | operator | Remove                               |
| POST   | `/api/v1/sites/apply`         | operator | Render all enabled sites + apply     |

### Apply semantics

- Atomic: Caddy's `/load` accepts the new config or rejects it whole. We
  never get a partial state.
- On success: every enabled site → `status: applied` + `lastAppliedAt`.
- On failure: every enabled site → `status: error` + `lastError`. The
  previously running config keeps serving.
- Sites that are disabled but were applied previously → flipped back to
  `draft`.

Common error codes:
- `caddy.not_configured` (503) — `CADDY_ADMIN_URL` env var missing
- `site.domain_taken` (409) — primary domain already in use
- `validation_error` (400) — bad domain / upstream / email

---

## Test count

| Suite                                  | Tests | Notes                                |
| -------------------------------------- | ----- | ------------------------------------ |
| (Phases 0–2 carry-over)                | 150   |                                      |
| `lib/__tests__/caddy.test.ts`          | 9     | mocked fetch                         |
| `services/__tests__/caddy-renderer.test.ts` | 12 | pure-function snapshots               |
| `routes/__tests__/sites.routes.test.ts` | 12   | real SQLite + mocked CaddyClient     |
| **Total**                              | **183** | passing in ~3s on the dev box     |

```bash
yarn api:test         # all backend tests
yarn api:typecheck    # strict TS
yarn typecheck        # web, strict
yarn build            # production build, 9 dynamic routes
./scripts/doctor.sh   # host + service + caddy diagnostics
```

---

## Known limitations (deferred)

- **No DNS automation.** You point DNS at the server yourself; the panel
  doesn't yet talk to Cloudflare/Route53. Domain wizard is the next slice.
- **No DNS health check / propagation poll.** If you click Apply before
  DNS resolves, Let's Encrypt will retry; you'll see `status: error` until
  DNS catches up.
- **No custom certificate upload.** Only Let's Encrypt for now.
- **No real-time apply progress.** The button is just disabled while the
  POST runs.
- **No site templates / quick presets.** You type the upstream by hand.
- **`/sites/apply` doesn't dry-run first.** Caddy validates internally and
  rejects bad config — but it'd be nicer to surface a "this would fail
  because" preview.
- **No reorder / priority.** Caddy matches in route order; we render in
  DB-row order. Fine for hostname-distinct sites; matters for path-based
  routing which we don't support yet.

---

## What's next (per [ROADMAP.md](ROADMAP.md))

- Domain wizard with Cloudflare / Route53 adapters and live DNS-propagation
  polling — turns the bare Sites form into a guided "add a domain" flow
- Postgres GUI (pgweb sidecar)
- Mailu email wizard
- MinIO storage browser
- WebSocket terminals + log streams
- CLI + image publishing + open-source launch
