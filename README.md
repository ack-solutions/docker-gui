# Docker Control Center

A Next.js + Material UI dashboard for managing Docker resources such as containers, images, volumes, and networks. The project ships with an opinionated folder structure, mocked data layer, and ready-to-extend React Query hooks for integrating with a real Docker Engine API.

## Features

- **Container management** – list running/stopped containers, inspect resource usage, and access quick actions.
- **Image catalog** – review image metadata, track storage consumption, and prepare exports.
- **Volume insights** – monitor persistent volumes and prune unused resources.
- **Network visibility** – explore Docker networks and understand container connectivity.
- **Debug tooling** – follow live logs with filtering, view aggregate severity counts, and browse container file systems.
- **Modern UI** – built with Material UI components, responsive layout, and dark theme defaults.

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Run the development server**

   ```bash
   npm run dev
   ```

   The application will be available at [http://localhost:3000](http://localhost:3000).

3. **Configure Docker Engine access (optional)**

   Duplicate `.env.example` to `.env.local` and tune the flags for your workflow:

   ```bash
   cp .env.example .env.local
   ```

   - `NEXT_PUBLIC_USE_MOCKS=true` (default) keeps the demo data.
   - Set `NEXT_PUBLIC_USE_MOCKS=false` to require live Docker responses.
   - Provide standard Docker variables (`DOCKER_HOST`, `DOCKER_TLS_VERIFY`, `DOCKER_CERT_PATH`, `DOCKER_SOCKET_PATH`) if you connect to a remote daemon or use a non-default socket location.

### Using live Docker data

1. **Start Docker Engine** – ensure Docker Desktop or your daemon is running.
2. **Expose the socket or TCP endpoint**
   - Local socket (default): verify `/var/run/docker.sock` exists and is readable.
     ```bash
     ls -l /var/run/docker.sock
     ```
     On Linux you may need `sudo usermod -aG docker "$USER"` and re-login.
   - Remote/TCP: set `DOCKER_HOST=tcp://host:2375` and, if TLS is required, `DOCKER_TLS_VERIFY=1` and `DOCKER_CERT_PATH=/path/to/certs`.
3. **Update `.env.local`** with `NEXT_PUBLIC_USE_MOCKS=false` and any Docker variables described above, then restart `npm run dev`.
4. **Test connectivity** directly to confirm Docker is reachable:
   ```bash
   curl --unix-socket /var/run/docker.sock http://localhost/containers/json
   # or for TCP endpoints
   curl http://localhost:2375/containers/json
   ```

If the dashboard shows a `502 Bad Gateway` message, the server could not reach Docker. Re-check the environment variables, socket permissions, and that the daemon is running.

## Authentication & Users

- The dashboard now requires authentication. Without a valid session token no API or page is accessible.
- On first run, create an administrator account with a single POST request (subsequent registrations are disabled so the portal stays locked down):

  ```bash
  curl -X POST http://localhost:3000/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"email":"admin@example.com","password":"ChangeMe123!","name":"Platform Admin"}'
  ```

  Replace the credentials and update them immediately after signing in.

- Sign in at [http://localhost:3000/login](http://localhost:3000/login). Sessions are JWT-based and stored in `localStorage`.
- Manage additional users and their module-level permissions under **Server → User Management**. Roles (admin, operator, viewer) provide sensible defaults, and you can override access per module.
- User and session data are stored in SQLite (`SQLITE_PATH`, default `/app/data/auth.db`). Make sure this path lives on persistent storage in production.

## Running with Docker Compose

### Local development (hot reload)

1. Ensure Docker Desktop / Docker Engine is running and the Unix socket (or TCP endpoint) is reachable.
2. Optionally duplicate `.env.example` to `.env.development` and adjust values.
3. Start the dev stack with file watching and hot reload:

   ```bash
   docker compose up --build
   ```

   The container mounts your workspace, runs `yarn install`, and executes `yarn dev`, so code edits on macOS, Linux, or Windows (via WSL2) trigger instant reloads. Generated SQLite data lives in `docker-gui-data` and the authentication database defaults to `/app/data/auth.db`; inspect them via `docker volume ls`.

4. Stop the stack with `Ctrl+C` (foreground) or `docker compose down`.

> **Windows note:** Bind-mounting `/var/run/docker.sock` is not supported on native Windows. Run the stack inside WSL2 or expose the Docker daemon at `tcp://host.docker.internal:2375` and set `DOCKER_HOST` accordingly before starting the compose service.

### Production image

Build and run the optimized Next.js output using the dedicated compose file:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This uses the `runner` stage from the `Dockerfile`, copies the standalone Next.js bundle, and keeps data in the `docker-gui-data` volume. Set `JWT_SECRET`, `SQLITE_PATH`, and any additional environment variables prior to deployment.

## Project Structure

```
src/
  app/                # Next.js app router pages and layouts
  components/         # Layout, providers, and theming helpers
  features/           # Domain-focused modules (containers, images, etc.)
  lib/                # API client and shared utilities
```

Each feature module contains hooks for data access and UI components. Hooks use React Query and default to mocked data, making it straightforward to swap in live Docker Engine endpoints.

## Styling & UI

- Material UI 5 with a custom dark theme and responsive typography.
- Reusable layout components (`Sidebar`, `TopBar`, `AppLayout`) provide navigation and consistent styling.
- React Query centralizes server state management via `QueryProvider`.

## Next Steps

- Connect `src/lib/api/docker.ts` to your Docker Engine or management backend.
- Implement mutations for start/stop/restart container actions.
- Extend the file browser to download files or upload assets.
- Secure the dashboard with authentication and role-based access controls.

## Scripts

- `npm run dev` – start the local development server.
- `npm run build` – create an optimized production build.
- `npm run start` – run the production build.
- `npm run lint` – lint the project with ESLint.

## Requirements

- Node.js 18.18+
- npm 10+

Feel free to customize the structure or styling to fit your team's workflow.
