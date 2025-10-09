"use client";

import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import { Paper, Stack, Typography } from "@mui/material";

const ProxiesPage = () => (
  <Stack spacing={3}>
    <Stack direction="row" spacing={1.5} alignItems="center">
      <CompareArrowsIcon color="primary" />
      <Typography variant="h5">Proxy Manager</Typography>
    </Stack>
    <Paper sx={{ p: 4, borderRadius: 3 }}>
      <Typography variant="body1" gutterBottom>
        Route traffic to services, configure load-balancing rules, and monitor upstream health in one place.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Proxy management is coming soon. Stay tuned for automated LetsEncrypt and Canary deployment controls.
      </Typography>
    </Paper>
  </Stack>
);

export default ProxiesPage;
