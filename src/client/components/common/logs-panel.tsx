"use client";

import { useMemo, useState } from "react";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import { Box, Chip, Divider, IconButton, InputAdornment, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import moment from "moment";
import { Controller, useForm } from "react-hook-form";
import { useLogs } from "@/features/docker/logs/hooks/use-logs";

const SearchField = styled(TextField)({
  minWidth: 200
});

const LevelField = styled(TextField)({
  minWidth: 120
});

const LogViewport = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: "auto",
  backgroundColor: theme.palette.mode === "dark" ? "rgba(15, 23, 42, 0.6)" : theme.palette.grey[50],
  padding: theme.spacing(2)
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
    paddingLeft: theme.spacing(2)
  };
});

const logLevels = [
  { label: "All levels", value: "all" },
  { label: "Info", value: "info" },
  { label: "Warnings", value: "warn" },
  { label: "Errors", value: "error" }
] as const;

type LogLevel = (typeof logLevels)[number]["value"];

interface LogFilterForm {
  query: string;
  level: LogLevel;
}

interface LogsPanelProps {
  containerId: string;
  containerName?: string;
}

export const LogsPanel = ({ containerId, containerName }: LogsPanelProps) => {
  const { logs, isStreaming, toggleStreaming, severityCounters } = useLogs({ containerId });
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
  };

  return (
    <Stack spacing={2} sx={{ height: "100%", p: 2 }}>
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <SearchField
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
            <LevelField
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
            </LevelField>
          )}
        />
        <Chip label={`Info: ${severityCounters.info}`} size="small" color="primary" variant="outlined" />
        <Chip label={`Warnings: ${severityCounters.warn}`} size="small" color="warning" variant="outlined" />
        <Chip label={`Errors: ${severityCounters.error}`} size="small" color="error" variant="outlined" />
        <Box flex={1} />
        <IconButton 
          size="small" 
          color={isStreaming ? "warning" : "primary"}
          onClick={toggleStreaming}
          title={isStreaming ? "Pause streaming" : "Start streaming"}
        >
          {isStreaming ? <PauseCircleOutlineIcon fontSize="small" /> : <PlayCircleOutlineIcon fontSize="small" />}
        </IconButton>
        <IconButton size="small" onClick={handleDownloadLogs} title="Download logs">
          <DownloadIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Divider />
      <LogViewport>
        <Stack spacing={1.5}>
          {filteredLogs.map((log) => (
            <LogLine key={log.id} $level={log.level}>
              <Typography variant="caption" color="text.secondary">
                {moment(log.timestamp).format("HH:mm:ss")} · {log.level.toUpperCase()}
              </Typography>
              <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                {log.message}
              </Typography>
            </LogLine>
          ))}
          {filteredLogs.length === 0 && (
            <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 4 }}>
              No logs match your current filters.
            </Typography>
          )}
        </Stack>
      </LogViewport>
    </Stack>
  );
};

export default LogsPanel;
