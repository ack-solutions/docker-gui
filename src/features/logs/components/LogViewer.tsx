"use client";

import { useMemo, useState } from "react";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import { Box, Button, Chip, Divider, InputAdornment, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useLogs } from "@/features/logs/hooks/useLogs";

dayjs.extend(relativeTime);

const logLevels = [
  { label: "All levels", value: "all" },
  { label: "Info", value: "info" },
  { label: "Warnings", value: "warn" },
  { label: "Errors", value: "error" }
] as const;

type LogLevel = (typeof logLevels)[number]["value"];

interface LogViewerProps {
  containerId: string;
}

const LogViewer = ({ containerId }: LogViewerProps) => {
  const { logs, isStreaming, toggleStreaming, severityCounters } = useLogs({ containerId });
  const [level, setLevel] = useState<LogLevel>("all");
  const [query, setQuery] = useState("");

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesLevel = level === "all" || log.level === level;
      const matchesQuery = !query || log.message.toLowerCase().includes(query.toLowerCase());
      return matchesLevel && matchesQuery;
    });
  }, [logs, level, query]);

  return (
    <Paper sx={{ p: 3, borderRadius: 3, display: "flex", flexDirection: "column", gap: 2, height: "100%" }}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
        <Typography variant="h6" sx={{ flex: 1 }}>
          Live Logs
        </Typography>
        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search log output"
          size="small"
          sx={{ minWidth: 220 }}
        />
        <TextField
          select
          size="small"
          label="Level"
          value={level}
          onChange={(event) => setLevel(event.target.value as LogLevel)}
          sx={{ minWidth: 180 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FilterAltIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        >
          {logLevels.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
        <Button
          variant={isStreaming ? "outlined" : "contained"}
          color={isStreaming ? "warning" : "primary"}
          startIcon={isStreaming ? <PauseCircleOutlineIcon /> : <PlayCircleOutlineIcon />}
          onClick={toggleStreaming}
        >
          {isStreaming ? "Pause" : "Follow"}
        </Button>
      </Stack>
      <Stack direction="row" spacing={1}>
        <Chip label={`Info ${severityCounters.info}`} size="small" color="primary" variant="outlined" />
        <Chip label={`Warnings ${severityCounters.warn}`} size="small" color="warning" variant="outlined" />
        <Chip label={`Errors ${severityCounters.error}`} size="small" color="error" variant="outlined" />
      </Stack>
      <Divider />
      <Box
        sx={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "rgba(15, 23, 42, 0.6)",
          borderRadius: 2,
          p: 2,
          maxHeight: 480,
          border: "1px solid rgba(148, 163, 184, 0.2)"
        }}
      >
        <Stack spacing={1.5}>
          {filteredLogs.map((log) => (
            <Box
              key={log.id}
              sx={{
                borderLeft: `3px solid ${
                  log.level === "error"
                    ? "#f87171"
                    : log.level === "warn"
                      ? "#fbbf24"
                      : "#38bdf8"
                }`,
                pl: 2
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {dayjs(log.timestamp).format("HH:mm:ss")} · {log.level.toUpperCase()}
              </Typography>
              <Typography variant="body2">{log.message}</Typography>
            </Box>
          ))}
          {filteredLogs.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No logs match your current filters.
            </Typography>
          )}
        </Stack>
      </Box>
    </Paper>
  );
};

export default LogViewer;
