"use client";

import { useMemo, useState } from "react";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { Box, Card, CardContent, Chip, Collapse, Divider, IconButton, InputAdornment, MenuItem, Stack, TextField, Tooltip, Typography, CircularProgress } from "@mui/material";
import { styled } from "@mui/material/styles";
import moment from "moment";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { useLogs } from "@/features/docker/logs/hooks/use-logs";

const CompactSearchField = styled(TextField)(({ theme }) => ({
  minWidth: 160,
  [theme.breakpoints.down("md")]: {
    minWidth: 120
  }
}));

const CompactLevelField = styled(TextField)(({ theme }) => ({
  minWidth: 100,
  [theme.breakpoints.down("md")]: {
    minWidth: 90
  }
}));

const LogViewport = styled(Box, {
  shouldForwardProp: (prop) => prop !== "$isExpanded"
})<{ $isExpanded: boolean }>(({ theme, $isExpanded }) => ({
  flex: 1,
  overflow: "auto",
  backgroundColor: theme.palette.mode === "dark" ? "rgba(15, 23, 42, 0.6)" : theme.palette.grey[50],
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1.5),
  maxHeight: $isExpanded ? "calc(100vh - 240px)" : 500,
  minHeight: $isExpanded ? 650 : 350,
  border: `1px solid ${theme.palette.divider}`,
  transition: theme.transitions.create(["max-height", "min-height"], {
    duration: theme.transitions.duration.standard
  }),
  fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: "0.8125rem"
}));

const LogLine = styled(Box, {
  shouldForwardProp: (prop) => prop !== "$level"
})<{ $level: "info" | "warn" | "error" }>(({ theme, $level }) => {
  const palette = {
    error: theme.palette.error.main,
    warn: theme.palette.warning.main,
    info: theme.palette.primary.main
  } as const;

  return {
    borderLeft: `3px solid ${palette[$level]}`,
    paddingLeft: theme.spacing(1.5),
    marginBottom: theme.spacing(1),
    "&:hover": {
      backgroundColor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)"
    }
  };
});

const logLevels = [
  { label: "All", value: "all" },
  { label: "Info", value: "info" },
  { label: "Warn", value: "warn" },
  { label: "Error", value: "error" }
] as const;

type LogLevel = (typeof logLevels)[number]["value"];

interface LogViewerProps {
  containerId: string;
}

interface LogFilterForm {
  query: string;
  level: LogLevel;
}

const LogViewer = ({ containerId }: LogViewerProps) => {
  const { logs, isStreaming, toggleStreaming, severityCounters } = useLogs({ containerId });
  const [isExpanded, setIsExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { control, register, watch } = useForm<LogFilterForm>({
    defaultValues: {
      query: "",
      level: "all"
    }
  });

  const level = watch("level");
  const query = watch("query");

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel = level === "all" || log.level === level;
      const matchesQuery = !query || log.message.toLowerCase().includes(query.toLowerCase());
      return matchesLevel && matchesQuery;
    });
  }, [logs, level, query]);

  const handleDownloadLogs = () => {
    setIsLoading(true);
    try {
      const logText = filteredLogs
        .map((log) => `[${moment(log.timestamp).format("YYYY-MM-DD HH:mm:ss")}] ${log.level.toUpperCase()}: ${log.message}`)
        .join("\n");
      const blob = new Blob([logText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `container-${containerId}-logs-${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Logs downloaded successfully");
    } catch (error) {
      toast.error("Failed to download logs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLogs = async () => {
    const logText = filteredLogs
      .map((log) => `[${moment(log.timestamp).format("YYYY-MM-DD HH:mm:ss")}] ${log.level.toUpperCase()}: ${log.message}`)
      .join("\n");
    
    if (!logText) {
      toast.info("No logs to copy");
      return;
    }

    try {
      await navigator.clipboard.writeText(logText);
      toast.success("Logs copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy logs");
    }
  };

  return (
    <Card>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack spacing={1}>
          {/* Compact Toolbar */}
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Live Logs
            </Typography>
            <Chip 
              label={`${filteredLogs.length} total`} 
              size="small" 
              color="primary" 
              variant="outlined" 
            />
            <Chip 
              label={`⚠ ${severityCounters.warn}`} 
              size="small" 
              color="warning" 
              variant="outlined" 
            />
            <Chip 
              label={`✕ ${severityCounters.error}`} 
              size="small" 
              color="error" 
              variant="outlined" 
            />
            <Box flex={1} />
            <Tooltip title={filtersExpanded ? "Hide filters" : "Show filters"}>
              <IconButton 
                size="small" 
                onClick={() => setFiltersExpanded(!filtersExpanded)}
              >
                {filtersExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={isExpanded ? "Collapse" : "Expand"}>
              <IconButton size="small" onClick={() => setIsExpanded(!isExpanded)}>
                {isExpanded ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title={isStreaming ? "Pause streaming" : "Start streaming"}>
              <IconButton 
                size="small" 
                color={isStreaming ? "warning" : "default"}
                onClick={toggleStreaming}
              >
                {isStreaming ? <PauseCircleOutlineIcon fontSize="small" /> : <PlayCircleOutlineIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Copy visible logs">
              <IconButton size="small" onClick={handleCopyLogs}>
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Download logs">
              <IconButton size="small" onClick={handleDownloadLogs} disabled={isLoading}>
                {isLoading ? <CircularProgress size={16} /> : <DownloadIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          </Stack>

          {/* Collapsible Filters */}
          <Collapse in={filtersExpanded}>
            <Stack 
              direction="row" 
              spacing={1} 
              sx={{ 
                pt: 1,
                pb: 0.5
              }}
            >
              <CompactSearchField
                {...register("query")}
                placeholder="Search logs..."
                size="small"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  )
                }}
              />
              <Controller
                control={control}
                name="level"
                render={({ field }) => (
                  <CompactLevelField
                    select
                    size="small"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <FilterAltIcon fontSize="small" />
                        </InputAdornment>
                      )
                    }}
                    {...field}
                  >
                    {logLevels.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </CompactLevelField>
                )}
              />
            </Stack>
          </Collapse>

          <Divider />

          {/* Log Content */}
          <LogViewport $isExpanded={isExpanded}>
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <LogLine key={log.id} $level={log.level}>
                  <Typography 
                    variant="caption" 
                    color="text.secondary" 
                    sx={{ fontSize: "0.75rem", display: "block", mb: 0.25 }}
                  >
                    {moment(log.timestamp).format("HH:mm:ss")} · {log.level.toUpperCase()}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      wordBreak: "break-word", 
                      fontSize: "0.8125rem",
                      whiteSpace: "pre-wrap"
                    }}
                  >
                    {log.message}
                  </Typography>
                </LogLine>
              ))
            ) : (
              <Box 
                sx={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  height: "100%",
                  minHeight: 200
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {logs.length === 0 ? "No logs available" : "No logs match your filters"}
                </Typography>
              </Box>
            )}
          </LogViewport>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default LogViewer;
