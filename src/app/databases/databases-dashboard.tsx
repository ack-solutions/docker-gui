"use client";

import { useCallback, useEffect, useState } from "react";
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
  Divider,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import LinkIcon from "@mui/icons-material/AddLink";
import { toast } from "sonner";
import { AuthGuard, ErrorState, LoadingState, PageShell } from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

type Engine = "postgres" | "mysql" | "mariadb";

interface Discovered {
  containerId: string;
  containerName: string;
  image: string;
  engine: Engine;
  suggestedHost: string;
  suggestedPort: number;
  state: string;
  alreadyConnected: boolean;
}

interface DbConnection {
  id: string;
  name: string;
  engine: Engine;
  host: string;
  port: number;
  username: string;
  database: string | null;
  ssl: boolean;
  hasPassword: boolean;
  containerId: string | null;
  verified: boolean;
  lastError: string | null;
}

interface FormState {
  name: string;
  engine: Engine;
  host: string;
  port: string;
  username: string;
  password: string;
  database: string;
  containerId?: string;
}

const EMPTY_FORM: FormState = {
  name: "",
  engine: "postgres",
  host: "",
  port: "",
  username: "",
  password: "",
  database: ""
};

function DatabasesInner({ user }: { user: PublicUser }) {
  const canWrite = user.role === "owner" || user.role === "admin" || user.role === "operator";
  const [discovered, setDiscovered] = useState<Discovered[] | null>(null);
  const [conns, setConns] = useState<DbConnection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([
        apiFetch<Discovered[]>("/api/v1/databases/discover").catch(() => []),
        apiFetch<DbConnection[]>("/api/v1/databases/connections")
      ]);
      setDiscovered(d);
      setConns(c);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = useCallback((prefill?: Partial<FormState>) => {
    setForm({ ...EMPTY_FORM, ...prefill });
    setCreateOpen(true);
  }, []);

  const saveFromDiscovery = useCallback(
    (d: Discovered) => {
      openCreate({
        name: d.containerName,
        engine: d.engine,
        host: d.suggestedHost,
        port: String(d.suggestedPort),
        username: d.engine === "postgres" ? "postgres" : "root",
        containerId: d.containerId
      });
    },
    [openCreate]
  );

  const createConn = useCallback(async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        engine: form.engine,
        host: form.host,
        username: form.username
      };
      if (form.port) payload["port"] = Number(form.port);
      if (form.password) payload["password"] = form.password;
      if (form.database) payload["database"] = form.database;
      if (form.containerId) payload["containerId"] = form.containerId;
      await apiFetch("/api/v1/databases/connections", { method: "POST", body: JSON.stringify(payload) });
      toast.success(`Saved ${form.name}`);
      setCreateOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [form, load]);

  const verify = useCallback(
    async (c: DbConnection) => {
      try {
        await apiFetch(`/api/v1/databases/connections/${c.id}/verify`, { method: "POST" });
        await load();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : String(err));
      }
    },
    [load]
  );

  const remove = useCallback(
    async (c: DbConnection) => {
      if (!confirm(`Remove connection "${c.name}"? (The database itself is untouched.)`)) return;
      try {
        await apiFetch(`/api/v1/databases/connections/${c.id}`, { method: "DELETE" });
        toast.success("Connection removed");
        await load();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : String(err));
      }
    },
    [load]
  );

  if (conns === null && !loadError) {
    return (
      <PageShell title="Databases" user={user}>
        <LoadingState />
      </PageShell>
    );
  }
  if (conns === null && loadError) {
    return (
      <PageShell title="Databases" user={user}>
        <ErrorState title="Cannot load databases" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  const newlyDiscovered = (discovered ?? []).filter((d) => !d.alreadyConnected);

  return (
    <PageShell
      title="Databases"
      subtitle="Discover database containers and save connection profiles. Query console and backups are coming next."
      user={user}
      actions={
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} variant="outlined" size="small" onClick={load}>
            Refresh
          </Button>
          {canWrite && (
            <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => openCreate()}>
              Add connection
            </Button>
          )}
        </Stack>
      }
    >
      {newlyDiscovered.length > 0 && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>
              Discovered on this server
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Container</TableCell>
                  <TableCell>Engine</TableCell>
                  <TableCell>Reachable at</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {newlyDiscovered.map((d) => (
                  <TableRow key={d.containerId} hover>
                    <TableCell>
                      {d.containerName}
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {d.image}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={d.engine} />
                    </TableCell>
                    <TableCell>
                      <code>
                        {d.suggestedHost}:{d.suggestedPort}
                      </code>
                    </TableCell>
                    <TableCell align="right">
                      {canWrite && (
                        <Button size="small" startIcon={<LinkIcon />} onClick={() => saveFromDiscovery(d)}>
                          Save connection
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Connections
      </Typography>
      {(conns ?? []).length === 0 ? (
        <Alert severity="info">
          No saved connections yet. Save a discovered database above, or add one manually.
        </Alert>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Engine</TableCell>
              <TableCell>Host</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(conns ?? []).map((c) => (
              <TableRow key={c.id} hover>
                <TableCell>{c.name}</TableCell>
                <TableCell>
                  <Chip size="small" label={c.engine} />
                </TableCell>
                <TableCell>
                  <code>
                    {c.host}:{c.port}
                  </code>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {c.username}
                    {c.database ? ` · ${c.database}` : ""}
                  </Typography>
                </TableCell>
                <TableCell>
                  {c.verified ? (
                    <Chip size="small" icon={<CheckCircleIcon />} label="reachable" color="success" variant="outlined" />
                  ) : (
                    <Tooltip title={c.lastError ?? "Not verified"}>
                      <Chip size="small" icon={<ErrorIcon />} label="unverified" color="warning" variant="outlined" />
                    </Tooltip>
                  )}
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => verify(c)}>
                    Verify
                  </Button>
                  {canWrite && (
                    <Tooltip title="Remove connection">
                      <IconButton size="small" color="error" onClick={() => remove(c)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Alert severity="info" sx={{ mt: 3 }}>
        Verification currently checks network reachability (host:port). Credential validation, a
        SQL query console, and one-click backups to S3 are coming in the next update.
      </Alert>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add database connection</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              size="small"
              fullWidth
            />
            <TextField
              select
              label="Engine"
              value={form.engine}
              onChange={(e) => setForm((f) => ({ ...f, engine: e.target.value as Engine }))}
              size="small"
              fullWidth
            >
              <MenuItem value="postgres">PostgreSQL</MenuItem>
              <MenuItem value="mysql">MySQL</MenuItem>
              <MenuItem value="mariadb">MariaDB</MenuItem>
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                label="Host"
                value={form.host}
                onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                helperText="Container name or hostname"
                size="small"
                fullWidth
              />
              <TextField
                label="Port"
                value={form.port}
                onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
                placeholder={form.engine === "postgres" ? "5432" : "3306"}
                size="small"
                sx={{ width: 120 }}
              />
            </Stack>
            <TextField
              label="Username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              size="small"
              fullWidth
            />
            <TextField
              label="Password"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              size="small"
              fullWidth
            />
            <TextField
              label="Database (optional)"
              value={form.database}
              onChange={(e) => setForm((f) => ({ ...f, database: e.target.value }))}
              size="small"
              fullWidth
            />
            <Divider />
            <Typography variant="caption" color="text.secondary">
              Tip: create a read-only DB user for safe browsing. The password is stored encrypted.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy || !form.name || !form.host || !form.username} onClick={createConn}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}

export default function DatabasesDashboard() {
  return <AuthGuard>{(user) => <DatabasesInner user={user} />}</AuthGuard>;
}
