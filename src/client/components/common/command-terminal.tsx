"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Terminal } from "@xterm/xterm";
import { toast } from "sonner";
import "@xterm/xterm/css/xterm.css";

const parseCommand = (input: string) =>
  (input.match(/(?:"[^"]*"|'[^']*'|[^\s"']+)/g) ?? []).map((token) => token.replace(/^['"]|['"]$/g, ""));

export interface CommandTerminalProps {
  executeCommand: (tokens: string[]) => Promise<string | null | void>;
  sessionName?: string;
  promptLabel?: string;
  welcomeMessage?: string;
  minHeight?: number;
  fitParent?: boolean;
  onLastOutputChange?: (output: string | null) => void;
}

const CommandTerminal = ({
  executeCommand,
  sessionName,
  promptLabel,
  welcomeMessage,
  minHeight = 320,
  fitParent = false,
  onLastOutputChange
}: CommandTerminalProps) => {
  const theme = useTheme();

  const terminalContainerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);

  const bufferRef = useRef<string>("");
  const historyRef = useRef<string[]>([]);
  const historyIndexRef = useRef<number>(0);
  const promptRef = useRef<string>("");
  const initializedRef = useRef(false);
  const lastOutputRef = useRef<string | null>(null);
  const allOutputRef = useRef<string[]>([]);

  const resolvedSession = sessionName ?? "session";
  const resolvedPrompt = promptLabel ?? `${resolvedSession}`;
  const resolvedWelcome =
    welcomeMessage ?? `Welcome to the interactive shell. Connected to ${resolvedSession}.`;

  const notifyOutput = useCallback(
    (output: string | null) => {
      lastOutputRef.current = output;
      if (output) {
        allOutputRef.current.push(output);
      }
      onLastOutputChange?.(output);
    },
    [onLastOutputChange]
  );

  const writePrompt = useCallback(
    (newLine = true) => {
      const term = terminalRef.current;
      if (!term) return;
      const prompt = `${resolvedPrompt}#`;
      promptRef.current = prompt;
      bufferRef.current = "";
      term.write(`${newLine ? "\r\n" : ""}${prompt} `);
    },
    [resolvedPrompt]
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
        allOutputRef.current = [];
        writePrompt(false);
        return;
      }

      try {
        const tokens = parseCommand(line);
        if (tokens.length === 0) {
          writePrompt();
          return;
        }
        const output = await executeCommand(tokens);
        const formatted = output ? String(output).trim() : "";
        if (formatted) {
          term.writeln(formatted.replace(/\n/g, "\r\n"));
          notifyOutput(formatted);
        } else {
          notifyOutput(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        term.writeln(`\x1b[31mError: ${message}\x1b[0m`);
        notifyOutput(message);
      }

      writePrompt();
    },
    [executeCommand, notifyOutput, writePrompt]
  );

  const handleCopyAll = async () => {
    const allText = allOutputRef.current.join("\n\n");
    if (!allText) {
      toast.info("No output to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(allText);
      toast.success("Terminal output copied");
    } catch (error) {
      toast.error("Failed to copy output");
    }
  };

  const handleClearTerminal = () => {
    const term = terminalRef.current;
    if (term) {
      term.clear();
      allOutputRef.current = [];
      writePrompt(false);
      toast.success("Terminal cleared");
    }
  };

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
      },
      scrollback: 10000
    });

    terminalRef.current = term;
    term.open(terminalContainerRef.current);
    term.writeln(resolvedWelcome);
    writePrompt(false);

    const handleResize = () => {
      try {
        const width = terminalContainerRef.current?.offsetWidth ?? 640;
        const height = terminalContainerRef.current?.offsetHeight ?? 400;
        const cols = Math.max(80, Math.floor(width / 8.5));
        const rows = Math.max(10, Math.floor(height / 17));
        term.resize(cols, rows);
      } catch {
        // ignore xterm resize errors
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
          void runCommand(line.trim());
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
  }, [resolvedWelcome, runCommand, theme.palette.mode, theme.palette.primary.main, theme.palette.text.primary, replaceLine, writePrompt]);

  useEffect(() => {
    if (initializedRef.current) {
      writePrompt();
    }
  }, [resolvedPrompt, writePrompt]);

  return (
    <Stack sx={{ height: "100%", position: "relative" }}>
      {/* Action Buttons */}
      <Stack 
        direction="row" 
        spacing={0.5} 
        sx={{ 
          position: "absolute", 
          top: 8, 
          right: 8, 
          zIndex: 1,
          backgroundColor: (theme) => theme.palette.mode === "dark" ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.5)",
          borderRadius: 1,
          backdropFilter: "blur(4px)",
          p: 0.25
        }}
      >
        <Tooltip title="Copy all output">
          <IconButton size="small" onClick={handleCopyAll}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear terminal">
          <IconButton size="small" onClick={handleClearTerminal}>
            <DeleteSweepIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* Terminal */}
      <Box
        ref={terminalContainerRef}
        sx={{
          width: "100%",
          height: fitParent ? "100%" : { xs: minHeight, md: minHeight + 60 },
          borderRadius: 0,
          overflow: "hidden",
          backgroundColor: theme.palette.mode === "dark" ? "#050B1A" : "#f8fafc",
          px: 1,
          pt: 1
        }}
      />
    </Stack>
  );
};

export default CommandTerminal;
