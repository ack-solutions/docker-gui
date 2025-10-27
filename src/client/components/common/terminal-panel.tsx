"use client";

import { Stack } from "@mui/material";
import CommandTerminal from "@/components/common/command-terminal";
import { executeContainerCommand } from "@/lib/api/docker";

interface TerminalPanelProps {
  containerId: string;
  containerName?: string;
}

export const TerminalPanel = ({ containerId, containerName }: TerminalPanelProps) => {
  const sessionLabel = containerName ?? containerId;

  return (
    <Stack sx={{ height: "100%", overflow: "hidden" }}>
      <CommandTerminal
        sessionName={sessionLabel}
        promptLabel={`root@${sessionLabel}:/app`}
        welcomeMessage={`Welcome to ${sessionLabel}. Type commands and press Enter.`}
        executeCommand={(tokens) => executeContainerCommand(containerId, tokens)}
        fitParent
      />
    </Stack>
  );
};

export default TerminalPanel;
