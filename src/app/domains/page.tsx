"use client";

import DomainIcon from "@mui/icons-material/Language";
import { Stack, Typography } from "@mui/material";
import SimpleDomainManager from "@/features/domains/components/simple-domain-manager";

const DomainsPage = () => (
  <Stack spacing={3}>
    <Stack spacing={1}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <DomainIcon color="primary" fontSize="large" />
        <Typography variant="h4" fontWeight={600}>
          Domains
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Connect your domains and route traffic to your containers or external services
      </Typography>
    </Stack>
    <SimpleDomainManager />
  </Stack>
);

export default DomainsPage;

