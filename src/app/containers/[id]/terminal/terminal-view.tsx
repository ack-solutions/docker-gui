"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import { useRouter } from "next/navigation";

import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

import { AuthGuard, PageShell } from "@/components";
import { getTokens, type PublicUser } from "@/lib/v2/auth-client";

interface ServerMessage {
  kind: "meta" | "data" | "exit" | "error";
  data?: string;
  message?: string;
  code?: number | null;
}

type TerminalStatus = "connecting" | "connected" | "exited" | "error";

const SHELL_OPTIONS = [
  { value: "/bin/sh", label: "sh" },
  { value: "/bin/bash", label: "bash" },
  { value: "/bin/ash", label: "ash (alpine)" },
  { value: "/bin/zsh", label: "zsh" }
];

const TERMINAL_THEME = {
  background: "#0b0e14",
  foreground: "#d6deeb",
  cursor: "#d6deeb",
  cursorAccent: "#0b0e14",
  selectionBackground: "rgba(214, 222, 235, 0.3)",
  black: "#011627",
  red: "#ef5350",
  green: "#22da6e",
  yellow: "#addb67",
  blue: "#82aaff",
  magenta: "#c792ea",
  cyan: "#21c7a8",
  white: "#d6deeb",
  brightBlack: "#575656",
  brightRed: "#ef5350",
  brightGreen: "#22da6e",
  brightYellow: "#ffeb95",
  brightBlue: "#82aaff",
  brightMagenta: "#c792ea",
  brightCyan: "#7fdbca",
  brightWhite: "#ffffff"
};

function buildWsUrl(
  containerId: string,
  opts: { cmd: string; cols: number; rows: number }
): string | null {
  if (typeof window === "undefined") return null;
  const tokens = getTokens();
  if (!tokens) return null;
  const base = process.env.NEXT_PUBLIC_API_URL ?? window.location.origin;
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/api/v1/ws/exec/${encodeURIComponent(containerId)}`;
  url.searchParams.set("token", tokens.accessToken);
  url.searchParams.set("cmd", opts.cmd);
  url.searchParams.set("cols", String(opts.cols));
  url.searchParams.set("rows", String(opts.rows));
  return url.toString();
}

function TerminalInner({ user, containerId }: { user: PublicUser; containerId: string }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [shell, setShell] = useState<string>("/bin/sh");
  const [status, setStatus] = useState<TerminalStatus>("connecting");
  const [exitCode, setExitCode] = useState<number | null | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  // Mount xterm once. Cleanup on unmount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const term = new Terminal({
      cursorBlink: true,
      fontFamily:
        "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      fontSize: 13,
      lineHeight: 1.2,
      theme: TERMINAL_THEME,
      scrollback: 5000,
      convertEol: false,
      allowProposedApi: true
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon());
    term.open(el);
    try {
      fit.fit();
    } catch {
      // initial fit can fail before the layout settles; harmless
    }
    term.focus();

    termRef.current = term;
    fitRef.current = fit;

    const onResize = () => {
      try {
        fit.fit();
      } catch {
        // ignore
      }
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    window.addEventListener("resize", onResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // (Re)connect whenever shell or generation changes.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;

    setExitCode(undefined);
    setErrorMessage(null);
    setStatus("connecting");
    term.clear();
    term.writeln(
      `\x1b[90mconnecting to ${containerId.slice(0, 12)} (${shell})…\x1b[0m`
    );

    const cols = Math.max(term.cols, 1);
    const rows = Math.max(term.rows, 1);
    const url = buildWsUrl(containerId, { cmd: shell, cols, rows });
    if (!url) {
      setErrorMessage("Not authenticated");
      setStatus("error");
      return;
    }
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setStatus("connected");
    ws.onmessage = (e) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(typeof e.data === "string" ? e.data : "") as ServerMessage;
      } catch {
        return;
      }
      if (parsed.kind === "data" && parsed.data !== undefined) {
        term.write(parsed.data);
        return;
      }
      if (parsed.kind === "exit") {
        setExitCode(parsed.code ?? null);
        setStatus("exited");
        term.writeln(
          `\r\n\x1b[90m── process exited (code: ${parsed.code ?? "n/a"}) ──\x1b[0m`
        );
        return;
      }
      if (parsed.kind === "error" && parsed.message) {
        setErrorMessage(parsed.message);
        setStatus("error");
        term.writeln(`\r\n\x1b[31merror: ${parsed.message}\x1b[0m`);
        return;
      }
    };
    ws.onerror = () => {
      setErrorMessage("WebSocket connection error");
      setStatus("error");
    };
    ws.onclose = () => {
      setStatus((s) => (s === "exited" || s === "error" ? s : "exited"));
    };

    const dataDisposable = term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ kind: "input", data }));
      }
    });
    const resizeDisposable = term.onResize(({ cols: c, rows: r }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ kind: "resize", cols: c, rows: r }));
      }
    });

    return () => {
      dataDisposable.dispose();
      resizeDisposable.dispose();
      if (ws.readyState <= 1) ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, shell, generation]);

  const reconnect = useCallback(() => {
    setGeneration((g) => g + 1);
  }, []);

  const subtitle = (
    <>
      Interactive shell · {shell} ·{" "}
      <Chip
        size="small"
        label={
          status === "connected"
            ? "connected"
            : status === "connecting"
              ? "connecting"
              : status === "exited"
                ? `exited${exitCode !== undefined && exitCode !== null ? ` (${exitCode})` : ""}`
                : "error"
        }
        color={
          status === "connected"
            ? "success"
            : status === "error"
              ? "error"
              : status === "exited"
                ? "default"
                : "info"
        }
        sx={{ ml: 0.5 }}
      />
    </>
  );

  return (
    <PageShell
      title={`Terminal · ${containerId.slice(0, 12)}`}
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
          <TextField
            select
            size="small"
            value={shell}
            onChange={(e) => setShell(e.target.value)}
            sx={{ minWidth: 160 }}
            disabled={status === "connecting" || status === "connected"}
          >
            {SHELL_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <Button
            size="small"
            variant={status === "exited" || status === "error" ? "contained" : "outlined"}
            startIcon={<RestartAltIcon />}
            onClick={reconnect}
          >
            {status === "exited" || status === "error" ? "Reconnect" : "Restart"}
          </Button>
        </>
      }
    >
      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErrorMessage(null)}>
          {errorMessage}
        </Alert>
      )}

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
        <Chip size="small" label="Tip: Ctrl+D or `exit` ends the session" variant="outlined" />
        <Chip
          size="small"
          label="Resize the window — terminal follows"
          variant="outlined"
        />
      </Stack>

      <Box
        ref={containerRef}
        sx={{
          height: "70vh",
          width: "100%",
          bgcolor: TERMINAL_THEME.background,
          borderRadius: 1,
          p: 1,
          overflow: "hidden",
          // xterm sets these on its own canvas, but we mirror to keep the
          // padding area looking right when the terminal hasn't filled.
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
        }}
      />
    </PageShell>
  );
}

export default function TerminalView({ containerId }: { containerId: string }) {
  return <AuthGuard>{(user) => <TerminalInner user={user} containerId={containerId} />}</AuthGuard>;
}
