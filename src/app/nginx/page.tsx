"use client";

import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import { Stack, Typography } from "@mui/material";
import NginxManager from "@/features/nginx/components/nginx-manager";

const NginxPage = () => (
  <Stack spacing={3.5}>
    <Stack direction="row" spacing={1.5} alignItems="center">
      <SettingsEthernetIcon color="primary" />
      <Typography variant="h5">Nginx Configuration</Typography>
    </Stack>
    <Typography variant="body1" color="text.secondary">
      Map domains to upstream services, manage TLS certificates, and generate production-ready server blocks without leaving the dashboard.
    </Typography>
    <NginxManager />
  </Stack>
);

export default NginxPage;

