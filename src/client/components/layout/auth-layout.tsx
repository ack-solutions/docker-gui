"use client";

import { ReactNode } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";

interface AuthLayoutProps {
  children: ReactNode;
  loading?: boolean;
}

const AuthLayout = ({ children, loading = false }: AuthLayoutProps) => {
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          backgroundColor: 'background.default',
        }}
      >
        <Typography 
          variant="h4" 
          fontWeight={700} 
          color="primary" 
          sx={{ mb: 3 }}
        >
          Docker GUI
        </Typography>
        <Stack spacing={2} alignItems="center">
          <CircularProgress size={48} thickness={4} />
          <Typography variant="body2" color="text.secondary">
            Loading...
          </Typography>
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

