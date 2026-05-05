# Updating

Updates are one command:

```bash
sudo docker-gui update
```

That re-runs the installer with your existing data, secrets, and
`config.yml` preserved. Downtime is typically 10–30 seconds while
containers restart.

> First-time install? See [INSTALL.md](INSTALL.md).

---

## What `update` does

1. Downloads the latest source tarball (defaults to the `main` branch)
2. Replaces `/opt/docker-gui/source/` with the new source
3. Refreshes `/opt/docker-gui/docker-compose.yml` and the Caddy bootstrap config
4. **Preserves** `/opt/docker-gui/config.yml` and `/opt/docker-gui/.env`
5. Rebuilds the api + web images
6. `docker compose up -d` — atomic restart, named volumes intact
7. Runs Prisma migrations on api boot
8. Waits for the health endpoint

---

## Pinning a version

Update to a specific tag:

```bash
sudo docker-gui update --version v0.4.0
```

Or `main` for the latest:

```bash
sudo docker-gui update --version main
```

(The `--version` flag accepts any branch or tag from the configured repo.
Override the repo entirely with `DOCKER_GUI_REPO=owner/name`.)

---

## Rolling back

There is no built-in `docker-gui rollback` yet (it's on the roadmap).
For now, rollback is a re-update with an older version:

```bash
sudo docker-gui update --version v0.3.0
```

The data volume isn't touched by this — but **schema migrations are not
auto-reversible**. If a migration ran during the upgrade and you roll back
to a version that doesn't know about the new columns, you may see errors.
In that case:

1. Restore the most recent backup: `sudo docker-gui restore <file>`
2. Or stop the api and revert the schema by hand (advanced)

The safe way: take a backup before every update.

```bash
docker-gui backup --out /var/backups/docker-gui-pre-upgrade.tar.gz
sudo docker-gui update
# verify everything works...
```

---

## What's preserved across updates

| Path / Resource                       | Preserved | Notes                                              |
| ------------------------------------- | --------- | -------------------------------------------------- |
| `/opt/docker-gui/.env`                | ✓         | Your secrets stay the same, sessions survive       |
| `/opt/docker-gui/config.yml`          | ✓         | Your config edits survive                          |
| Docker volume `docker-gui_app-data`   | ✓         | Database + app state                               |
| Docker volume `docker-gui_caddy-data` | ✓         | TLS certs + ACME state                             |
| Docker volume `docker-gui_caddy-config`| ✓        | Caddy's last-applied config (sites stay live)      |
| `/opt/docker-gui/docker-compose.yml`  | refreshed | Replaced by the new version's compose file        |
| `/opt/docker-gui/source/`             | replaced  | Wiped and re-extracted from the new tarball       |
| `/opt/docker-gui/caddy/initial.json`  | refreshed | Replaced by the new version's bootstrap config    |
| `/usr/local/bin/docker-gui`           | refreshed | Replaced by the new version's CLI                 |

---

## Automatic updates

Run `docker-gui update` from cron. Add to root's crontab:

```cron
# Update at 03:30 every Sunday
30 3 * * 0  /usr/local/bin/docker-gui update >> /var/log/docker-gui-update.log 2>&1
```

Or, use systemd timers for more flexibility — see your distro's docs.

We don't ship an in-app auto-updater yet because:

- Schema migrations need a rollback path before they're safe to run unattended
- Major version bumps may need config migration

When those are ready, `docker-gui update` will gain an `--auto` flag with
sensible safety rails.

---

## Health check after update

```bash
docker-gui doctor
```

Expected output: all `✓`, no `✗`.

If anything regressed:

```bash
docker-gui logs --tail=200    # what's the api complaining about?
docker-gui status             # are all containers up?
```

---

## Update from a fork or private repo

```bash
DOCKER_GUI_REPO=my-org/docker-gui-fork \
DOCKER_GUI_VERSION=production \
sudo -E docker-gui update
```

For a fully private mirror behind auth, set `DOCKER_GUI_TARBALL_URL` to a
fully qualified URL with auth (e.g. token in the URL or a
short-lived presigned link).

---

## Network-isolated installs

If your server can't reach github.com:

1. Build a tarball locally: `tar czf docker-gui.tar.gz --exclude=node_modules --exclude=.next --exclude=.git -C /path/to/repo .`
2. Copy it to the server: `scp docker-gui.tar.gz server:/tmp/`
3. On the server: `DOCKER_GUI_TARBALL_URL=file:///tmp/docker-gui.tar.gz sudo -E docker-gui update`

(`file://` URLs work because `curl` supports them.)

---

See also:
[INSTALL.md](INSTALL.md) ·
[CONFIG.md](CONFIG.md) ·
[CLI.md](CLI.md) ·
[SCRIPTS.md](SCRIPTS.md)
