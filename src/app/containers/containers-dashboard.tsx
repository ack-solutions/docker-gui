"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ArticleOutlinedIcon from "@mui/icons-material/ArticleOutlined";
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
  LogStreamPanel,
  PageShell,
  SplitPanel,
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
  labels?: Record<string, string>;
}

type GroupMode = "none" | "project" | "image" | "state";

const REFRESH_MS = 5000;
const GROUP_BY_KEY = "dgui.v2.containers.groupBy";
const COMPOSE_PROJECT_LABEL = "com.docker.compose.project";

const GROUP_OPTIONS: Array<{ value: GroupMode; label: string }> = [
  { value: "none", label: "None" },
  { value: "project", label: "Compose project" },
  { value: "image", label: "Image" },
  { value: "state", label: "State" }
];

function ContainersInner({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [rows, setRows] = useState<ContainerSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<GroupMode>("none");
  // Docked log drawer target (independent of the 5s poll, so it never flickers).
  const [logTarget, setLogTarget] = useState<{ id: string; name: string } | null>(null);
  const [logsCollapsed, setLogsCollapsed] = useState(false);

  // Restore persisted group-by after mount (avoids SSR/client mismatch).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(GROUP_BY_KEY) as GroupMode | null;
    if (saved && GROUP_OPTIONS.some((o) => o.value === saved)) setGroupBy(saved);
  }, []);

  const changeGroupBy = useCallback((mode: GroupMode) => {
    setGroupBy(mode);
    if (typeof window !== "undefined") window.localStorage.setItem(GROUP_BY_KEY, mode);
  }, []);

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
        // If we were tailing this container, close the drawer.
        if (logTarget?.id === c.id) setLogTarget(null);
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

  function openLogs(c: ContainerSummary) {
    setLogTarget({ id: c.id, name: c.names[0] ?? c.shortId });
    setLogsCollapsed(false);
  }

  const counts = useMemo(() => {
    const c = { total: rows?.length ?? 0, running: 0, stopped: 0 };
    for (const x of rows ?? []) {
      if (x.state === "running") c.running += 1;
      else c.stopped += 1;
    }
    return c;
  }, [rows]);

  const groupResolver = useMemo<((r: ContainerSummary) => string) | undefined>(() => {
    switch (groupBy) {
      case "project":
        return (r) => r.labels?.[COMPOSE_PROJECT_LABEL] ?? "(standalone)";
      case "image":
        return (r) => r.image;
      case "state":
        return (r) => r.state;
      default:
        return undefined;
    }
  }, [groupBy]);

  const columns: Column<ContainerSummary>[] = [
    { key: "state", header: "State", width: 120, render: (r) => <StatusChip status={r.state} /> },
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
    { key: "status", header: "Status", render: (r) => <Typography variant="body2">{r.status}</Typography> },
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
        <Tooltip title="Logs">
          <span>
            <IconButton
              size="small"
              onClick={() => openLogs(c)}
              disabled={busy}
              color={logTarget?.id === c.id ? "primary" : "default"}
            >
              <ArticleOutlinedIcon fontSize="small" />
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
              <IconButton size="small" onClick={() => action(c, "start")} disabled={busy} color="success">
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
            <IconButton size="small" onClick={() => action(c, "remove")} disabled={busy} color="error">
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    );
  }

  function renderGroupHeader(key: string, groupRows: ContainerSummary[]) {
    const running = groupRows.filter((c) => c.state === "running").length;
    return (
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {key}
        </Typography>
        <Chip size="small" color="success" variant="outlined" label={`${running} running`} />
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
        <ErrorState title="Cannot list containers" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  const logDrawer = logTarget ? (
    <SplitPanel
      storageKey="containers-logs"
      header={`Logs · ${logTarget.name}`}
      ariaLabel="Resize logs panel"
      collapsed={logsCollapsed}
      onCollapsedChange={setLogsCollapsed}
      onClose={() => {
        setLogTarget(null);
        setLogsCollapsed(false);
      }}
      headerActions={
        <Tooltip title="Open full-page live logs">
          <IconButton size="small" onClick={() => router.push(`/containers/${logTarget.id}/logs`)}>
            <ArticleOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      }
      panel={<LogStreamPanel containerId={logTarget.id} enabled={!logsCollapsed} />}
    />
  ) : undefined;

  return (
    <PageShell
      title="Containers"
      subtitle={`${counts.total} total · ${counts.running} running · ${counts.stopped} stopped`}
      user={user}
      splitPanel={logDrawer}
      actions={
        <>
          <TextField
            select
            size="small"
            label="Group by"
            value={groupBy}
            onChange={(e) => changeGroupBy(e.target.value as GroupMode)}
            sx={{ minWidth: 150 }}
          >
            {GROUP_OPTIONS.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
          <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">
            Refresh
          </Button>
        </>
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
        {...(groupResolver ? { groupBy: groupResolver, renderGroupHeader } : {})}
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
    </PageShell>
  );
}

export default function ContainersDashboard() {
  return <AuthGuard>{(user) => <ContainersInner user={user} />}</AuthGuard>;
}
