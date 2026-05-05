# Phase 1 — Auth + containers + DB-backed health

This adds to Phase 0 a real authentication system, the first set of Docker
container endpoints, and a working management UI you can sign into.

> Phase 0 is in [PHASE_0_RUN.md](PHASE_0_RUN.md). This doc covers what
> changed since.

---

## What's in this slice

### Backend (`apps/api/`)

```
prisma/
└── schema.prisma                     # User · RefreshToken · AuditLog (SQLite)

src/
├── config.ts                         # +SETUP_SECRET, DATABASE_URL, token TTLs validated at boot
├── lib/
│   ├── db.ts                         # Prisma client singleton + disconnect
│   ├── password.ts                   # scrypt hash/verify (Node built-in, no native deps)
│   ├── jwt.ts                        # access + refresh token signing/verifying + SHA-256 hash
│   └── __tests__/                    # 14 unit tests for password + jwt
├── middleware/
│   ├── auth.middleware.ts            # requireAuth + requireRole Fastify pre-handlers
│   └── __tests__/                    # 7 integration tests
├── services/
│   ├── user.service.ts               # CreateUser, findByEmail, findById, countAll
│   ├── auth.service.ts               # login + refresh (rotating) + logout
│   ├── docker-containers.service.ts  # list/inspect/start/stop/restart/remove/logs + log demuxer
│   └── __tests__/                    # 23 unit tests
├── routes/
│   ├── auth.routes.ts                # /auth/login, /refresh, /logout, /me, /setup/bootstrap
│   ├── docker.routes.ts              # /docker/containers + per-id actions
│   └── __tests__/                    # 26 integration tests with real SQLite
├── schemas/
│   └── container.schema.ts           # zod schemas for ContainerSummary
└── __tests__/
    ├── config.test.ts                # 12 boot-validation tests
    └── test-helpers.ts               # buildTestEnv: fresh SQLite per test run
```

### Frontend (`src/app/`, `src/lib/v2/`)

```
src/lib/v2/
└── auth-client.ts                    # token storage, transparent refresh,
                                      # apiFetch wrapper with typed errors

src/app/
├── login/
│   ├── page.tsx
│   └── login-form.tsx                # auto-detects bootstrap mode if no admin exists
├── containers/
│   ├── page.tsx
│   └── containers-dashboard.tsx      # MUI table, start/stop/restart/remove, logs viewer
└── health/                           # (unchanged from Phase 0)
```

### Stats

- **30 source files**, **~1,800 LOC**
- **112 tests across 12 files**, all passing in ~2 seconds
- **Strict TypeScript** with `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`

---

## Run it

### One-time setup

```bash
cd apps/api
cp .env.example .env       # if not done in Phase 0
yarn install
npx prisma migrate deploy   # creates apps/api/data/app.db
```

### Two terminals

```bash
# Terminal 1 — API
cd apps/api
yarn dev                    # http://127.0.0.1:4000

# Terminal 2 — Web (repo root)
yarn dev                    # http://localhost:3000
```

### Sign in

Open <http://localhost:3000/login>.

The login page auto-detects whether any admin exists yet:

- **First time** — shows a "Create the first admin" form. Paste your
  `SETUP_SECRET` from `apps/api/.env` (`dev-setup-secret-…` by default in
  dev), enter email + name + password (8+ chars), submit. You'll be logged
  in immediately and redirected to `/containers`.

- **After first time** — shows the regular sign-in form. The setup secret
  is now disabled (the bootstrap endpoint refuses with `409`).

### Pages

| URL              | What it does                                                   |
| ---------------- | -------------------------------------------------------------- |
| `/login`         | Sign-in form, with bootstrap mode for first run                |
| `/containers`    | List all containers, start/stop/restart/remove, view logs      |
| `/health`        | System health dashboard (Phase 0, now shows real DB check)     |

The containers page polls `GET /api/v1/docker/containers?all=true` every 5
seconds. If the API returns a 401 it auto-redirects to `/login?next=/containers`.
On a stale access token it transparently refreshes via the refresh token
before retrying the request, so users don't see a logout flicker every 15
minutes.

### CLI verification (without a browser)

```bash
SETUP="dev-setup-secret-do-not-use-in-production-1234567890abcdef"

# Create the first admin
curl -s -X POST http://127.0.0.1:4000/api/v1/setup/bootstrap \
  -H "x-setup-secret: $SETUP" \
  -H "content-type: application/json" \
  -d '{"email":"admin@example.com","password":"DevPass123","name":"Admin"}' | jq

# Log in
TOKEN=$(curl -s -X POST http://127.0.0.1:4000/api/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"admin@example.com","password":"DevPass123"}' \
  | jq -r .data.accessToken)

# Check who you are
curl -s http://127.0.0.1:4000/api/v1/auth/me -H "authorization: Bearer $TOKEN" | jq

# List containers (requires Docker daemon reachable)
curl -s http://127.0.0.1:4000/api/v1/docker/containers -H "authorization: Bearer $TOKEN" | jq
```

---

## Endpoints (Phase 1)

| Method | Path                                          | Auth     | Purpose                                              |
| ------ | --------------------------------------------- | -------- | ---------------------------------------------------- |
| GET    | `/api/v1/health`                              | public   | Full snapshot (now with real DB check)               |
| GET    | `/api/v1/health/live`                         | public   | Liveness probe                                       |
| GET    | `/api/v1/health/ready`                        | public   | Readiness                                            |
| POST   | `/api/v1/setup/bootstrap`                     | secret   | Create first owner (one-time, requires SETUP_SECRET) |
| POST   | `/api/v1/auth/login`                          | public   | Email + password → access + refresh tokens          |
| POST   | `/api/v1/auth/refresh`                        | refresh  | Rotate refresh token, get new access token           |
| POST   | `/api/v1/auth/logout`                         | refresh  | Revoke a refresh token                               |
| GET    | `/api/v1/auth/me`                             | bearer   | Current user                                         |
| GET    | `/api/v1/docker/containers`                   | bearer   | List containers (?all=true&#x7c;false)               |
| GET    | `/api/v1/docker/containers/:id`               | bearer   | Inspect (raw dockerode output)                       |
| POST   | `/api/v1/docker/containers/:id/start`         | operator | Start container                                      |
| POST   | `/api/v1/docker/containers/:id/stop`          | operator | Stop container (10s grace)                           |
| POST   | `/api/v1/docker/containers/:id/restart`       | operator | Restart container                                    |
| DELETE | `/api/v1/docker/containers/:id`               | operator | Remove (?force=true&volumes=true)                    |
| GET    | `/api/v1/docker/containers/:id/logs?tail=N`   | bearer   | Last N lines (max 2000), demultiplexed               |

**Auth tags:**

- `public`: no token required
- `secret`: `x-setup-secret` header
- `bearer`: `Authorization: Bearer <access_token>`
- `refresh`: refresh token in body
- `operator`: bearer + role in `{owner, admin, operator}`

---

## What changed in tests

| Layer        | Files                                                | Tests | Covers                                                                    |
| ------------ | ---------------------------------------------------- | ----- | ------------------------------------------------------------------------- |
| Config       | `__tests__/config.test.ts`                           | 12    | Missing/short secrets, prod refuses dev defaults, type coercion           |
| Password     | `lib/__tests__/password.test.ts`                     | 7     | Hash/verify roundtrip, salt randomness, malformed input rejection          |
| JWT          | `lib/__tests__/jwt.test.ts`                          | 7     | Sign/verify, tamper detection, expiry, refresh token + hash determinism    |
| User svc     | `services/__tests__/user.service.test.ts`            | 9     | Create flow, validation, dedupe, password stripping                        |
| Auth svc     | `services/__tests__/auth.service.test.ts`            | 10    | Login success/failure, refresh rotation + revocation, logout, inactive    |
| Auth mw      | `middleware/__tests__/auth.middleware.test.ts`       | 7     | Header parsing, JWT verify, role gating                                   |
| Health svc   | `services/__tests__/health.service.test.ts`          | 13    | Real DB check, rollup matrix                                              |
| System metrics | `services/__tests__/system-metrics.service.test.ts` | 8     | CPU bounds, memory math, disk fault tolerance                              |
| Docker svc   | `services/__tests__/docker-containers.service.test.ts` | 11   | Mapping, error mapping, demuxLogs, 304 idempotency                       |
| Health route | `routes/__tests__/health.routes.test.ts`             | 5     | Live API on real SQLite                                                   |
| Auth route   | `routes/__tests__/auth.routes.test.ts`               | 13    | Bootstrap flow, login/logout/refresh/me end-to-end                        |
| Docker route | `routes/__tests__/docker.routes.test.ts`             | 8     | Auth gating, action plumbing, validation                                  |

```bash
yarn test            # 112 tests in ~2s
yarn test:watch
yarn typecheck       # strict mode, zero errors
```

---

## Security properties (this slice)

- Password storage: scrypt(N=2^14, r=8, p=1, keyLen=64), random 16-byte salt per user
- JWT signing: HS256 with `JWT_SECRET` validated at boot (≥ 32 chars, refuses dev default in production)
- Refresh tokens: random 48 bytes, stored only as SHA-256 hash, single-use (rotated on every refresh)
- Logout: revokes the specific refresh token immediately
- Login error messages don't distinguish "unknown email" from "wrong password"
- Inactive users cannot log in (and refresh tokens stop working immediately)
- Setup endpoint disables itself once any user exists
- Container endpoints require bearer auth; mutations require operator-or-higher role
- All API errors use a single envelope: `{ error: { code, message, details? } }`
- Strict TypeScript + zod validation on every input

---

## Known limitations / next slices

- The Docker socket on macOS Docker Desktop is at `~/.docker/run/docker.sock`,
  not the default `/var/run/docker.sock`. Set
  `DOCKER_SOCKET=/Users/<you>/.docker/run/docker.sock` in `apps/api/.env` to
  see container endpoints work locally on Mac.
- Real-time streams (terminal exec, log tail) are not yet wired — `/logs`
  is a one-shot fetch. Phase 2 adds WebSockets.
- No CSRF protection yet (tokens are in localStorage; consider httpOnly
  cookies later for hardened deployments).
- No rate limiting yet.
- Docker images, volumes, networks endpoints not yet built.
- Storage (MinIO), domains (Caddy), email, DB GUI features still pending
  per ROADMAP.md.

These are sequenced in [ROADMAP.md](ROADMAP.md).
