"use client";

import { useMemo } from "react";
import FilterAltIcon from "@mui/icons-material/FilterAlt";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import { Box, Button, Chip, Divider, InputAdornment, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import moment from "moment";
import { Controller, useForm } from "react-hook-form";
import { useLogs } from "@/features/logs/hooks/useLogs";

const LogPanel = styled(Paper)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  height: "100%"
}));

const SearchField = styled(TextField)(({ theme }) => ({
  minWidth: 220,
  [theme.breakpoints.down("md")]: {
    width: "100%"
  }
}));

const LevelField = styled(TextField)(({ theme }) => ({
  minWidth: 180
}));

const LogViewport = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: "auto",
  backgroundColor: theme.palette.mode === "dark" ? "rgba(15, 23, 42, 0.6)" : theme.palette.grey[50],
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  maxHeight: 480,
  border: `1px solid ${theme.palette.divider}`
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

interface LogViewerProps {
  containerId: string;
}

interface LogFilterForm {
  query: string;
  level: LogLevel;
}

const LogViewer = ({ containerId }: LogViewerProps) => {
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

  return (
    <LogPanel>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
        <Typography variant="h6" flex={1}>
          Live Logs
        </Typography>
        <SearchField
          {...register("query")}
          placeholder="Search log output"
          size="small"
        />
        <Controller
          control={control}
          name="level"
          render={({ field }) => (
            <LevelField
              select
              size="small"
              label="Level"
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
      <LogViewport>
        <Stack spacing={1.5}>
          {filteredLogs.map((log) => (
            <LogLine key={log.id} $level={log.level}>
              <Typography variant="caption" color="text.secondary">
                {moment(log.timestamp).format("HH:mm:ss")} · {log.level.toUpperCase()}
              </Typography>
              <Typography variant="body2">{log.message}</Typography>
            </LogLine>
          ))}
          {filteredLogs.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No logs match your current filters.
            </Typography>
          )}
        </Stack>
      </LogViewport>
    </LogPanel>
  );
};

export default LogViewer;
