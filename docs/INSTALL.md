# Install &amp; update

Get docker-gui running on a fresh Linux server, keep it up to date,
diagnose it when something breaks. One doc, top to bottom.

> Local development on macOS / your laptop? See
> **[DEVELOPMENT.md](DEVELOPMENT.md)** instead — production install is
> Linux-only.

---

## Install

On your Linux server, paste this one command and press Enter:

```bash
curl -fsSL https://raw.githubusercontent.com/ack-solutions/docker-gui/main/scripts/install.sh | sudo bash
```

That's it. No URL editing, no choosing a method. The installer takes
3–5 minutes the first time and:

1. Detects your OS, installs Docker if it isn't already
2. Downloads the **latest GitHub release** (or the `develop` branch when
   no release is published yet)
3. Generates random `JWT_SECRET` + `SETUP_SECRET` in `/opt/docker-gui/.env`
4. Builds the api / web / caddy images locally
5. Starts the stack with `docker compose up -d`
6. Installs the `docker-gui` CLI to `/usr/local/bin/`
7. Prints your URL and a one-time setup secret

When it finishes you'll see:

```
╔══════════════════════════════════════════════════════════════════╗
║  docker-gui is running                                           ║
╚══════════════════════════════════════════════════════════════════╝

  URL:           http://203.0.113.10:3000
  Setup secret:  9a8b7c6d5e4f3a2b...   (one-time use)

  CLI:           docker-gui --help
  Update:        docker-gui update
  ...
```

Open the URL, paste the setup secret, create your first admin — you're in.

---

## First login (in the browser)

The login page detects there's no admin yet and switches to **"Create
the first admin"** mode. Fill in:

1. **Setup secret** — paste from the install banner (or get it back with
   `sudo grep ^SETUP_SECRET /opt/docker-gui/.env`)
2. **Your name**, **email**, **password** (8+ chars)

Submit. You're logged in as `owner` and redirected to `/containers`.

The setup secret is now disabled — future visits to `/login` show the
regular sign-in form.

---

## Features — turning on optional capabilities

The default install runs only the **panel** (api + web). It does not bind
ports 80 or 443 — those stay free for whatever else you're hosting until
you explicitly turn on the reverse-proxy feature.

To enable an optional capability, open **`/features`** in the web UI:

| Feature | What it adds | Ports it reserves while running |
|---|---|---|
| **Caddy** — reverse proxy + auto HTTPS | Required for Sites: point a domain at this server, fill the form, Caddy issues a Lets Encrypt cert. | 80, 443 |
| **MinIO** — object storage *(coming soon)* | S3-compatible storage with a custom UI for buckets, IAM, and visual policy editing. | 9000, 9001 |
| **Email (Mailu)** *(coming soon)* | Self-hosted SMTP / IMAP / webmail with DKIM + SPF + DMARC wizard. | 25, 465, 587, 993 |
| **Postgres GUI** *(coming soon)* | Browser-based Postgres explorer (pgweb). | — |

Click **Enable** on a feature card and the api launches the corresponding
container immediately. Click **Disable** to stop and remove it — the data
volume is preserved, so re-enabling restores state.

Each feature container is managed by docker-gui via the Docker socket.
You'll see them on the `/containers` page tagged with the
`docker-gui.managed-by=features-service` label. Don't manage them by
hand from the CLI — use the Features page, or you'll get out of sync.

### Examples

**"I just want the panel — don't expose any HTTPS yet."**
Default install. Nothing more to do. Use the panel at `http://server:3000`.

**"I want a real domain with HTTPS for the panel itself."**
1. Open `/features` → Enable **Caddy** (binds 80 + 443).
2. Open `/sites` → New site for `panel.example.com` → Upstream `web:80` → Apply.
3. Set DNS for `panel.example.com` → server IP. Wait ~30 seconds for Caddy
   to issue the cert.
4. Visit `https://panel.example.com`.

**"I want object storage."**
Open `/features` → look for **MinIO**. Currently *coming soon* — track
progress in [docs/ROADMAP.md](ROADMAP.md).

**"I want to free port 80 again."**
Open `/features` → Disable **Caddy**. The container is removed; data
volumes remain. Sites you defined are kept in the database — re-enabling
restores them.

---

## Update

Same one command — re-run it:

```bash
curl -fsSL https://raw.githubusercontent.com/ack-solutions/docker-gui/main/scripts/install.sh | sudo bash
```

Or, if you have the CLI installed:

```bash
sudo docker-gui update
```

What's preserved automatically:

| Path / resource                          | Preserved | Notes                                              |
| ---------------------------------------- | :-------: | -------------------------------------------------- |
| `/opt/docker-gui/.env`                   | ✓         | Your secrets stay the same, sessions survive       |
| `/opt/docker-gui/config.yml`             | ✓         | Your config edits survive                          |
| Docker volume `docker-gui_app-data`      | ✓         | Database + app state                               |
| Docker volume `docker-gui_caddy-data`    | ✓         | TLS certs + ACME state                             |
| Docker volume `docker-gui_caddy-config`  | ✓         | Caddy's last-applied config (sites stay live)      |
| `/opt/docker-gui/docker-compose.yml`     | refreshed | Replaced by the new version's compose file         |
| `/opt/docker-gui/source/`                | replaced  | Wiped + re-extracted from the new tarball          |
| `/usr/local/bin/docker-gui`              | refreshed | Replaced by the new version's CLI                  |

Downtime is typically 10–30 seconds while containers restart.

### Pin to a specific version

```bash
sudo DOCKER_GUI_VERSION=v0.4.0 docker-gui update
```

### Roll back

There's no built-in `rollback` yet. Re-update with an older tag:

```bash
sudo DOCKER_GUI_VERSION=v0.3.0 docker-gui update
```

> Schema migrations are not auto-reversible. Take a backup before each
> update if rolling back matters: `docker-gui backup`.

### Automatic updates (cron)

```cron
# Update at 03:30 every Sunday
30 3 * * 0  /usr/local/bin/docker-gui update >> /var/log/docker-gui-update.log 2>&1
```

---

## Verify

```bash
docker-gui status        # are containers running?
docker-gui doctor        # is anything wrong?
docker-gui logs          # what is each service saying?
```

A healthy install shows all `✓` from `docker-gui doctor`:

```
== OS ==          ✓ Linux
== Docker ==      ✓ docker CLI / daemon / compose plugin / socket readable
== System ==      ✓ memory / disk / curl / openssl
== Service ==     ✓ install dir / .env mode 600 / secrets / API /health/live
== Caddy ==       ✓ container running / admin API reachable

Summary:  16 passed  0 warned  0 failed
```

For monitoring: `docker-gui doctor --json` is parseable. Pipe it into
Prometheus, Healthchecks.io, or a cron job.

---

## Server requirements

| Item                 | Minimum                      | Recommended            |
| -------------------- | ---------------------------- | ---------------------- |
| OS                   | Ubuntu 22.04 / Debian 11 / RHEL 9 (or compatible) | Ubuntu 24.04 |
| Architecture         | `amd64` or `arm64`           | `amd64`                |
| CPU                  | 2 cores                      | 4 cores                |
| RAM                  | 1 GB                         | 4 GB+                  |
| Disk                 | 10 GB                        | 50 GB+                 |
| Network              | Public IPv4                  | Public IPv4 + IPv6     |
| Docker               | 24.0+ (installer can install) | latest                |
| Open ports           | 22 (SSH), 3000 (web)         | + 80, 443 (HTTPS sites)|

---

## Customization

Override defaults via env vars on the install command:

```bash
curl -fsSL https://raw.githubusercontent.com/ack-solutions/docker-gui/main/scripts/install.sh \
  | sudo DOCKER_GUI_WEB_PORT=8080 DOCKER_GUI_DIR=/srv/docker-gui bash
```

| Variable                | Default                       | What it does                                             |
| ----------------------- | ----------------------------- | -------------------------------------------------------- |
| `DOCKER_GUI_DIR`        | `/opt/docker-gui`             | Install root                                             |
| `DOCKER_GUI_REPO`       | `ack-solutions/docker-gui`    | GitHub repo to download (`owner/name`)                   |
| `DOCKER_GUI_VERSION`    | latest release ↳ `develop`    | Specific branch or tag (e.g. `v0.4.0`, `main`)           |
| `DOCKER_GUI_TARBALL_URL`| derived                       | Override the tarball URL entirely                        |
| `DOCKER_GUI_WEB_PORT`   | `3000`                        | Host port the web UI binds to                            |
| `DOCKER_GUI_LOCAL`      | `0`                           | Set to `1` to install from a local checkout (skip download) |

For deeper config (CORS origins, Caddy admin URL, log level, etc.) edit
`/opt/docker-gui/config.yml` after install. See **[CONFIG.md](CONFIG.md)**.

---

## What got installed where

```
/opt/docker-gui/
├── docker-compose.yml     # Production stack (refreshed on update)
├── config.yml             # Your edits — preserved across updates
├── .env                   # Secrets — preserved (mode 600)
├── caddy/
│   └── initial.json       # Caddy bootstrap config (refreshed)
└── source/                # Full source tree, used by `build:` (refreshed)

/usr/local/bin/docker-gui  # CLI wrapper
```

Plus three Docker volumes managed by Compose:

- `docker-gui_app-data` — SQLite DB + app state
- `docker-gui_caddy-data` — TLS certs + ACME state
- `docker-gui_caddy-config` — Caddy's last-applied config

---

## Alternative install methods

The one-liner at the top is the recommended path. These alternatives
exist for special cases.

### From a `git clone` (inspect the source first)

```bash
git clone https://github.com/ack-solutions/docker-gui.git
cd docker-gui
DOCKER_GUI_LOCAL=1 sudo -E ./scripts/install.sh
```

Useful when you want to read the code before running it, pin to a
specific commit, or contribute changes back. Upgrade with `git pull`
followed by re-running the same install command.

### Air-gapped server (no internet)

On a machine with internet:

```bash
git clone https://github.com/ack-solutions/docker-gui.git
tar czf docker-gui.tar.gz \
  --exclude=node_modules --exclude=.next --exclude=.git \
  --exclude='apps/api/data' --exclude='apps/api/node_modules' \
  -C docker-gui .
scp docker-gui.tar.gz user@air-gapped-server:/tmp/
```

On the air-gapped server:

```bash
mkdir -p /tmp/docker-gui-src && cd /tmp/docker-gui-src
tar xzf /tmp/docker-gui.tar.gz
DOCKER_GUI_LOCAL=1 sudo -E ./scripts/install.sh
```

Or point `DOCKER_GUI_TARBALL_URL` at a local file path that `curl` can
reach (`file:///media/usb/docker-gui.tar.gz` works).

### Inspect before running

```bash
curl -fsSL https://raw.githubusercontent.com/ack-solutions/docker-gui/main/scripts/install.sh -o install.sh
less install.sh                  # read it
sudo bash install.sh             # then run
```

### Compose-only (full manual control)

```bash
sudo mkdir -p /opt/docker-gui/source /opt/docker-gui/caddy
sudo curl -fsSL https://github.com/ack-solutions/docker-gui/archive/develop.tar.gz | \
  sudo tar -xz --strip-components=1 -C /opt/docker-gui/source/

sudo cp /opt/docker-gui/source/docker-compose.yml /opt/docker-gui/
sudo cp /opt/docker-gui/source/config.yml /opt/docker-gui/
sudo cp /opt/docker-gui/source/docker/caddy/initial.json /opt/docker-gui/caddy/

sudo bash -c 'cat > /opt/docker-gui/.env <<EOF
JWT_SECRET=$(openssl rand -hex 32)
SETUP_SECRET=$(openssl rand -hex 32)
WEB_PORT=3000
EOF'
sudo chmod 600 /opt/docker-gui/.env

cd /opt/docker-gui && sudo docker compose up -d --build
```

You won't have the `docker-gui` CLI on `PATH`, but `docker compose ...`
in `/opt/docker-gui/` works the same.

---

## Troubleshooting

**Installer fails at "Failed to download source"**
Server can't reach github.com. Try the air-gapped method above, or
override `DOCKER_GUI_TARBALL_URL` with a mirror.

**"Port 3000 is already in use"**
Either stop the other service, or pick a different port on install:

```bash
curl -fsSL https://raw.githubusercontent.com/ack-solutions/docker-gui/main/scripts/install.sh \
  | sudo DOCKER_GUI_WEB_PORT=8080 bash
```

**Service didn't become healthy in 60s**
- `docker-gui logs api`  — check the API logs
- `docker-gui doctor`    — full diagnostic
- Common causes: out of memory (>1 GB free required), Docker daemon
  permission issues, the api can't reach the Docker socket.

**Forgot the setup secret**
```bash
sudo grep ^SETUP_SECRET /opt/docker-gui/.env
```
Only useful before the first admin exists. After that, use the CLI:
`sudo docker-gui admin reset alice@example.com 'NewPass1'`.

**Forgot admin password**
```bash
sudo docker-gui admin reset alice@example.com 'NewPass1'
```

**TLS cert isn't issuing for my domain**
DNS must point at the server before Caddy can issue a cert. Check from
another host: `dig +short example.com`. Caddy retries in the background:
`docker-gui logs caddy`.

**Docker socket permission denied (host CLI)**
The api container mounts the socket read-only and works fine. From the
host, your user might need to be added to the docker group:

```bash
sudo usermod -aG docker $USER
newgrp docker      # or log out and back in
```

---

## Backups

Quick manual backup of the SQLite DB + app state:

```bash
docker-gui backup --out /var/backups/docker-gui-$(date +%F).tar.gz
```

Restore:

```bash
docker-gui restore /var/backups/docker-gui-2026-05-05.tar.gz
```

Schedule it from cron (root crontab):

```cron
# Daily backup at 02:00
0 2 * * *  /usr/local/bin/docker-gui backup --out /var/backups/docker-gui-$(date +\%F).tar.gz
```

---

## Uninstall

```bash
sudo docker-gui uninstall --keep-data    # remove containers + images, keep volumes/.env
sudo docker-gui uninstall --purge        # remove everything (irreversible)
```

---

## Production security checklist

- [ ] Fresh server (not a workstation)
- [ ] Non-root user with sudo, root SSH disabled
- [ ] Firewall: allow 22, 3000 (or your `WEB_PORT`), and 80 + 443 if using Sites
- [ ] SSH key auth, password auth disabled
- [ ] Strong unique admin password (from a manager)
- [ ] Daily backup automated (see above)
- [ ] `JWT_SECRET` is *not* the dev default (verify with `docker-gui doctor`)
- [ ] `docker-gui update` scheduled (cron — see above) so security patches land

---

See also:
[CONFIG.md](CONFIG.md) ·
[CLI.md](CLI.md) ·
[ARCHITECTURE.md](ARCHITECTURE.md) ·
[ROADMAP.md](ROADMAP.md)
