"use client";

import CommandTerminal from "@/components/common/command-terminal";
import { executeContainerCommand } from "@/lib/api/docker";

interface TerminalPanelProps {
  containerId: string;
  containerName?: string;
}

export const TerminalPanel = ({ containerId, containerName }: TerminalPanelProps) => {
  const sessionLabel = containerName ?? containerId;

  return (
    <CommandTerminal
      sessionName={sessionLabel}
      promptLabel={`root@${sessionLabel}:/app`}
      welcomeMessage={`Welcome to the container shell. Connected to ${sessionLabel}.`}
      executeCommand={(tokens) => executeContainerCommand(containerId, tokens)}
      fitParent
    />
  );
};

export default TerminalPanel;
