"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Stack, Typography } from "@mui/material";
import {
  ErrorState,
  formatBytes,
  formatDuration,
  formatPercent,
  formatRelativeTime,
  LoadingState,
  MetricBar,
  PageShell,
  SectionCard,
  StatusChip,
  type StatusKind
} from "@/components";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "";
const HEALTH_URL = `${API_BASE}/api/v1/health`;
const REFRESH_MS = 5000;

interface CheckResult {
  status: StatusKind;
  latencyMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

interface SystemMetrics {
  cpu: { usagePercent: number; cores: number; loadAverage: [number, number, number] };
  memory: { usedBytes: number; totalBytes: number; freeBytes: number; usagePercent: number };
  disks: Array<{
    path: string;
    usedBytes: number;
    totalBytes: number;
    availableBytes: number;
    usagePercent: number;
  }>;
}

interface HealthResponse {
  status: StatusKind;
  uptime: number;
  version: string;
  timestamp: string;
  checks: { api: CheckResult; docker: CheckResult; database: CheckResult };
  system: SystemMetrics;
}

function CheckRow({ name, result }: { name: string; result: CheckResult }) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={1.5}
      sx={{
        py: 1.25,
        borderBottom: 1,
        borderColor: "divider",
        "&:last-of-type": { borderBottom: 0 }
      }}
    >
      <Typography sx={{ minWidth: 110, fontWeight: 500 }}>{name}</Typography>
      <StatusChip status={result.status} variant="filled" />
      {typeof result.latencyMs === "number" && result.status !== "unavailable" && (
        <Typography variant="caption" color="text.secondary">
          {result.latencyMs}ms
        </Typography>
      )}
      {result.message && (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ ml: "auto", textAlign: "right" }}
        >
          {result.message}
        </Typography>
      )}
    </Stack>
  );
}

export default function HealthDashboard() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(HEALTH_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`API returned ${res.status}`);
        const body: { data: HealthResponse } = await res.json();
        if (cancelled) return;
        setData(body.data);
        setError(null);
        setLastFetched(new Date());
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    }
    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const overall = useMemo(
    () => (data ? <StatusChip status={data.status} variant="filled" withIcon /> : null),
    [data]
  );

  if (!data && !error) {
    return (
      <PageShell title="System Health">
        <LoadingState />
      </PageShell>
    );
  }

  if (!data && error) {
    return (
      <PageShell title="System Health">
        <ErrorState
          title="Cannot reach the API"
          message={error}
          detail={`The dashboard fetches from ${HEALTH_URL || "/api/v1/health"}. Make sure the API is running:\ncd apps/api && yarn dev`}
          onRetry={() => window.location.reload()}
        />
      </PageShell>
    );
  }

  if (!data) return null;

  return (
    <PageShell
      title="System Health"
      subtitle={
        <>
          v{data.version} · uptime {formatDuration(data.uptime)} · refreshed{" "}
          {lastFetched ? formatRelativeTime(lastFetched) : "—"}
        </>
      }
      actions={overall ?? undefined}
    >
      {error && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Latest refresh failed: {error} (showing previous data)
        </Alert>
      )}

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        sx={{ mb: 2 }}
        alignItems="stretch"
      >
        <Box sx={{ flex: 1 }}>
          <SectionCard title="Service checks">
            <CheckRow name="API" result={data.checks.api} />
            <CheckRow name="Docker" result={data.checks.docker} />
            <CheckRow name="Database" result={data.checks.database} />
          </SectionCard>
        </Box>
        <Box sx={{ flex: 1 }}>
          <SectionCard title="System metrics">
            <MetricBar
              label="CPU"
              pct={data.system.cpu.usagePercent}
              primary={formatPercent(data.system.cpu.usagePercent)}
              secondary={`${data.system.cpu.cores} cores · load ${data.system.cpu.loadAverage
                .map((n) => n.toFixed(2))
                .join(" / ")}`}
            />
            <MetricBar
              label="Memory"
              pct={data.system.memory.usagePercent}
              primary={`${formatBytes(data.system.memory.usedBytes)} / ${formatBytes(data.system.memory.totalBytes)}`}
              secondary={formatPercent(data.system.memory.usagePercent)}
            />
          </SectionCard>
        </Box>
      </Stack>

      <SectionCard title="Disk usage">
        {data.system.disks.length === 0 ? (
          <Typography color="text.secondary">No disks reported.</Typography>
        ) : (
          data.system.disks.map((d) => (
            <MetricBar
              key={d.path}
              label={d.path}
              pct={d.usagePercent}
              primary={`${formatBytes(d.usedBytes)} / ${formatBytes(d.totalBytes)}`}
              secondary={`${formatPercent(d.usagePercent)} · ${formatBytes(d.availableBytes)} free`}
            />
          ))
        )}
      </SectionCard>
    </PageShell>
  );
}
