"use client";

import EmailIcon from "@mui/icons-material/Email";
import { Paper, Stack, Typography } from "@mui/material";

const EmailPage = () => (
  <Stack spacing={3}>
    <Stack direction="row" spacing={1.5} alignItems="center">
      <EmailIcon color="primary" />
      <Typography variant="h5">Email Management</Typography>
    </Stack>
    <Paper sx={{ p: 4, borderRadius: 3 }}>
      <Typography variant="body1" gutterBottom>
        Manage transactional email services, SMTP relays, and inbox routing from a single pane.
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Email management is on the roadmap. You&apos;ll be able to create mailboxes, aliases, and monitor deliverability soon.
      </Typography>
    </Paper>
  </Stack>
);

export default EmailPage;
