"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress, Typography } from "@mui/material";

const ProxiesPage = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirect to nginx page as proxies are now managed there
    router.replace("/nginx");
  }, [router]);

  return (
    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400 }}>
      <CircularProgress />
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        Redirecting to Nginx configuration...
      </Typography>
    </Box>
  );
};

export default ProxiesPage;

