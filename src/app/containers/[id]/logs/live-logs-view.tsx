"use client";

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Stack,
  Switch,
  Tooltip,
  Typography,
  FormControlLabel
} from "@mui/material";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useRouter } from "next/navigation";
import { AuthGuard, PageShell } from "@/components";
import {
  useContainerLogStream,
  type LogStreamStatus
} from "@/lib/v2/use-container-log-stream";
import { type PublicUser } from "@/lib/v2/auth-client";

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

function LiveLogsInner({ user, containerId }: { user: PublicUser; containerId: string }) {
  const router = useRouter();
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const { lines, status, error, paused, bufferedCount, counts, setPaused, clear, reconnect } =
    useContainerLogStream(containerId, { maxLines: 5000, enabled: true });

  // Auto-scroll on new lines.
  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, autoScroll]);

  const subtitle = (
    <>
      {counts.stdout} stdout · {counts.stderr} stderr · capped at 5,000 lines ·{" "}
      <Chip size="small" label={status} color={statusColor(status)} sx={{ ml: 0.5 }} />
    </>
  );

  const canReconnect = status === "ended" || status === "error" || status === "closed" || status === "auth-expired";

  return (
    <PageShell
      title={`Live logs · ${containerId.slice(0, 12)}`}
      subtitle={subtitle}
      user={user}
      actions={
        <>
          <Tooltip title="Back to containers">
            <span>
              <IconButton size="small" onClick={() => router.push("/containers")}>
                <ArrowBackIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Clear">
            <span>
              <IconButton size="small" onClick={clear}>
                <DeleteSweepIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Button
            size="small"
            variant="outlined"
            startIcon={paused ? <PlayCircleOutlineIcon /> : <PauseCircleOutlineIcon />}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? "Resume" : "Pause"}
          </Button>
          {canReconnect && (
            <Button size="small" variant="contained" onClick={reconnect}>
              Reconnect
            </Button>
          )}
        </>
      }
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <FormControlLabel
          control={<Switch size="small" checked={autoScroll} onChange={(_, v) => setAutoScroll(v)} />}
          label="Auto-scroll"
        />
        {paused && bufferedCount > 0 && (
          <Typography variant="caption" color="text.secondary">
            {bufferedCount} new line{bufferedCount === 1 ? "" : "s"} buffered
          </Typography>
        )}
      </Stack>

      {error && (
        <Alert severity={status === "auth-expired" ? "warning" : "error"} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box
        ref={scrollRef}
        sx={{
          height: "70vh",
          overflowY: "auto",
          bgcolor: "#0b0e14",
          color: "#d6deeb",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          fontSize: 12.5,
          lineHeight: 1.45,
          px: 1.5,
          py: 1,
          borderRadius: 1
        }}
      >
        {lines.length === 0 ? (
          <Typography variant="caption" sx={{ color: "rgba(214,222,235,0.55)" }}>
            {status === "connecting"
              ? "Connecting…"
              : status === "ended"
                ? "Stream ended."
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
    </PageShell>
  );
}

export default function LiveLogsView({ containerId }: { containerId: string }) {
  return <AuthGuard>{(user) => <LiveLogsInner user={user} containerId={containerId} />}</AuthGuard>;
}
