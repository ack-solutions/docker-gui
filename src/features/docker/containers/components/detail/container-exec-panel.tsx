"use client";

import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import { Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import { useState } from "react";
import { executeContainerCommand } from "@/lib/api/docker";

const OutputViewport = styled("pre")(({ theme }) => ({
  backgroundColor: theme.palette.mode === "dark" ? "rgba(15,23,42,0.8)" : theme.palette.grey[50],
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2),
  fontFamily: 'ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  maxHeight: 320,
  overflow: "auto"
}));

interface ContainerExecPanelProps {
  containerId: string;
  containerName?: string;
}

const ContainerExecPanel = ({ containerId, containerName }: ContainerExecPanelProps) => {
  const [command, setCommand] = useState("env");
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>("Run a command to see output");

  const handleRun = async () => {
    if (!command.trim()) {
      return;
    }

    setIsRunning(true);
    setOutput((prev) => (prev ? `${prev}\n\n> ${command}\n` : `> ${command}\n`));

    try {
      const tokens = command
        .match(/(?:"[^"]*"|'[^']*'|[^\s"']+)/g)
        ?.map((token) => token.replace(/^['"]/, "").replace(/['"]$/, "")) ?? [];
      if (tokens.length === 0) {
        setOutput((prev) => `${prev}\nNo command provided.`);
      } else {
        const result = await executeContainerCommand(containerId, tokens);
        setOutput((prev) => `${prev}${result ? `\n${result}` : "\n(Command completed)"}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOutput((prev) => `${prev}\nError: ${message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const handleClear = () => {
    setOutput("Run a command to see output");
  };

  return (
    <Card>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ xs: "stretch", md: "center" }}>
            <Typography variant="h6" flex={1}>
              Run command {containerName ? `on ${containerName}` : "inside container"}
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="e.g. ls -la /app"
            />
            <Button
              variant="contained"
              startIcon={<PlayArrowIcon fontSize="small" />}
              onClick={handleRun}
              disabled={isRunning}
            >
              Execute
            </Button>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon fontSize="small" />}
              onClick={handleClear}
              disabled={isRunning}
            >
              Clear
            </Button>
          </Stack>
          <OutputViewport>{output}</OutputViewport>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default ContainerExecPanel;
