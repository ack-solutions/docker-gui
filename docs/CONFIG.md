# Configuration reference

> **AUTO-GENERATED** from `apps/api/src/config/registry.ts`. Do not edit by hand — your changes will be overwritten. To add or change a key, edit the registry and run `yarn workspace @dgui/api docs:config`.

docker-gui reads configuration from three layers, in increasing precedence: hard-coded defaults, `/etc/docker-gui/config.yml`, and environment variables. Runtime UI edits (when supported) sit on top.

## Table of contents

- [Authentication](#authentication)
- [Networking](#networking)
- [Logging](#logging)
- [Rate limiting](#rate-limiting)
- [Docker](#docker)
- [Caddy (reverse proxy)](#caddy-(reverse-proxy))
- [System](#system)
- [Alerts (email)](#alerts-(email))

## Authentication

### `core.auth.jwtSecret` **required** 🔒

HMAC key used to sign access + refresh tokens. Must be at least 32 bytes of high-entropy random data. NEVER set this manually — install.sh generates it once and writes it to /etc/docker-gui/secrets/jwt-secret with 0600 perms. Rotating it invalidates all existing sessions.

| Field | Value |
| --- | --- |
| Type | `string` |
| Env var | `JWT_SECRET` |
| YAML path | _(env-only — never written to config.yml)_ |
| Range | ≥ 32 |
| UI editable | no |
| Restart required | yes |
| Since | v0.1.0 |

### `core.auth.setupSecret` **required** 🔒

One-time shared secret required to bootstrap the first admin account via POST /api/v1/setup/bootstrap. After the first admin exists, this route is disabled and the secret becomes inert.

| Field | Value |
| --- | --- |
| Type | `string` |
| Env var | `SETUP_SECRET` |
| YAML path | _(env-only — never written to config.yml)_ |
| Range | ≥ 16 |
| UI editable | no |
| Restart required | yes |
| Since | v0.1.0 |

### `core.auth.accessTokenTtlSeconds`

How long an access token is valid before it must be refreshed. Short is safer (smaller blast radius if a token leaks) but increases refresh-endpoint load. Default 15 min is a sensible middle ground.

| Field | Value |
| --- | --- |
| Type | `duration-seconds` |
| Default | `900` |
| Env var | `ACCESS_TOKEN_TTL` |
| YAML path | `auth.access_token_ttl` |
| Range | 60 – 86400 |
| UI editable | yes |
| Restart required | no |
| Since | v0.1.0 |

Examples:

```
900 # 15 min
3600 # 1 hour
```

### `core.auth.refreshTokenTtlSeconds`

How long a refresh token can be used to obtain new access tokens. After this the user must re-authenticate. Default 7 days balances convenience against risk.

| Field | Value |
| --- | --- |
| Type | `duration-seconds` |
| Default | `604800` |
| Env var | `REFRESH_TOKEN_TTL` |
| YAML path | `auth.refresh_token_ttl` |
| Range | 3600 – 31536000 |
| UI editable | yes |
| Restart required | no |
| Since | v0.1.0 |

Examples:

```
604800 # 7 days
2592000 # 30 days
```

## Networking

### `core.network.bindHost`

Network interface the API listens on. In the default compose setup this is 127.0.0.1 because the web service proxies to it over the docker network. Setting 0.0.0.0 exposes the API directly — only do this if you know why.

| Field | Value |
| --- | --- |
| Type | `string` |
| Default | `127.0.0.1` |
| Env var | `API_HOST` |
| YAML path | `api.host` |
| UI editable | no |
| Restart required | yes |
| Since | v0.1.0 |

Examples:

```
127.0.0.1
0.0.0.0
```

### `core.network.bindPort`

TCP port the API listens on.

| Field | Value |
| --- | --- |
| Type | `number` |
| Default | `4000` |
| Env var | `API_PORT` |
| YAML path | `api.port` |
| Range | 1 – 65535 |
| UI editable | no |
| Restart required | yes |
| Since | v0.1.0 |

### `core.network.corsOrigins`

Comma-separated list of origins allowed to call the API with credentials. The web UI origin must be included.

| Field | Value |
| --- | --- |
| Type | `list` |
| Default | `http://localhost:3000` |
| Env var | `CORS_ORIGINS` |
| YAML path | `api.cors_origins` |
| UI editable | yes |
| Restart required | yes |
| Since | v0.1.0 |

Examples:

```
http://localhost:3000
https://panel.example.com,https://example.com
```

### `core.network.databaseUrl` **required**

Prisma connection string. SQLite is the default and works for almost any single-server install. Switch to PostgreSQL by setting a postgres:// URL — schema is portable. Avoid embedding credentials directly in this URL; prefer per-component env vars so the connection string itself stays non-secret.

| Field | Value |
| --- | --- |
| Type | `string` |
| Env var | `DATABASE_URL` |
| YAML path | _(env-only — never written to config.yml)_ |
| UI editable | no |
| Restart required | yes |
| Since | v0.1.0 |

Examples:

```
file:../data/app.db
postgresql://user@host:5432/dockergui
```

### `core.env`

Standard Node.js mode flag. In `production`, the boot validator refuses dev-default secrets and logs are JSON-only.

| Field | Value |
| --- | --- |
| Type | `enum` |
| Allowed | `development` · `production` · `test` |
| Default | `development` |
| Env var | `NODE_ENV` |
| YAML path | _(env-only — never written to config.yml)_ |
| UI editable | no |
| Restart required | yes |
| Since | v0.1.0 |

## Logging

### `core.log.level`

Minimum log level to emit. `debug` and `trace` are noisy but invaluable when chasing a bug. `info` is the right default.

| Field | Value |
| --- | --- |
| Type | `enum` |
| Allowed | `trace` · `debug` · `info` · `warn` · `error` · `fatal` |
| Default | `info` |
| Env var | `LOG_LEVEL` |
| YAML path | `api.log_level` |
| UI editable | yes |
| Restart required | no |
| Since | v0.1.0 |

### `core.log.pretty`

Human-readable colored log output. Turn off in production so logs are valid JSON for log shippers.

| Field | Value |
| --- | --- |
| Type | `boolean` |
| Default | `false` |
| Env var | `LOG_PRETTY` |
| YAML path | `api.log_pretty` |
| UI editable | yes |
| Restart required | yes |
| Since | v0.1.0 |

## Rate limiting

### `core.rateLimit.perMinute`

Maximum API requests per minute per source IP. 0 disables. Keep on in production to slow brute force and runaway scripts.

| Field | Value |
| --- | --- |
| Type | `number` |
| Default | `100` |
| Env var | `RATE_LIMIT_PER_MINUTE` |
| YAML path | `auth.rate_limit_per_minute` |
| Range | 0 – 100000 |
| UI editable | yes |
| Restart required | yes |
| Since | v0.2.0 |

### `core.rateLimit.lockoutAfterFails`

Number of consecutive failed logins before the account is temporarily locked. 0 disables.

| Field | Value |
| --- | --- |
| Type | `number` |
| Default | `5` |
| Env var | `LOCKOUT_AFTER_FAILS` |
| YAML path | `auth.lockout_after_fails` |
| Range | 0 – 50 |
| UI editable | yes |
| Restart required | no |
| Since | v0.2.0 |

### `core.rateLimit.lockoutDurationMinutes`

How long an account stays locked after triggering the fail threshold.

| Field | Value |
| --- | --- |
| Type | `number` |
| Default | `15` |
| Env var | `LOCKOUT_DURATION_MINUTES` |
| YAML path | `auth.lockout_duration_minutes` |
| Range | 1 – 1440 |
| UI editable | yes |
| Restart required | no |
| Since | v0.2.0 |

## Docker

### `docker.socket`

Override the Docker socket path. Leave unset to use the platform default: /var/run/docker.sock on Linux, ~/.docker/run/docker.sock on macOS/Docker Desktop.

| Field | Value |
| --- | --- |
| Type | `string` |
| Default | _(unset → feature disabled or auto-detected)_ |
| Env var | `DOCKER_SOCKET` |
| YAML path | `docker.socket` |
| UI editable | no |
| Restart required | yes |
| Since | v0.1.0 |

Examples:

```
/var/run/docker.sock
```

### `docker.network`

Name of the Docker network the api container is on. Feature containers (Caddy, MinIO, …) are attached to this same network so the api can reach them without exposing ports to the host.

| Field | Value |
| --- | --- |
| Type | `string` |
| Default | `docker-gui_dgui` |
| Env var | `DOCKER_GUI_NETWORK` |
| YAML path | `docker.network` |
| UI editable | no |
| Restart required | yes |
| Since | v0.1.0 |

### `docker.installDir`

Host path where install.sh wrote configs, snapshots, and feature data. Used to build bind mounts for feature containers — they need the host path, not the api container path.

| Field | Value |
| --- | --- |
| Type | `string` |
| Default | `/opt/docker-gui` |
| Env var | `DOCKER_GUI_INSTALL_DIR` |
| YAML path | `docker.install_dir` |
| UI editable | no |
| Restart required | yes |
| Since | v0.1.0 |

## Caddy (reverse proxy)

### `caddy.adminUrl`

URL of the Caddy admin API. Defaults to the on-demand reverse-proxy feature container (docker-gui-caddy:2019), reachable only on the internal docker network — so enabling Sites from the Features page works with no manual config. Apply stays pending until that container is running.

| Field | Value |
| --- | --- |
| Type | `url` |
| Default | `http://docker-gui-caddy:2019` |
| Env var | `CADDY_ADMIN_URL` |
| YAML path | `caddy.admin_url` |
| UI editable | no |
| Restart required | yes |
| Since | v0.1.0 |

Examples:

```
http://docker-gui-caddy:2019
```

### `caddy.defaultLetsEncryptEmail`

Contact email registered with Lets Encrypt for any site without its own override. Required by ACME — without it the per-site form must always set one explicitly.

| Field | Value |
| --- | --- |
| Type | `email` |
| Default | _(unset → feature disabled or auto-detected)_ |
| Env var | `CADDY_DEFAULT_LE_EMAIL` |
| YAML path | `caddy.default_le_email` |
| UI editable | yes |
| Restart required | no |
| Since | v0.1.0 |

Examples:

```
ops@example.com
```

## System

### `system.publicIp`

Public IPv4 address of this server. Drives the DNS wizard recommendations (e.g. A records). Auto-detected via STUN on first run if left blank.

| Field | Value |
| --- | --- |
| Type | `ipv4` |
| Default | _(unset → feature disabled or auto-detected)_ |
| Env var | `SYSTEM_PUBLIC_IP` |
| YAML path | `system.public_ip` |
| UI editable | yes |
| Restart required | no |
| Since | v0.1.0 |

Examples:

```
203.0.113.10
```

### `system.publicIp6`

Public IPv6 address of this server (drives AAAA recommendations). Optional — skip if your VPS is v4-only.

| Field | Value |
| --- | --- |
| Type | `ipv6` |
| Default | _(unset → feature disabled or auto-detected)_ |
| Env var | `SYSTEM_PUBLIC_IP6` |
| YAML path | `system.public_ip6` |
| UI editable | yes |
| Restart required | no |
| Since | v0.1.0 |

Examples:

```
2001:db8::1
```

## Alerts (email)

### `alerts.smtp.host`

SMTP server hostname for email alert delivery. Leave blank to disable email alerts (webhook delivery still works).

| Field | Value |
| --- | --- |
| Type | `string` |
| Default | _(unset → feature disabled or auto-detected)_ |
| Env var | `ALERT_SMTP_HOST` |
| YAML path | `alerts.smtp.host` |
| UI editable | yes |
| Restart required | yes |
| Since | v0.2.0 |

Examples:

```
smtp.sendgrid.net
smtp.gmail.com
```

### `alerts.smtp.port`

SMTP server port. 587 for STARTTLS (default), 465 for implicit TLS.

| Field | Value |
| --- | --- |
| Type | `number` |
| Default | `587` |
| Env var | `ALERT_SMTP_PORT` |
| YAML path | `alerts.smtp.port` |
| Range | 1 – 65535 |
| UI editable | yes |
| Restart required | yes |
| Since | v0.2.0 |

### `alerts.smtp.secure`

Use implicit TLS (set true for port 465). Leave false for STARTTLS on 587.

| Field | Value |
| --- | --- |
| Type | `boolean` |
| Default | `false` |
| Env var | `ALERT_SMTP_SECURE` |
| YAML path | `alerts.smtp.secure` |
| UI editable | yes |
| Restart required | yes |
| Since | v0.2.0 |

### `alerts.smtp.user`

SMTP auth username. Leave blank for an unauthenticated relay.

| Field | Value |
| --- | --- |
| Type | `string` |
| Default | _(unset → feature disabled or auto-detected)_ |
| Env var | `ALERT_SMTP_USER` |
| YAML path | `alerts.smtp.user` |
| UI editable | yes |
| Restart required | yes |
| Since | v0.2.0 |

### `alerts.smtp.password` 🔒

SMTP auth password / API key. Secret — masked in API and logs, never returned. Set via env only.

| Field | Value |
| --- | --- |
| Type | `string` |
| Default | _(unset → feature disabled or auto-detected)_ |
| Env var | `ALERT_SMTP_PASSWORD` |
| YAML path | _(env-only — never written to config.yml)_ |
| UI editable | no |
| Restart required | yes |
| Since | v0.2.0 |

### `alerts.smtp.from`

From address for alert emails. Defaults to the SMTP username when omitted.

| Field | Value |
| --- | --- |
| Type | `email` |
| Default | _(unset → feature disabled or auto-detected)_ |
| Env var | `ALERT_SMTP_FROM` |
| YAML path | `alerts.smtp.from` |
| UI editable | yes |
| Restart required | yes |
| Since | v0.2.0 |

Examples:

```
alerts@example.com
```

