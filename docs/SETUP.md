# Setup guide

Install docker-gui on a Linux server. **macOS is dev-only** — see
[DEVELOPMENT.md](DEVELOPMENT.md) for local development.

---

## 1. Server requirements

| Item                | Minimum                | Recommended            |
| ------------------- | ---------------------- | ---------------------- |
| OS                  | Ubuntu 22.04 / Debian 11 / RHEL 9 (or compatible) | Ubuntu 24.04 |
| Architecture        | `amd64` or `arm64`     | `amd64`                |
| CPU                 | 2 cores                | 4 cores                |
| RAM                 | 1 GB                   | 4 GB+                  |
| Disk                | 10 GB                  | 50 GB+                 |
| Network             | Public IPv4            | Public IPv4 + IPv6     |
| Docker              | 24.0+                  | latest                 |
| Open ports          | 22 (SSH), 3000 (web)   | + 80, 443 if you put a reverse proxy in front |

---

## 2. One-line install (recommended)

On a fresh server:

```bash
curl -fsSL https://get.docker-gui.io/install.sh | sudo bash
```

What it does, in order:

1. Detects OS
2. Installs Docker via `get.docker.com` if missing
3. Verifies Docker daemon, compose plugin, port 3000 free
4. Clones repo to `/opt/docker-gui`
5. Generates `JWT_SECRET` and `SETUP_SECRET` (32-byte random hex) into
   `/opt/docker-gui/.env` (mode 600)
6. Builds production images (api + web)
7. Starts the stack with `docker compose up -d`
8. Polls `/api/v1/health/live` until ready
9. Prints the URL + your setup secret

After it finishes:

```
================================================================
  docker-gui is running

  URL:           http://203.0.113.10:3000
  Setup secret:  7f3a-9k2p-4qx8-bm1v...  (save this — shown once)

  Health check:  /opt/docker-gui/scripts/doctor.sh
  Logs:          docker compose -f /opt/docker-gui/docker-compose.yml logs -f
  Update:        sudo /opt/docker-gui/scripts/install.sh
  Uninstall:     sudo /opt/docker-gui/scripts/uninstall.sh
================================================================
```

Open the URL — the login page detects there's no admin yet and switches to
bootstrap mode. Paste your setup secret + an email/password and you're in.

### Re-run to upgrade

`install.sh` is idempotent. Re-running pulls the latest source, rebuilds
images, and restarts. Existing `.env` and data volumes are preserved.

```bash
sudo /opt/docker-gui/scripts/install.sh
```

### Customizing the install

Override defaults via env vars:

```bash
DOCKER_GUI_DIR=/srv/docker-gui \
DOCKER_GUI_BRANCH=main \
DOCKER_GUI_WEB_PORT=8080 \
sudo -E ./scripts/install.sh
```

---

## 3. Manual install (no curl-pipe-bash)

```bash
# Install Docker if missing
curl -fsSL https://get.docker.com | sudo sh

# Clone
sudo git clone https://github.com/your-org/docker-gui.git /opt/docker-gui
cd /opt/docker-gui

# Generate secrets
sudo bash -c 'cat > /opt/docker-gui/.env <<EOF
JWT_SECRET=$(openssl rand -hex 32)
SETUP_SECRET=$(openssl rand -hex 32)
EOF'
sudo chmod 600 /opt/docker-gui/.env

# Build and start
sudo docker compose up -d --build

# Wait for ready
until curl -fsS http://127.0.0.1:3000/api/v1/health/live; do sleep 1; done

# Show your setup secret
sudo grep ^SETUP_SECRET /opt/docker-gui/.env
```

---

## 4. First-time setup (in the browser)

Open `http://<your-server-ip>:3000`. You'll be redirected to `/login`.

Because no admin exists yet, the form is in **"Create the first admin"**
mode:

1. **Setup secret** — paste from `/opt/docker-gui/.env` (the
   `SETUP_SECRET=` line, value only)
2. **Your name** — display name for the admin
3. **Email** — login email
4. **Password** — 8+ chars

Submit. You're logged in as `owner` and redirected to `/containers`. From
here you can manage:

- **/containers** — start/stop/restart/remove + view logs
- **/images** — pull from registries, remove
- **/volumes** — list, remove, prune unused
- **/networks** — list, remove, prune
- **/health** — system metrics + service health

The setup secret is now disabled — you'll see a regular sign-in form on
future visits to `/login`.

---

## 5. Health check / doctor

A standalone script that diagnoses the host and the running service:

```bash
/opt/docker-gui/scripts/doctor.sh
```

Sample output:

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

For monitoring: `doctor.sh --json` produces parseable JSON. Scope to
sections: `doctor.sh --feature docker`. See [SCRIPTS.md](SCRIPTS.md).

---

## 6. Updating

```bash
sudo /opt/docker-gui/scripts/install.sh
```

That re-runs the installer, which pulls latest, rebuilds, restarts.
Downtime is typically 5–15 seconds.

---

## 7. Backups

Phase 2 ships with a single SQLite database in a named Docker volume.

Manual backup:

```bash
docker run --rm -v docker-gui_app-data:/data -v "$(pwd)":/backup alpine \
  tar czf /backup/docker-gui-backup.tar.gz -C /data .
```

Restore:

```bash
docker compose -f /opt/docker-gui/docker-compose.yml down
docker run --rm -v docker-gui_app-data:/data -v "$(pwd)":/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/docker-gui-backup.tar.gz -C /data'
docker compose -f /opt/docker-gui/docker-compose.yml up -d
```

A first-class backup CLI lands in a later phase.

---

## 8. Uninstall

```bash
sudo /opt/docker-gui/scripts/uninstall.sh --keep-data   # safe, reversible
sudo /opt/docker-gui/scripts/uninstall.sh --purge       # nukes everything
```

---

## 9. Troubleshooting

### Web UI won't load

```bash
/opt/docker-gui/scripts/doctor.sh
```

The doctor will tell you which check failed. Common cases:

- **Docker daemon not running** — `sudo systemctl start docker`
- **Port 3000 in use by something else** — `DOCKER_GUI_WEB_PORT=8080 sudo -E ./scripts/install.sh`
- **Containers crashing** — `docker compose -f /opt/docker-gui/docker-compose.yml logs --tail 200`

### Forgot admin password

Reset by stopping the API, deleting the user, and bootstrap-ing again:

```bash
docker compose -f /opt/docker-gui/docker-compose.yml exec api \
  sh -c 'echo "DELETE FROM users; DELETE FROM refresh_tokens;" | sqlite3 /data/app.db'
```

Then load `/login` — the bootstrap mode comes back. (A first-class
`docker-gui admin reset` command lands in the CLI phase.)

### "Lost" my setup secret

Your secret is in `/opt/docker-gui/.env`:

```bash
sudo grep ^SETUP_SECRET /opt/docker-gui/.env
```

It's only useful before the first admin exists. Once the bootstrap is
complete, this value isn't needed.

### Docker socket permission denied

The `api` container mounts the socket read-only. Inside the container it's
fine. From the host, your user might not be in the `docker` group:

```bash
sudo usermod -aG docker $USER
newgrp docker  # or log out and back in
```

### Mail/email/storage features

Not in Phase 2. See [ROADMAP.md](ROADMAP.md) for the timeline:
- Phase 3: Caddy + domains + SSL
- Phase 4: Postgres GUI
- Phase 5: Mailu email wizard
- Phase 6: MinIO storage browser

---

## 10. Security checklist for production

- [ ] Fresh server, not a workstation
- [ ] Non-root user with sudo, root SSH disabled
- [ ] Firewall: allow 22, 3000 (or whatever WEB_PORT you chose)
- [ ] SSH key auth, password auth disabled
- [ ] Strong unique password for the admin account, from a manager
- [ ] Regular backup (automate the section 7 commands)
- [ ] `JWT_SECRET` is *not* the dev default (verify with `doctor.sh`)
- [ ] Re-run install regularly (or set up a cron) to pick up patches
- [ ] If you put a reverse proxy in front of `:3000` for HTTPS, set
      `CORS_ORIGINS` in `.env` to your real domain

A first-class TLS termination via Caddy lands in Phase 3.
