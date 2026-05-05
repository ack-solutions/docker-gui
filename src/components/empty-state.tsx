"use client";

import { Box, Typography } from "@mui/material";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import type { ReactNode } from "react";

export interface EmptyStateProps {
  title?: string;
  message?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  dense?: boolean;
}

/**
 * Single empty-state look across all pages. Use whenever a list/table has
 * zero rows or a search yields no results.
 *
 * Usage:
 *   <EmptyState title="No containers" message="Create one with `docker run …`" />
 */
export function EmptyState({
  title = "Nothing here yet",
  message,
  icon,
  action,
  dense = false
}: EmptyStateProps): JSX.Element {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: dense ? 3 : 6,
        px: 2,
        color: "text.secondary"
      }}
    >
      <Box sx={{ fontSize: 40, lineHeight: 1, mb: 1, opacity: 0.5 }}>
        {icon ?? <InboxOutlinedIcon fontSize="inherit" />}
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 600, color: "text.primary", mb: 0.5 }}>
        {title}
      </Typography>
      {message && <Typography variant="body2">{message}</Typography>}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Box>
  );
}
