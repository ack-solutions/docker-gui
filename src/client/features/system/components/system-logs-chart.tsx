"use client";

import { useState, useEffect, useMemo, useCallback, useRef, memo } from "react";
import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography,
  IconButton,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  MenuItem,
  Chip,
  FormControl,
  FormControlLabel,
  Checkbox,
  Paper,
  Pagination,
  Select,
  InputLabel,
  Skeleton,
  Alert,
  Button,
  useTheme,
  alpha
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import ShowChartIcon from "@mui/icons-material/ShowChart";
import TableChartIcon from "@mui/icons-material/TableChart";
import FilterListIcon from "@mui/icons-material/FilterList";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from "recharts";
import { fetchMetricsLogs, type MetricsLogsResponse } from "@/lib/api/server";
import { usePersistentState } from "@/client/hooks/use-persistent-state";

interface ChartDataPoint {
  timestamp: string;
  time: number;
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  cpuCores?: number;
  memoryTotal?: number;
  diskTotal?: number;
}

interface SystemLogsChartProps {
  autoRefreshMs?: number;
}

type ViewMode = "chart" | "table";
type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";
type SortField = "timestamp" | "cpuUsage" | "memoryUsage" | "diskUsage";
type SortOrder = "asc" | "desc";

const SystemLogsChart = memo(function SystemLogsChart({ autoRefreshMs = 30000 }: SystemLogsChartProps) {
  const theme = useTheme();
  
  // State
  const [logs, setLogs] = useState<MetricsLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = usePersistentState<ViewMode>("system:logs:view-mode", "chart");
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [sortField, setSortField] = useState<SortField>("timestamp");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Toggle lines visibility
  const [showCPU, setShowCPU] = useState(true);
  const [showMemory, setShowMemory] = useState(true);
  const [showDisk, setShowDisk] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  // Track last fetch timestamp to only append new data
  const lastFetchTimeRef = useRef<Date | null>(null);
  const isInitialLoadRef = useRef(true);

  // Fetch logs - optimized to append new data
  const fetchLogs = useCallback(async (isRefresh = false) => {
    try {
      setError(null);
      
      // Calculate time range
      const now = new Date();
      const start = new Date(now);
      const rangeMs = {
        "1h": 60 * 60 * 1000,
        "6h": 6 * 60 * 60 * 1000,
        "24h": 24 * 60 * 60 * 1000,
        "7d": 7 * 24 * 60 * 60 * 1000,
        "30d": 30 * 24 * 60 * 60 * 1000
      };
      start.setTime(now.getTime() - rangeMs[timeRange]);

      // On auto-refresh, only fetch new data since last fetch
      const fetchStart = isRefresh && lastFetchTimeRef.current && !isInitialLoadRef.current
        ? lastFetchTimeRef.current
        : start;

      // Fetch with pagination
      const limit = viewMode === "chart" ? 200 : rowsPerPage;
      const offset = viewMode === "chart" ? 0 : (page - 1) * rowsPerPage;

      const data = await fetchMetricsLogs({
        startDate: fetchStart.toISOString(),
        endDate: now.toISOString(),
        limit,
        offset
      });

      // Append or replace data
      if (isRefresh && !isInitialLoadRef.current && lastFetchTimeRef.current) {
        // Append new data to existing
        setLogs((prev) => {
          if (!prev) return data;
          
          return {
            cpu: { 
              logs: [...prev.cpu.logs, ...data.cpu.logs].slice(-200), // Keep last 200
              count: prev.cpu.count + data.cpu.count 
            },
            memory: { 
              logs: [...prev.memory.logs, ...data.memory.logs].slice(-200),
              count: prev.memory.count + data.memory.count 
            },
            disk: { 
              logs: [...prev.disk.logs, ...data.disk.logs].slice(-200),
              count: prev.disk.count + data.disk.count 
            }
          };
        });
      } else {
        // Full replace (initial load or manual refresh)
        setLogs(data);
        isInitialLoadRef.current = false;
      }

      lastFetchTimeRef.current = now;
      setLastUpdated(Date.now());
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch metrics logs:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch logs");
      setLoading(false);
    }
  }, [timeRange, page, rowsPerPage, viewMode]);

  // Auto-refresh with optimized appending
  useEffect(() => {
    fetchLogs(false); // Initial load
    const interval = setInterval(() => fetchLogs(true), autoRefreshMs); // Auto-refresh
    return () => clearInterval(interval);
  }, [fetchLogs, autoRefreshMs]);

  // Prepare chart data - memoized to prevent re-calculation
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!logs) return [];

    const { cpu, memory, disk } = logs;
    
    // Create a map of all timestamps
    const timeMap = new Map<number, ChartDataPoint>();

    // Process CPU logs
    if (showCPU) {
      cpu.logs.forEach((log: any) => {
        const time = new Date(log.timestamp).getTime();
        timeMap.set(time, {
          ...timeMap.get(time),
          timestamp: new Date(log.timestamp).toLocaleTimeString(),
          time,
          cpuUsage: log.usagePercent,
          cpuCores: log.cores
        });
      });
    }

    // Process Memory logs
    if (showMemory) {
      memory.logs.forEach((log: any) => {
        const time = new Date(log.timestamp).getTime();
        timeMap.set(time, {
          ...timeMap.get(time),
          timestamp: new Date(log.timestamp).toLocaleTimeString(),
          time,
          memoryUsage: (log.usedBytes / log.totalBytes) * 100,
          memoryTotal: log.totalBytes
        });
      });
    }

    // Process Disk logs
    if (showDisk) {
      disk.logs.forEach((log: any) => {
        const time = new Date(log.timestamp).getTime();
        timeMap.set(time, {
          ...timeMap.get(time),
          timestamp: new Date(log.timestamp).toLocaleTimeString(),
          time,
          diskUsage: (log.usedBytes / log.totalBytes) * 100,
          diskTotal: log.totalBytes
        });
      });
    }

    // Sort by time and return
    return Array.from(timeMap.values()).sort((a, b) => a.time - b.time);
  }, [logs, showCPU, showMemory, showDisk]);

  // Filter and sort data for table view
  const tableData = useMemo(() => {
    if (!logs || viewMode !== "table") return [];

    let combined: any[] = [];

    if (showCPU) {
      combined.push(...logs.cpu.logs.map((log: any) => ({
        ...log,
        type: "CPU",
        value: log.usagePercent
      })));
    }

    if (showMemory) {
      combined.push(...logs.memory.logs.map((log: any) => ({
        ...log,
        type: "Memory",
        value: (log.usedBytes / log.totalBytes) * 100
      })));
    }

    if (showDisk) {
      combined.push(...logs.disk.logs.map((log: any) => ({
        ...log,
        type: "Disk",
        value: (log.usedBytes / log.totalBytes) * 100
      })));
    }

    // Filter by search query
    if (searchQuery) {
      combined = combined.filter((log) =>
        log.type.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Sort
    combined.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortField) {
        case "timestamp":
          aVal = new Date(a.timestamp).getTime();
          bVal = new Date(b.timestamp).getTime();
          break;
        case "cpuUsage":
        case "memoryUsage":
        case "diskUsage":
          aVal = a.value;
          bVal = b.value;
          break;
        default:
          return 0;
      }

      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });

    return combined;
  }, [logs, viewMode, showCPU, showMemory, showDisk, searchQuery, sortField, sortOrder]);

  const totalPages = Math.ceil(tableData.length / rowsPerPage);

  // Memoize handlers to prevent re-renders
  const handleViewModeChange = useCallback((_: any, val: ViewMode | null) => {
    if (val) setViewMode(val);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTimeRangeChange = useCallback((e: any) => {
    setTimeRange(e.target.value as TimeRange);
    isInitialLoadRef.current = true; // Force full reload on time range change
  }, []);

  const handlePageChange = useCallback((_: any, val: number) => {
    setPage(val);
  }, []);

  // Don't show skeleton on initial load - let main loading screen handle it
  if (loading && !logs) {
    return null;
  }

  return (
    <Card>
      <CardContent>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6" fontWeight={600}>
            System Metrics
          </Typography>
          
          <Stack direction="row" spacing={1} alignItems="center">
            {lastUpdated && (
              <Chip 
                label={`Updated ${Math.floor((Date.now() - lastUpdated) / 1000)}s ago`}
                size="small"
                variant="outlined"
              />
            )}
            
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={() => fetchLogs(false)}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>

            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              size="small"
            >
              <ToggleButton value="chart">
                <ShowChartIcon fontSize="small" />
              </ToggleButton>
              <ToggleButton value="table">
                <TableChartIcon fontSize="small" />
              </ToggleButton>
            </ToggleButtonGroup>
          </Stack>
        </Stack>

        {/* Controls */}
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} mb={2}>
          {/* Time Range */}
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Time Range</InputLabel>
            <Select
              value={timeRange}
              label="Time Range"
              onChange={handleTimeRangeChange}
            >
              <MenuItem value="1h">Last Hour</MenuItem>
              <MenuItem value="6h">Last 6 Hours</MenuItem>
              <MenuItem value="24h">Last 24 Hours</MenuItem>
              <MenuItem value="7d">Last 7 Days</MenuItem>
              <MenuItem value="30d">Last 30 Days</MenuItem>
            </Select>
          </FormControl>

          {/* Toggle Lines */}
          <Stack direction="row" spacing={1} flex={1}>
            <FormControlLabel
              control={<Checkbox checked={showCPU} onChange={(e) => setShowCPU(e.target.checked)} size="small" />}
              label={<Chip label="CPU" size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1) }} />}
            />
            <FormControlLabel
              control={<Checkbox checked={showMemory} onChange={(e) => setShowMemory(e.target.checked)} size="small" />}
              label={<Chip label="Memory" size="small" sx={{ bgcolor: alpha(theme.palette.success.main, 0.1) }} />}
            />
            <FormControlLabel
              control={<Checkbox checked={showDisk} onChange={(e) => setShowDisk(e.target.checked)} size="small" />}
              label={<Chip label="Disk" size="small" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1) }} />}
            />
          </Stack>

          {/* Search (for table view) */}
          {viewMode === "table" && (
            <TextField
              size="small"
              label="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              sx={{ minWidth: 200 }}
            />
          )}
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Chart View */}
        {viewMode === "chart" && (
          <Box sx={{ width: "100%", height: 400 }}>
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                <XAxis 
                  dataKey="timestamp"
                  stroke={theme.palette.text.secondary}
                  tick={{ fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  stroke={theme.palette.text.secondary}
                  tick={{ fontSize: 12 }}
                  domain={[0, 100]}
                  label={{ value: "Usage %", angle: -90, position: "insideLeft" }}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 4
                  }}
                  formatter={(value: any) => `${Number(value).toFixed(2)}%`}
                />
                <Legend />
                
                {showCPU && (
                  <Line
                    type="monotone"
                    dataKey="cpuUsage"
                    stroke={theme.palette.primary.main}
                    strokeWidth={2}
                    dot={false}
                    name="CPU Usage %"
                    connectNulls
                  />
                )}
                
                {showMemory && (
                  <Line
                    type="monotone"
                    dataKey="memoryUsage"
                    stroke={theme.palette.success.main}
                    strokeWidth={2}
                    dot={false}
                    name="Memory Usage %"
                    connectNulls
                  />
                )}
                
                {showDisk && (
                  <Line
                    type="monotone"
                    dataKey="diskUsage"
                    stroke={theme.palette.warning.main}
                    strokeWidth={2}
                    dot={false}
                    name="Disk Usage %"
                    connectNulls
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Table View */}
        {viewMode === "table" && (
          <>
            {/* Sort Controls */}
            <Stack direction="row" spacing={2} mb={2}>
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Sort By</InputLabel>
                <Select
                  value={sortField}
                  label="Sort By"
                  onChange={(e) => setSortField(e.target.value as SortField)}
                >
                  <MenuItem value="timestamp">Timestamp</MenuItem>
                  <MenuItem value="cpuUsage">Usage %</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Order</InputLabel>
                <Select
                  value={sortOrder}
                  label="Order"
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                >
                  <MenuItem value="desc">Newest First</MenuItem>
                  <MenuItem value="asc">Oldest First</MenuItem>
                </Select>
              </FormControl>

              <FormControl size="small" sx={{ minWidth: 100 }}>
                <InputLabel>Per Page</InputLabel>
                <Select
                  value={rowsPerPage}
                  label="Per Page"
                  onChange={(e) => {
                    setRowsPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </FormControl>
            </Stack>

            {/* Table */}
            <Paper variant="outlined" sx={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                    <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Time</th>
                    <th style={{ padding: 12, textAlign: "left", fontWeight: 600 }}>Type</th>
                    <th style={{ padding: 12, textAlign: "right", fontWeight: 600 }}>Usage %</th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.slice((page - 1) * rowsPerPage, page * rowsPerPage).map((log, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid ${theme.palette.divider}` }}>
                      <td style={{ padding: 12 }}>
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td style={{ padding: 12 }}>
                        <Chip label={log.type} size="small" />
                      </td>
                      <td style={{ padding: 12, textAlign: "right" }}>
                        <Chip
                          label={`${log.value.toFixed(2)}%`}
                          size="small"
                          color={log.value > 80 ? "error" : log.value > 60 ? "warning" : "success"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Paper>

            {/* Pagination */}
            <Stack direction="row" justifyContent="center" mt={2}>
              <Pagination
                count={totalPages}
                page={page}
                onChange={handlePageChange}
                color="primary"
              />
            </Stack>
          </>
        )}

        {/* Stats Summary */}
        <Stack direction="row" justifyContent="space-around" mt={2} spacing={2}>
          {showCPU && chartData.length > 0 && (
            <Box textAlign="center">
              <Typography variant="caption" color="text.secondary">
                Avg CPU
              </Typography>
              <Typography variant="h6">
                {(chartData.reduce((sum, d) => sum + (d.cpuUsage || 0), 0) / chartData.filter(d => d.cpuUsage).length).toFixed(1)}%
              </Typography>
            </Box>
          )}
          
          {showMemory && chartData.length > 0 && (
            <Box textAlign="center">
              <Typography variant="caption" color="text.secondary">
                Avg Memory
              </Typography>
              <Typography variant="h6">
                {(chartData.reduce((sum, d) => sum + (d.memoryUsage || 0), 0) / chartData.filter(d => d.memoryUsage).length).toFixed(1)}%
              </Typography>
            </Box>
          )}
          
          {showDisk && chartData.length > 0 && (
            <Box textAlign="center">
              <Typography variant="caption" color="text.secondary">
                Avg Disk
              </Typography>
              <Typography variant="h6">
                {(chartData.reduce((sum, d) => sum + (d.diskUsage || 0), 0) / chartData.filter(d => d.diskUsage).length).toFixed(1)}%
              </Typography>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
});

export default SystemLogsChart;

