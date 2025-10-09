"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import { executeContainerCommand } from "@/lib/api/docker";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";

export interface ContainerShellTerminalProps {
  containerId: string;
  containerName?: string;
  minHeight?: number;
  fitParent?: boolean;
  onLastOutputChange?: (output: string | null) => void;
}

const parseCommand = (input: string) =>
  (input.match(/(?:"[^"]*"|'[^']*'|[^\s"']+)/g) ?? []).map((token) => token.replace(/^['"]|['"]$/g, ""));

const ContainerShellTerminal = ({
  containerId,
  containerName,
  minHeight = 320,
  fitParent = false,
  onLastOutputChange
}: ContainerShellTerminalProps) => {
  const theme = useTheme();
  const { data: containers } = useContainers();
  const container = useMemo(
    () => containers?.find((entry) => entry.id === containerId),
    [containers, containerId]
  );

  const resolvedName = containerName ?? container?.name ?? "container";

  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const bufferRef = useRef<string>("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(0);
  const promptRef = useRef<string>("");
  const initializedRef = useRef(false);
  const lastOutputRef = useRef<string | null>(null);

  const promptLabel = useMemo(() => `root@${resolvedName}:/app`, [resolvedName]);

  const notifyOutput = useCallback(
    (output: string | null) => {
      lastOutputRef.current = output;
      onLastOutputChange?.(output);
    },
    [onLastOutputChange]
  );

  const writePrompt = useCallback(
    (newLine = true) => {
      const term = terminalRef.current;
      if (!term) return;
      const prompt = `${promptLabel}#`;
      promptRef.current = prompt;
      bufferRef.current = "";
      term.write(`${newLine ? "\r\n" : ""}${prompt} `);
    },
    [promptLabel]
  );

  const replaceLine = useCallback((text: string) => {
    const term = terminalRef.current;
    if (!term) return;
    term.write(`\u001b[2K\r${promptRef.current} ${text}`);
    bufferRef.current = text;
  }, []);

  const runCommand = useCallback(
    async (line: string) => {
      const term = terminalRef.current;
      if (!term) return;

      if (!line) {
        writePrompt();
        return;
      }

      if (line === "clear") {
        term.clear();
        writePrompt(false);
        return;
      }

      try {
        const tokens = parseCommand(line);
        if (tokens.length === 0) {
          writePrompt();
          return;
        }
        const output = await executeContainerCommand(containerId, tokens);
        const formatted = output?.trim() ?? "";
        if (formatted) {
          term.writeln(formatted.replace(/\n/g, "\r\n"));
          notifyOutput(formatted);
        } else {
          notifyOutput(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        term.writeln(`Error: ${message}`);
        notifyOutput(message);
      }

      writePrompt();
    },
    [containerId, notifyOutput, writePrompt]
  );

  useEffect(() => {
    if (!terminalContainerRef.current || initializedRef.current) {
      return;
    }

    const term = new Terminal({
      fontSize: 13,
      fontFamily:
        'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      cursorBlink: true,
      theme: {
        background: theme.palette.mode === "dark" ? "#050B1A" : "#f8fafc",
        foreground: theme.palette.text.primary,
        cursor: theme.palette.primary.main,
        selectionBackground: theme.palette.primary.main
      }
    });

    terminalRef.current = term;
    term.open(terminalContainerRef.current);
    term.writeln(`Welcome to the container shell. Connected to ${resolvedName}.`);
    writePrompt(false);

    const handleResize = () => {
      try {
        const width = terminalContainerRef.current?.offsetWidth ?? 640;
        term.resize(Math.max(80, Math.floor(width / 8)), 24);
      } catch {
        // ignore
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);

    const handleData = (data: string) => {
      const termInstance = terminalRef.current;
      if (!termInstance) {
        return;
      }

      switch (data) {
        case "\u0003":
          termInstance.write("^C");
          writePrompt();
          break;
        case "\u007F": {
          if (bufferRef.current.length > 0) {
            bufferRef.current = bufferRef.current.slice(0, -1);
            termInstance.write("\b \b");
          }
          break;
        }
        case "\r": {
          const line = bufferRef.current;
          termInstance.write("\r\n");
          if (line.trim()) {
            historyRef.current.push(line);
          }
          historyIndexRef.current = historyRef.current.length;
          runCommand(line.trim());
          break;
        }
        case "\u001b[A": {
          if (historyRef.current.length === 0) return;
          historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
          const historyLine = historyRef.current[historyIndexRef.current] ?? "";
          replaceLine(historyLine);
          break;
        }
        case "\u001b[B": {
          if (historyRef.current.length === 0) return;
          historyIndexRef.current = Math.min(historyRef.current.length, historyIndexRef.current + 1);
          const historyLine = historyRef.current[historyIndexRef.current] ?? "";
          replaceLine(historyLine);
          break;
        }
        default: {
          if (data >= " " && data <= "~") {
            bufferRef.current += data;
            termInstance.write(data);
          }
          break;
        }
      }
    };

    term.onData(handleData);
    initializedRef.current = true;

    return () => {
      window.removeEventListener("resize", handleResize);
      term.dispose();
      terminalRef.current = null;
      initializedRef.current = false;
    };
  }, [resolvedName, runCommand, theme.palette.mode, theme.palette.primary.main, theme.palette.text.primary, replaceLine, writePrompt]);

  useEffect(() => {
    if (initializedRef.current) {
      writePrompt();
    }
  }, [promptLabel, writePrompt]);

  return (
    <Box
      ref={terminalContainerRef}
      sx={{
        width: "100%",
        height: fitParent ? "100%" : { xs: minHeight, md: minHeight + 60 },
        borderRadius: 1,
        overflow: "hidden",
        backgroundColor: theme.palette.mode === "dark" ? "#050B1A" : "#f8fafc",
        px: 1,
        pt: 1
      }}
    />
  );
};

export default ContainerShellTerminal;
