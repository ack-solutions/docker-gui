"use client";

import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import { Stack, Typography } from "@mui/material";
import SimpleNginxManager from "@/features/nginx/components/simple-nginx-manager";

const NginxPage = () => (
  <Stack spacing={3}>
    <Stack spacing={1}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <SettingsEthernetIcon color="primary" fontSize="large" />
        <Typography variant="h4" fontWeight={600}>
          Nginx Sites
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Configure reverse proxy, SSL certificates, and route domains to your services
      </Typography>
    </Stack>
    <SimpleNginxManager />
  </Stack>
);

export default NginxPage;

