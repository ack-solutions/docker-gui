"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
import OndemandVideoIcon from "@mui/icons-material/OndemandVideo";
import TerminalIcon from "@mui/icons-material/Terminal";
import { toast } from "sonner";
import {
  AuthGuard,
  type Column,
  DataTable,
  EmptyState,
  ErrorState,
  formatPorts,
  LoadingState,
  PageShell,
  SectionCard,
  StatusChip,
  type StatusKind
} from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

interface ContainerSummary {
  id: string;
  shortId: string;
  names: string[];
  image: string;
  state: StatusKind;
  status: string;
  createdAt: string;
  ports: Array<{ privatePort: number; publicPort?: number; type: string; ip?: string }>;
}

const REFRESH_MS = 5000;

function ContainersInner({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [rows, setRows] = useState<ContainerSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [logsView, setLogsView] = useState<{ id: string; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<ContainerSummary[]>("/api/v1/docker/containers?all=true");
      setRows(list);
      setLoadError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login?next=/containers");
        return;
      }
      setLoadError(err instanceof ApiError ? err.message : String(err));
    }
  }, [router]);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => clearInterval(interval);
  }, [load]);

  async function action(c: ContainerSummary, kind: "start" | "stop" | "restart" | "remove") {
    setBusyId(c.id);
    setActionError(null);
    try {
      if (kind === "remove") {
        const force = c.state === "running";
        await apiFetch(`/api/v1/docker/containers/${c.id}?force=${force}`, { method: "DELETE" });
        toast.success(`Removed ${c.names[0] ?? c.shortId}`);
      } else {
        await apiFetch(`/api/v1/docker/containers/${c.id}/${kind}`, { method: "POST" });
        toast.success(`${kind[0]?.toUpperCase()}${kind.slice(1)}ed ${c.names[0] ?? c.shortId}`);
      }
      await load();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : String(err);
      setActionError(msg);
      toast.error(msg);
    } finally {
      setBusyId(null);
    }
  }

  async function viewLogs(c: ContainerSummary) {
    setBusyId(c.id);
    setActionError(null);
    try {
      const data = await apiFetch<{ id: string; tail: number; text: string }>(
        `/api/v1/docker/containers/${c.id}/logs?tail=200`
      );
      setLogsView({ id: c.shortId, text: data.text || "(no log output)" });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  const counts = useMemo(() => {
    const c = { total: rows?.length ?? 0, running: 0, stopped: 0 };
    for (const x of rows ?? []) {
      if (x.state === "running") c.running += 1;
      else c.stopped += 1;
    }
    return c;
  }, [rows]);

  const columns: Column<ContainerSummary>[] = [
    {
      key: "state",
      header: "State",
      width: 120,
      render: (r) => <StatusChip status={r.state} />
    },
    {
      key: "name",
      header: "Name",
      render: (r) => (
        <Box>
          <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
            {r.names[0] ?? r.shortId}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {r.shortId}
          </Typography>
        </Box>
      )
    },
    {
      key: "image",
      header: "Image",
      render: (r) => (
        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
          {r.image}
        </Typography>
      )
    },
    {
      key: "status",
      header: "Status",
      render: (r) => <Typography variant="body2">{r.status}</Typography>
    },
    {
      key: "ports",
      header: "Ports",
      render: (r) => (
        <Typography variant="caption" sx={{ fontFamily: "monospace" }}>
          {formatPorts(r.ports)}
        </Typography>
      )
    }
  ];

  function rowActions(c: ContainerSummary) {
    const busy = busyId === c.id;
    const running = c.state === "running";
    return (
      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
        <Tooltip title="Logs (last 200 lines)">
          <span>
            <IconButton size="small" onClick={() => viewLogs(c)} disabled={busy}>
              <ArticleOutlinedIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Live logs (follow)">
          <span>
            <IconButton
              size="small"
              onClick={() => router.push(`/containers/${c.id}/logs`)}
              disabled={busy}
            >
              <OndemandVideoIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title={running ? "Open terminal (exec)" : "Container must be running"}>
          <span>
            <IconButton
              size="small"
              onClick={() => router.push(`/containers/${c.id}/terminal`)}
              disabled={busy || !running}
            >
              <TerminalIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        {!running && (
          <Tooltip title="Start">
            <span>
              <IconButton
                size="small"
                onClick={() => action(c, "start")}
                disabled={busy}
                color="success"
              >
                <PlayArrowIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        {running && (
          <Tooltip title="Stop">
            <span>
              <IconButton size="small" onClick={() => action(c, "stop")} disabled={busy}>
                <StopIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
        <Tooltip title="Restart">
          <span>
            <IconButton size="small" onClick={() => action(c, "restart")} disabled={busy}>
              <RestartAltIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Remove">
          <span>
            <IconButton
              size="small"
              onClick={() => action(c, "remove")}
              disabled={busy}
              color="error"
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    );
  }

  // First load: nothing yet, no error
  if (rows === null && !loadError) {
    return (
      <PageShell title="Containers" user={user}>
        <LoadingState />
      </PageShell>
    );
  }

  // First load failed
  if (rows === null && loadError) {
    return (
      <PageShell title="Containers" user={user}>
        <ErrorState
          title="Cannot list containers"
          message={loadError}
          onRetry={load}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Containers"
      subtitle={`${counts.total} total · ${counts.running} running · ${counts.stopped} stopped`}
      user={user}
      actions={
        <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">
          Refresh
        </Button>
      }
    >
      {loadError && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setLoadError(null)}>
          Latest refresh failed: {loadError}
        </Alert>
      )}
      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      <DataTable
        columns={columns}
        rows={rows ?? []}
        rowKey={(r) => r.id}
        rowActions={rowActions}
        empty={
          <EmptyState
            title="No containers"
            message={
              <>
                Create one with <code>docker run …</code> on this host.
              </>
            }
          />
        }
      />

      {logsView && (
        <Box sx={{ mt: 3 }}>
          <SectionCard
            title={`Logs · ${logsView.id} · last 200 lines`}
            action={
              <Button size="small" onClick={() => setLogsView(null)}>
                Close
              </Button>
            }
            dense
          >
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 1.5,
                bgcolor: "action.hover",
                borderRadius: 1,
                overflowX: "auto",
                fontSize: 12,
                maxHeight: 400
              }}
            >
              {logsView.text}
            </Box>
          </SectionCard>
        </Box>
      )}
    </PageShell>
  );
}

export default function ContainersDashboard() {
  return <AuthGuard>{(user) => <ContainersInner user={user} />}</AuthGuard>;
}
