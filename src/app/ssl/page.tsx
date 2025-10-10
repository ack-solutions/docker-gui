"use client";

import LockIcon from "@mui/icons-material/Lock";
import { Paper, Stack, Typography } from "@mui/material";

const SSLPage = () => {
  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <LockIcon color="primary" />
        <Typography variant="h5">SSL Certificates</Typography>
      </Stack>
      <Paper sx={{ p: 4, borderRadius: 3 }}>
        <Typography variant="body1" gutterBottom>
          SSL management is on the roadmap.
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Issue, renew, and deploy TLS certificates automatically, with support for popular providers.
        </Typography>
      </Paper>
    </Stack>
  );
};

export default SSLPage;

