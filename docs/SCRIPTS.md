# Scripts

The `scripts/` directory contains the operational scripts shipped with
docker-gui — install, doctor, uninstall. They have no runtime dependencies
beyond standard Linux + Docker, so they work even when the application
itself is broken.

---

## scripts/install.sh

One-line installer. Run on a fresh Linux server (Ubuntu 22.04+, Debian 11+,
RHEL 9+ / Rocky / Alma all work). macOS is dev-only — see
[DEVELOPMENT.md](DEVELOPMENT.md) instead.

### What it does

1. Detects OS
2. Checks Docker — installs via `get.docker.com` if missing
3. Verifies Docker daemon is running and `docker compose` plugin is present
4. Verifies the chosen web port is free
5. Clones the repo to `/opt/docker-gui` (or updates an existing checkout)
6. Generates `JWT_SECRET` and `SETUP_SECRET` (32-byte random hex) → writes
   to `/opt/docker-gui/.env` with mode 600. Existing `.env` is preserved
   on re-runs.
7. Builds the multi-arch images via `docker compose build`
8. Starts the stack with `docker compose up -d`
9. Polls `http://127.0.0.1:<WEB_PORT>/api/v1/health/live` until ready
   (60-second budget)
10. Prints the URL + the setup secret you need to bootstrap the first admin

### Usage

From the internet (recommended):

```bash
curl -fsSL https://get.docker-gui.io/install.sh | sudo bash
```

From a local checkout:

```bash
sudo ./scripts/install.sh
```

### Configuration via env

| Variable               | Default                       | Effect                                  |
| ---------------------- | ----------------------------- | --------------------------------------- |
| `DOCKER_GUI_DIR`       | `/opt/docker-gui`             | Where to install                        |
| `DOCKER_GUI_REPO`      | the public repo               | Source repo (override for forks)        |
| `DOCKER_GUI_BRANCH`    | `main`                        | Branch / tag to check out               |
| `DOCKER_GUI_WEB_PORT`  | `3000`                        | Port to bind the web UI                 |

### Idempotency

Re-running `install.sh` upgrades to the latest `main`:

- Existing `.env` is **preserved** (your secrets don't rotate)
- Existing data volume is **preserved** (DB, configs, MinIO)
- Images are rebuilt from the new source
- Stack is restarted

For a forced clean install, run `uninstall.sh --purge` first.

---

## scripts/doctor.sh

Diagnose problems with your installation or your host. Designed to give
specific, actionable output — not just "something is broken".

### Usage

```bash
./scripts/doctor.sh                    # All checks, human output
./scripts/doctor.sh --json             # JSON for CI/monitoring
./scripts/doctor.sh --feature docker   # Run only the Docker section
```

### Sections

| Section   | Checks                                                                      |
| --------- | --------------------------------------------------------------------------- |
| `os`      | Linux/macOS supported                                                       |
| `docker`  | docker CLI, daemon running, compose plugin, socket readable                 |
| `system`  | Memory available, disk free at /, curl + openssl present                    |
| `ports`   | Web/API ports free or in use by docker-gui                                  |
| `service` | Install dir present, .env mode 600, secrets meet length, /health responding |

### Exit codes

- `0` — all checks pass (warnings are OK)
- `1` — at least one critical check failed

### JSON output (for monitoring)

```bash
./scripts/doctor.sh --json
```

Returns:

```json
{
  "pass": 12,
  "fail": 0,
  "warn": 1,
  "checks": {
    "pass": ["docker CLI (...)", "..."],
    "fail": [],
    "warn": ["docker socket: not readable by current user — ..."]
  }
}
```

Use this in a Prometheus blackbox exporter, a Healthchecks.io ping, or
just `cron` writing to a file:

```cron
*/5 * * * * /opt/docker-gui/scripts/doctor.sh --json > /var/log/docker-gui-health.json
```

---

## scripts/uninstall.sh

Clean removal. Two modes:

```bash
sudo ./scripts/uninstall.sh --keep-data   # remove containers + images, keep volumes + .env
sudo ./scripts/uninstall.sh --purge       # remove everything including data
sudo ./scripts/uninstall.sh --yes --purge # non-interactive
```

`--keep-data` is the safe default for "I want to reinstall fresh later" —
it stops and removes the running containers and locally built images, but
your data volume (the SQLite DB, configs, etc.) and your `.env` (with
generated secrets) stay put. Run `install.sh` again to bring it back.

`--purge` is the irreversible one. Use with care.

---

## When to run each

| Situation                                                | Run                                          |
| -------------------------------------------------------- | -------------------------------------------- |
| Setting up a new server                                  | `install.sh`                                 |
| Upgrading docker-gui                                     | `install.sh` again (idempotent)              |
| Web UI / login isn't working                             | `doctor.sh`, then check `docker compose logs`|
| Adding monitoring                                        | `doctor.sh --json` from a cron job           |
| Want to reinstall fresh but keep data                    | `uninstall.sh --keep-data`, then `install.sh`|
| Decommissioning a server                                 | `uninstall.sh --purge`                       |
| Feel a check is missing                                  | Open a PR adding it to `doctor.sh`           |

---

## Adding new doctor checks

The pattern in `doctor.sh` is:

```bash
if run_section <section_name>; then
  section "Section title"
  if my_check_passes; then
    ok "Description of what passed"
  else
    fail "Check name" "Why it failed and how to fix"
  fi
fi
```

`fail` increments the failure counter and contributes to the non-zero
exit code. `warn` records a warning but doesn't fail the run. `ok` is
purely informational.

Section names are slugs that can be passed via `--feature` so users can
run a subset.
