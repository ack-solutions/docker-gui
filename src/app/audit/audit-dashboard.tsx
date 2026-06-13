"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Collapse,
  IconButton,
  MenuItem,
  Stack,
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
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import {
  AuthGuard,
  ErrorState,
  LoadingState,
  PageShell
} from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

interface AuditEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  payload: Record<string, unknown> | null;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
}

interface AuditPage {
  entries: AuditEntry[];
  nextCursor: string | null;
  total?: number;
}

// Common action prefixes for the quick filter.
const PREFIXES: Array<{ label: string; value: string }> = [
  { label: "All activity", value: "" },
  { label: "Auth", value: "auth." },
  { label: "Containers", value: "container." },
  { label: "Images", value: "image." },
  { label: "Volumes", value: "volume." },
  { label: "Networks", value: "network." },
  { label: "Sites", value: "site." },
  { label: "DNS", value: "dns." },
  { label: "Storage", value: "storage." },
  { label: "Features", value: "feature." }
];

function actionColor(action: string): "default" | "success" | "error" | "warning" | "info" {
  if (action === "auth.login.failed") return "error";
  if (action.endsWith(".delete")) return "warning";
  if (action.startsWith("feature.")) return "info";
  if (action === "auth.login.success") return "success";
  return "default";
}

function statusOf(entry: AuditEntry): number | null {
  const code = entry.payload?.["statusCode"];
  return typeof code === "number" ? code : null;
}

function Row({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const status = statusOf(entry);
  const when = new Date(entry.createdAt);
  return (
    <>
      <TableRow hover sx={{ "& > *": { borderBottom: "unset" } }}>
        <TableCell padding="checkbox">
          <IconButton size="small" onClick={() => setOpen((o) => !o)} aria-label="expand">
            {open ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Tooltip title={when.toISOString()}>
            <span>{when.toLocaleString()}</span>
          </Tooltip>
        </TableCell>
        <TableCell>
          <Chip size="small" label={entry.action} color={actionColor(entry.action)} variant="outlined" />
        </TableCell>
        <TableCell>{entry.actorEmail ?? <em style={{ opacity: 0.6 }}>system</em>}</TableCell>
        <TableCell>
          {entry.targetType ? (
            <Typography variant="body2" component="span">
              {entry.targetType}
              {entry.targetId ? (
                <Typography variant="caption" color="text.secondary" component="span">
                  {" "}· {entry.targetId}
                </Typography>
              ) : null}
            </Typography>
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell>
          {status !== null ? (
            <Chip
              size="small"
              label={status}
              color={status >= 200 && status < 300 ? "success" : status >= 400 ? "error" : "default"}
              variant="filled"
            />
          ) : (
            "—"
          )}
        </TableCell>
        <TableCell>
          <Typography variant="caption" color="text.secondary">
            {entry.ip ?? "—"}
          </Typography>
        </TableCell>
      </TableRow>
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box
              component="pre"
              sx={{
                m: 1,
                p: 1.5,
                bgcolor: "action.hover",
                borderRadius: 1,
                fontSize: 12,
                overflowX: "auto"
              }}
            >
              {JSON.stringify(
                {
                  id: entry.id,
                  actorId: entry.actorId,
                  userAgent: entry.userAgent,
                  payload: entry.payload
                },
                null,
                2
              )}
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}

function AuditInner({ user }: { user: PublicUser }) {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [prefix, setPrefix] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (prefix) params.set("actionPrefix", prefix);
      if (actorFilter.trim()) params.set("actorId", actorFilter.trim());
      if (cursor) params.set("cursor", cursor);
      return params.toString();
    },
    [prefix, actorFilter]
  );

  const load = useCallback(async () => {
    setForbidden(false);
    try {
      const page = await apiFetch<AuditPage>(`/api/v1/audit?${buildQuery()}`);
      setEntries(page.entries);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
      setLoadError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setEntries([]);
        return;
      }
      setLoadError(err instanceof ApiError ? err.message : String(err));
    }
  }, [buildQuery]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await apiFetch<AuditPage>(`/api/v1/audit?${buildQuery(nextCursor)}`);
      setEntries((prev) => [...(prev ?? []), ...page.entries]);
      setNextCursor(page.nextCursor);
      setTotal(page.total);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : String(err));
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, buildQuery]);

  if (entries === null && !loadError) {
    return (
      <PageShell title="Audit log" user={user}>
        <LoadingState />
      </PageShell>
    );
  }

  if (entries === null && loadError) {
    return (
      <PageShell title="Audit log" user={user}>
        <ErrorState title="Cannot load audit log" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Audit log"
      subtitle="Every state-changing action, who did it, and when. Append-only — entries cannot be edited or deleted from the panel."
      user={user}
      actions={
        <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">
          Refresh
        </Button>
      }
    >
      {forbidden ? (
        <Alert severity="warning">
          The audit log is restricted to owners and admins. Your role does not have access.
        </Alert>
      ) : (
        <>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              select
              size="small"
              label="Category"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              sx={{ minWidth: 180 }}
            >
              {PREFIXES.map((p) => (
                <MenuItem key={p.value} value={p.value}>
                  {p.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              label="Actor user id"
              placeholder="filter by actor id"
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              sx={{ minWidth: 220 }}
            />
            {typeof total === "number" && (
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary">
                  {total} matching {total === 1 ? "entry" : "entries"}
                </Typography>
              </Box>
            )}
          </Stack>

          {loadError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {loadError}
            </Alert>
          )}

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Time</TableCell>
                  <TableCell>Action</TableCell>
                  <TableCell>Actor</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>IP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(entries ?? []).map((e) => (
                  <Row key={e.id} entry={e} />
                ))}
                {(entries ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                        No activity recorded yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {nextCursor && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Button onClick={loadMore} disabled={loadingMore} variant="outlined">
                {loadingMore ? "Loading…" : "Load more"}
              </Button>
            </Box>
          )}
        </>
      )}
    </PageShell>
  );
}

export default function AuditDashboard() {
  return <AuthGuard>{(user) => <AuditInner user={user} />}</AuthGuard>;
}
