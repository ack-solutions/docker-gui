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
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { toast } from "sonner";
import { AuthGuard, ErrorState, LoadingState, PageShell } from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

type Op = "gt" | "lt" | "gte" | "lte" | "eq";

interface Rule {
  id: string;
  name: string;
  metric: string;
  operator: Op;
  threshold: number;
  forSeconds: number;
  cooldownSeconds: number;
  webhookUrl: string | null;
  emailTo: string | null;
  enabled: boolean;
  lastFiredAt: string | null;
}

interface Event {
  id: string;
  ruleName: string;
  metric: string;
  value: number;
  status: "firing" | "resolved";
  message: string;
  delivered: boolean;
  createdAt: string;
}

interface MetricOption {
  value: string;
  label: string;
}

// Shown until the live catalog (which adds per-disk + per-container metrics)
// loads, and as a fallback if the endpoint is unreachable.
const FALLBACK_METRICS: MetricOption[] = [
  { value: "system.cpu.percent", label: "CPU %" },
  { value: "system.memory.percent", label: "Memory %" }
];
const OPS: Op[] = ["gt", "lt", "gte", "lte", "eq"];
const OP_LABEL: Record<Op, string> = { gt: ">", lt: "<", gte: "≥", lte: "≤", eq: "=" };

const EMPTY = {
  name: "",
  metric: "system.cpu.percent",
  operator: "gt" as Op,
  threshold: "90",
  forSeconds: "60",
  cooldownSeconds: "300",
  webhookUrl: "",
  emailTo: ""
};

function AlertsInner({ user }: { user: PublicUser }) {
  const canManage = user.role === "owner" || user.role === "admin";
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [busy, setBusy] = useState(false);
  const [metricOptions, setMetricOptions] = useState<MetricOption[]>(FALLBACK_METRICS);

  const load = useCallback(async () => {
    try {
      const [r, e, m] = await Promise.all([
        apiFetch<Rule[]>("/api/v1/alerts/rules"),
        apiFetch<Event[]>("/api/v1/alerts/events").catch(() => []),
        apiFetch<MetricOption[]>("/api/v1/alerts/metrics").catch(() => [])
      ]);
      setRules(r);
      setEvents(e);
      if (m.length > 0) setMetricOptions(m);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(async () => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        metric: form.metric,
        operator: form.operator,
        threshold: Number(form.threshold),
        forSeconds: Number(form.forSeconds),
        cooldownSeconds: Number(form.cooldownSeconds)
      };
      if (form.webhookUrl.trim()) payload["webhookUrl"] = form.webhookUrl.trim();
      if (form.emailTo.trim()) payload["emailTo"] = form.emailTo.trim();
      await apiFetch("/api/v1/alerts/rules", { method: "POST", body: JSON.stringify(payload) });
      toast.success("Rule created");
      setCreateOpen(false);
      setForm({ ...EMPTY });
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [form, load]);

  const toggle = useCallback(
    async (r: Rule) => {
      try {
        await apiFetch(`/api/v1/alerts/rules/${r.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !r.enabled }) });
        await load();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : String(err));
      }
    },
    [load]
  );

  const remove = useCallback(
    async (r: Rule) => {
      if (!confirm(`Delete rule "${r.name}"?`)) return;
      try {
        await apiFetch(`/api/v1/alerts/rules/${r.id}`, { method: "DELETE" });
        toast.success("Rule deleted");
        await load();
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : String(err));
      }
    },
    [load]
  );

  if (rules === null && !loadError) {
    return (
      <PageShell title="Alerts" user={user}>
        <LoadingState />
      </PageShell>
    );
  }
  if (rules === null && loadError) {
    return (
      <PageShell title="Alerts" user={user}>
        <ErrorState title="Cannot load alerts" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Alerts"
      subtitle="Threshold rules on system metrics. Firing rules deliver to a webhook (Slack/Discord/generic) and/or email."
      user={user}
      actions={
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} variant="outlined" size="small" onClick={load}>
            Refresh
          </Button>
          {canManage && (
            <Button startIcon={<AddIcon />} variant="contained" size="small" onClick={() => setCreateOpen(true)}>
              New rule
            </Button>
          )}
        </Stack>
      }
    >
      {(rules ?? []).length === 0 ? (
        <Alert severity="info" sx={{ mb: 3 }}>
          No alert rules yet. {canManage ? "Create one to get notified when CPU or memory crosses a threshold." : ""}
        </Alert>
      ) : (
        <Table size="small" sx={{ mb: 4 }}>
          <TableHead>
            <TableRow>
              <TableCell>Rule</TableCell>
              <TableCell>Condition</TableCell>
              <TableCell>For / cooldown</TableCell>
              <TableCell>Webhook</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Enabled</TableCell>
              {canManage && <TableCell />}
            </TableRow>
          </TableHead>
          <TableBody>
            {(rules ?? []).map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{r.name}</TableCell>
                <TableCell>
                  <code>
                    {r.metric} {OP_LABEL[r.operator]} {r.threshold}
                  </code>
                </TableCell>
                <TableCell>
                  {r.forSeconds}s / {r.cooldownSeconds}s
                </TableCell>
                <TableCell>{r.webhookUrl ? "✓" : "—"}</TableCell>
                <TableCell>{r.emailTo ? "✓" : "—"}</TableCell>
                <TableCell>
                  <Switch size="small" checked={r.enabled} disabled={!canManage} onChange={() => toggle(r)} />
                </TableCell>
                {canManage && (
                  <TableCell align="right">
                    <Tooltip title="Delete rule">
                      <IconButton size="small" color="error" onClick={() => remove(r)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Typography variant="h6" sx={{ mb: 1 }}>
        Recent events
      </Typography>
      {events.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No alerts have fired.
        </Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>When</TableCell>
              <TableCell>Rule</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Detail</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.id} hover>
                <TableCell>{new Date(e.createdAt).toLocaleString()}</TableCell>
                <TableCell>{e.ruleName}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={e.status}
                    color={e.status === "firing" ? "error" : "success"}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>
                  <Typography variant="caption">
                    {e.message}
                    {!e.delivered && e.status === "firing" ? " (delivery failed)" : ""}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>New alert rule</DialogTitle>
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
              label="Metric"
              value={form.metric}
              onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value }))}
              size="small"
              fullWidth
              helperText="System CPU/memory, each disk, and every running container."
            >
              {(metricOptions.some((m) => m.value === form.metric)
                ? metricOptions
                : [{ value: form.metric, label: form.metric }, ...metricOptions]
              ).map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction="row" spacing={2}>
              <TextField
                select
                label="Op"
                value={form.operator}
                onChange={(e) => setForm((f) => ({ ...f, operator: e.target.value as Op }))}
                size="small"
                sx={{ width: 90 }}
              >
                {OPS.map((o) => (
                  <MenuItem key={o} value={o}>
                    {OP_LABEL[o]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Threshold"
                value={form.threshold}
                onChange={(e) => setForm((f) => ({ ...f, threshold: e.target.value }))}
                size="small"
                fullWidth
              />
            </Stack>
            <Stack direction="row" spacing={2}>
              <TextField
                label="For (s)"
                value={form.forSeconds}
                onChange={(e) => setForm((f) => ({ ...f, forSeconds: e.target.value }))}
                size="small"
                fullWidth
                helperText="Hold before firing"
              />
              <TextField
                label="Cooldown (s)"
                value={form.cooldownSeconds}
                onChange={(e) => setForm((f) => ({ ...f, cooldownSeconds: e.target.value }))}
                size="small"
                fullWidth
                helperText="Min gap between fires"
              />
            </Stack>
            <TextField
              label="Webhook URL (optional)"
              placeholder="https://hooks.slack.com/…"
              value={form.webhookUrl}
              onChange={(e) => setForm((f) => ({ ...f, webhookUrl: e.target.value }))}
              size="small"
              fullWidth
            />
            <TextField
              label="Email to (optional)"
              placeholder="ops@example.com, sre@example.com"
              value={form.emailTo}
              onChange={(e) => setForm((f) => ({ ...f, emailTo: e.target.value }))}
              size="small"
              fullWidth
              helperText="Comma-separated. Requires SMTP configured on the server (ALERT_SMTP_*)."
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy || !form.name || !form.threshold} onClick={create}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      <Box sx={{ mt: 3 }}>
        <Alert severity="info">
          Rules are evaluated every 60 seconds against live metrics — system CPU/memory, disk
          usage, and per-container CPU/memory. Firing rules deliver to a webhook and/or email
          (email requires SMTP configured on the server via ALERT_SMTP_*).
        </Alert>
      </Box>
    </PageShell>
  );
}

export default function AlertsDashboard() {
  return <AuthGuard>{(user) => <AlertsInner user={user} />}</AuthGuard>;
}
