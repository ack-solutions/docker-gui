"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import MemoryIcon from "@mui/icons-material/Memory";
import SpeedIcon from "@mui/icons-material/Speed";
import SaveIcon from "@mui/icons-material/SaveOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import DatasetOutlinedIcon from "@mui/icons-material/DatasetOutlined";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import type { ReactNode } from "react";
import { AuthGuard, ErrorState, LoadingState, PageShell } from "@/components";
import { progressColor } from "@/components/theme";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

type Status = "ok" | "degraded" | "down" | "unavailable";

interface Health {
  status: Status;
  uptime: number;
  version: string;
  checks: Record<string, { status: Status; latencyMs?: number; details?: Record<string, unknown> }>;
  system: {
    cpu: { usagePercent: number; cores: number; loadAverage: number[] };
    memory: { usagePercent: number; usedBytes: number; totalBytes: number };
    disks: Array<{ path: string; usagePercent: number; usedBytes: number; totalBytes: number }>;
  };
}

interface Container {
  state: string;
}

function fmtBytes(n: number): string {
  if (!n) return "0";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${u[i]}`;
}

function fmtUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function MetricCard({
  icon,
  label,
  pct,
  sub
}: {
  icon: ReactNode;
  label: string;
  pct: number;
  sub: string;
}) {
  const color = progressColor(pct);
  return (
    <Card>
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ color: `${color}.main`, display: "flex" }}>{icon}</Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              {label}
            </Typography>
          </Stack>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {Math.round(pct)}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={Math.min(100, pct)}
          color={color}
          sx={{ height: 8, borderRadius: 5, bgcolor: "action.hover" }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
          {sub}
        </Typography>
      </CardContent>
    </Card>
  );
}

function QuickLink({ icon, label, href }: { icon: ReactNode; label: string; href: string }) {
  const router = useRouter();
  return (
    <Card>
      <CardActionArea onClick={() => router.push(href)} sx={{ p: 2 }}>
        <Stack spacing={1} alignItems="flex-start">
          <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {label}
          </Typography>
        </Stack>
      </CardActionArea>
    </Card>
  );
}

const STATUS_META: Record<Status, { label: string; color: string; icon: ReactNode }> = {
  ok: { label: "All systems operational", color: "#16a34a", icon: <CheckCircleIcon /> },
  degraded: { label: "Degraded", color: "#d97706", icon: <WarningAmberIcon /> },
  down: { label: "Service down", color: "#dc2626", icon: <ErrorIcon /> },
  unavailable: { label: "Unavailable", color: "#64748b", icon: <ErrorIcon /> }
};

function DashboardInner({ user }: { user: PublicUser }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [containers, setContainers] = useState<Container[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [h, c] = await Promise.all([
        apiFetch<Health>("/api/v1/health"),
        apiFetch<Container[]>("/api/v1/docker/containers").catch(() => [])
      ]);
      setHealth(h);
      setContainers(c);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  if (!health && !error) {
    return (
      <PageShell title="Dashboard" user={user}>
        <LoadingState />
      </PageShell>
    );
  }
  if (!health && error) {
    return (
      <PageShell title="Dashboard" user={user}>
        <ErrorState title="Cannot load dashboard" message={error} onRetry={load} />
      </PageShell>
    );
  }

  const h = health!;
  const meta = STATUS_META[h.status] ?? STATUS_META.unavailable;
  const running = (containers ?? []).filter((c) => c.state === "running").length;
  const total = (containers ?? []).length;
  const dockerVersion =
    (h.checks["docker"]?.details?.["version"] as string | undefined) ?? "—";
  const disk = h.system.disks[0];

  return (
    <PageShell
      title="Dashboard"
      subtitle={`Welcome back, ${user.name.split(" ")[0]}`}
      user={user}
      actions={
        <Button startIcon={<RefreshIcon />} variant="outlined" size="small" onClick={load}>
          Refresh
        </Button>
      }
    >
      {/* Status hero */}
      <Card sx={{ mb: 3, overflow: "hidden", position: "relative" }}>
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(120deg, rgba(37,99,235,0.06), rgba(124,58,237,0.06))"
          }}
        />
        <CardContent sx={{ position: "relative" }}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ sm: "center" }}
            spacing={2}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ color: meta.color, display: "flex", "& svg": { fontSize: 40 } }}>{meta.icon}</Box>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {meta.label}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Up {fmtUptime(h.uptime)} · Docker {dockerVersion} · panel v{h.version}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1}>
              {Object.entries(h.checks).map(([name, c]) => (
                <Chip
                  key={name}
                  size="small"
                  label={name}
                  color={c.status === "ok" ? "success" : c.status === "down" ? "error" : "warning"}
                  variant="outlined"
                  icon={c.status === "ok" ? <CheckCircleIcon /> : <ErrorIcon />}
                />
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      {/* Metric cards */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr", lg: "repeat(4, 1fr)" },
          gap: 2,
          mb: 3
        }}
      >
        <MetricCard
          icon={<SpeedIcon />}
          label="CPU"
          pct={h.system.cpu.usagePercent}
          sub={`${h.system.cpu.cores} cores · load ${h.system.cpu.loadAverage[0]?.toFixed(2) ?? "—"}`}
        />
        <MetricCard
          icon={<MemoryIcon />}
          label="Memory"
          pct={h.system.memory.usagePercent}
          sub={`${fmtBytes(h.system.memory.usedBytes)} / ${fmtBytes(h.system.memory.totalBytes)}`}
        />
        {disk && (
          <MetricCard
            icon={<SaveIcon />}
            label="Disk"
            pct={disk.usagePercent}
            sub={`${fmtBytes(disk.usedBytes)} / ${fmtBytes(disk.totalBytes)} (${disk.path})`}
          />
        )}
        <Card>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Box sx={{ color: "primary.main", display: "flex" }}>
                  <Inventory2OutlinedIcon />
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Containers
                </Typography>
              </Stack>
              <Typography variant="h5" sx={{ fontWeight: 700 }}>
                {containers === null ? <CircularProgress size={18} /> : total}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Chip size="small" color="success" variant="outlined" label={`${running} running`} />
              <Chip size="small" variant="outlined" label={`${total - running} stopped`} />
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              On this server
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Quick links */}
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        Quick access
      </Typography>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", sm: "repeat(3, 1fr)", md: "repeat(6, 1fr)" },
          gap: 2
        }}
      >
        <QuickLink icon={<Inventory2OutlinedIcon />} label="Containers" href="/containers" />
        <QuickLink icon={<DatasetOutlinedIcon />} label="Databases" href="/databases" />
        <QuickLink icon={<CloudOutlinedIcon />} label="Storage" href="/storage" />
        <QuickLink icon={<ArchiveOutlinedIcon />} label="Registry" href="/registry" />
        <QuickLink icon={<NotificationsActiveOutlinedIcon />} label="Alerts" href="/alerts" />
        <QuickLink icon={<ExtensionOutlinedIcon />} label="Features" href="/features" />
      </Box>
    </PageShell>
  );
}

export default function Dashboard() {
  return <AuthGuard>{(user) => <DashboardInner user={user} />}</AuthGuard>;
}
