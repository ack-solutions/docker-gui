# Configuration reference

docker-gui reads its operational config from two files at the install root:

```
/opt/docker-gui/
├── config.yml    # Operational settings (this doc)
└── .env          # Secrets — JWT_SECRET, SETUP_SECRET, WEB_PORT
```

| File         | Edited by  | Preserved across updates | Where it goes              |
| ------------ | ---------- | ------------------------ | -------------------------- |
| `config.yml` | You        | Yes                      | Mounted into the api container at `/etc/docker-gui/config.yml` |
| `.env`       | Installer (then you) | Yes            | Read by docker-compose for service env |

---

## Quick edit

```bash
docker-gui config            # opens config.yml in $EDITOR (default: nano)
                             # auto-restarts services on save
docker-gui config show       # cat config.yml
docker-gui config validate   # check YAML syntax without applying
```

Or edit by hand:

```bash
sudo nano /opt/docker-gui/config.yml
docker-gui restart
```

---

## Precedence

For each setting, the value used is the first non-empty match:

1. **Environment variable** — overrides everything (e.g. `LOG_LEVEL=debug`
   in `.env` or set inline)
2. **`config.yml`** — operational defaults
3. **Built-in default** — see the table below

This means you can ship a curated `config.yml` for your team and override
specific values per-host with env vars without editing the file.

---

## `config.yml` reference

The shipped template ([source](../config.yml)) is heavily commented.
Below is the full schema.

### `api`

```yaml
api:
  host: 0.0.0.0
  port: 4000
  log_level: info
  log_pretty: false
  cors_origins:
    - http://localhost:3000
```

| Key             | Env var        | Type / default            | What it does                                                    |
| --------------- | -------------- | ------------------------- | --------------------------------------------------------------- |
| `host`          | `API_HOST`     | string, `127.0.0.1`       | Bind address for Fastify. Use `0.0.0.0` inside containers.      |
| `port`          | `API_PORT`     | int, `4000`               | API port (internal — host doesn't expose this directly).        |
| `log_level`     | `LOG_LEVEL`    | enum, `info`              | One of `trace debug info warn error fatal`.                     |
| `log_pretty`    | `LOG_PRETTY`   | bool, `false`             | Pretty-print logs (true in dev). JSON in production.            |
| `cors_origins`  | `CORS_ORIGINS` | array of url, `[localhost:3000]` | Browser origins permitted to call the API directly.       |

### `auth`

```yaml
auth:
  access_token_ttl: 900
  refresh_token_ttl: 604800
```

| Key                  | Env var                | Type / default | What it does                                       |
| -------------------- | ---------------------- | -------------- | -------------------------------------------------- |
| `access_token_ttl`   | `ACCESS_TOKEN_TTL`     | int (seconds), `900` (15 min)    | Bearer-token lifetime.            |
| `refresh_token_ttl`  | `REFRESH_TOKEN_TTL`    | int (seconds), `604800` (7 days) | Refresh-token lifetime. Rotated each refresh. |

### `docker`

```yaml
docker:
  socket: /var/run/docker.sock
```

| Key      | Env var          | Type / default                  | What it does                                                |
| -------- | ---------------- | ------------------------------- | ----------------------------------------------------------- |
| `socket` | `DOCKER_SOCKET`  | path, `/var/run/docker.sock`    | The Docker Engine socket the api will manage.               |

In production, the compose file mounts the host socket read-only into the
api container.

### `caddy`

```yaml
caddy:
  admin_url: http://caddy:2019
  default_le_email: ops@example.com
```

| Key                | Env var                   | Type / default                         | What it does                                                                 |
| ------------------ | ------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| `admin_url`        | `CADDY_ADMIN_URL`         | URL, *unset*                           | Where Caddy's admin API listens. Compose default: `http://caddy:2019`.       |
| `default_le_email` | `CADDY_DEFAULT_LE_EMAIL`  | email, *unset*                         | Fallback Let's Encrypt email when a Site doesn't supply one.                 |

If `admin_url` is unset, the `/sites` page lets you define sites but the
"Apply to Caddy" button is disabled.

### `system`

```yaml
system:
  public_ip: 203.0.113.10
  public_ip6: 2001:db8::1   # optional
```

| Key          | Env var              | Type / default     | What it does                                                                                       |
| ------------ | -------------------- | ------------------ | -------------------------------------------------------------------------------------------------- |
| `public_ip`  | `SYSTEM_PUBLIC_IP`   | IPv4, *unset*      | The public IPv4 of this server. Drives the DNS wizard's recommended A records.                     |
| `public_ip6` | `SYSTEM_PUBLIC_IP6`  | IPv6, *unset*      | Optional public IPv6. If set, the DNS wizard adds AAAA records.                                    |

If neither is set, the Sites wizard still creates Sites and applies them
to Caddy — it just won't have anything to suggest under "Auto-create DNS
records". Set this once when you install and forget about it.

---

## DNS providers

Provider credentials (e.g. Cloudflare API tokens) are *not* in `config.yml`
or `.env` — they're added through the UI under **DNS providers**, encrypted
with a key derived from `JWT_SECRET`, and stored in the SQLite DB. Rotating
`JWT_SECRET` invalidates all stored provider credentials and you'll need
to re-enter them. That's a deliberate trade-off so a leaked DB file alone
doesn't expose the tokens.

The Cloudflare token needs two scopes: `Zone:Read` and `Zone:DNS:Edit`,
restricted to the zones you want managed. Create one at
<https://dash.cloudflare.com/profile/api-tokens>.

---

## `.env` reference (secrets)

```bash
JWT_SECRET=<64-hex-chars>
SETUP_SECRET=<64-hex-chars>
WEB_PORT=3000
```

| Variable        | Required | What it does                                                                    |
| --------------- | -------- | ------------------------------------------------------------------------------- |
| `JWT_SECRET`    | yes      | HMAC secret for signing JWT access tokens. **32+ random bytes.** Rotating it invalidates every active session. |
| `SETUP_SECRET`  | yes      | One-time secret used to create the first admin from the login UI. After that, it's effectively a no-op. |
| `WEB_PORT`      | no       | Host port the web container binds to. Defaults to 3000.                          |
| `LE_EMAIL`      | no       | Convenience: maps to `CADDY_DEFAULT_LE_EMAIL` in compose if you don't want to put it in `config.yml`. |
| `CORS_ORIGINS`  | no       | Comma-separated browser origins. Override `config.yml`.                          |

The installer generates `JWT_SECRET` and `SETUP_SECRET` on first run with
`openssl rand -hex 32`. They are NOT regenerated on update — your sessions
survive upgrades.

To rotate a secret manually:

```bash
sudo nano /opt/docker-gui/.env       # edit the value
docker-gui restart
```

For `JWT_SECRET`, every active user must log in again after rotation.

---

## Adding a setting

To support a new config value:

1. Add a Zod field to `apps/api/src/config.ts` (with default if optional)
2. Add the YAML→env mapping to
   [`apps/api/src/lib/yaml-config.ts`](../apps/api/src/lib/yaml-config.ts)
3. Add a section to the template in [`config.yml`](../config.yml) with a
   doc comment explaining what it does
4. Document it in this file
5. Reference it in the relevant code path

Tests for the loader live at
[`apps/api/src/lib/__tests__/yaml-config.test.ts`](../apps/api/src/lib/__tests__/yaml-config.test.ts) —
add a new test case for any new key.

---

## Examples

### Run on a non-default port

`/opt/docker-gui/.env`:

```
WEB_PORT=8080
```

```bash
docker-gui restart
```

### Switch to debug logging temporarily

```bash
sudo sed -i 's/log_level: info/log_level: debug/' /opt/docker-gui/config.yml
docker-gui restart
docker-gui logs api    # now extra-verbose
```

Or with an env var that overrides the file:

```bash
echo 'LOG_LEVEL=debug' | sudo tee -a /opt/docker-gui/.env
docker-gui restart
```

### Enable Caddy auto-HTTPS without per-site emails

```yaml
# /opt/docker-gui/config.yml
caddy:
  admin_url: http://caddy:2019
  default_le_email: ops@yourcompany.com
```

Now you can leave the Let's Encrypt email blank when creating a site —
this default is used.

### Allow extra CORS origins

```yaml
api:
  cors_origins:
    - http://localhost:3000
    - https://app.yourcompany.com
    - https://staging.yourcompany.com
```

---

See also:
[INSTALL.md](INSTALL.md) ·
[UPDATE.md](UPDATE.md) ·
[CLI.md](CLI.md) ·
[ARCHITECTURE.md](ARCHITECTURE.md)
