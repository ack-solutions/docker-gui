"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import KeyIcon from "@mui/icons-material/Key";
import LockResetIcon from "@mui/icons-material/LockReset";
import { toast } from "sonner";
import { AuthGuard, ErrorState, LoadingState, PageShell } from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

type Role = "owner" | "admin" | "operator" | "viewer";

interface ManagedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
  createdAt?: string;
}

const ROLE_COLOR: Record<Role, "default" | "error" | "warning" | "info" | "success"> = {
  owner: "error",
  admin: "warning",
  operator: "info",
  viewer: "default"
};

const ROLE_HELP: Record<Role, string> = {
  owner: "Full control, including managing other owners.",
  admin: "Manage everything except owner accounts.",
  operator: "Create and change resources; no user/feature admin.",
  viewer: "Read-only access."
};

function assignableRoles(actorRole: Role): Role[] {
  // Only an owner can grant the owner role.
  return actorRole === "owner"
    ? ["owner", "admin", "operator", "viewer"]
    : ["admin", "operator", "viewer"];
}

function UsersInner({ user }: { user: PublicUser }) {
  const actorRole = user.role as Role;
  const [users, setUsers] = useState<ManagedUser[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "operator" as Role });

  // Password reset dialog state
  const [pwTarget, setPwTarget] = useState<ManagedUser | null>(null);
  const [pwValue, setPwValue] = useState("");

  // Self change-password dialog
  const [selfPwOpen, setSelfPwOpen] = useState(false);
  const [selfPw, setSelfPw] = useState({ current: "", next: "" });

  const load = useCallback(async () => {
    setForbidden(false);
    try {
      const list = await apiFetch<ManagedUser[]>("/api/v1/users");
      setUsers(list);
      setLoadError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setUsers([]);
        return;
      }
      setLoadError(err instanceof ApiError ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createUser = useCallback(async () => {
    setBusy(true);
    try {
      await apiFetch("/api/v1/users", {
        method: "POST",
        body: JSON.stringify(form)
      });
      toast.success(`Created ${form.email}`);
      setCreateOpen(false);
      setForm({ email: "", name: "", password: "", role: "operator" });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [form, load]);

  const changeRole = useCallback(
    async (u: ManagedUser, role: Role) => {
      if (role === u.role) return;
      setBusy(true);
      try {
        await apiFetch(`/api/v1/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ role }) });
        toast.success(`${u.email} is now ${role}`);
        await load();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : String(err));
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const toggleActive = useCallback(
    async (u: ManagedUser) => {
      setBusy(true);
      try {
        await apiFetch(`/api/v1/users/${u.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: !u.isActive })
        });
        toast.success(`${u.email} ${u.isActive ? "deactivated" : "activated"}`);
        await load();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : String(err));
        await load();
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const removeUser = useCallback(
    async (u: ManagedUser) => {
      if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return;
      setBusy(true);
      try {
        await apiFetch(`/api/v1/users/${u.id}`, { method: "DELETE" });
        toast.success(`Deleted ${u.email}`);
        await load();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  const resetPassword = useCallback(async () => {
    if (!pwTarget) return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/users/${pwTarget.id}/password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: pwValue })
      });
      toast.success(`Password reset for ${pwTarget.email}`);
      setPwTarget(null);
      setPwValue("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [pwTarget, pwValue]);

  const changeOwnPassword = useCallback(async () => {
    setBusy(true);
    try {
      await apiFetch("/api/v1/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: selfPw.current, newPassword: selfPw.next })
      });
      toast.success("Password changed");
      setSelfPwOpen(false);
      setSelfPw({ current: "", next: "" });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [selfPw]);

  if (users === null && !loadError) {
    return (
      <PageShell title="Users" user={user}>
        <LoadingState />
      </PageShell>
    );
  }
  if (users === null && loadError) {
    return (
      <PageShell title="Users" user={user}>
        <ErrorState title="Cannot load users" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  const canManage = (u: ManagedUser): boolean => {
    // Mirror the server rules so the UI doesn't offer actions that will 403.
    if (u.role === "owner" && actorRole !== "owner") return false;
    return true;
  };

  return (
    <PageShell
      title="Users"
      subtitle="Manage who can sign in and what they can do. Roles are enforced on every request."
      user={user}
      actions={
        <Stack direction="row" spacing={1}>
          <Button startIcon={<LockResetIcon />} variant="outlined" size="small" onClick={() => setSelfPwOpen(true)}>
            My password
          </Button>
          <Button startIcon={<RefreshIcon />} variant="outlined" size="small" onClick={load}>
            Refresh
          </Button>
          <Button startIcon={<PersonAddIcon />} variant="contained" size="small" onClick={() => setCreateOpen(true)}>
            Add user
          </Button>
        </Stack>
      }
    >
      {forbidden ? (
        <Alert severity="warning">User management is restricted to owners and admins.</Alert>
      ) : (
        <>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {(Object.keys(ROLE_HELP) as Role[]).map((r) => (
              <Stack key={r} direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={r} color={ROLE_COLOR[r]} sx={{ minWidth: 78 }} />
                <Typography variant="caption" color="text.secondary">
                  {ROLE_HELP[r]}
                </Typography>
              </Stack>
            ))}
          </Stack>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Active</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(users ?? []).map((u) => {
                  const manageable = canManage(u);
                  const isSelf = u.id === user.id;
                  return (
                    <TableRow key={u.id} hover>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {u.name} {isSelf && <Chip size="small" label="you" sx={{ ml: 0.5 }} />}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {u.email}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          value={u.role}
                          disabled={!manageable || busy}
                          onChange={(e) => changeRole(u, e.target.value as Role)}
                          sx={{ minWidth: 120 }}
                        >
                          {/* Always include the user's current role so it renders,
                              even if it's above what the actor can assign. */}
                          {Array.from(new Set([u.role, ...assignableRoles(actorRole)])).map((r) => (
                            <MenuItem key={r} value={r} disabled={!assignableRoles(actorRole).includes(r as Role)}>
                              {r}
                            </MenuItem>
                          ))}
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={u.isActive}
                          disabled={!manageable || busy || isSelf}
                          onChange={() => toggleActive(u)}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Reset password">
                          <span>
                            <IconButton
                              size="small"
                              disabled={!manageable || busy}
                              onClick={() => {
                                setPwTarget(u);
                                setPwValue("");
                              }}
                            >
                              <KeyIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={isSelf ? "You cannot delete yourself" : "Delete user"}>
                          <span>
                            <IconButton
                              size="small"
                              color="error"
                              disabled={!manageable || busy || isSelf}
                              onClick={() => removeUser(u)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Create user dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Add user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="Temporary password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              helperText="At least 8 characters. The user can change it after signing in."
              fullWidth
              size="small"
            />
            <TextField
              select
              label="Role"
              value={form.role}
              onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
              fullWidth
              size="small"
            >
              {assignableRoles(actorRole).map((r) => (
                <MenuItem key={r} value={r}>
                  {r} — {ROLE_HELP[r]}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy || !form.email || !form.name || form.password.length < 8}
            onClick={createUser}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset password dialog */}
      <Dialog open={pwTarget !== null} onClose={() => setPwTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Reset password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Set a new password for <strong>{pwTarget?.email}</strong>. Their existing sessions will be signed out.
          </Typography>
          <TextField
            label="New password"
            type="password"
            value={pwValue}
            onChange={(e) => setPwValue(e.target.value)}
            fullWidth
            size="small"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPwTarget(null)}>Cancel</Button>
          <Button variant="contained" disabled={busy || pwValue.length < 8} onClick={resetPassword}>
            Reset
          </Button>
        </DialogActions>
      </Dialog>

      {/* Self change-password dialog */}
      <Dialog open={selfPwOpen} onClose={() => setSelfPwOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Change my password</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Current password"
              type="password"
              value={selfPw.current}
              onChange={(e) => setSelfPw((s) => ({ ...s, current: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              label="New password"
              type="password"
              value={selfPw.next}
              onChange={(e) => setSelfPw((s) => ({ ...s, next: e.target.value }))}
              helperText="At least 8 characters. Other sessions will be signed out."
              fullWidth
              size="small"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelfPwOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={busy || !selfPw.current || selfPw.next.length < 8}
            onClick={changeOwnPassword}
          >
            Change
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}

export default function UsersDashboard() {
  return <AuthGuard>{(user) => <UsersInner user={user} />}</AuthGuard>;
}
