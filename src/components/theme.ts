import { createTheme } from "@mui/material/styles";

/**
 * The single source of truth for visual style. Change a value here, every
 * page picks it up.
 */
export const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#2563eb", dark: "#1d4ed8", light: "#3b82f6", contrastText: "#ffffff" },
    secondary: { main: "#7c3aed" },
    success: { main: "#16a34a", light: "#22c55e" },
    warning: { main: "#d97706", light: "#f59e0b" },
    error: { main: "#dc2626", light: "#ef4444" },
    info: { main: "#0ea5e9" },
    text: { primary: "#0f172a", secondary: "#64748b" },
    divider: "#e7ebf0",
    background: { default: "#f5f7fb", paper: "#ffffff" }
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    h4: { fontWeight: 700, letterSpacing: "-0.02em" },
    h5: { fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontWeight: 700, letterSpacing: "-0.01em" },
    subtitle1: { fontWeight: 600 },
    subtitle2: { fontWeight: 600 },
    button: { fontWeight: 600 }
  },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: "none", borderRadius: 10, fontWeight: 600 },
        sizeSmall: { borderRadius: 8, paddingTop: 5, paddingBottom: 5 },
        containedPrimary: { boxShadow: "0 1px 2px rgba(37,99,235,0.28)" },
        outlined: { borderColor: "#d8dee6" }
      }
    },
    MuiIconButton: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiCard: {
      defaultProps: { variant: "outlined" },
      styleOverrides: {
        root: {
          borderColor: "#e7ebf0",
          borderRadius: 16,
          boxShadow: "0 1px 2px rgba(15,23,42,0.04), 0 1px 3px rgba(15,23,42,0.03)"
        }
      }
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500, borderRadius: 8 },
        sizeSmall: { height: 22 }
      }
    },
    MuiTableHead: { styleOverrides: { root: { backgroundColor: "#f8fafc" } } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: "#eef1f5" },
        head: {
          fontWeight: 600,
          color: "#64748b",
          fontSize: "0.7rem",
          letterSpacing: "0.05em",
          textTransform: "uppercase"
        }
      }
    },
    MuiTableRow: {
      styleOverrides: {
        root: { "&.MuiTableRow-hover:hover": { backgroundColor: "#f9fafb" } }
      }
    },
    MuiTooltip: { styleOverrides: { tooltip: { borderRadius: 8, fontSize: "0.75rem" } } },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiInputLabel: { styleOverrides: { root: { fontSize: "0.9rem" } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: "#ffffff",
          "& .MuiOutlinedInput-notchedOutline": { borderColor: "#dfe3e8" },
          "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#c4ccd6" },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderWidth: 1, borderColor: "#2563eb" },
          "&.Mui-focused": { boxShadow: "0 0 0 3px rgba(37,99,235,0.12)" }
        }
      }
    }
  }
});

export type Tone = "ok" | "warning" | "down" | "neutral";

export type StatusKind =
  | "ok"
  | "degraded"
  | "down"
  | "unavailable"
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
    case "warning" as never:
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
