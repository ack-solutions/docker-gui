# Phase 0 — How to run and test

This is the first working slice of the new architecture. It lives alongside
the existing prototype code (which is untouched) and demonstrates:

- A typed Fastify backend (`apps/api/`) with strict TypeScript
- A `/api/v1/health` endpoint that surfaces real CPU / memory / disk + Docker
  daemon status
- 37 automated tests covering config validation, services, and the HTTP layer
- A `/health` page in the existing Next.js app that consumes the API

## What's in this slice

```
apps/api/                       # NEW — Fastify backend, strict TS
├── src/
│   ├── config.ts               # zod-validated env loader, refuses weak JWT_SECRET
│   ├── app.ts                  # Fastify factory + error envelope
│   ├── index.ts                # entry point with graceful shutdown
│   ├── lib/
│   │   ├── docker.ts           # dockerode client
│   │   ├── errors.ts           # AppError + typed subclasses
│   │   └── logger.ts           # Fastify/pino options builder
│   ├── routes/
│   │   ├── health.routes.ts    # GET /api/v1/health, /health/live, /health/ready
│   │   └── __tests__/          # 7 integration tests via fastify.inject
│   ├── schemas/
│   │   └── health.schema.ts    # zod schemas reused for response validation
│   ├── services/
│   │   ├── health.service.ts   # check aggregator + status rollup
│   │   ├── system-metrics.service.ts  # CPU sampling, memory, disk via fs.statfs
│   │   └── __tests__/          # 20 unit tests
│   └── __tests__/
│       └── config.test.ts      # 10 tests for env validation + boot guards
├── package.json
├── tsconfig.json               # strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
├── vitest.config.ts
├── .env.example
└── README.md

src/app/health/                 # NEW — health page in existing Next.js
├── page.tsx
└── health-dashboard.tsx        # MUI dashboard with 5s polling

next.config.mjs                 # MODIFIED — added /api/v1/* dev rewrite to :4000
```

## Run it

Two terminals.

### Terminal 1 — start the API

```bash
cd apps/api
yarn install            # first time only
cp .env.example .env    # first time only
yarn dev                # http://127.0.0.1:4000
```

### Terminal 2 — start the Next.js web app

```bash
# at the repo root (existing dev workflow, unchanged)
yarn dev                # http://localhost:3000
```

Then open <http://localhost:3000/health>.

The page polls `/api/v1/health` every 5 seconds. In dev, Next.js proxies that
to the Fastify API automatically (see `next.config.mjs` rewrites). If the API
is down, the page shows a clear error with run instructions.

## Run the tests

```bash
cd apps/api
yarn test               # 37 tests, ~700ms
yarn test:watch         # watch mode
yarn test:coverage      # with coverage report
yarn typecheck          # strict TS check, no emit
```

## What each test layer covers

| Layer            | File                                                | Coverage                                                                 |
| ---------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| Config / boot    | `src/__tests__/config.test.ts`                      | Missing/short JWT, prod refuses dev default, port coercion, log level    |
| Service unit     | `services/__tests__/system-metrics.service.test.ts` | CPU bounds, memory math, disk error tolerance, full snapshot shape       |
| Service unit     | `services/__tests__/health.service.test.ts`         | Docker ok/down, status rollup matrix, uptime safety                      |
| HTTP integration | `routes/__tests__/health.routes.test.ts`            | Endpoint shape, docker-down path, 404 envelope, CORS preflight, liveness |

If any of these fail after a change, you know exactly what broke before
shipping.

## What "status" means in the response

| Status        | Meaning                                                            |
| ------------- | ------------------------------------------------------------------ |
| `ok`          | All required checks passed                                         |
| `degraded`    | Some checks unavailable (e.g. Docker not running) but not failing  |
| `down`        | A required check is reporting failure                              |
| `unavailable` | The check could not be performed (e.g. dependency not configured)  |

In Phase 0 the database check is a deliberate `unavailable` stub — overall
health rolls up as `degraded` until Phase 1 wires Prisma in.

## Endpoints

| Method | Path                       | Purpose                                                  |
| ------ | -------------------------- | -------------------------------------------------------- |
| GET    | `/api/v1/health`           | Full snapshot — checks + system metrics                  |
| GET    | `/api/v1/health/live`      | Liveness probe — returns immediately, no checks          |
| GET    | `/api/v1/health/ready`     | Readiness — returns ok=false only when overall is `down` |

## What Phase 0 deliberately did NOT do

- No Postgres / Prisma yet (DB check is a stub)
- No JWT login flow yet (auth port lands in next slice)
- No Docker container management UI yet
- No monorepo workspace setup yet (apps/api is a standalone yarn project)
- No CI workflow yet
- No Playwright e2e yet (Vitest integration tests cover the same ground for now)

These all come in subsequent slices per [ROADMAP.md](ROADMAP.md).

## Troubleshooting

**Page says "Cannot reach the API"** — is the API running on port 4000?
`curl http://127.0.0.1:4000/api/v1/health/live` should return
`{"data":{"ok":true}}`.

**Docker check shows `unavailable`** — expected on macOS without Docker
Desktop running, or when the socket is at a non-default path. Set
`DOCKER_SOCKET=/path/to/docker.sock` in `apps/api/.env` if needed. On Mac
with Docker Desktop, the socket is typically
`~/.docker/run/docker.sock`.

**Port 4000 already in use** — change `API_PORT` in `apps/api/.env` and
`API_PROXY_TARGET` in your shell when starting Next.js (or change the
default in `next.config.mjs`).
