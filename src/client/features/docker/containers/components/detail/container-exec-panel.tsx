"use client";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { Alert, Card, CardContent, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useState } from "react";
import { toast } from "sonner";
import { executeContainerCommand } from "@/lib/api/docker";

const OutputViewport = styled("pre")(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "rgba(15,23,42,0.8)" : theme.palette.grey[50],
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1.5),
  fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  maxHeight: 350,
  minHeight: 200,
  overflow: "auto",
  fontSize: "0.8125rem",
  margin: 0,
  whiteSpace: "pre-wrap",
  wordWrap: "break-word"
}));

interface ContainerExecPanelProps {
  containerId: string;
  containerName?: string;
}

const ContainerExecPanel = ({ containerId, containerName }: ContainerExecPanelProps) => {
  const [command, setCommand] = useState("env");
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>("Run a command to see output");
  const [error, setError] = useState<string | null>(null);

  const handleRun = async () => {
    if (!command.trim()) {
      toast.error("Please enter a command");
      return;
    }

    setIsRunning(true);
    setError(null);
    setOutput((prev) => (prev ? `${prev}\n\n> ${command}\n` : `> ${command}\n`));

    try {
      const tokens = command
        .match(/(?:"[^"]*"|'[^']*'|[^\s"']+)/g)
        ?.map((token) => token.replace(/^['"]/,  "").replace(/['"]$/, "")) ?? [];
      if (tokens.length === 0) {
        setOutput((prev) => `${prev}\nNo command provided.`);
      } else {
        const result = await executeContainerCommand(containerId, tokens);
        setOutput((prev) => `${prev}${result ? `\n${result}` : "\n(Command completed successfully)"}`);
        toast.success("Command executed");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOutput((prev) => `${prev}\n\x1b[31mError: ${message}\x1b[0m`);
      setError(message);
      toast.error("Command failed");
    } finally {
      setIsRunning(false);
    }
  };

  const handleClear = () => {
    setOutput("Run a command to see output");
    setError(null);
    toast.success("Output cleared");
  };

  const handleCopyOutput = async () => {
    if (!output || output === "Run a command to see output") {
      toast.info("No output to copy");
      return;
    }
    try {
      await navigator.clipboard.writeText(output);
      toast.success("Output copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy output");
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey && !isRunning) {
      event.preventDefault();
      handleRun();
    }
  };

  return (
    <Card>
      <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
              Run command {containerName ? `on ${containerName}` : "inside container"}
            </Typography>
          </Stack>

          {error && (
            <Alert severity="error" onClose={() => setError(null)} sx={{ py: 0.5 }}>
              {error}
            </Alert>
          )}

          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              fullWidth
              size="small"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g. ls -la /app or echo 'Hello World'"
              disabled={isRunning}
            />
            <Tooltip title="Execute command (Enter)">
              <span>
                <IconButton
                  color="primary"
                  onClick={handleRun}
                  disabled={isRunning || !command.trim()}
                  size="small"
                  sx={{ border: 1, borderColor: "divider" }}
                >
                  {isRunning ? <CircularProgress size={20} /> : <PlayArrowIcon fontSize="small" />}
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Copy output">
              <IconButton
                onClick={handleCopyOutput}
                disabled={isRunning}
                size="small"
                sx={{ border: 1, borderColor: "divider" }}
              >
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear output">
              <IconButton
                onClick={handleClear}
                disabled={isRunning}
                size="small"
                sx={{ border: 1, borderColor: "divider" }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <OutputViewport>{output}</OutputViewport>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ContainerExecPanel;
