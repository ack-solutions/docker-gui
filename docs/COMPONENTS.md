# Component library

The web app's design system. **One canonical implementation** of every UI
pattern that appears more than once. Pages compose these — they never
recreate them.

Located in [`src/components/`](../src/components/), exported from a single
barrel: `import { ... } from "@/components"`.

If you find yourself reaching for `<Card>`, `<Chip>`, or `<Table>` directly
in a page, stop and check whether one of these wrappers covers it. If not,
either propose a new component for the library, or extend an existing one.

---

## Tokens

### `theme`

The MUI theme used by the entire app. Defined once in
[theme.ts](../src/components/theme.ts), provided via the root layout.
Pages must not call `createTheme` or override palette in-line — change a
value here, every page picks it up.

```ts
import { theme } from "@/components";
```

| Token              | Value         | Notes                              |
| ------------------ | ------------- | ---------------------------------- |
| `primary.main`     | `#0ea5e9`     | Brand colour — buttons, loaders    |
| `success.main`     | `#16a34a`     | "ok" / "running"                   |
| `warning.main`     | `#d97706`     | "degraded" / "paused"              |
| `error.main`       | `#dc2626`     | "down" / "exited"                  |
| `shape.borderRadius` | `8`         | Cards, chips, inputs               |

### `toneFor(status)` and `progressColor(pct)`

```ts
toneFor("running")          // → "success"
toneFor("degraded")         // → "warning"
progressColor(82)           // → "warning"  (default thresholds: 75 / 90)
```

Use these instead of inlining a `switch` over status values.

### `StatusKind`

Union type covering every status string the API returns:
`"ok" | "degraded" | "down" | "unavailable" | "running" | "exited" | "dead" | "paused" | "restarting" | "removing" | "created" | "unknown"`.

When the API surfaces a new state, add it here once — every chip and color
helper updates with it.

---

## Format helpers

Pure string helpers in [format.ts](../src/components/format.ts). Never
write ad-hoc bytes/seconds/percent formatters in a page.

```ts
formatBytes(8_589_934_592)         // "8.00 GB"
formatDuration(3725)               // "1h 2m"
formatPercent(42.345)              // "42.3%"
formatRelativeTime("2026-05-04T...") // "5m ago"
formatPorts([{ privatePort: 80, publicPort: 8080, type: "tcp" }])
                                   // "8080→80/tcp"
```

---

## Components

### `<StatusChip status={...} />`

Coloured chip with an icon. Drives the visual status indicator across the
whole UI — health checks, container states, future domains/ssl/etc.

```tsx
<StatusChip status="running" />
<StatusChip status="degraded" label="2 checks failing" />
<StatusChip status="ok" size="small" variant="outlined" withIcon={false} />
```

Props:

- `status: StatusKind` — required
- `label?: string` — defaults to a sensible label per status
- `size?: "small" | "medium"` — default `"small"`
- `variant?: "filled" | "outlined"` — default: filled for coloured tones, outlined for default
- `withIcon?: boolean` — default `true`

### `<MetricBar label pct primary secondary />`

Labeled progress bar with primary + secondary text. Used on Health for
CPU/memory/disk; reuse for any percentage metric.

```tsx
<MetricBar
  label="CPU"
  pct={42}
  primary="42%"
  secondary="8 cores · load 1.2 / 0.9 / 0.8"
/>
```

Color thresholds default to `75%` (warning) / `90%` (danger). Override:

```tsx
<MetricBar label="Custom" pct={62} thresholds={{ warning: 50, danger: 80 }} />
```

### `<EmptyState title message action icon />`

Use whenever a list/table is empty. Pages should not render their own
"nothing here" markup.

```tsx
<EmptyState
  title="No containers"
  message={<>Create one with <code>docker run …</code></>}
  action={<Button>Create</Button>}
/>
```

Set `dense` when used inside a table cell so vertical padding stays tight.

### `<ErrorState title message detail onRetry />`

Card-sized error state for **page-level** failures (i.e. the page can't
show its primary content). For action-level errors (a button click failed
but data is still visible), use MUI `<Alert severity="error">` directly.

```tsx
<ErrorState
  title="Cannot reach the API"
  message={err.message}
  onRetry={load}
  detail={"cd apps/api && yarn dev"}
/>
```

### `<LoadingState message fullScreen />`

Standard centered spinner. Use for first-render fetches; for in-flight
actions, use button `disabled` state instead.

```tsx
<LoadingState />
<LoadingState message="Refreshing…" fullScreen />
```

### `<SectionCard title subtitle action dense>{children}</SectionCard>`

The single card style. Use whenever a page has labelled sections so all
spacing and typography match.

```tsx
<SectionCard
  title="Service checks"
  action={<Button size="small">Refresh</Button>}
>
  ...
</SectionCard>
```

### `<DataTable columns rows rowKey rowActions empty />`

Generic table with optional per-row actions cell on the right. The shape
is the same everywhere: header row → optional empty state → one row per
item → optional actions.

```tsx
const columns: Column<Container>[] = [
  { key: "state", header: "State", render: (r) => <StatusChip status={r.state} /> },
  { key: "name",  header: "Name",  render: (r) => r.names[0] ?? r.shortId },
  { key: "image", header: "Image", render: (r) => r.image }
];

<DataTable
  columns={columns}
  rows={containers}
  rowKey={(r) => r.id}
  rowActions={(r) => <ContainerActions row={r} />}
  empty={<EmptyState title="No containers" />}
/>
```

Don't roll your own `<Table>` — extend `<DataTable>` instead. If you need a
column you can't express today, add a feature here.

### `<PageShell title subtitle user actions navItems>{children}</PageShell>`

Top-level chrome: app bar (brand + nav + user menu), page header
(title/subtitle + actions), then content. **Every page renders one PageShell
and nothing else outside of it** — no per-page `<AppBar>`, `<Container>`, or
custom header markup.

```tsx
<PageShell
  title="Containers"
  subtitle="12 total · 8 running"
  user={user}
  actions={<Button startIcon={<RefreshIcon />}>Refresh</Button>}
>
  <DataTable {...} />
</PageShell>
```

For unauthenticated screens (login, error pages), pass `hideChrome`:

```tsx
<PageShell hideChrome maxWidth="sm">
  ...
</PageShell>
```

`navItems` defaults to `[Containers, Health]`. Pages don't need to pass it
unless they want to override.

### `<AuthGuard>{(user) => <Page user={user} />}</AuthGuard>`

Render-prop wrapper that:

1. Redirects to `/login?next=<current>` if no token
2. Verifies the token by calling `/auth/me`
3. Passes the fetched `user` to children

Every authenticated page goes through `AuthGuard`. The check is identical
everywhere — there is no per-page auth code.

```tsx
export default function ContainersDashboard() {
  return <AuthGuard>{(user) => <ContainersInner user={user} />}</AuthGuard>;
}
```

If you find yourself writing `useEffect(() => { if (!isAuthenticated()) ... })`
in a page, you're working against the guard. Just use it.

---

## Conventions for adding pages

1. Page file (`src/app/<route>/page.tsx`) is a thin server shell — sets
   `metadata` and renders the dashboard component.
2. Dashboard component (`<route>-dashboard.tsx`) is `"use client"` and
   wraps content in `<AuthGuard>` if authenticated, or `<PageShell hideChrome>`
   if not.
3. Use the components above for everything — Cards, Chips, Tables.
4. Toasts via `sonner` (`import { toast } from "sonner"`) for action
   feedback; `<Alert>` for inline page-level warnings; `<ErrorState>` for
   "page failed to load" cases.
5. Format any number/byte/duration through `format.ts` helpers.

If a page needs something the library can't express, propose an addition
to `src/components/` — don't fork into the page.

---

## What this replaces

The pre-rebuild prototype had each feature page implementing its own:

- Status chip styling (different colors and icons in different files)
- Metric bar layout (handwritten in 3+ places)
- Empty state markup (none in some places, custom in others)
- Auth check (some pages had it, some didn't, with different redirect targets)
- Page header layout (varied between pages)
- Number/bytes formatting (3 different `formatBytes` implementations)

All of that is now this single library. Adding a feature should mean
*using* these components, not duplicating them.
