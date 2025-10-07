"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import TerminalIcon from "@mui/icons-material/Terminal";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Box, Button, Paper, Stack, Typography, useTheme } from "@mui/material";
import { useParams } from "next/navigation";
import { Terminal } from "@xterm/xterm";
import "@xterm/xterm/css/xterm.css";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { executeContainerCommand } from "@/lib/api/docker";
import { useContainers } from "@/features/containers/hooks/use-containers";

const parseCommand = (input: string) =>
  (input.match(/(?:"[^"]*"|[^\s"])+/g) ?? []).map((token) => token.replace(/^"|"$/g, ""));

const ShellPage = () => {
  const params = useParams<{ id: string }>();
  const routerContainerId = params?.id ?? "";
  const { data: containers } = useContainers();
  const container = containers?.find((item) => item.id === routerContainerId);
  const theme = useTheme();
  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const bufferRef = useRef<string>("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(0);
  const initializedRef = useRef(false);
  const promptRef = useRef<string>("");
  const [copyLabel, setCopyLabel] = useState("Copy last output");
  const lastOutputRef = useRef<string>("");

  const promptLabel = useMemo(() => {
    const name = container?.name ?? "demo";
    return `root@${name}:/app`;
  }, [container?.name]);

  const writePrompt = useCallback((newLine = true) => {
    const term = terminalRef.current;
    if (!term) {
      return;
    }
    const prompt = `${promptLabel}#`;
    promptRef.current = prompt;
    bufferRef.current = "";
    if (newLine) {
      term.write(`\r\n${prompt} `);
    } else {
      term.write(`${prompt} `);
    }
  }, [promptLabel]);

  const replaceLine = useCallback((text: string) => {
    const term = terminalRef.current;
    if (!term) {
      return;
    }
    term.write(`\u001b[2K\r${promptRef.current} ${text}`);
    bufferRef.current = text;
  }, []);

  const runCommand = useCallback(
    async (line: string) => {
      const term = terminalRef.current;
      if (!term) {
        return;
      }

      if (!line) {
        writePrompt();
        return;
      }

      if (line === "clear") {
        term.clear();
        writePrompt(false);
        return;
      }

      const targetContainerId = container?.id ?? routerContainerId;

      if (!targetContainerId) {
        term.writeln("No container selected. Navigate from the containers list.");
        writePrompt();
        return;
      }

      try {
        const tokens = parseCommand(line);
        if (tokens.length === 0) {
          writePrompt();
          return;
        }
        const output = await executeContainerCommand(targetContainerId, tokens);
        const formatted = output?.trim() ?? "";
        if (formatted) {
          term.writeln(formatted.replace(/\n/g, "\r\n"));
          lastOutputRef.current = formatted;
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        term.writeln(`Error: ${message}`);
        lastOutputRef.current = message;
      }

      writePrompt();
    },
    [container?.id, routerContainerId, writePrompt]
  );

  useEffect(() => {
    if (!terminalContainerRef.current) {
      return;
    }

    const term = new Terminal({
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
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
    term.writeln("Welcome to the container shell. Commands are executed via Docker when available.");
    writePrompt(false);

    const handleResize = () => {
      try {
        term.resize(Math.max(80, Math.floor((terminalContainerRef.current?.offsetWidth ?? 640) / 8)), 24);
      } catch (error) {
        // ignore resize errors
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
        case "\u0003": // Ctrl+C
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
        case "\u001b[A": { // Up
          if (historyRef.current.length === 0) {
            return;
          }
          historyIndexRef.current = Math.max(0, historyIndexRef.current - 1);
          const historyLine = historyRef.current[historyIndexRef.current] ?? "";
          replaceLine(historyLine);
          break;
        }
        case "\u001b[B": { // Down
          if (historyRef.current.length === 0) {
            return;
          }
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
  }, [theme.palette.mode, theme.palette.primary.main, theme.palette.text.primary, writePrompt, replaceLine, runCommand]);

  useEffect(() => {
    if (!initializedRef.current) {
      return;
    }
    writePrompt();
  }, [promptLabel, writePrompt]);

  useEffect(() => {
    let timer: number | undefined;
    if (copyLabel !== "Copy last output") {
      timer = window.setTimeout(() => setCopyLabel("Copy last output"), 1500);
    }
    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [copyLabel]);

  const handleCopy = async () => {
    const output = lastOutputRef.current;
    if (!output) {
      setCopyLabel("Nothing to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      setCopyLabel("Copied!");
    } catch (error) {
      setCopyLabel("Copy failed");
    }
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <TerminalIcon color="primary" />
        <Typography variant="h5">
          Interactive shell
        </Typography>
      </Stack>
      <Typography variant="body1" color="text.secondary">
        {container ? `Connected to ${container.name} (${container.id})` : "Demo container session"}
      </Typography>
      <Paper sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          <Box
            ref={terminalContainerRef}
            sx={{
              height: { xs: 320, md: 380 },
              borderRadius: 1,
              overflow: "hidden",
              backgroundColor: theme.palette.mode === "dark" ? "#050B1A" : "#f8fafc",
              px: 1,
              pt: 1
            }}
          />
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", md: "center" }} spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Type commands directly in the terminal. Supports history (↑ / ↓) and Ctrl+C.
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<OpenInNewIcon fontSize="small" />}
                href="/containers"
                size="small"
              >
                Back to containers
              </Button>
              <Button
                variant="outlined"
                startIcon={<ContentCopyIcon fontSize="small" />}
                onClick={handleCopy}
                size="small"
              >
                {copyLabel}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Paper>
    </Stack>
  );
};

export default ShellPage;
