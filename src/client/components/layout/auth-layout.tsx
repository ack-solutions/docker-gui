"use client";

import { ReactNode } from "react";
import { Box, Skeleton, Stack } from "@mui/material";

interface AuthLayoutProps {
  children: ReactNode;
  loading?: boolean;
}

const AuthLayout = ({ children, loading = false }: AuthLayoutProps) => {
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 3
        }}
      >
        <Stack spacing={2} sx={{ width: "100%", maxWidth: 400 }}>
          <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          <Skeleton variant="text" height={40} />
          <Skeleton variant="text" height={40} />
          <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
        </Stack>
      </Box>
    );
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 3
      }}
    >
      {children}
    </Box>
  );
};

export default AuthLayout;

