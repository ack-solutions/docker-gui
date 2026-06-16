"use client";

import { useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Tooltip,
  Typography
} from "@mui/material";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import {
  useContainerLogStream,
  type LogStreamStatus
} from "@/lib/v2/use-container-log-stream";

export interface LogStreamPanelProps {
  containerId: string;
  /** When false the underlying socket is closed (e.g. the drawer is collapsed). */
  enabled: boolean;
}

function statusColor(status: LogStreamStatus): "success" | "error" | "default" | "info" | "warning" {
  switch (status) {
    case "connected":
      return "success";
    case "error":
      return "error";
    case "auth-expired":
      return "warning";
    case "ended":
      return "default";
    default:
      return "info";
  }
}

const MONO =
  "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";

/**
 * Body of the docked log drawer. Owns a shared container-log stream (capped at
 * 1500 lines for the embedded view) and renders a compact control bar plus the
 * dark terminal box. Each line is a plain <div> (not a styled MUI Box) to keep
 * emotion off the hot path at 1500 nodes.
 */
export function LogStreamPanel({ containerId, enabled }: LogStreamPanelProps): JSX.Element {
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { lines, status, error, paused, bufferedCount, counts, setPaused, clear, reconnect } =
    useContainerLogStream(containerId, { maxLines: 1500, enabled });

  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines, autoScroll]);

  const canReconnect =
    status === "ended" || status === "error" || status === "closed" || status === "auth-expired";

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Control bar */}
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 2,
          py: 0.5,
          flexShrink: 0,
          borderBottom: 1,
          borderColor: "divider",
          flexWrap: "wrap"
        }}
      >
        <Chip size="small" label={status} color={statusColor(status)} />
        <Typography variant="caption" color="text.secondary">
          {counts.stdout} stdout · {counts.stderr} stderr
        </Typography>
        {paused && bufferedCount > 0 && (
          <Typography variant="caption" color="warning.main">
            {bufferedCount} buffered
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <FormControlLabel
          sx={{ mr: 0 }}
          control={<Switch size="small" checked={autoScroll} onChange={(_, v) => setAutoScroll(v)} />}
          label={<Typography variant="caption">Auto-scroll</Typography>}
        />
        <Button
          size="small"
          variant="outlined"
          startIcon={paused ? <PlayCircleOutlineIcon /> : <PauseCircleOutlineIcon />}
          onClick={() => setPaused((p) => !p)}
        >
          {paused ? "Resume" : "Pause"}
        </Button>
        <Tooltip title="Clear">
          <IconButton size="small" onClick={clear}>
            <DeleteSweepIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        {canReconnect && (
          <Button size="small" variant="contained" onClick={reconnect}>
            Reconnect
          </Button>
        )}
      </Stack>

      {error && (
        <Box
          sx={{
            px: 2,
            py: 0.5,
            flexShrink: 0,
            fontSize: 12,
            color: "#fff",
            bgcolor: status === "auth-expired" ? "warning.main" : "error.main"
          }}
        >
          {error}
        </Box>
      )}

      {/* Terminal */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          bgcolor: "#0b0e14",
          color: "#d6deeb",
          fontFamily: MONO,
          fontSize: 12.5,
          lineHeight: 1.45,
          px: 1.5,
          py: 1
        }}
      >
        {lines.length === 0 ? (
          <Typography variant="caption" sx={{ color: "rgba(214,222,235,0.55)" }}>
            {status === "connecting"
              ? "Connecting…"
              : status === "ended"
                ? "Stream ended."
                : !enabled
                  ? "Collapsed — expand to resume streaming."
                  : "Waiting for output…"}
          </Typography>
        ) : (
          lines.map((l) => (
            <div
              key={l.id}
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                color: l.stream === "stderr" ? "#ff8a93" : "#d6deeb"
              }}
            >
              {l.text}
            </div>
          ))
        )}
      </Box>
    </Box>
  );
}
