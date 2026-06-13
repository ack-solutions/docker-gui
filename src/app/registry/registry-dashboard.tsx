"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
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
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { toast } from "sonner";
import { AuthGuard, ErrorState, LoadingState, PageShell } from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

interface RegistryConnection {
  id: string;
  name: string;
  endpoint: string;
  managed: boolean;
  username: string | null;
  hasPassword: boolean;
  pushHost: string | null;
  verified: boolean;
  lastVerifiedAt: string | null;
  lastError: string | null;
}

interface Repository {
  name: string;
  tagCount: number;
}
interface Tag {
  tag: string;
  digest: string;
  size: number;
  mediaType: string;
}

function fmtBytes(n: number): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  const u = ["KB", "MB", "GB", "TB"];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(1)} ${u[i]}`;
}

/** Host[:port] used in `docker push` lines. */
function hostFor(c: RegistryConnection): string {
  if (c.pushHost) return c.pushHost;
  try {
    return new URL(c.endpoint).host;
  } catch {
    return c.endpoint;
  }
}

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Could not copy")
  );
}

function PushInstructions({ conn }: { conn: RegistryConnection }) {
  const host = hostFor(conn);
  const login = conn.username
    ? `docker login ${host} -u ${conn.username} -p <password>`
    : `# no auth configured — front this registry with the reverse proxy for external push`;
  const example = [
    login,
    `docker tag my-image:latest ${host}/my-image:latest`,
    `docker push ${host}/my-image:latest`
  ].join("\n");
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="subtitle2">Push instructions</Typography>
        <Tooltip title="Copy">
          <IconButton size="small" onClick={() => copy(example)}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box
        component="pre"
        sx={{ m: 0, mt: 0.5, p: 1.5, bgcolor: "action.hover", borderRadius: 1, fontSize: 12, overflowX: "auto" }}
      >
        {example}
      </Box>
      <Typography variant="caption" color="text.secondary">
        In GitHub Actions, store the password as a secret and run the same{" "}
        <code>docker login</code> / <code>docker push</code> steps.
      </Typography>
    </Box>
  );
}

function ConnectionCard({
  conn,
  canWrite,
  onChanged
}: {
  conn: RegistryConnection;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [repos, setRepos] = useState<Repository[] | null>(null);
  const [openRepo, setOpenRepo] = useState<string | null>(null);
  const [tags, setTags] = useState<Tag[] | null>(null);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const browse = useCallback(async () => {
    setBusy(true);
    setBrowseError(null);
    try {
      const list = await apiFetch<Repository[]>(`/api/v1/registry/${conn.id}/repositories`);
      setRepos(list);
    } catch (err) {
      setBrowseError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [conn.id]);

  const loadTags = useCallback(
    async (repo: string) => {
      setOpenRepo(repo);
      setTags(null);
      try {
        const list = await apiFetch<Tag[]>(`/api/v1/registry/${conn.id}/tags?repo=${encodeURIComponent(repo)}`);
        setTags(list);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : String(err));
      }
    },
    [conn.id]
  );

  const deleteTag = useCallback(
    async (repo: string, tag: string) => {
      if (!confirm(`Delete ${repo}:${tag}? This removes the image manifest.`)) return;
      try {
        await apiFetch(
          `/api/v1/registry/${conn.id}/tags?repo=${encodeURIComponent(repo)}&tag=${encodeURIComponent(tag)}`,
          { method: "DELETE" }
        );
        toast.success(`Deleted ${repo}:${tag}`);
        await loadTags(repo);
        await browse();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : String(err));
      }
    },
    [conn.id, loadTags, browse]
  );

  const verify = useCallback(async () => {
    setBusy(true);
    try {
      await apiFetch(`/api/v1/registry/connections/${conn.id}/verify`, { method: "POST" });
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [conn.id, onChanged]);

  const remove = useCallback(async () => {
    if (!confirm(`Remove connection "${conn.name}"? (The registry data is not deleted.)`)) return;
    try {
      await apiFetch(`/api/v1/registry/connections/${conn.id}`, { method: "DELETE" });
      toast.success("Connection removed");
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    }
  }, [conn.id, conn.name, onChanged]);

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <Typography variant="h6">{conn.name}</Typography>
          {conn.managed && <Chip size="small" label="managed" color="primary" variant="outlined" />}
          {conn.verified ? (
            <Chip size="small" icon={<CheckCircleIcon />} label="verified" color="success" variant="outlined" />
          ) : (
            <Chip size="small" icon={<ErrorIcon />} label="unverified" color="warning" variant="outlined" />
          )}
          <Box sx={{ flex: 1 }} />
          <Button size="small" onClick={verify} disabled={busy}>
            Verify
          </Button>
          {canWrite && (
            <Tooltip title="Remove connection">
              <IconButton size="small" color="error" onClick={remove}>
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Stack>
        <Typography variant="caption" color="text.secondary">
          {conn.endpoint}
          {conn.username ? ` · user ${conn.username}` : " · no auth"}
        </Typography>
        {conn.lastError && (
          <Alert severity="warning" sx={{ mt: 1 }}>
            {conn.lastError}
          </Alert>
        )}

        <Box sx={{ my: 2 }}>
          <PushInstructions conn={conn} />
        </Box>

        <Divider sx={{ my: 1.5 }} />

        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="subtitle2">Repositories</Typography>
          <Button size="small" startIcon={<RefreshIcon />} onClick={browse} disabled={busy}>
            {repos === null ? "Browse" : "Reload"}
          </Button>
        </Stack>

        {browseError && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {browseError}
          </Alert>
        )}

        {repos !== null && repos.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            No images pushed yet.
          </Typography>
        )}

        {repos && repos.length > 0 && (
          <Table size="small" sx={{ mt: 1 }}>
            <TableHead>
              <TableRow>
                <TableCell>Repository</TableCell>
                <TableCell align="right">Tags</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {repos.map((r) => (
                <Fragment key={r.name}>
                  <TableRow hover>
                    <TableCell>{r.name}</TableCell>
                    <TableCell align="right">{r.tagCount}</TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => loadTags(r.name)}>
                        {openRepo === r.name ? "Hide tags" : "View tags"}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {openRepo === r.name && (
                    <TableRow>
                      <TableCell colSpan={3} sx={{ bgcolor: "action.hover" }}>
                        {tags === null ? (
                          <Typography variant="caption">Loading tags…</Typography>
                        ) : tags.length === 0 ? (
                          <Typography variant="caption">No tags.</Typography>
                        ) : (
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Tag</TableCell>
                                <TableCell>Digest</TableCell>
                                <TableCell align="right">Size</TableCell>
                                <TableCell />
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {tags.map((t) => (
                                <TableRow key={t.tag}>
                                  <TableCell>{t.tag}</TableCell>
                                  <TableCell>
                                    <code style={{ fontSize: 11 }}>{t.digest.slice(0, 19)}…</code>
                                  </TableCell>
                                  <TableCell align="right">{fmtBytes(t.size)}</TableCell>
                                  <TableCell align="right">
                                    {canWrite && (
                                      <Tooltip title="Delete tag">
                                        <IconButton size="small" color="error" onClick={() => deleteTag(r.name, t.tag)}>
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
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function RegistryInner({ user }: { user: PublicUser }) {
  const canWrite = user.role === "owner" || user.role === "admin" || user.role === "operator";
  const [conns, setConns] = useState<RegistryConnection[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", endpoint: "", username: "", password: "", pushHost: "" });

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<RegistryConnection[]>("/api/v1/registry/connections");
      setConns(list);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createConn = useCallback(async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { name: form.name, endpoint: form.endpoint };
      if (form.username) payload["username"] = form.username;
      if (form.password) payload["password"] = form.password;
      if (form.pushHost) payload["pushHost"] = form.pushHost;
      await apiFetch("/api/v1/registry/connections", { method: "POST", body: JSON.stringify(payload) });
      toast.success(`Added ${form.name}`);
      setCreateOpen(false);
      setForm({ name: "", endpoint: "", username: "", password: "", pushHost: "" });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [form, load]);

  if (conns === null && !loadError) {
    return (
      <PageShell title="Registry" user={user}>
        <LoadingState />
      </PageShell>
    );
  }
  if (conns === null && loadError) {
    return (
      <PageShell title="Registry" user={user}>
        <ErrorState title="Cannot load registry" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  const list = conns ?? [];

  return (
    <PageShell
      title="Registry"
      subtitle="Private Docker image registries. Browse and prune images, and copy push instructions for CI."
      user={user}
      actions={
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} variant="outlined" size="small" onClick={load}>
            Refresh
          </Button>
          {canWrite && (
            <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setCreateOpen(true)}>
              Add connection
            </Button>
          )}
        </Stack>
      }
    >
      {list.length === 0 && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No registry connections yet. Enable the <strong>Image registry</strong> feature from{" "}
          <a href="/features">Features</a> to run one on this server, then add a connection pointing at{" "}
          <code>http://docker-gui-registry:5000</code>. Or connect an external registry.
        </Alert>
      )}

      <Stack spacing={2}>
        {list.map((c) => (
          <ConnectionCard key={c.id} conn={c} canWrite={canWrite} onChanged={load} />
        ))}
      </Stack>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add registry connection</DialogTitle>
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
              label="Endpoint"
              placeholder="http://docker-gui-registry:5000"
              value={form.endpoint}
              onChange={(e) => setForm((f) => ({ ...f, endpoint: e.target.value }))}
              helperText="The registry v2 API base URL. For the managed registry use http://docker-gui-registry:5000."
              size="small"
              fullWidth
            />
            <TextField
              label="Push host (optional)"
              placeholder="registry.example.com"
              value={form.pushHost}
              onChange={(e) => setForm((f) => ({ ...f, pushHost: e.target.value }))}
              helperText="Host shown in docker push instructions for external clients (e.g. your Caddy domain)."
              size="small"
              fullWidth
            />
            <Divider>optional auth</Divider>
            <TextField
              label="Username"
              value={form.username}
              onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
              size="small"
              fullWidth
            />
            <TextField
              label="Password / token"
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              size="small"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy || !form.name || !form.endpoint} onClick={createConn}>
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </PageShell>
  );
}

export default function RegistryDashboard() {
  return <AuthGuard>{(user) => <RegistryInner user={user} />}</AuthGuard>;
}
