"use client";

import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import { Stack, Typography } from "@mui/material";
import UserManagement from "@/features/users/components/user-management";

const UsersPage = () => (
  <Stack spacing={3.5}>
    <Stack direction="row" spacing={1.5} alignItems="center">
      <ManageAccountsIcon color="primary" />
      <Typography variant="h5">User & Permission Management</Typography>
    </Stack>
    <Typography variant="body1" color="text.secondary">
      Control who can sign in to the portal and fine-tune module access per user or role. Administrators can invite operators and viewers with a single click.
    </Typography>
    <UserManagement />
  </Stack>
);

export default UsersPage;
