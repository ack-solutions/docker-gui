"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Terminal } from "@xterm/xterm";
import { toast } from "sonner";
import "@xterm/xterm/css/xterm.css";

type CompletionEntry = { name: string; type: "file" | "directory" };

type TerminalInputState = {
  buffer: string;
  cursor: number;
  history: string[];
  historyIndex: number;
};

const COMPLETION_ROOT_FALLBACK = "/";
const HISTORY_LIMIT = 1_000;
const BRACKET_PASTE_START = "\u001b[200~";
const BRACKET_PASTE_END = "\u001b[201~";

const tokenizeInput = (value: string): string[] => {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (let i = 0; i < value.length; i++) {
    const char = value[i] ?? "";

    if (quote) {
      if (char === quote) {
        quote = null;
        continue;
      }
      if (quote === '"' && char === "\\" && i + 1 < value.length) {
        current += value[++i] ?? "";
        continue;
      }
      current += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    if (char === "\\" && i + 1 < value.length) {
      current += value[++i] ?? "";
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
};

const normalizePath = (value: string): string => {
  if (!value) {
    return "/";
  }

  const absolute = value.startsWith("/");
  const segments = value.split("/").filter(Boolean);
  const stack: string[] = [];

  for (const segment of segments) {
    if (segment === ".") {
      continue;
    }
    if (segment === "..") {
      stack.pop();
      continue;
    }
    stack.push(segment);
  }

  const normalized = stack.join("/");
  if (absolute) {
    return normalized ? `/${normalized}` : "/";
  }
  return normalized || ".";
};

const joinAbsolutePath = (base: string, addition: string): string => {
  if (!addition) {
    return normalizePath(base || "/");
  }
  if (addition.startsWith("/")) {
    return normalizePath(addition);
  }
  const sanitizedBase = base.endsWith("/") ? base : `${base}/`;
  return normalizePath(`${sanitizedBase}${addition}`);
};

interface PromptConfig {
  prefix: string;
  path: string;
  hasPath: boolean;
}

const parsePromptLabel = (label: string | undefined, fallback: string): PromptConfig => {
  if (!label) {
    return { prefix: fallback, path: COMPLETION_ROOT_FALLBACK, hasPath: false };
  }

  const trimmed = label.trim().replace(/#+$/, "");
  const separatorIndex = trimmed.lastIndexOf(":");

  if (separatorIndex === -1) {
    return {
      prefix: trimmed || fallback,
      path: COMPLETION_ROOT_FALLBACK,
      hasPath: false
    };
  }

  const prefix = trimmed.slice(0, separatorIndex) || fallback;
  const rawPath = trimmed.slice(separatorIndex + 1) || "/";

  return {
    prefix,
    path: normalizePath(rawPath),
    hasPath: true
  };
};



const formatColumns = (items: string[], maxWidth = 80, columnWidth = 20): string[] => {
  if (!items.length) {
    return [];
  }

  const lines: string[] = [];
  let current = "";

  for (const item of items) {
    const padded = item.padEnd(columnWidth, " ");
    if (current.length + columnWidth > maxWidth) {
      lines.push(current.trimEnd());
      current = padded;
    } else {
      current += padded;
    }
  }

  if (current.trim()) {
    lines.push(current.trimEnd());
  }

  return lines;
};

const findCommonPrefix = (candidates: string[]): string => {
  if (!candidates.length) {
    return "";
  }
  let prefix = candidates[0] ?? "";
  for (const candidate of candidates.slice(1)) {
    while (!candidate.startsWith(prefix) && prefix) {
      prefix = prefix.slice(0, -1);
    }
    if (!prefix) {
      break;
    }
  }
  return prefix;
};

export interface CommandTerminalProps {
  executeCommand: (tokens: string[]) => Promise<string | null | void>;
  getFilesForCompletion?: (path: string) => Promise<CompletionEntry[]>;
  sessionName?: string;
  promptLabel?: string;
  welcomeMessage?: string;
  minHeight?: number;
  fitParent?: boolean;
  onLastOutputChange?: (output: string | null) => void;
}

const CommandTerminal = ({
  executeCommand,
  getFilesForCompletion,
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
  const fitAddonRef = useRef<FitAddon | null>(null);
  const initializedRef = useRef(false);
  const inputStateRef = useRef<TerminalInputState>({ buffer: "", cursor: 0, history: [], historyIndex: -1 });
  const promptRef = useRef<string>("");
  const outputLogRef = useRef<string[]>([]);
  const lastOutputRef = useRef<string | null>(null);

  const resolvedSession = sessionName ?? "session";
  const promptConfig = useMemo(() => parsePromptLabel(promptLabel, resolvedSession), [promptLabel, resolvedSession]);
  const resolvedWelcome = useMemo(
    () => welcomeMessage ?? `Welcome to the interactive shell. Connected to ${resolvedSession}.`,
    [welcomeMessage, resolvedSession]
  );
  const promptPrefixRef = useRef(promptConfig.prefix);
  const promptHasPathRef = useRef(promptConfig.hasPath);
  const workingDirectoryRef = useRef(promptConfig.path || COMPLETION_ROOT_FALLBACK);
  const previousDirectoryRef = useRef<string | null>(null);
  const homeDirectoryRef = useRef(promptConfig.path || COMPLETION_ROOT_FALLBACK);
  const promptSignatureRef = useRef(`${promptConfig.prefix}:${promptConfig.path}`);

  const resetInputBuffer = useCallback(() => {
    const state = inputStateRef.current;
    state.buffer = "";
    state.cursor = 0;
    state.historyIndex = -1;
  }, []);

  const accentColor = useMemo(
    () => (theme.palette.mode === "dark" ? "#7ee787" : "#1f6feb"),
    [theme.palette.mode]
  );

  const terminalTheme = useMemo(() => {
    if (theme.palette.mode === "dark") {
      return {
        background: "#0d1117",
        foreground: "#e6edf3",
        cursor: accentColor,
        selectionBackground: "rgba(126, 231, 135, 0.3)",
        selectionForeground: "#0d1117",
        black: "#484f58",
        red: "#ff7b72",
        green: "#7ee787",
        yellow: "#f2cc60",
        blue: "#79c0ff",
        magenta: "#d2a8ff",
        cyan: "#92d5ff",
        white: "#e6edf3",
        brightBlack: "#6e7681",
        brightRed: "#ffa198",
        brightGreen: "#aff5b4",
        brightYellow: "#f8e3a1",
        brightBlue: "#a5d6ff",
        brightMagenta: "#f2c5ff",
        brightCyan: "#b5e8ff",
        brightWhite: "#ffffff"
      };
    }

    return {
      background: "#fdfdfd",
      foreground: "#0f172a",
      cursor: accentColor,
      selectionBackground: "rgba(31, 111, 235, 0.25)",
      selectionForeground: "#fdfdfd",
      black: "#2e3440",
      red: "#d63a3a",
      green: "#1a7f37",
      yellow: "#b88700",
      blue: "#0f6feb",
      magenta: "#8d4ecb",
      cyan: "#0aa4b4",
      white: "#1e293b",
      brightBlack: "#4c566a",
      brightRed: "#ff4f4f",
      brightGreen: "#2bb159",
      brightYellow: "#e0a500",
      brightBlue: "#388bfd",
      brightMagenta: "#a371f7",
      brightCyan: "#10b9c6",
      brightWhite: "#334155"
    };
  }, [accentColor, theme.palette.mode]);

  const notifyOutput = useCallback(
    (output: string | null) => {
      lastOutputRef.current = output;
      if (output) {
        outputLogRef.current.push(output);
      }
      onLastOutputChange?.(output);
    },
    [onLastOutputChange]
  );

  const buildPromptValue = useCallback(() => {
    const base = promptPrefixRef.current?.trim().length ? promptPrefixRef.current : resolvedSession;
    const directory = workingDirectoryRef.current || COMPLETION_ROOT_FALLBACK;
    const label = promptHasPathRef.current ? `${base}:${directory}` : base;
    const plain = `${label}#`;
    const { r, g, b } = hexToRgb(accentColor);
    return `\u001b[38;2;${r};${g};${b}m${plain}\u001b[0m`;
  }, [accentColor, resolvedSession]);

  const writePrompt = useCallback(
    (newLine = true) => {
      const term = terminalRef.current;
      if (!term) {
        return;
      }
      resetInputBuffer();
      const promptLabel = buildPromptValue();
      promptRef.current = promptLabel;
      const prefix = newLine ? "\r\n" : "";
      term.write(`${prefix}${promptLabel} `);
    },
    [buildPromptValue, resetInputBuffer]
  );

  const refreshInputLine = useCallback(() => {
    const term = terminalRef.current;
    if (!term) {
      return;
    }
    const { buffer, cursor } = inputStateRef.current;
    const promptLabel = promptRef.current || buildPromptValue();
    promptRef.current = promptLabel;
    term.write(`\r\u001b[K${promptLabel} ${buffer}`);
    const distanceToEnd = buffer.length - cursor;
    if (distanceToEnd > 0) {
      term.write(`\u001b[${distanceToEnd}D`);
    }
  }, [buildPromptValue]);

  useEffect(() => {
    promptPrefixRef.current = promptConfig.prefix;
    promptHasPathRef.current = promptConfig.hasPath;
    const normalizedPath = promptConfig.path || COMPLETION_ROOT_FALLBACK;
    homeDirectoryRef.current = normalizedPath;
    const signature = `${promptConfig.prefix}:${normalizedPath}`;

    if (promptSignatureRef.current !== signature) {
      promptSignatureRef.current = signature;
      workingDirectoryRef.current = normalizedPath;
      previousDirectoryRef.current = null;
      if (initializedRef.current) {
        writePrompt();
      }
    }
  }, [promptConfig.hasPath, promptConfig.path, promptConfig.prefix, writePrompt]);

  const mutateState = useCallback(
    (mutator: (draft: TerminalInputState) => void, refresh = true) => {
      mutator(inputStateRef.current);
      if (refresh) {
        refreshInputLine();
      }
    },
    [refreshInputLine]
  );

  const insertText = useCallback(
    (text: string) => {
      if (!text) {
        return;
      }
      mutateState((state) => {
        const before = state.buffer.slice(0, state.cursor);
        const after = state.buffer.slice(state.cursor);
        state.buffer = `${before}${text}${after}`;
        state.cursor = before.length + text.length;
      });
    },
    [mutateState]
  );

  const wrapCommandWithDirectory = useCallback((tokens: string[]) => {
    const cwd = workingDirectoryRef.current || homeDirectoryRef.current || COMPLETION_ROOT_FALLBACK;
    if (!cwd) {
      return tokens;
    }
    return ["cd", cwd, "&&", ...tokens];
  }, []);

  const handleDirectoryChange = useCallback(
    async (tokens: string[]) => {
      const term = terminalRef.current;
      if (!term) {
        return;
      }

      if (tokens.length > 2) {
        const message = "cd: too many arguments";
        term.writeln(`\x1b[31m${message}\x1b[0m`);
        notifyOutput(message);
        return;
      }

      const targetArg = tokens[1];
      const currentDirectory = workingDirectoryRef.current || homeDirectoryRef.current || COMPLETION_ROOT_FALLBACK;
      const homeDirectory = homeDirectoryRef.current || COMPLETION_ROOT_FALLBACK;

      let destination: string | null = null;

      if (!targetArg || targetArg === "~") {
        destination = homeDirectory;
      } else if (targetArg.startsWith("~/")) {
        const suffix = targetArg.slice(2);
        destination = normalizePath(`${homeDirectory}/${suffix}`);
      } else if (targetArg === "-") {
        if (!previousDirectoryRef.current) {
          const message = "cd: OLDPWD not set";
          term.writeln(`\x1b[31m${message}\x1b[0m`);
          notifyOutput(message);
          return;
        }
        destination = previousDirectoryRef.current;
      } else {
        destination = targetArg.startsWith("/")
          ? normalizePath(targetArg)
          : normalizePath(`${currentDirectory}/${targetArg}`);
      }

      if (!destination) {
        return;
      }

      const marker = "__CWD__";
      const commandTokens = ["cd", destination, "&&", "printf", `${marker}%s`, "$PWD"];

      try {
        const response = await executeCommand(commandTokens);
        const normalized = response ? String(response) : "";
        const trimmed = normalized.trim();

        const markerIndex = trimmed.indexOf(marker);

        if (markerIndex !== -1) {
          const nextDirRaw = trimmed.slice(markerIndex + marker.length).trim();
          const nextDir = nextDirRaw || "/";
          if (targetArg === "-") {
            term.writeln(nextDir);
            notifyOutput(nextDir);
          } else {
            notifyOutput(null);
          }
          previousDirectoryRef.current = currentDirectory;
          workingDirectoryRef.current = nextDir;
        } else if (trimmed) {
          const printable = trimmed.replace(/\r?\n/g, "\r\n");
          term.writeln(printable);
          notifyOutput(trimmed);
        } else {
          notifyOutput(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        term.writeln(`\x1b[31m${message}\x1b[0m`);
        notifyOutput(message);
      }
    },
    [executeCommand, notifyOutput]
  );

  const handleClearTerminal = useCallback(() => {
    const term = terminalRef.current;
    if (!term) {
      return;
    }
    term.clear();
    outputLogRef.current = [];
    writePrompt(false);
    toast.success("Terminal cleared");
  }, [writePrompt]);

  const handleCopyOutput = useCallback(async () => {
    const fullOutput = outputLogRef.current.join("\n\n");
    if (!fullOutput) {
      toast.info("No output to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(fullOutput);
      toast.success("Terminal output copied");
    } catch {
      toast.error("Failed to copy output");
    }
  }, []);

  const executeLine = useCallback(
    async (line: string) => {
      const term = terminalRef.current;
      if (!term) {
        return;
      }

      if (!line.trim()) {
        writePrompt();
        return;
      }

      if (line.trim() === "clear") {
        term.clear();
        outputLogRef.current = [];
        notifyOutput(null);
        writePrompt(false);
        return;
      }

      const tokens = tokenizeInput(line);
      if (!tokens.length) {
        writePrompt();
        return;
      }

      const isBareCdCommand = tokens[0] === "cd" && tokens.length <= 2;

      if (isBareCdCommand) {
        await handleDirectoryChange(tokens);
        writePrompt();
        return;
      }

      try {
        const scopedTokens = wrapCommandWithDirectory(tokens);
        const response = await executeCommand(scopedTokens);
        const normalized = response == null ? "" : String(response);
        if (normalized.trim()) {
          const printable = normalized.replace(/\r?\n/g, "\r\n");
          term.writeln(printable);
          notifyOutput(printable);
        } else {
          notifyOutput(null);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        term.writeln(`\x1b[31m${message}\x1b[0m`);
        notifyOutput(message);
      }

      writePrompt();
    },
    [executeCommand, handleDirectoryChange, notifyOutput, wrapCommandWithDirectory, writePrompt]
  );

  const requestCompletion = useCallback(async () => {
    if (!getFilesForCompletion) {
      return;
    }
    const term = terminalRef.current;
    if (!term) {
      return;
    }

    const { buffer, cursor } = inputStateRef.current;
    const beforeCursor = buffer.slice(0, cursor);
    const match = beforeCursor.match(/([^\s]+)$/);
    const rawToken = match ? match[1] ?? "" : "";
    const tokenStart = match ? beforeCursor.length - rawToken.length : beforeCursor.length;
    const suffix = buffer.slice(cursor);

    const slashIndex = rawToken.lastIndexOf("/");
    const segment = slashIndex === -1 ? rawToken : rawToken.slice(slashIndex + 1);
    const directoryToken = slashIndex === -1 ? "" : rawToken.slice(0, slashIndex + 1);
    const baseDirectory = workingDirectoryRef.current || homeDirectoryRef.current || COMPLETION_ROOT_FALLBACK;
    const searchDir = normalizePath(
      directoryToken ? joinAbsolutePath(baseDirectory, directoryToken) : baseDirectory
    );

    let entries: CompletionEntry[] = [];
    try {
      entries = await getFilesForCompletion(searchDir);
    } catch {
      return;
    }

    const matches = entries.filter((entry) => entry.name.startsWith(segment));
    if (!matches.length) {
      return;
    }

    if (matches.length === 1) {
      const [matchEntry] = matches;
      const tokenAddition = matchEntry.name.slice(segment.length) + (matchEntry.type === "directory" ? "/" : " ");
      mutateState((state) => {
        const prefix = buffer.slice(0, tokenStart);
        const completed = `${rawToken}${tokenAddition}`;
        state.buffer = `${prefix}${completed}${suffix}`;
        state.cursor = prefix.length + completed.length;
      });
      return;
    }

    const commonPrefix = findCommonPrefix(matches.map((entry) => entry.name));
    if (commonPrefix && commonPrefix.length > segment.length) {
      const addition = commonPrefix.slice(segment.length);
      mutateState((state) => {
        const prefix = buffer.slice(0, tokenStart);
        const completed = `${rawToken}${addition}`;
        state.buffer = `${prefix}${completed}${suffix}`;
        state.cursor = prefix.length + completed.length;
      });
      return;
    }

    term.write("\r\n");
    const directories = matches
      .filter((entry) => entry.type === "directory")
      .map((entry) => `${entry.name}/`)
      .sort((a, b) => a.localeCompare(b));
    const files = matches
      .filter((entry) => entry.type === "file")
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
    const listing = [...directories, ...files];
    formatColumns(listing).forEach((line) => term.writeln(line));
    refreshInputLine();
  }, [getFilesForCompletion, mutateState, refreshInputLine]);

  const handleHistory = useCallback(
    (direction: "up" | "down") => {
      const state = inputStateRef.current;
      if (!state.history.length) {
        return;
      }
      if (direction === "up") {
        if (state.historyIndex === -1) {
          state.historyIndex = state.history.length;
        }
        if (state.historyIndex > 0) {
          state.historyIndex -= 1;
          state.buffer = state.history[state.historyIndex] ?? "";
          state.cursor = state.buffer.length;
          refreshInputLine();
        }
        return;
      }

      if (state.historyIndex === -1) {
        return;
      }
      state.historyIndex += 1;
      if (state.historyIndex >= state.history.length) {
        state.historyIndex = -1;
        state.buffer = "";
        state.cursor = 0;
      } else {
        state.buffer = state.history[state.historyIndex] ?? "";
        state.cursor = state.buffer.length;
      }
      refreshInputLine();
    },
    [refreshInputLine]
  );

  const handleBracketedPaste = useCallback(
    (payload: string) => {
      const sanitized = payload.replace(/\r/g, "");
      const [firstLine, ...rest] = sanitized.split("\n");
      insertText(firstLine ?? "");
      if (!rest.length) {
        return;
      }
      rest.forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return;
        }
        setTimeout(() => {
          const term = terminalRef.current;
          if (!term) {
            return;
          }
          term.write("\r\n");
          void executeLine(trimmed);
        }, index * 20);
      });
    },
    [executeLine, insertText]
  );

  const handleTermData = useCallback(
    (data: string) => {
      const term = terminalRef.current;
      if (!term) {
        return;
      }

      if (!data) {
        return;
      }

      if (data.startsWith(BRACKET_PASTE_START) && data.endsWith(BRACKET_PASTE_END)) {
        handleBracketedPaste(data.slice(BRACKET_PASTE_START.length, -BRACKET_PASTE_END.length));
        return;
      }

      switch (data) {
        case "\u0003": // Ctrl+C
          term.write("^C");
          resetInputBuffer();
          writePrompt();
          return;
        case "\u000c": // Ctrl+L
          handleClearTerminal();
          return;
        case "\u0015": // Ctrl+U
          mutateState((state) => {
            const after = state.buffer.slice(state.cursor);
            state.buffer = after;
            state.cursor = 0;
          });
          return;
        case "\u0017": // Ctrl+W
          mutateState((state) => {
            const before = state.buffer.slice(0, state.cursor);
            const after = state.buffer.slice(state.cursor);
            const trimmedBefore = before.replace(/\S+$/, "");
            state.buffer = `${trimmedBefore}${after}`;
            state.cursor = trimmedBefore.length;
          });
          return;
        case "\u0001": // Ctrl+A
          mutateState((state) => {
            state.cursor = 0;
          });
          return;
        case "\u0005": // Ctrl+E
          mutateState((state) => {
            state.cursor = state.buffer.length;
          });
          return;
        case "\u000b": // Ctrl+K
          mutateState((state) => {
            state.buffer = state.buffer.slice(0, state.cursor);
          });
          return;
        case "\u007f":
        case "\u0008":
          mutateState((state) => {
            if (state.cursor === 0) {
              return;
            }
            const before = state.buffer.slice(0, state.cursor - 1);
            const after = state.buffer.slice(state.cursor);
            state.buffer = `${before}${after}`;
            state.cursor = before.length;
          });
          return;
        case "\t":
          void requestCompletion();
          return;
        case "\r":
        case "\n": {
          const line = inputStateRef.current.buffer;
          term.write("\r\n");
          if (line.trim()) {
            const history = inputStateRef.current.history;
            history.push(line);
            if (history.length > HISTORY_LIMIT) {
              history.shift();
            }
          }
          resetInputBuffer();
          void executeLine(line);
          return;
        }
        case "\u001b[A":
        case "\u001bOA":
          handleHistory("up");
          return;
        case "\u001b[B":
        case "\u001bOB":
          handleHistory("down");
          return;
        case "\u001b[D":
        case "\u001bOD":
          mutateState((state) => {
            state.cursor = Math.max(0, state.cursor - 1);
          });
          return;
        case "\u001b[C":
        case "\u001bOC":
          mutateState((state) => {
            state.cursor = Math.min(state.buffer.length, state.cursor + 1);
          });
          return;
        case "\u001b[H":
        case "\u001bOH":
          mutateState((state) => {
            state.cursor = 0;
          });
          return;
        case "\u001b[F":
        case "\u001bOF":
          mutateState((state) => {
            state.cursor = state.buffer.length;
          });
          return;
        case "\u001b[3~": // Delete key
          mutateState((state) => {
            if (state.cursor >= state.buffer.length) {
              return;
            }
            const before = state.buffer.slice(0, state.cursor);
            const after = state.buffer.slice(state.cursor + 1);
            state.buffer = `${before}${after}`;
          });
          return;
        default:
          break;
      }

      if (!data.startsWith("\u001b") && data.length === 1 && data >= " " && data <= "~") {
        insertText(data);
        return;
      }

      if (!data.startsWith("\u001b") && data.length > 1) {
        insertText(data);
      }
    },
    [executeLine, handleClearTerminal, handleHistory, insertText, mutateState, requestCompletion, resetInputBuffer, writePrompt, handleBracketedPaste]
  );

  const handlePasteEvent = useCallback(
    (event: ClipboardEvent) => {
      event.preventDefault();
      const text = event.clipboardData?.getData("text");
      if (!text) {
        return;
      }
      handleBracketedPaste(text);
    },
    [handleBracketedPaste]
  );

  const handleCopyEvent = useCallback((event: ClipboardEvent) => {
    const term = terminalRef.current;
    if (!term) {
      return;
    }
    const selection = term.getSelection();
    if (selection) {
      event.clipboardData?.setData("text/plain", selection);
      event.preventDefault();
    }
  }, []);

  useEffect(() => {
    if (!terminalContainerRef.current || initializedRef.current) {
      return;
    }

    const terminal = new Terminal({
      fontSize: 13,
      fontFamily:
        'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      cursorBlink: true,
      scrollback: 10_000,
      theme: terminalTheme
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(terminalContainerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;
    initializedRef.current = true;

    const resize = () => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    };

    const dataDisposable = terminal.onData(handleTermData);
    const pasteTarget = terminalContainerRef.current;
    pasteTarget.addEventListener("paste", handlePasteEvent);
    pasteTarget.addEventListener("copy", handleCopyEvent);
    window.addEventListener("resize", resize);
    terminal.focus();

    terminal.writeln(resolvedWelcome);
    writePrompt(false);

    return () => {
      dataDisposable.dispose();
      window.removeEventListener("resize", resize);
      pasteTarget.removeEventListener("paste", handlePasteEvent);
      pasteTarget.removeEventListener("copy", handleCopyEvent);
      terminal.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
      initializedRef.current = false;
    };
  }, [handleCopyEvent, handlePasteEvent, handleTermData, resolvedWelcome, terminalTheme, writePrompt]);

  return (
    <Stack sx={{ height: "100%", position: "relative" }}>
      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 1,
          backgroundColor: (theme) =>
            theme.palette.mode === "dark" ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.6)",
          borderRadius: 1,
          backdropFilter: "blur(4px)",
          p: 0.25
        }}
      >
        <Tooltip title="Copy all output">
          <IconButton size="small" onClick={handleCopyOutput}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear terminal">
          <IconButton size="small" onClick={handleClearTerminal}>
            <DeleteSweepIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Box
        ref={terminalContainerRef}
        sx={{
          width: "100%",
          height: fitParent ? "100%" : { xs: minHeight, md: minHeight + 60 },
          borderRadius: 0,
          overflow: "hidden",
          backgroundColor: terminalTheme.background,
          px: 1,
          pt: 1
        }}
      />
    </Stack>
  );
};

export default CommandTerminal;
