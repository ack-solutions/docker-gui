import { createTheme } from "@mui/material/styles";

/**
 * The single source of truth for visual style. Change a value here, every
 * page picks it up.
 *
 * Tokens (referenced from components):
 * - palette.primary  — brand colour, used for primary buttons + loaders
 * - palette.success  — "ok" / "running" status
 * - palette.warning  — "degraded" / "paused" / "restarting" status
 * - palette.error    — "down" / "exited" / "dead" status
 * - shape.borderRadius — global radius for cards, chips, inputs
 * - typography       — system font stack (no web font fetch)
 */
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#0ea5e9", dark: "#0284c7", light: "#38bdf8" },
    success: { main: "#16a34a" },
    warning: { main: "#d97706" },
    error: { main: "#dc2626" },
    background: { default: "#f8fafc", paper: "#ffffff" }
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    subtitle1: { fontWeight: 600 }
  },
  components: {
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiCard: { defaultProps: { variant: "outlined" } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } }
  }
});

/**
 * Semantic tone → MUI color name.
 *
 * Use this in any component that takes a color hint instead of repeating
 * status-color logic. Add new tones here, never inline a switch in a page.
 */
export type Tone = "ok" | "warning" | "down" | "neutral";

export type StatusKind =
  // health-style statuses
  | "ok"
  | "degraded"
  | "down"
  | "unavailable"
  // container-state statuses
  | "running"
  | "exited"
  | "dead"
  | "paused"
  | "restarting"
  | "removing"
  | "created"
  | "unknown";

export function toneFor(status: StatusKind): "success" | "warning" | "error" | "default" {
  switch (status) {
    case "ok":
    case "running":
      return "success";
    case "degraded":
    case "warning" as never: // tolerate the broader Tone alias
    case "paused":
    case "restarting":
      return "warning";
    case "down":
    case "exited":
    case "dead":
      return "error";
    case "unavailable":
    case "unknown":
    case "created":
    case "removing":
    default:
      return "default";
  }
}

export function progressColor(pct: number): "success" | "warning" | "error" {
  if (pct >= 90) return "error";
  if (pct >= 75) return "warning";
  return "success";
}
