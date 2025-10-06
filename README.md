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

3. **Configure Docker Engine API (optional)**

   Update the `NEXT_PUBLIC_DOCKER_API_URL` environment variable to point to your Docker daemon. By default, the app uses mocked data so it works out of the box.

   ```bash
   cp .env.example .env.local
   # Edit NEXT_PUBLIC_DOCKER_API_URL and NEXT_PUBLIC_USE_MOCKS as needed
   ```

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
