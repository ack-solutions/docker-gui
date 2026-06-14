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
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import TerminalIcon from "@mui/icons-material/Terminal";
import BackupIcon from "@mui/icons-material/Backup";
import { FormControlLabel, Switch } from "@mui/material";
import { toast } from "sonner";
import { AuthGuard, ErrorState, LoadingState, PageShell } from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

interface QueryResult {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
  durationMs: number;
  command: string | null;
  affectedRows: number | null;
}

function QueryConsole({ conn, onClose }: { conn: DbConnection; onClose: () => void }) {
  const [sql, setSql] = useState("");
  const [readOnly, setReadOnly] = useState(true);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!sql.trim()) return;
    setRunning(true);
    setError(null);
    try {
      const res = await apiFetch<QueryResult>(`/api/v1/databases/connections/${conn.id}/query`, {
        method: "POST",
        body: JSON.stringify({ sql, readOnly })
      });
      setResult(res);
    } catch (err) {
      setResult(null);
      setError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setRunning(false);
    }
  }, [sql, readOnly, conn.id]);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <TerminalIcon fontSize="small" />
          <span>
            Query · {conn.name}{" "}
            <Typography component="span" variant="caption" color="text.secondary">
              ({conn.engine} · {conn.host}:{conn.port}
              {conn.database ? ` · ${conn.database}` : ""})
            </Typography>
          </span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <TextField
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          placeholder="SELECT * FROM ... ;   (⌘/Ctrl+Enter to run)"
          multiline
          minRows={5}
          maxRows={14}
          fullWidth
          slotProps={{ input: { sx: { fontFamily: "monospace", fontSize: 13 } } }}
        />
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 1.5 }}>
          <Button
            variant="contained"
            startIcon={<PlayArrowIcon />}
            onClick={run}
            disabled={running || !sql.trim()}
          >
            {running ? "Running…" : "Run"}
          </Button>
          <FormControlLabel
            control={<Switch checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} size="small" />}
            label="Read-only"
          />
          {!readOnly && (
            <Typography variant="caption" color="warning.main">
              Write mode — statements can modify data.
            </Typography>
          )}
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mt: 2, fontFamily: "monospace", fontSize: 12 }}>
            {error}
          </Alert>
        )}

        {result && !error && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              {result.command ?? "OK"} ·{" "}
              {result.columns.length > 0
                ? `${result.rowCount} row${result.rowCount === 1 ? "" : "s"}`
                : result.affectedRows !== null
                  ? `${result.affectedRows} affected`
                  : "no rows"}{" "}
              · {result.durationMs} ms
              {result.truncated ? " · truncated" : ""}
            </Typography>
            {result.columns.length > 0 && (
              <Box sx={{ mt: 1, maxHeight: 360, overflow: "auto", border: 1, borderColor: "divider", borderRadius: 1 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      {result.columns.map((c) => (
                        <TableCell key={c} sx={{ fontWeight: 700 }}>
                          {c}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {result.rows.map((row, i) => (
                      <TableRow key={i} hover>
                        {result.columns.map((c) => (
                          <TableCell key={c} sx={{ fontFamily: "monospace", fontSize: 12 }}>
                            {formatCell(row[c])}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

function formatCell(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

interface BackupJob {
  id: string;
  status: "pending" | "running" | "success" | "failed";
  trigger: string;
  bucket: string;
  objectKey: string;
  sizeBytes: number | null;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

interface S3Conn {
  id: string;
  name: string;
}

function fmtSize(n: number | null): string {
  if (n === null) return "—";
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${u[i]}`;
}

const STATUS_COLOR: Record<BackupJob["status"], "default" | "info" | "success" | "error"> = {
  pending: "default",
  running: "info",
  success: "success",
  failed: "error"
};

interface Schedule {
  enabled: boolean;
  cron: string | null;
  s3ConnectionId: string | null;
  bucket: string | null;
}

function BackupsDialog({ conn, onClose }: { conn: DbConnection; onClose: () => void }) {
  const [s3conns, setS3conns] = useState<S3Conn[]>([]);
  const [jobs, setJobs] = useState<BackupJob[] | null>(null);
  const [s3Id, setS3Id] = useState("");
  const [bucket, setBucket] = useState("");
  const [busy, setBusy] = useState(false);
  const [schedEnabled, setSchedEnabled] = useState(false);
  const [cron, setCron] = useState("0 3 * * *");

  const loadJobs = useCallback(async () => {
    try {
      const list = await apiFetch<BackupJob[]>(`/api/v1/databases/connections/${conn.id}/backups`);
      setJobs(list);
    } catch {
      setJobs([]);
    }
  }, [conn.id]);

  useEffect(() => {
    apiFetch<S3Conn[]>("/api/v1/storage/connections")
      .then((list) => {
        setS3conns(list);
        if (list[0]) setS3Id(list[0].id);
      })
      .catch(() => setS3conns([]));
    apiFetch<Schedule>(`/api/v1/databases/connections/${conn.id}/schedule`)
      .then((s) => {
        setSchedEnabled(s.enabled);
        if (s.cron) setCron(s.cron);
        if (s.s3ConnectionId) setS3Id(s.s3ConnectionId);
        if (s.bucket) setBucket(s.bucket);
      })
      .catch(() => undefined);
    loadJobs();
  }, [loadJobs, conn.id]);

  const saveSchedule = useCallback(
    async (enabled: boolean) => {
      setBusy(true);
      try {
        const payload = enabled
          ? { enabled: true, cron, s3ConnectionId: s3Id, bucket: bucket.trim() }
          : { enabled: false };
        const s = await apiFetch<Schedule>(`/api/v1/databases/connections/${conn.id}/schedule`, {
          method: "PUT",
          body: JSON.stringify(payload)
        });
        setSchedEnabled(s.enabled);
        toast.success(enabled ? "Schedule saved" : "Schedule disabled");
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [cron, s3Id, bucket, conn.id]
  );

  // Poll while any job is running.
  useEffect(() => {
    if (!jobs?.some((j) => j.status === "running" || j.status === "pending")) return;
    const t = setInterval(loadJobs, 1500);
    return () => clearInterval(t);
  }, [jobs, loadJobs]);

  const run = useCallback(async () => {
    if (!s3Id || !bucket.trim()) return;
    setBusy(true);
    try {
      await apiFetch(`/api/v1/databases/connections/${conn.id}/backups`, {
        method: "POST",
        body: JSON.stringify({ s3ConnectionId: s3Id, bucket: bucket.trim() })
      });
      toast.success("Backup started");
      await loadJobs();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [s3Id, bucket, conn.id, loadJobs]);

  const restore = useCallback(
    async (job: BackupJob) => {
      if (
        !confirm(
          `Restore this backup into "${conn.name}"?\n\nThis OVERWRITES data in the target database and cannot be undone.`
        )
      )
        return;
      setBusy(true);
      try {
        await apiFetch(`/api/v1/databases/backups/${job.id}/restore`, {
          method: "POST",
          body: JSON.stringify({})
        });
        toast.success("Restore complete");
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [conn.name]
  );

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <BackupIcon fontSize="small" />
          <span>Backups · {conn.name}</span>
        </Stack>
      </DialogTitle>
      <DialogContent>
        {s3conns.length === 0 ? (
          <Alert severity="warning">
            No storage connections. Add one under <a href="/storage">Storage</a> to back up to S3/MinIO.
          </Alert>
        ) : (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="flex-start">
            <TextField
              select
              label="Destination (S3)"
              value={s3Id}
              onChange={(e) => setS3Id(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
            >
              {s3conns.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Bucket"
              value={bucket}
              onChange={(e) => setBucket(e.target.value)}
              size="small"
              placeholder="db-backups"
            />
            <Button
              variant="contained"
              startIcon={<BackupIcon />}
              onClick={run}
              disabled={busy || !s3Id || !bucket.trim()}
              sx={{ mt: 0.5 }}
            >
              Back up now
            </Button>
          </Stack>
        )}

        {s3conns.length > 0 && (
          <Box sx={{ mt: 2, p: 1.5, border: 1, borderColor: "divider", borderRadius: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={schedEnabled}
                    onChange={(e) => saveSchedule(e.target.checked)}
                    size="small"
                    disabled={busy}
                  />
                }
                label="Scheduled backups"
              />
              <TextField
                label="Cron"
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                size="small"
                sx={{ width: 160 }}
                helperText="min hr dom mon dow"
              />
              <Button size="small" onClick={() => saveSchedule(true)} disabled={busy || !cron.trim() || !bucket.trim()}>
                Save schedule
              </Button>
              <Typography variant="caption" color="text.secondary">
                Uses the destination + bucket above. e.g. <code>0 3 * * *</code> = daily 3am.
              </Typography>
            </Stack>
          </Box>
        )}

        <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>
          History
        </Typography>
        {jobs === null ? (
          <Typography variant="caption">Loading…</Typography>
        ) : jobs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No backups yet.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>Object key</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id} hover>
                  <TableCell>{new Date(j.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Tooltip title={j.error ?? ""}>
                      <Chip size="small" label={j.status} color={STATUS_COLOR[j.status]} variant="outlined" />
                    </Tooltip>
                  </TableCell>
                  <TableCell>{fmtSize(j.sizeBytes)}</TableCell>
                  <TableCell>
                    <code style={{ fontSize: 11 }}>
                      {j.bucket}/{j.objectKey}
                    </code>
                  </TableCell>
                  <TableCell align="right">
                    {j.status === "success" && (
                      <Button
                        size="small"
                        color="warning"
                        onClick={() => restore(j)}
                        disabled={busy}
                      >
                        Restore
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

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
  const [queryConn, setQueryConn] = useState<DbConnection | null>(null);
  const [backupConn, setBackupConn] = useState<DbConnection | null>(null);

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
                  {canWrite && (
                    <Button size="small" startIcon={<TerminalIcon />} onClick={() => setQueryConn(c)}>
                      Query
                    </Button>
                  )}
                  {canWrite && (
                    <Button size="small" startIcon={<BackupIcon />} onClick={() => setBackupConn(c)}>
                      Backups
                    </Button>
                  )}
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
        Verification checks network reachability (host:port). Use <strong>Query</strong> to run SQL
        (read-only by default — create a read-only DB user for safe browsing) and{" "}
        <strong>Backups</strong> to dump a database to S3/MinIO, restore it, or schedule recurring
        backups. A browser-based DB explorer (pgweb/phpMyAdmin) is coming next.
      </Alert>

      {queryConn && <QueryConsole conn={queryConn} onClose={() => setQueryConn(null)} />}
      {backupConn && <BackupsDialog conn={backupConn} onClose={() => setBackupConn(null)} />}

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
