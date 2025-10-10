"use client";

import ContainerShellTerminal from "@/features/docker/containers/components/container-shell-terminal";

interface TerminalPanelProps {
  containerId: string;
  containerName?: string;
}

export const TerminalPanel = ({ containerId, containerName }: TerminalPanelProps) => {
  return (
    <ContainerShellTerminal
      containerId={containerId}
      containerName={containerName}
      fitParent
    />
  );
};

export default TerminalPanel;
