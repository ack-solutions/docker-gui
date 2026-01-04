"use client";

import { useMemo, useState, useCallback, useRef, useEffect } from "react";
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
import type { DockerLogEntry } from "@/types/docker";

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
  minHeight: 0, // Important for flex scrolling
  overflow: "auto",
  backgroundColor: theme.palette.mode === "dark" ? "#050B1A" : "#f8fafc",
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(1.5),
  border: `1px solid ${theme.palette.divider}`,
  fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSize: "0.8125rem",
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  userSelect: "text",
  "&::-webkit-scrollbar": {
    width: "8px",
    height: "8px"
  },
  "&::-webkit-scrollbar-track": {
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"
  },
  "&::-webkit-scrollbar-thumb": {
    backgroundColor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
    borderRadius: "4px",
    "&:hover": {
      backgroundColor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.3)" : "rgba(0, 0, 0, 0.3)"
    }
  }
}));

const LogLine = styled(Typography, {
  shouldForwardProp: (prop) => prop !== "$level"
})<{ $level: "info" | "warn" | "error" }>(({ theme, $level }) => {
  const colors = {
    error: theme.palette.error.main,
    warn: theme.palette.warning.main,
    info: theme.palette.text.primary
  } as const;

  return {
    color: colors[$level],
    margin: 0,
    padding: 0,
    fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: "0.8125rem",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word"
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
  const [autoScroll, setAutoScroll] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { control, register, watch } = useForm<LogFilterForm>({
    defaultValues: {
      query: "",
      level: "all"
    }
  });

  const level = watch("level");
  const query = watch("query");

  // Auto-start streaming on mount
  useEffect(() => {
    if (!isStreaming) {
      toggleStreaming();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]); // Only auto-start when container changes

  // Filter and sort logs chronologically (oldest to newest for terminal-like display)
  const filteredLogs = useMemo(() => {
    const filtered = logs.filter((log) => {
      const matchesLevel = level === "all" || log.level === level;
      const matchesQuery = !query || log.message.toLowerCase().includes(query.toLowerCase());
      return matchesLevel && matchesQuery;
    });
    
    // Sort chronologically (oldest first) for terminal-like continuous output
    return filtered.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [logs, level, query]);

  // Check if user is near bottom of scroll
  const isNearBottom = useCallback((element: HTMLElement, threshold = 100) => {
    const { scrollTop, scrollHeight, clientHeight } = element;
    return scrollHeight - scrollTop - clientHeight < threshold;
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback((smooth = false) => {
    if (viewportRef.current) {
      viewportRef.current.scrollTo({
        top: viewportRef.current.scrollHeight,
        behavior: smooth ? "smooth" : "auto"
      });
    }
  }, []);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    if (!viewportRef.current) return;

    const nearBottom = isNearBottom(viewportRef.current);
    
    if (nearBottom) {
      // User is at bottom, enable auto-scroll
      setAutoScroll(true);
      isUserScrollingRef.current = false;
    } else {
      // User scrolled up, disable auto-scroll
      if (autoScroll) {
        setAutoScroll(false);
        isUserScrollingRef.current = true;
      }
    }

    // Clear existing timeout
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    // Set a timeout to detect when user stops scrolling
    scrollTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 150);
  }, [autoScroll, isNearBottom]);

  // Auto-scroll when new logs arrive (if auto-scroll is enabled)
  useEffect(() => {
    if (autoScroll && !isUserScrollingRef.current && viewportRef.current) {
      // Check if we're already near bottom before scrolling
      if (isNearBottom(viewportRef.current, 200)) {
        // Use requestAnimationFrame for smooth scrolling
        requestAnimationFrame(() => {
          scrollToBottom(false);
        });
      }
    }
  }, [filteredLogs.length, autoScroll, scrollToBottom, isNearBottom]);

  // Reset auto-scroll when container changes
  useEffect(() => {
    setAutoScroll(true);
    setTimeout(() => {
      scrollToBottom(false);
    }, 100);
  }, [containerId, scrollToBottom]);

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
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 }, height: "100%", display: "flex", flexDirection: "column" }}>
        <Stack spacing={1} sx={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Compact Toolbar - Fixed */}
          <Stack 
            direction="row" 
            spacing={1} 
            alignItems="center" 
            flexWrap="wrap"
            sx={{ flexShrink: 0 }} // Prevent toolbar from shrinking
          >
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
            <Tooltip title={autoScroll ? "Auto-scroll enabled (scroll up to pause)" : "Auto-scroll paused (scroll to bottom to resume)"}>
              <Chip 
                label={autoScroll ? "Following" : "Paused"} 
                size="small" 
                color={autoScroll ? "success" : "default"}
                variant="outlined"
                sx={{ cursor: "pointer" }}
                onClick={() => {
                  setAutoScroll(true);
                  scrollToBottom(true);
                }}
              />
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

          {/* Collapsible Filters - Fixed */}
          <Collapse in={filtersExpanded}>
            <Stack 
              direction="row" 
              spacing={1} 
              sx={{ 
                pt: 1,
                pb: 0.5,
                flexShrink: 0 // Prevent filters from shrinking
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
          <LogViewport 
            ref={viewportRef}
            $isExpanded={isExpanded}
            onScroll={handleScroll}
          >
            {filteredLogs.length > 0 ? (
              filteredLogs.map((log) => (
                <LogLine key={log.id} $level={log.level} as="div">
                  {log.message}
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
