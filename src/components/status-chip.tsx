"use client";

import { Chip, type ChipProps } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { toneFor, type StatusKind } from "./theme";

export interface StatusChipProps {
  status: StatusKind;
  label?: string;
  size?: ChipProps["size"];
  variant?: ChipProps["variant"];
  withIcon?: boolean;
}

const ICONS: Record<"success" | "warning" | "error" | "default", JSX.Element> = {
  success: <CheckCircleIcon fontSize="small" />,
  warning: <WarningAmberIcon fontSize="small" />,
  error: <ErrorOutlineIcon fontSize="small" />,
  default: <HelpOutlineIcon fontSize="small" />
};

const DEFAULT_LABELS: Record<StatusKind, string> = {
  ok: "OK",
  degraded: "Degraded",
  down: "Down",
  unavailable: "Unavailable",
  running: "Running",
  exited: "Exited",
  dead: "Dead",
  paused: "Paused",
  restarting: "Restarting",
  removing: "Removing",
  created: "Created",
  unknown: "Unknown"
};

/**
 * One chip for every status anywhere in the UI.
 *
 * Usage:
 *   <StatusChip status="running" />
 *   <StatusChip status="degraded" label="Some checks unavailable" />
 *   <StatusChip status="ok" size="small" variant="outlined" withIcon={false} />
 */
export function StatusChip({
  status,
  label,
  size = "small",
  variant,
  withIcon = true
}: StatusChipProps): JSX.Element {
  const color = toneFor(status);
  return (
    <Chip
      size={size}
      label={label ?? DEFAULT_LABELS[status]}
      color={color}
      variant={variant ?? (color === "default" ? "outlined" : "filled")}
      {...(withIcon ? { icon: ICONS[color] } : {})}
    />
  );
}
