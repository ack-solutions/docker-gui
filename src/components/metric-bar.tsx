"use client";

import { Box, LinearProgress, Typography } from "@mui/material";
import { progressColor } from "./theme";

export interface MetricBarProps {
  label: string;
  pct: number;
  primary?: string;
  secondary?: string;
  thresholds?: { warning: number; danger: number };
}

/**
 * Labeled progress bar with primary + secondary text.
 *
 * Color thresholds default to 75% (warning) / 90% (danger) — override via
 * `thresholds` if a metric has different sensible bands.
 *
 * Usage:
 *   <MetricBar label="CPU" pct={42} primary="42%" secondary="8 cores" />
 */
export function MetricBar({
  label,
  pct,
  primary,
  secondary,
  thresholds
}: MetricBarProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const color = thresholds
    ? clamped >= thresholds.danger
      ? "error"
      : clamped >= thresholds.warning
        ? "warning"
        : "success"
    : progressColor(clamped);
  return (
    <Box sx={{ mb: 2, "&:last-of-type": { mb: 0 } }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {label}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {primary}
          {secondary ? ` · ${secondary}` : ""}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={clamped}
        color={color}
        sx={{ height: 8, borderRadius: 1 }}
      />
    </Box>
  );
}
