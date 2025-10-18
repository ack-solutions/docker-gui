"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  IconButton,
  Skeleton,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  alpha
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import RefreshIcon from "@mui/icons-material/Refresh";
import { fetchMetricsLogs, type CpuMetricsLog, type MemoryMetricsLog, type DiskMetricsLog, type MetricsLogsResponse } from "@/lib/api/server";

const formatDateTime = (date: Date | string) => {
  const d = new Date(date);
  return d.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) {
    return `${gb.toFixed(2)} GB`;
  }
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
};

const getUsageColor = (percent: number): "success" | "warning" | "error" => {
  if (percent < 60) return "success";
  if (percent < 85) return "warning";
  return "error";
};

type TabValue = "all" | "cpu" | "memory" | "disk";

interface RecentLogsCardProps {
  autoRefreshIntervalMs?: number;
}

const formatRelativeTime = (timestamp: number | null) => {
  if (!timestamp) {
    return "never";
  }

  const diffSeconds = Math.max(Math.floor((Date.now() - timestamp) / 1000), 0);

  if (diffSeconds < 5) {
    return "just now";
  }
  if (diffSeconds < 60) {
    return `${diffSeconds}s ago`;
  }

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const RecentLogsCard = ({ autoRefreshIntervalMs = 30_000 }: RecentLogsCardProps) => {
  const theme = useTheme();
  const [logs, setLogs] = useState<MetricsLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  
  // Use refs to track loading state without causing re-renders in callbacks
  const isRefreshingRef = useRef(false);
  const isLoadingRef = useRef(true);

  const loadLogs = useCallback(
    async (mode: "initial" | "refresh" = "refresh") => {
      if (mode === "refresh" && (isRefreshingRef.current || isLoadingRef.current)) {
        return;
      }

      try {
        if (mode === "initial") {
          isLoadingRef.current = true;
          setLoading(true);
        } else {
          isRefreshingRef.current = true;
          setIsRefreshing(true);
        }
        const response = await fetchMetricsLogs({ limit: 10 });
        setLogs(response);
        setError(null);
        setLastUpdatedAt(Date.now());
      } catch (err) {
        console.error("Failed to fetch metrics logs:", err);
        setError("Failed to load recent logs");
      } finally {
        if (mode === "initial") {
          isLoadingRef.current = false;
          setLoading(false);
        }
        isRefreshingRef.current = false;
        setIsRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadLogs("initial");

    if (!autoRefreshIntervalMs || autoRefreshIntervalMs <= 0) {
      return;
    }

    const id = window.setInterval(() => {
      void loadLogs("refresh");
    }, autoRefreshIntervalMs);

    return () => {
      window.clearInterval(id);
    };
  }, [autoRefreshIntervalMs, loadLogs]);

  const lastUpdatedLabel = useMemo(() => formatRelativeTime(lastUpdatedAt), [lastUpdatedAt]);
  const lastUpdatedExact = useMemo(
    () =>
      lastUpdatedAt
        ? new Date(lastUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        : null,
    [lastUpdatedAt]
  );

  const headerChipLabel = useMemo(() => {
    if (isRefreshing) {
      return "Updating…";
    }
    if (logs) {
      return `Updated ${lastUpdatedLabel}`;
    }
    if (error) {
      return "Retry required";
    }
    return "Awaiting data";
  }, [isRefreshing, logs, lastUpdatedLabel, error]);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Stack spacing={theme.spacing(2)}>
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="rectangular" height={320} sx={{ borderRadius: theme.spacing(1) }} />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (error || !logs) {
    return (
      <Card>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" mb={theme.spacing(2)}>
            <Typography variant="h6" fontWeight={600}>Recent System Logs</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title={lastUpdatedExact ? `Last updated at ${lastUpdatedExact}` : "No logs yet"}>
                <Chip
                  size="small"
                  variant="outlined"
                  color={isRefreshing ? "primary" : "default"}
                  label={headerChipLabel}
                />
              </Tooltip>
              <Tooltip title={isRefreshing ? "Refreshing…" : "Refresh"}>
                <span>
                  <IconButton
                    size="small"
                    disabled={isRefreshing}
                    onClick={() => {
                      void loadLogs("refresh");
                    }}
                    sx={{
                      "&:hover": {
                        backgroundColor: alpha(theme.palette.primary.main, 0.1)
                      }
                    }}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>
          <Box 
            sx={{ 
              textAlign: "center", 
              py: theme.spacing(6),
              px: theme.spacing(3),
              backgroundColor: alpha(theme.palette.divider, 0.03),
              borderRadius: theme.spacing(1.5)
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {error || "No logs available yet. Logs will appear as the system collects metrics."}
            </Typography>
          </Box>
        </CardContent>
      </Card>
    );
  }

  // Merge logs from all types for "all" view, sorted by timestamp
  const combinedLogs = activeTab === "all" ? [
    ...logs.cpu.logs.map(log => ({ ...log, type: "cpu" as const })),
    ...logs.memory.logs.map(log => ({ ...log, type: "memory" as const })),
    ...logs.disk.logs.map(log => ({ ...log, type: "disk" as const }))
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10) : [];

  const cpuLogs = logs.cpu.logs;
  const memoryLogs = logs.memory.logs;
  const diskLogs = logs.disk.logs;

  const renderCpuTable = () => (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Usage</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Load (1m)</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Load (5m)</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Load (15m)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {cpuLogs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: theme.spacing(4) }}>
                <Typography variant="body2" color="text.secondary">
                  No CPU logs available yet
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            cpuLogs.map((log) => (
              <TableRow 
                key={log.id} 
                hover
                sx={{
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.04)
                  }
                }}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {formatDateTime(log.timestamp)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={`${log.usagePercent.toFixed(1)}%`}
                    size="small"
                    color={getUsageColor(log.usagePercent)}
                    sx={{ minWidth: 65, fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2" color="text.secondary">
                    {log.loadAverage1m.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2" color="text.secondary">
                    {log.loadAverage5m.toFixed(2)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2" color="text.secondary">
                    {log.loadAverage15m.toFixed(2)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderMemoryTable = () => (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Usage</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Used</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Free</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {memoryLogs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: theme.spacing(4) }}>
                <Typography variant="body2" color="text.secondary">
                  No memory logs available yet
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            memoryLogs.map((log) => (
              <TableRow 
                key={log.id} 
                hover
                sx={{
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.04)
                  }
                }}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {formatDateTime(log.timestamp)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={`${log.usagePercent.toFixed(1)}%`}
                    size="small"
                    color={getUsageColor(log.usagePercent)}
                    sx={{ minWidth: 65, fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{formatBytes(log.usedBytes)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{formatBytes(log.freeBytes)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" color="text.secondary">
                    {formatBytes(log.totalBytes)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderDiskTable = () => (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Usage</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Used</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Available</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {diskLogs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} align="center" sx={{ py: theme.spacing(4) }}>
                <Typography variant="body2" color="text.secondary">
                  No disk logs available yet
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            diskLogs.map((log) => (
              <TableRow 
                key={log.id} 
                hover
                sx={{
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.04)
                  }
                }}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {formatDateTime(log.timestamp)}
                  </Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={`${log.usagePercent.toFixed(1)}%`}
                    size="small"
                    color={getUsageColor(log.usagePercent)}
                    sx={{ minWidth: 65, fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{formatBytes(log.usedBytes)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2">{formatBytes(log.availableBytes)}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography variant="body2" color="text.secondary">
                    {formatBytes(log.totalBytes)}
                  </Typography>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  const renderAllTable = () => (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
            <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
            <TableCell align="center" sx={{ fontWeight: 600 }}>Usage</TableCell>
            <TableCell align="right" sx={{ fontWeight: 600 }}>Details</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {combinedLogs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} align="center" sx={{ py: theme.spacing(4) }}>
                <Typography variant="body2" color="text.secondary">
                  No logs available yet
                </Typography>
              </TableCell>
            </TableRow>
          ) : (
            combinedLogs.map((log, index) => (
              <TableRow 
                key={`${log.type}-${log.id}-${index}`} 
                hover
                sx={{
                  "&:hover": {
                    backgroundColor: alpha(theme.palette.primary.main, 0.04)
                  }
                }}
              >
                <TableCell>
                  <Typography variant="body2" fontWeight={500}>
                    {formatDateTime(log.timestamp)}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip 
                    label={log.type.toUpperCase()} 
                    size="small" 
                    variant="outlined"
                    sx={{ minWidth: 75, fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={`${log.usagePercent.toFixed(1)}%`}
                    size="small"
                    color={getUsageColor(log.usagePercent)}
                    sx={{ minWidth: 65, fontWeight: 600 }}
                  />
                </TableCell>
                <TableCell align="right">
                  <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    {log.type === "cpu" && `Load: ${(log as any).loadAverage1m?.toFixed(2)}`}
                    {log.type === "memory" && `Used: ${formatBytes((log as any).usedBytes)}`}
                    {log.type === "disk" && `Available: ${formatBytes((log as any).availableBytes)}`}
                  </Typography>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Card>
      <CardContent sx={{ p: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{
            px: theme.spacing(2.5),
            pt: theme.spacing(2.5),
            pb: theme.spacing(1.5)
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            Recent System Logs
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Tooltip title={lastUpdatedExact ? `Last updated at ${lastUpdatedExact}` : "No logs yet"}>
              <Chip
                size="small"
                variant="outlined"
                color={isRefreshing ? "primary" : "default"}
                label={headerChipLabel}
              />
            </Tooltip>
            <Tooltip title={isRefreshing ? "Refreshing…" : "Refresh"}>
              <span>
                <IconButton
                  size="small"
                  disabled={isRefreshing}
                  onClick={() => {
                    void loadLogs("refresh");
                  }}
                  sx={{
                    "&:hover": {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1)
                    }
                  }}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Box sx={{ borderBottom: 1, borderColor: "divider", px: theme.spacing(2.5) }}>
          <Tabs 
            value={activeTab} 
            onChange={(_, value) => setActiveTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              "& .MuiTab-root": {
                minHeight: 48,
                fontWeight: 600
              }
            }}
          >
            <Tab label={`All (${combinedLogs.length})`} value="all" />
            <Tab label={`CPU (${cpuLogs.length})`} value="cpu" />
            <Tab label={`Memory (${memoryLogs.length})`} value="memory" />
            <Tab label={`Disk (${diskLogs.length})`} value="disk" />
          </Tabs>
        </Box>

        <Box sx={{ maxHeight: 400, overflow: "auto" }}>
          {activeTab === "all" && renderAllTable()}
          {activeTab === "cpu" && renderCpuTable()}
          {activeTab === "memory" && renderMemoryTable()}
          {activeTab === "disk" && renderDiskTable()}
        </Box>
      </CardContent>
    </Card>
  );
};

export default RecentLogsCard;
