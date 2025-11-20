"use client";

import { Stack } from "@mui/material";
import CommandTerminal from "@/components/common/command-terminal";
import { executeContainerCommand, fetchContainerFiles } from "@/lib/api/docker";

interface TerminalPanelProps {
  containerId: string;
  containerName?: string;
}

export const TerminalPanel = ({ containerId, containerName }: TerminalPanelProps) => {
  const sessionLabel = containerName ?? containerId;

  const getFilesForCompletion = async (path: string) => {
    try {
      const files = await fetchContainerFiles(containerId, path);
      return files.map(file => ({
        name: file.name,
        type: file.type === "directory" ? "directory" as const : "file" as const
      }));
    } catch {
      return [];
    }
  };

  return (
    <Stack sx={{ height: "100%", overflow: "hidden" }}>
      <CommandTerminal
        sessionName={sessionLabel}
        promptLabel={`root@${sessionLabel}:/app`}
        welcomeMessage={`Welcome to ${sessionLabel}. Type commands and press Enter.`}
        executeCommand={(tokens) => executeContainerCommand(containerId, tokens)}
        getFilesForCompletion={getFilesForCompletion}
        fitParent
      />
    </Stack>
  );
};

export default TerminalPanel;
