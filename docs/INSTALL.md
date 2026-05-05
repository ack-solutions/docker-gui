# Install

Get docker-gui running on a fresh Linux server.

> Looking for local development? See [DEVELOPMENT.md](DEVELOPMENT.md).
> Already installed? See [UPDATE.md](UPDATE.md) and [CLI.md](CLI.md).

---

## At a glance

```bash
curl -fsSL https://get.docker-gui.io/install.sh | sudo bash
```

That's it. The installer will:

1. Detect your OS and install Docker if it's missing
2. Download the latest source tarball (no `git` required)
3. Generate strong random secrets in `/opt/docker-gui/.env`
4. Build the production images (api + web + caddy)
5. Start the stack
6. Install the `docker-gui` CLI to `/usr/local/bin/`
7. Print your URL and a one-time setup secret

When the installer finishes you'll see:

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

Open the URL, paste the setup secret on the login page, create your first
admin, and you're in.

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

## Method 1 — One-line install (recommended)

```bash
curl -fsSL https://get.docker-gui.io/install.sh | sudo bash
```

You can override defaults with environment variables:

```bash
DOCKER_GUI_DIR=/srv/docker-gui \
DOCKER_GUI_VERSION=v0.4.0 \
DOCKER_GUI_WEB_PORT=8080 \
sudo -E bash -c 'curl -fsSL https://get.docker-gui.io/install.sh | bash'
```

| Variable                | Default                              | What it does                                             |
| ----------------------- | ------------------------------------ | -------------------------------------------------------- |
| `DOCKER_GUI_DIR`        | `/opt/docker-gui`                    | Install root                                             |
| `DOCKER_GUI_REPO`       | `anthropics/docker-gui`              | GitHub repo to download (`owner/name`)                   |
| `DOCKER_GUI_VERSION`    | `main`                               | Branch or tag to use (e.g. `v0.4.0`)                     |
| `DOCKER_GUI_TARBALL_URL`| derived                              | Override the tarball URL entirely                        |
| `DOCKER_GUI_WEB_PORT`   | `3000`                               | Host port the web UI binds to                            |
| `DOCKER_GUI_LOCAL`      | `0`                                  | Set to `1` to install from the current directory (devs)  |

---

## Method 2 — Manual install (no curl-pipe-bash)

If you'd rather see what's happening:

```bash
# 1. Make sure Docker is installed and running
sudo systemctl status docker || curl -fsSL https://get.docker.com | sudo sh

# 2. Download the installer (read it first if you like)
curl -fsSL -o install.sh https://raw.githubusercontent.com/anthropics/docker-gui/main/scripts/install.sh
less install.sh

# 3. Run it
sudo bash install.sh
```

---

## Method 3 — Compose-only (advanced)

If you want full control and don't want the helper scripts:

```bash
# Pick an install dir
sudo mkdir -p /opt/docker-gui/source /opt/docker-gui/caddy
cd /opt/docker-gui

# Download a tagged source tarball (or main) and extract source/
sudo curl -fsSL https://github.com/anthropics/docker-gui/archive/main.tar.gz | \
  sudo tar -xz -C /tmp/
sudo mv /tmp/docker-gui-main/* /opt/docker-gui/source/

# Place compose + caddy bootstrap at the install root
sudo cp /opt/docker-gui/source/docker-compose.yml /opt/docker-gui/
sudo cp /opt/docker-gui/source/config.yml /opt/docker-gui/
sudo cp /opt/docker-gui/source/docker/caddy/initial.json /opt/docker-gui/caddy/

# Generate secrets
sudo bash -c 'cat > /opt/docker-gui/.env <<EOF
JWT_SECRET=$(openssl rand -hex 32)
SETUP_SECRET=$(openssl rand -hex 32)
WEB_PORT=3000
EOF'
sudo chmod 600 /opt/docker-gui/.env

# Build + start
cd /opt/docker-gui && sudo docker compose up -d --build
```

You won't have the `docker-gui` CLI on PATH, but `docker compose ...` works
the same.

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

## First-time setup (in the browser)

Open `http://<server-ip>:<WEB_PORT>` (default `:3000`). You'll be redirected
to `/login`.

Because no admin exists yet, the form switches to **"Create the first
admin"** mode:

1. **Setup secret** — paste from the install banner (or
   `sudo grep ^SETUP_SECRET /opt/docker-gui/.env`)
2. **Your name** — display name
3. **Email** — login email
4. **Password** — 8+ chars

Submit. You're logged in as `owner` and redirected to `/containers`.

The setup secret is now disabled — future visits to `/login` show the
regular sign-in form.

---

## What to do next

- **Add your first reverse-proxy rule** — `/sites` → New site. Point your
  domain at the server, fill in `app.example.com` + an upstream like
  `web:80`, click Apply. Caddy issues a Let's Encrypt cert in seconds.
- **Configure** — edit `/opt/docker-gui/config.yml` (or `docker-gui config`)
  to change defaults. See [CONFIG.md](CONFIG.md) for the full reference.
- **Set up monitoring** — `docker-gui doctor --json` is parseable; pipe
  it into Prometheus, Healthchecks.io, or a cron-job.
- **Plan updates** — see [UPDATE.md](UPDATE.md). Updates are one command:
  `sudo docker-gui update`.

---

## Verifying the install

```bash
docker-gui status        # is it running?
docker-gui doctor        # is anything wrong?
docker-gui logs          # what's happening?
docker-gui version       # what version + image tags?
```

A healthy install shows:

```
$ docker-gui doctor
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
  ...

== Service ==
  ✓ install dir exists (/opt/docker-gui)
  ✓ .env present (mode 600)
  ✓ JWT_SECRET set (32+ chars)
  ✓ SETUP_SECRET set
  ✓ config.yml present
  ✓ docker-gui CLI installed (/usr/local/bin/docker-gui)
  ✓ API /health/live responds
  ✓ overall status: ok

== Caddy (reverse proxy) ==
  ✓ container running
  ✓ admin API reachable from inside container

Summary:  16 passed  0 warned  0 failed
```

---

## Uninstall

```bash
sudo docker-gui uninstall --keep-data    # remove containers + images, keep volumes/.env
sudo docker-gui uninstall --purge        # remove everything (irreversible)
```

---

## Troubleshooting

**Installer fails at "Failed to download source"**
The repo URL or version isn't reachable. Check `DOCKER_GUI_REPO` and
`DOCKER_GUI_VERSION`. For the public release this defaults to GitHub —
your server needs outbound HTTPS to github.com.

**"Port 3000 is already in use"**
Another service is using it. Either stop that service or pick a different
port: `DOCKER_GUI_WEB_PORT=8080 sudo -E ./install.sh`.

**Service didn't become healthy in 60s**
- `docker-gui logs api`  — check the API logs
- `docker-gui doctor`    — full diagnostic
- Common causes: out of memory (>1 GB free required), Docker daemon
  permissions issues, the api can't reach the Docker socket.

**TLS cert isn't issuing for my domain**
DNS must point at the server before Caddy can issue a cert.
Check `dig +short example.com` from another host. Caddy retries
in the background — see `docker-gui logs caddy`.

**Forgot the setup secret**
```bash
sudo grep ^SETUP_SECRET /opt/docker-gui/.env
```
(But this only works before the first admin exists. After that, use
`docker-gui admin create` from the host.)

---

See also:
[CONFIG.md](CONFIG.md) ·
[UPDATE.md](UPDATE.md) ·
[CLI.md](CLI.md) ·
[SCRIPTS.md](SCRIPTS.md) ·
[ARCHITECTURE.md](ARCHITECTURE.md)
