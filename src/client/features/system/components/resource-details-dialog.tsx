"use client";

import { useEffect, useMemo } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from "recharts";
import type { SystemMetrics } from "@/types/system";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { fetchSystemMetrics, selectSystemMetricsHistory } from "@/store/system/slice";

interface ResourceDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  metrics: SystemMetrics | null;
  type: "cpu" | "memory" | "disk";
}

const formatBytes = (bytes: number, precision = 2) => {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }
  const units = ["B", "KiB", "MiB", "GiB", "TiB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 ? 0 : precision)} ${units[exponent]}`;
};

const formatTimeLabel = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
};

const CpuDetails = ({ metrics, chartData }: { metrics: SystemMetrics; chartData: any[] }) => {
  const theme = useTheme();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          CPU Usage Trend (Live)
        </Typography>
        <Box sx={{ height: 250, width: "100%" }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
              <XAxis dataKey="timestamp" stroke={theme.palette.text.secondary} fontSize={11} minTickGap={30} />
              <YAxis unit="%" stroke={theme.palette.text.secondary} fontSize={12} domain={[0, 100]} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: theme.shape.borderRadius
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, "CPU"]}
              />
              <Line type="monotone" dataKey="cpu" stroke={theme.palette.primary.main} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Overall Statistics
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>Overall CPU Usage</TableCell>
              <TableCell align="right">{metrics.cpu.overallUsagePercent.toFixed(2)}%</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Load Average (1m)</TableCell>
              <TableCell align="right">{metrics.cpu.loadAverage[0].toFixed(2)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Load Average (5m)</TableCell>
              <TableCell align="right">{metrics.cpu.loadAverage[1].toFixed(2)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Load Average (15m)</TableCell>
              <TableCell align="right">{metrics.cpu.loadAverage[2].toFixed(2)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Total Cores</TableCell>
              <TableCell align="right">{metrics.cpu.cores.length}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Per-Core Usage
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Core</TableCell>
              <TableCell align="right">Usage</TableCell>
              <TableCell align="right">Speed (MHz)</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {metrics.cpu.cores.map((core) => (
              <TableRow key={core.id}>
                <TableCell>{core.id.replace("cpu-", "Core ")}</TableCell>
                <TableCell align="right">{core.usagePercent.toFixed(2)}%</TableCell>
                <TableCell align="right">{core.speedMhz.toFixed(0)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Stack>
  );
};

const MemoryDetails = ({ metrics, chartData }: { metrics: SystemMetrics; chartData: any[] }) => {
  const theme = useTheme();

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Memory Usage Trend (Live)
        </Typography>
        <Box sx={{ height: 250, width: "100%" }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
              <XAxis dataKey="timestamp" stroke={theme.palette.text.secondary} fontSize={11} minTickGap={30} />
              <YAxis unit="%" stroke={theme.palette.text.secondary} fontSize={12} domain={[0, 100]} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: theme.shape.borderRadius
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Memory"]}
              />
              <Line type="monotone" dataKey="memory" stroke={theme.palette.secondary.main} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Memory Statistics
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>Total Memory</TableCell>
              <TableCell align="right">{formatBytes(metrics.memory.totalBytes)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Used Memory</TableCell>
              <TableCell align="right">{formatBytes(metrics.memory.usedBytes)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Free Memory</TableCell>
              <TableCell align="right">{formatBytes(metrics.memory.freeBytes)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Usage Percentage</TableCell>
              <TableCell align="right">{metrics.memory.usagePercent.toFixed(2)}%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>

      <Box>
        <Typography variant="body2" color="text.secondary">
          Memory usage represents the total RAM consumed by the system, including applications, cached data, and system processes.
        </Typography>
      </Box>
    </Stack>
  );
};

const DiskDetails = ({ metrics, chartData }: { metrics: SystemMetrics; chartData: any[] }) => {
  const theme = useTheme();

  if (!metrics.disks) {
    return (
      <Typography variant="body2" color="text.secondary">
        Disk metrics are not available in the current environment.
      </Typography>
    );
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Disk Usage Trend (Live)
        </Typography>
        <Box sx={{ height: 250, width: "100%" }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
              <XAxis dataKey="timestamp" stroke={theme.palette.text.secondary} fontSize={11} minTickGap={30} />
              <YAxis unit="%" stroke={theme.palette.text.secondary} fontSize={12} domain={[0, 100]} />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: theme.palette.background.paper,
                  border: `1px solid ${theme.palette.divider}`,
                  borderRadius: theme.shape.borderRadius
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`, "Storage"]}
              />
              <Line type="monotone" dataKey="storage" stroke={theme.palette.success.main} strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </Box>
      </Box>

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Overall Storage
        </Typography>
        <Table size="small">
          <TableBody>
            <TableRow>
              <TableCell>Total Storage</TableCell>
              <TableCell align="right">{formatBytes(metrics.disks.totalBytes)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Used Storage</TableCell>
              <TableCell align="right">{formatBytes(metrics.disks.usedBytes)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Available Storage</TableCell>
              <TableCell align="right">{formatBytes(metrics.disks.availableBytes)}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Usage Percentage</TableCell>
              <TableCell align="right">{metrics.disks.usagePercent.toFixed(2)}%</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Box>

      <Box>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Disk Partitions
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Mount Point</TableCell>
              <TableCell>Filesystem</TableCell>
              <TableCell align="right">Size</TableCell>
              <TableCell align="right">Used</TableCell>
              <TableCell align="right">Available</TableCell>
              <TableCell align="right">Usage</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {metrics.disks.partitions.map((partition) => (
              <TableRow key={`${partition.filesystem}-${partition.mountpoint}`}>
                <TableCell>{partition.mountpoint}</TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {partition.filesystem}
                  </Typography>
                </TableCell>
                <TableCell align="right">{formatBytes(partition.sizeBytes)}</TableCell>
                <TableCell align="right">{formatBytes(partition.usedBytes)}</TableCell>
                <TableCell align="right">{formatBytes(partition.availableBytes)}</TableCell>
                <TableCell align="right">{partition.usagePercent.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Stack>
  );
};

const ResourceDetailsDialog = ({ open, onClose, metrics, type }: ResourceDetailsDialogProps) => {
  const dispatch = useAppDispatch();
  const history = useAppSelector(selectSystemMetricsHistory);

  // Fetch metrics every 5 seconds when dialog is open
  useEffect(() => {
    if (!open) return;

    const interval = setInterval(() => {
      void dispatch(fetchSystemMetrics());
    }, 5000);

    return () => clearInterval(interval);
  }, [open, dispatch]);

  const chartData = useMemo(() => {
    if (type === "cpu") {
      return history.slice(-60).map((point) => ({
        timestamp: formatTimeLabel(point.timestamp),
        cpu: Number(point.cpuUsagePercent.toFixed(1))
      }));
    } else if (type === "memory") {
      return history.slice(-60).map((point) => ({
        timestamp: formatTimeLabel(point.timestamp),
        memory: Number(point.memoryUsagePercent.toFixed(1))
      }));
    } else {
      return history
        .filter((point) => point.diskUsagePercent !== null)
        .slice(-60)
        .map((point) => ({
          timestamp: formatTimeLabel(point.timestamp),
          storage: point.diskUsagePercent ? Number(point.diskUsagePercent.toFixed(1)) : 0
        }));
    }
  }, [history, type]);

  if (!metrics) {
    return null;
  }

  const titles = {
    cpu: "CPU Details",
    memory: "Memory Details",
    disk: "Storage Details"
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">{titles[type]}</Typography>
          <IconButton edge="end" onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {type === "cpu" && <CpuDetails metrics={metrics} chartData={chartData} />}
        {type === "memory" && <MemoryDetails metrics={metrics} chartData={chartData} />}
        {type === "disk" && <DiskDetails metrics={metrics} chartData={chartData} />}
      </DialogContent>
    </Dialog>
  );
};

export default ResourceDetailsDialog;
