"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { getTokens, type PublicUser } from "@/lib/v2/auth-client";

interface LogMessage {
  kind: "meta" | "log" | "error";
  stream?: "stdout" | "stderr";
  text?: string;
  message?: string;
}

interface LogLine {
  id: number;
  stream: "stdout" | "stderr";
  text: string;
}

const MAX_LINES = 5000;

function buildWsUrl(containerId: string, tail: number): string | null {
  if (typeof window === "undefined") return null;
  const tokens = getTokens();
  if (!tokens) return null;
  const base = process.env.NEXT_PUBLIC_API_URL ?? window.location.origin;
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/api/v1/ws/logs/${encodeURIComponent(containerId)}`;
  url.searchParams.set("token", tokens.accessToken);
  url.searchParams.set("tail", String(tail));
  return url.toString();
}

function LiveLogsInner({ user, containerId }: { user: PublicUser; containerId: string }) {
  const router = useRouter();
  const [lines, setLines] = useState<LogLine[]>([]);
  const [paused, setPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "ended" | "error" | "closed"
  >("connecting");
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const idRef = useRef(0);
  const pausedRef = useRef(false);
  const bufferedRef = useRef<LogLine[]>([]);
  pausedRef.current = paused;

  const connect = useCallback(() => {
    const url = buildWsUrl(containerId, 200);
    if (!url) {
      setError("Not authenticated");
      setStatus("error");
      return;
    }
    setStatus("connecting");
    const ws = new WebSocket(url);
    wsRef.current = ws;
    ws.onopen = () => setStatus("connected");
    ws.onmessage = (e) => {
      let parsed: LogMessage;
      try {
        parsed = JSON.parse(typeof e.data === "string" ? e.data : "") as LogMessage;
      } catch {
        return;
      }
      if (parsed.kind === "error" && parsed.message) {
        setError(parsed.message);
        setStatus("error");
        return;
      }
      if (parsed.kind === "log" && parsed.text !== undefined) {
        const stream = parsed.stream ?? "stdout";
        const text = parsed.text;
        for (const segment of text.split(/\r?\n/)) {
          if (!segment && text.endsWith("\n") === false) {
            // skip empty trailing pieces from a chunk that didn't contain a newline
            continue;
          }
          const line: LogLine = { id: ++idRef.current, stream, text: segment };
          if (pausedRef.current) {
            bufferedRef.current.push(line);
            if (bufferedRef.current.length > MAX_LINES) {
              bufferedRef.current.splice(0, bufferedRef.current.length - MAX_LINES);
            }
          } else {
            setLines((prev) => {
              const next = prev.length >= MAX_LINES ? prev.slice(prev.length - MAX_LINES + 1) : prev.slice();
              next.push(line);
              return next;
            });
          }
        }
      }
      if (parsed.kind === "meta" && parsed.message === "stream ended") {
        setStatus("ended");
      }
    };
    ws.onerror = () => {
      setStatus("error");
      setError("WebSocket error");
    };
    ws.onclose = () => {
      setStatus((s) => (s === "ended" ? "ended" : s === "error" ? "error" : "closed"));
    };
  }, [containerId]);

  useEffect(() => {
    connect();
    return () => {
      const ws = wsRef.current;
      if (ws && ws.readyState <= 1) ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  // When unpausing, flush buffered lines into the visible list.
  useEffect(() => {
    if (paused) return;
    if (bufferedRef.current.length === 0) return;
    const flushed = bufferedRef.current;
    bufferedRef.current = [];
    setLines((prev) => {
      const merged = prev.concat(flushed);
      return merged.length > MAX_LINES ? merged.slice(merged.length - MAX_LINES) : merged;
    });
  }, [paused]);

  // Auto-scroll on new lines.
  useEffect(() => {
    if (!autoScroll) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, autoScroll]);

  const reconnect = useCallback(() => {
    setError(null);
    setLines([]);
    bufferedRef.current = [];
    const ws = wsRef.current;
    if (ws && ws.readyState <= 1) ws.close();
    connect();
  }, [connect]);

  const counts = useMemo(() => {
    let stdout = 0;
    let stderr = 0;
    for (const l of lines) {
      if (l.stream === "stderr") stderr += 1;
      else stdout += 1;
    }
    return { stdout, stderr };
  }, [lines]);

  const subtitle = (
    <>
      {counts.stdout} stdout · {counts.stderr} stderr · capped at {MAX_LINES.toLocaleString()} lines ·{" "}
      <Chip
        size="small"
        label={status}
        color={
          status === "connected"
            ? "success"
            : status === "error"
              ? "error"
              : status === "ended"
                ? "default"
                : "info"
        }
        sx={{ ml: 0.5 }}
      />
    </>
  );

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
              <IconButton size="small" onClick={() => setLines([])}>
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
          {(status === "ended" || status === "error" || status === "closed") && (
            <Button size="small" variant="contained" onClick={reconnect}>
              Reconnect
            </Button>
          )}
        </>
      }
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={autoScroll}
              onChange={(_, v) => setAutoScroll(v)}
            />
          }
          label="Auto-scroll"
        />
        {paused && bufferedRef.current.length > 0 && (
          <Typography variant="caption" color="text.secondary">
            {bufferedRef.current.length} new line{bufferedRef.current.length === 1 ? "" : "s"} buffered
          </Typography>
        )}
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
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
            <Box
              key={l.id}
              component="div"
              sx={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                color: l.stream === "stderr" ? "#ff8a93" : "#d6deeb"
              }}
            >
              {l.text}
            </Box>
          ))
        )}
      </Box>
    </PageShell>
  );
}

export default function LiveLogsView({ containerId }: { containerId: string }) {
  return <AuthGuard>{(user) => <LiveLogsInner user={user} containerId={containerId} />}</AuthGuard>;
}
