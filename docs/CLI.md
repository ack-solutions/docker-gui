# `docker-gui` CLI reference

The `docker-gui` command is installed at `/usr/local/bin/docker-gui` by
the installer. It wraps `docker compose` against the install at
`/opt/docker-gui/` so you don't have to remember `cd` paths or `-f` flags.

```
docker-gui — manage your docker-gui install

Usage:  docker-gui <command> [args...]
```

Run `docker-gui --help` for the full inline list. This page is the
expanded reference.

> Need to install? See [INSTALL.md](INSTALL.md).

---

## Service

### `start` / `stop` / `restart`

```bash
docker-gui start      # docker compose up -d
docker-gui stop       # docker compose down
docker-gui restart    # docker compose restart   (re-reads env + config.yml)
```

`restart` is what you want after editing `config.yml` or `.env`. It's faster
than `stop` + `start` because images don't need to be re-pulled or rebuilt.

### `status`

```bash
docker-gui status
```

Lists service names + image tags + status. Equivalent to
`docker compose -f /opt/docker-gui/docker-compose.yml ps`.

### `logs [service]`

```bash
docker-gui logs              # tail all services
docker-gui logs api          # only api
docker-gui logs caddy        # only caddy
```

Tails with `--tail=200`. Press Ctrl-C to stop.

### `shell [service]`

```bash
docker-gui shell             # api container (default)
docker-gui shell web
docker-gui shell caddy
```

Drops you into `sh` inside the named container. Useful for quick
inspection. The api container has `tsx` available so you can run admin
scripts directly.

---

## Config

### `config`

```bash
docker-gui config            # opens /opt/docker-gui/config.yml in $EDITOR
                             # auto-runs `restart` after the editor exits
```

Default editor is `nano`. Override with `EDITOR=vim docker-gui config`.

### `config show`

```bash
docker-gui config show
```

Prints the current `config.yml`.

### `config validate`

```bash
docker-gui config validate
```

Checks YAML syntax. Doesn't validate the schema (that happens at api boot
— check logs after restart).

---

## Admin

These run inside the api container, so the database is reached via the
in-cluster connection.

### `admin create <email> <name> <password>`

```bash
docker-gui admin create alice@example.com "Alice" "StrongPassword1"
```

Creates a new admin user with role `owner`. Use this when:

- You've lost access to the only admin and need a fresh one
- You want a second admin without going through the UI
- You're scripting initial bootstrap

### `admin reset <email> <password>`

```bash
docker-gui admin reset admin@example.com "NewPassword1"
```

Resets the password for an existing user. Revokes all active sessions —
the user will need to sign in again.

### `admin list`

```bash
docker-gui admin list
```

Prints a table of all users. Useful for checking who exists or which
accounts are inactive.

---

## Backup + restore

### `backup [--out path]`

```bash
docker-gui backup
docker-gui backup --out /var/backups/docker-gui-2026-05-05.tar.gz
```

Creates a tarball of the `app-data` volume (SQLite DB + state). Default
filename: `docker-gui-backup-<YYYYMMDD-HHMMSS>.tar.gz` in the current dir.

The backup does **not** include:

- Caddy state / certs (rebuild-able from Let's Encrypt on first request)
- `.env` and `config.yml` (back those up separately — they're tiny)

For full DR, copy the tarball offsite (S3, another server, etc.).

### `restore <path>`

```bash
docker-gui restore /var/backups/docker-gui-2026-05-05.tar.gz
```

Stops the stack, wipes the current `app-data` volume, untars the backup
into it, and starts the stack again. Asks for confirmation by default.

---

## Maintenance

### `update [--version v]`

```bash
docker-gui update                       # latest main
docker-gui update --version v0.4.0      # a specific tag
```

See [UPDATE.md](UPDATE.md) for what this does.

### `doctor [--feature x]`

```bash
docker-gui doctor                       # all checks
docker-gui doctor --feature docker      # only docker checks
docker-gui doctor --feature caddy
docker-gui doctor --json                # machine-readable output
```

See [SCRIPTS.md](SCRIPTS.md#scriptsdoctorsh).

### `version`

```bash
docker-gui version
```

Prints install dir, source version (from `package.json`), and a table of
running services + image tags.

---

## Removal

### `uninstall [--keep-data | --purge]`

```bash
sudo docker-gui uninstall --keep-data   # safe — preserves volumes + secrets
sudo docker-gui uninstall --purge       # nukes everything
sudo docker-gui uninstall --yes --purge # non-interactive purge
```

`--keep-data` is the safe default for "I want to reinstall later". Volumes
and `.env` survive — re-running the installer brings everything back.

`--purge` is irreversible. It removes containers, images, volumes,
`/opt/docker-gui/`, and `/usr/local/bin/docker-gui`. Take a backup first.

---

## Common workflows

### "Something is broken, what do I do?"

```bash
docker-gui doctor             # what's failing?
docker-gui logs --tail=200    # what does the api say?
docker-gui status             # are all containers up?
```

### "I want to upgrade to v0.5.0 with a backup"

```bash
docker-gui backup --out /var/backups/pre-v0.5.tar.gz
sudo docker-gui update --version v0.5.0
docker-gui doctor
# if anything's wrong:
sudo docker-gui restore /var/backups/pre-v0.5.tar.gz
sudo docker-gui update --version v0.4.0
```

### "I forgot the admin password"

```bash
sudo docker-gui admin reset admin@example.com "NewPassword1"
```

### "I want to check my config without restarting"

```bash
docker-gui config show
docker-gui config validate
```

### "I want to install a new version of docker-gui to test"

You can use a different install directory:

```bash
DOCKER_GUI_DIR=/opt/docker-gui-staging \
DOCKER_GUI_WEB_PORT=3001 \
sudo -E bash -c 'curl -fsSL https://get.docker-gui.io/install.sh | bash'
```

The CLI binary at `/usr/local/bin/docker-gui` will get overwritten —
that's fine, both installs share the same wrapper.

---

See also:
[INSTALL.md](INSTALL.md) ·
[CONFIG.md](CONFIG.md) ·
[UPDATE.md](UPDATE.md) ·
[SCRIPTS.md](SCRIPTS.md)
