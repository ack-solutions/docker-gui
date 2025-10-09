"use client";

import DomainIcon from "@mui/icons-material/Language";
import { Stack, Typography } from "@mui/material";
import DomainManager from "@/features/domains/components/domain-manager";

const DomainsPage = () => (
  <Stack spacing={3.5}>
    <Stack direction="row" spacing={1.5} alignItems="center">
      <DomainIcon color="primary" />
      <Typography variant="h5">Domain Management</Typography>
    </Stack>
    <Typography variant="body1" color="text.secondary">
      Manage DNS records, attach TLS certificates, and associate domains with upstream services and reverse-proxy entries.
    </Typography>
    <DomainManager />
  </Stack>
);

export default DomainsPage;
