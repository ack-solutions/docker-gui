# Development guide

How to run, change, and test docker-gui locally. For production install, see
[INSTALL.md](INSTALL.md).

---

## 1. Prerequisites

| Tool          | Version    | Why                                |
| ------------- | ---------- | ---------------------------------- |
| Node.js       | 20 LTS+    | Runtime                            |
| Yarn          | 1.22+      | Workspaces (we use the classic)    |
| Docker        | 24+        | dev-time integrations + Docker tests|
| Docker Compose| v2 plugin  | Local stack                        |
| Git           | 2.30+      | —                                  |
| `make`        | —          | Convenience targets                |

macOS, Linux, and Windows-with-WSL2 all work. Native Windows is not
supported because dockerode needs the Docker socket.

---

## 2. Clone & install

```bash
git clone https://github.com/<owner>/docker-gui.git
cd docker-gui
yarn install                # installs all workspace deps
cp .env.example .env        # generates dev defaults
```

The `.env.example` includes safe-to-commit dev defaults. The first
`yarn install` runs `prisma generate` automatically.

---

## 3. Two ways to run dev

### A. Hot-reload, native processes (fastest inner loop)

```bash
yarn dev                    # turbo runs apps/web + apps/api in parallel
```

Opens:

- Web: `http://localhost:3000`
- API: `http://localhost:4000`

The web app proxies `/api/*` to `http://localhost:4000` in dev (configured in
`apps/web/next.config.mjs`). Code changes in either app reload that app only.

The dev DB is a local SQLite file at `./apps/api/dev.db`. To reset:

```bash
yarn db:reset
```

### B. Full stack in containers (closest to production)

```bash
yarn dev:docker             # alias for: docker compose -f docker/compose/compose.dev.yml up
```

This starts everything (web + api + caddy + minio + a test postgres + a
test mailhog) with source mounted for hot reload. Use this when:

- You're testing a feature that needs Caddy in front (sites, SSL flows)
- You're testing MinIO bucket policies
- You're testing the production-ish networking

Slower restart but identical to prod behavior.

---

## 4. Database

Default dev DB is SQLite at `./apps/api/dev.db`. Common tasks:

```bash
yarn db:migrate             # apply pending migrations
yarn db:migrate:dev <name>  # create a new migration from schema.prisma
yarn db:reset               # nuke + remigrate + reseed
yarn db:seed                # seed-only
yarn db:studio              # opens prisma studio at :5555
```

To develop against Postgres locally instead of SQLite:

```bash
docker run -d --name dgui-pg -e POSTGRES_PASSWORD=dev -p 5432:5432 postgres:16
echo 'DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres' >> .env
yarn db:migrate
```

The schema is identical between SQLite and Postgres — Prisma handles it.

---

## 5. Running tests

Three layers, all runnable independently or together.

### Unit tests (Vitest)

```bash
yarn test                   # run once
yarn test:watch             # watch mode
yarn test:coverage          # with coverage report
```

Per-workspace:

```bash
yarn workspace @dgui/api test
yarn workspace @dgui/web test
yarn workspace @dgui/shared test
```

### Integration tests

These need Docker running. They spin up real Docker / MinIO / Postgres
containers and assert against them.

```bash
yarn test:integration
```

Tagged with `// @group integration` so they're excluded from `yarn test`.
Run subset:

```bash
yarn test:integration --grep docker
yarn test:integration --grep minio
```

### End-to-end tests (Playwright)

These start the full stack (compose.dev.yml), then run a browser through
real flows.

```bash
yarn test:e2e               # headless
yarn test:e2e:headed        # with browser visible
yarn test:e2e --debug       # step through with inspector
```

The Playwright config records traces, screenshots, and video on failure —
look in `apps/web/test-results/` for artifacts.

---

## 6. Manual testing checklist (before opening a PR)

Anything you can't cover with an automated test, walk through manually:

- [ ] Login → dashboard renders
- [ ] Create a container from UI; appears in list; logs stream
- [ ] Exec into the container via the terminal panel; type commands
- [ ] Stop and remove the container; cleanly removed
- [ ] Create a MinIO bucket; upload a 100 MB file; download it
- [ ] Add a domain (manual mode); see the records to add
- [ ] Add a site pointing at a container; Caddy serves it on `localhost`
- [ ] Logout; tokens are invalidated; cannot re-use the old JWT

For UI changes, check responsive (mobile width 375px) and dark theme.

---

## 7. Conventions

### TypeScript

- `strict: true` and friends — non-negotiable
- No `any`, `as any`, or `@ts-ignore` in committed code. If you genuinely
  need an escape hatch, use `as unknown as X` with a comment justifying it
- Branded types for IDs: `type ContainerId = Branded<string, 'ContainerId'>`
- Discriminated unions for variants — never optional sibling fields

### Validation

- Every API route validates request body, query, and params with zod
- Schemas live in `packages/shared/src/schemas/<feature>.ts`
- Both web and api import the same schema; client-side forms use the same zod

### Errors

- Throw a typed `AppError(code, message, { cause, details })` from services
- The Fastify error handler converts `AppError` to the HTTP envelope
- Never leak raw `error.message` from third-party libs to the client

### File naming

- `kebab-case` for files, `PascalCase` for React components, `camelCase` for
  functions
- One default export per React component file; named exports otherwise

### Git

- Conventional commits: `feat:`, `fix:`, `chore:`, `refactor:`, `docs:`
- One logical change per commit
- PR title = feature scope; description = the why + screenshots if UI

### React

- TanStack Query for any server data
- React Hook Form + zod for forms
- No `useEffect` for data fetching — that's what `useQuery` is for
- Co-locate components and their hooks under `apps/web/src/features/<area>/`

### Backend

- Routes are thin: parse → call service → return. No business logic
- Services are pure-ish: take inputs, return outputs, throw `AppError` on
  failure. They depend on injected clients (db, docker, minio) — no globals
- All async errors handled. No floating promises

---

## 8. Adding a new feature (checklist)

1. Sketch the data model — does it need a new Prisma model? Migration?
2. Define the zod schemas in `packages/shared/src/schemas/`
3. Write the service in `apps/api/src/services/<feature>/` with unit tests
4. Wire the route in `apps/api/src/routes/<feature>/`; add integration test
5. Build the UI page in `apps/web/src/app/<feature>/`
6. Add a TanStack Query hook in `apps/web/src/features/<feature>/api.ts`
7. Add a Playwright e2e for the happy path
8. Update docs if user-facing
9. Open a PR — CI must be green to merge

---

## 9. Debugging

### Backend (Fastify API)

```bash
yarn workspace @dgui/api dev:inspect
```

Then attach a debugger (VS Code launch config in `.vscode/launch.json`,
or Chrome DevTools at `chrome://inspect`).

Logs default to pretty-printed (`pino-pretty`) in dev. To see structured
JSON instead: `LOG_PRETTY=false yarn dev`.

### Frontend (Next.js)

Standard React DevTools and the Next.js error overlay. For TanStack Query
state: open the React Query devtools panel (toggle with the floating button
in dev).

### Inside containers

The api and web containers in `compose.dev.yml` expose the Node `--inspect`
port (9229 and 9230). VS Code → Run → Attach.

---

## 10. Common dev tasks

| I want to…                              | Run                                  |
| --------------------------------------- | ------------------------------------ |
| Reset everything                        | `yarn clean && yarn install`         |
| Reset just the DB                       | `yarn db:reset`                      |
| Update Prisma client after schema edit  | `yarn db:migrate:dev <name>`         |
| Generate types from API for the client  | automatic via `packages/shared`      |
| Add a dependency to the API only        | `yarn workspace @dgui/api add <pkg>` |
| Add a dependency to all workspaces      | `yarn add -W <pkg>`                  |
| See what's in the dev DB                | `yarn db:studio`                     |
| Lint everything                         | `yarn lint`                          |
| Format everything                       | `yarn format`                        |
| Run a one-off script against dev DB     | `yarn workspace @dgui/api tsx scripts/<name>.ts` |
| Build production images locally         | `yarn docker:build`                  |
| Run the production stack locally        | `yarn docker:up`                     |
| Tail the production stack logs          | `yarn docker:logs`                   |

---

## 11. Plugin development (preview)

A plugin lives in `plugins/<name>/` and follows this layout:

```
plugins/discord-notifier/
├── plugin.yml             # manifest: name, version, hooks, permissions
├── Dockerfile
├── src/
│   ├── index.ts           # entry, registers hook handlers
│   └── ui/                # optional: panel mounted via iframe
└── README.md
```

Run a plugin against your dev panel:

```bash
yarn plugin:dev plugins/discord-notifier
```

This builds the plugin image, registers it with the dev API, and watches for
changes. The full plugin SDK lands in Phase 7+.

---

## 12. Releasing

(For maintainers.)

```bash
yarn release patch          # 0.4.2 → 0.4.3
yarn release minor          # 0.4.x → 0.5.0
yarn release major          # 0.x.y → 1.0.0
```

The release script:

1. Runs full test suite (must be green)
2. Bumps version in all workspaces
3. Generates changelog from conventional commits
4. Creates a git tag
5. Pushes — CI builds and publishes multi-arch images and the npm CLI

---

## 13. Where to ask questions

- Architecture or design questions → GitHub Discussions
- Bugs → GitHub Issues
- Security → `security@docker-gui.io` (or the policy in `SECURITY.md`)
- Real-time chat → Discord (link in README)
