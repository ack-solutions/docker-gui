"use client";

import { useEffect, useMemo, useState } from "react";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import EditIcon from "@mui/icons-material/Edit";
import moment from "moment";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormGroup,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { toast } from "sonner";
import {
  useCreateUser,
  useDeleteUser,
  useUpdateUser,
  useUsers
} from "@/features/users/hooks/use-users";
import { rolePermissions } from "@/types/user";
import type { CreateUserInput, UpdateUserInput, User, UserPermission, UserRole } from "@/types/user";

const permissionGroups: Array<{
  label: string;
  items: Array<{ value: UserPermission; label: string; description?: string }>;
}> = [
  {
    label: "Dashboard",
    items: [{ value: "dashboard:view", label: "Dashboard overview" }]
  },
  {
    label: "Containers",
    items: [
      { value: "containers:view", label: "View containers" },
      { value: "containers:manage", label: "Manage containers" }
    ]
  },
  {
    label: "Images",
    items: [
      { value: "images:view", label: "View images" },
      { value: "images:manage", label: "Manage images" }
    ]
  },
  {
    label: "Volumes",
    items: [
      { value: "volumes:view", label: "View volumes" },
      { value: "volumes:manage", label: "Manage volumes" }
    ]
  },
  {
    label: "Networks",
    items: [
      { value: "networks:view", label: "View networks" },
      { value: "networks:manage", label: "Manage networks" }
    ]
  },
  {
    label: "Logs & Debugging",
    items: [
      { value: "logs:view", label: "View logs" },
      { value: "logs:manage", label: "Manage log sessions" }
    ]
  },
  {
    label: "File Browser",
    items: [
      { value: "files:view", label: "View files" },
      { value: "files:manage", label: "Manage files" }
    ]
  },
  {
    label: "Infrastructure",
    items: [
      { value: "domains:view", label: "View domains" },
      { value: "domains:manage", label: "Manage domains" },
      { value: "ssl:view", label: "View SSL certificates" },
      { value: "ssl:manage", label: "Manage SSL certificates" },
      { value: "nginx:view", label: "View Nginx configs" },
      { value: "nginx:manage", label: "Manage Nginx configs" },
      { value: "proxies:view", label: "View proxy routes" },
      { value: "proxies:manage", label: "Manage proxy routes" }
    ]
  },
  {
    label: "Email & Integrations",
    items: [
      { value: "email:view", label: "View email service" },
      { value: "email:manage", label: "Manage email service" }
    ]
  },
  {
    label: "Administration",
    items: [{ value: "users:manage", label: "Manage users & permissions" }]
  }
];

const permissionLabelMap = permissionGroups.reduce<Record<UserPermission, string>>((acc, group) => {
  group.items.forEach((item) => {
    acc[item.value] = item.label;
  });
  return acc;
}, {} as Record<UserPermission, string>);

const RoleChip = styled(Chip)(({ theme }) => ({
  textTransform: "capitalize"
}));

interface UserFormValues {
  email: string;
  name: string;
  password: string;
  role: UserRole;
  permissions: UserPermission[];
}

const createDefaultValues = (user?: User): UserFormValues => ({
  email: user?.email ?? "",
  name: user?.name ?? "",
  password: "",
  role: user?.role ?? "viewer",
  permissions: [...(user?.permissions ?? rolePermissions.viewer)]
});

interface UserFormDialogProps {
  open: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  onSubmit: (values: UserFormValues) => Promise<void>;
  user?: User | null;
}

const UserFormDialog = ({ open, mode, onClose, onSubmit, user }: UserFormDialogProps) => {
  const [values, setValues] = useState<UserFormValues>(() => createDefaultValues(user ?? undefined));
  const [submitting, setSubmitting] = useState(false);

  const title = mode === "create" ? "Invite user" : `Edit ${user?.name ?? user?.email ?? "user"}`;
  const isSuperAdmin = Boolean(user?.isSuperAdmin);

  const handleClose = () => {
    if (!submitting) {
      onClose();
    }
  };

  const handleRoleChange = (role: UserRole) => {
    setValues((prev) => ({
      ...prev,
      role,
      permissions: [...rolePermissions[role]]
    }));
  };

  const togglePermission = (permission: UserPermission) => {
    setValues((prev) => {
      const hasPermission = prev.permissions.includes(permission);
      return {
        ...prev,
        permissions: hasPermission
          ? prev.permissions.filter((item) => item !== permission)
          : [...prev.permissions, permission]
      };
    });
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(values);
      onClose();
    } catch {
      // Errors are surfaced via toast in the parent handler
    } finally {
      setSubmitting(false);
    }
  };

  const disableSubmit = submitting || (mode === "create" && !values.password.trim());

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack
          component="form"
          spacing={3}
          onSubmit={handleSubmit}
          id="user-management-form"
        >
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Email address"
              type="email"
              fullWidth
              value={values.email}
              onChange={(event) => setValues((prev) => ({ ...prev, email: event.target.value }))}
              required
              disabled={mode === "edit" && isSuperAdmin}
              autoComplete="email"
            />
            <TextField
              label="Display name"
              fullWidth
              value={values.name}
              onChange={(event) => setValues((prev) => ({ ...prev, name: event.target.value }))}
            />
          </Stack>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Password"
              type="password"
              fullWidth
              value={values.password}
              onChange={(event) => setValues((prev) => ({ ...prev, password: event.target.value }))}
              required={mode === "create"}
              helperText={mode === "edit" ? "Leave blank to keep the current password." : undefined}
            />
            <FormControl fullWidth>
              <InputLabel id="user-role">Role</InputLabel>
              <Select
                labelId="user-role"
                label="Role"
                value={values.role}
                onChange={(event) => handleRoleChange(event.target.value as UserRole)}
                disabled={mode === "edit" && isSuperAdmin}
              >
                <MenuItem value="admin">Administrator</MenuItem>
                <MenuItem value="operator">Operator</MenuItem>
                <MenuItem value="viewer">Viewer</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack spacing={1}>
            <Typography variant="subtitle2" color="text.secondary">
              Module access
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Fine tune the modules this user can access. Selecting a role applies sensible defaults which can be overridden below.
            </Typography>
            <Stack spacing={1.5}>
              {permissionGroups.map((group) => (
                <Box key={group.label} sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    {group.label}
                  </Typography>
                  <FormGroup row>
                    {group.items.map((item) => (
                      <FormControlLabel
                        key={item.value}
                        control={
                          <Switch
                            size="small"
                            checked={values.permissions.includes(item.value)}
                            onChange={() => togglePermission(item.value)}
                            disabled={mode === "edit" && isSuperAdmin}
                          />
                        }
                        label={item.label}
                        sx={{ mr: 3, mb: 1 }}
                      />
                    ))}
                  </FormGroup>
                </Box>
              ))}
            </Stack>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          form="user-management-form"
          variant="contained"
          disabled={disableSubmit}
        >
          {submitting ? "Saving..." : mode === "create" ? "Invite user" : "Save changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const UserManagement = () => {
  const { data: users, isLoading, isError, error } = useUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const openCreateDialog = () => {
    setMode("create");
    setSelectedUser(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (user: User) => {
    setMode("edit");
    setSelectedUser(user);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (values: UserFormValues) => {
    try {
      if (mode === "create") {
        const payload: CreateUserInput = {
          email: values.email,
          password: values.password,
          name: values.name || undefined,
          role: values.role,
          permissions: values.permissions
        };
        await createUser.mutateAsync(payload);
        toast.success(`Invited ${values.email}`);
      } else if (selectedUser) {
        const payload: UpdateUserInput = {
          email: values.email,
          name: values.name || undefined,
          role: values.role,
          permissions: values.permissions
        };
        if (values.password.trim()) {
          payload.password = values.password.trim();
        }
        await updateUser.mutateAsync({ id: selectedUser.id, payload });
        toast.success(`Updated ${values.email}`);
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        error?.message ??
        (mode === "create" ? "Unable to invite user." : "Unable to update user.");
      toast.error(message);
      throw error;
    }
  };

  const handleDelete = async (user: User) => {
    if (user.isSuperAdmin) {
      toast.error("The default super administrator cannot be removed.");
      return;
    }
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm(
      `Delete ${user.email}? This action cannot be undone.`
    );
    if (!confirmed) {
      return;
    }
    try {
      await deleteUser.mutateAsync(user.id);
      toast.success(`Removed ${user.email}`);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ??
        error?.message ??
        "Unable to delete user.";
      toast.error(message);
    }
  };

  const orderedUsers = useMemo(
    () => [...(users ?? [])].sort((a, b) => a.email.localeCompare(b.email)),
    [users]
  );

  if (isLoading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary">
            Loading users...
          </Typography>
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" variant="outlined">
        {error instanceof Error ? error.message : "Unable to load users."}
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <div>
          <Typography variant="h6">Team members</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage who can access the control center and what modules they can operate.
          </Typography>
        </div>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreateDialog}
        >
          Invite user
        </Button>
      </Stack>
      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Permissions</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orderedUsers.map((user) => {
                const isSuperAdmin = user.isSuperAdmin;
                return (
                  <TableRow hover key={user.id}>
                    <TableCell>
                      <Typography variant="body2">{user.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{user.name ?? "\u2014"}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        <RoleChip label={user.role} size="small" color={user.role === "admin" ? "primary" : "default"} />
                        {isSuperAdmin ? <Chip label="Super admin" size="small" color="secondary" /> : null}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {user.permissions.map((permission) => (
                          <Chip
                            key={permission}
                            label={permissionLabelMap[permission] ?? permission}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={moment(user.createdAt).format("MMM D, YYYY h:mm A")}>
                        <Typography variant="body2">
                          {moment(user.createdAt).fromNow()}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Tooltip title={isSuperAdmin ? "Super admin details" : "Edit user"}>
                          <span>
                            <Button
                              variant="text"
                              size="small"
                              startIcon={<EditIcon fontSize="small" />}
                              onClick={() => openEditDialog(user)}
                              disabled={createUser.isPending || updateUser.isPending}
                            >
                              Edit
                            </Button>
                          </span>
                        </Tooltip>
                        <Tooltip title={isSuperAdmin ? "Super admin cannot be removed" : "Remove user"}>
                          <span>
                            <Button
                              variant="text"
                              size="small"
                              color="error"
                              startIcon={<DeleteOutlineIcon fontSize="small" />}
                              onClick={() => handleDelete(user)}
                              disabled={isSuperAdmin || deleteUser.isPending}
                            >
                              Remove
                            </Button>
                          </span>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {orderedUsers.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                No users found. Invite your team to collaborate on infrastructure operations.
              </Typography>
            </Box>
          ) : null}
        </CardContent>
      </Card>
      <UserFormDialog
        open={isDialogOpen}
        mode={mode}
        user={selectedUser}
        onClose={() => setIsDialogOpen(false)}
        onSubmit={handleSubmit}
      />
    </Stack>
  );
};

export default UserManagement;
  useEffect(() => {
    if (open) {
      setValues(createDefaultValues(user ?? undefined));
    }
  }, [open, user]);
