# @dgui/api

Fastify backend for docker-gui. Phase 0 slice — currently exposes
`/api/v1/health` and runs system metrics + a Docker daemon check.

## Run locally

```bash
cd apps/api
cp .env.example .env
yarn install
yarn dev          # starts on http://127.0.0.1:4000
```

Verify:

```bash
curl -s http://127.0.0.1:4000/api/v1/health | jq
```

## Test

```bash
yarn test                   # one-shot
yarn test:watch             # watch mode
yarn test:coverage          # with coverage report
```

## Endpoints (Phase 0)

| Method | Path                   | Purpose                              |
| ------ | ---------------------- | ------------------------------------ |
| GET    | `/api/v1/health`       | Full health snapshot + system metrics |
| GET    | `/api/v1/health/live`  | Liveness probe (returns immediately) |
| GET    | `/api/v1/health/ready` | Readiness probe                      |

## Response shape

```json
{
  "data": {
    "status": "ok | degraded | down | unavailable",
    "uptime": 42,
    "version": "0.1.0",
    "timestamp": "2026-05-04T12:00:00.000Z",
    "checks": {
      "api":      { "status": "ok", "latencyMs": 0 },
      "docker":   { "status": "ok", "latencyMs": 3, "details": { "version": "24.0.7" } },
      "database": { "status": "unavailable", "message": "database not yet wired (Phase 0 stub)" }
    },
    "system": {
      "cpu":    { "usagePercent": 12.3, "cores": 8, "loadAverage": [1.1, 0.9, 0.8] },
      "memory": { "usedBytes": 8000000000, "totalBytes": 16000000000, "freeBytes": 8000000000, "usagePercent": 50.0 },
      "disks":  [ { "path": "/", "usedBytes": 100000000000, "totalBytes": 500000000000, "availableBytes": 400000000000, "usagePercent": 20.0 } ]
    }
  }
}
```

## Errors

All errors use a single envelope:

```json
{ "error": { "code": "not_found", "message": "Route not found" } }
```
