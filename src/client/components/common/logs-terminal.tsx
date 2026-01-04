"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import type { DockerLogEntry } from "@/types/docker";

const SCROLL_THRESHOLD = 2;

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const cleanHex = hex.replace("#", "");
  const r = parseInt(cleanHex.substring(0, 2), 16);
  const g = parseInt(cleanHex.substring(2, 4), 16);
  const b = parseInt(cleanHex.substring(4, 6), 16);
  return { r, g, b };
};

const colorizeLine = (line: string, hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return `\u001b[38;2;${r};${g};${b}m${line}\u001b[0m`;
};

interface LogsTerminalProps {
  logs: DockerLogEntry[];
  autoScroll: boolean;
  onAutoScrollChange?: (next: boolean) => void;
  scrollToBottomSignal?: number;
  minHeight?: number;
  sx?: SxProps<Theme>;
}

const LogsTerminal = ({
  logs,
  autoScroll,
  onAutoScrollChange,
  scrollToBottomSignal,
  minHeight = 220,
  sx
}: LogsTerminalProps) => {
  const theme = useTheme();
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const autoScrollRef = useRef(autoScroll);
  const onAutoScrollChangeRef = useRef(onAutoScrollChange);

  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  useEffect(() => {
    onAutoScrollChangeRef.current = onAutoScrollChange;
  }, [onAutoScrollChange]);

  const terminalTheme = useMemo(
    () => ({
      background: theme.palette.mode === "dark" ? "#050B1A" : "#f8fafc",
      foreground: theme.palette.mode === "dark" ? "#e6edf3" : "#0f172a",
      cursor: theme.palette.mode === "dark" ? "#7ee787" : "#1f6feb",
      selectionBackground: theme.palette.mode === "dark" ? "rgba(126, 231, 135, 0.3)" : "rgba(31, 111, 235, 0.25)"
    }),
    [theme.palette.mode]
  );

  const levelColors = useMemo(
    () => ({
      info: terminalTheme.foreground,
      warn: theme.palette.warning.main,
      error: theme.palette.error.main
    }),
    [terminalTheme.foreground, theme.palette.error.main, theme.palette.warning.main]
  );

  const buildOutput = useCallback(
    (entries: DockerLogEntry[]) => {
      const lines: string[] = [];
      entries.forEach((log) => {
        const color = levelColors[log.level] ?? levelColors.info;
        const message = String(log.message ?? "");
        const messageLines = message.split(/\r?\n/);
        messageLines.forEach((line) => {
          lines.push(colorizeLine(line, color));
        });
      });
      return lines.join("\r\n");
    },
    [levelColors]
  );

  useEffect(() => {
    if (!terminalContainerRef.current || terminalRef.current) {
      return;
    }

    const terminal = new Terminal({
      fontSize: 12,
      fontFamily:
        'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      cursorBlink: false,
      scrollback: 10_000,
      disableStdin: true,
      theme: terminalTheme
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalContainerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(terminalContainerRef.current);

    const scrollDisposable = terminal.onScroll((position) => {
      const buffer = terminal.buffer.active;
      const bottom = Math.max(0, buffer.length - terminal.rows);
      const isNearBottom = position >= bottom - SCROLL_THRESHOLD;
      const isFollowing = autoScrollRef.current;
      if (isNearBottom && !isFollowing) {
        onAutoScrollChangeRef.current?.(true);
      } else if (!isNearBottom && isFollowing) {
        onAutoScrollChangeRef.current?.(false);
      }
    });

    return () => {
      scrollDisposable.dispose();
      resizeObserver.disconnect();
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, [terminalTheme]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.setOption("theme", terminalTheme);
    }
  }, [terminalTheme]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) {
      return;
    }
    terminal.reset();
    const output = buildOutput(logs);
    if (output) {
      terminal.write(output);
    }
    if (autoScroll) {
      terminal.scrollToBottom();
    }
  }, [autoScroll, buildOutput, logs]);

  useEffect(() => {
    if (!terminalRef.current) {
      return;
    }
    terminalRef.current.scrollToBottom();
  }, [scrollToBottomSignal]);

  return (
    <Box
      ref={terminalContainerRef}
      sx={{
        width: "100%",
        height: "100%",
        minHeight,
        borderRadius: 1,
        overflow: "hidden",
        backgroundColor: terminalTheme.background,
        px: 1.5,
        py: 1,
        ...sx
      }}
    />
  );
};

export default LogsTerminal;
