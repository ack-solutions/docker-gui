"use client";

import { Box, CircularProgress, Typography } from "@mui/material";

export interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
}

/**
 * Standard loading indicator. Use during the first fetch on a page; use a
 * smaller inline spinner (e.g. button `loading` state) for actions.
 *
 * Usage:
 *   <LoadingState />
 *   <LoadingState message="Refreshing…" />
 */
export function LoadingState({ message, fullScreen = false }: LoadingStateProps): JSX.Element {
  return (
    <Box
      sx={{
        textAlign: "center",
        py: fullScreen ? 0 : 6,
        ...(fullScreen
          ? { minHeight: "60vh", display: "flex", flexDirection: "column", justifyContent: "center" }
          : {})
      }}
    >
      <CircularProgress />
      {message && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          {message}
        </Typography>
      )}
    </Box>
  );
}
