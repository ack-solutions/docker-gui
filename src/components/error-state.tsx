"use client";

import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { ReactNode } from "react";

export interface ErrorStateProps {
  title?: string;
  message?: ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  detail?: ReactNode;
}

/**
 * Full-card error state for when a page can't show its primary content.
 * For inline errors (e.g. action failed but data is still visible), use
 * MUI `Alert` with `severity="error"` instead.
 *
 * Usage:
 *   <ErrorState title="Cannot reach the API" message={err.message} onRetry={load} />
 */
export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  retryLabel = "Try again",
  detail
}: ErrorStateProps): JSX.Element {
  return (
    <Card sx={{ maxWidth: 560, mx: "auto" }}>
      <CardContent sx={{ p: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
          <ErrorOutlineIcon color="error" />
          <Typography variant="h6">{title}</Typography>
        </Stack>
        {message && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: detail ? 1 : 2 }}>
            {message}
          </Typography>
        )}
        {detail && (
          <Box
            component="pre"
            sx={{
              m: 0,
              mb: 2,
              p: 1.5,
              bgcolor: "action.hover",
              borderRadius: 1,
              overflowX: "auto",
              fontSize: 12
            }}
          >
            {detail}
          </Box>
        )}
        {onRetry && (
          <Button startIcon={<RefreshIcon />} onClick={onRetry} variant="outlined" size="small">
            {retryLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
