"use client";

import { memo, useMemo } from "react";
import { BottomPanel } from "@/components/common/bottom-panel";
import TerminalPanel from "@/components/common/terminal-panel";
import LogsPanel from "@/components/common/logs-panel";
import { useBottomPanel } from "@/components/common/bottom-panel-context";

const renderTabContent = (tab: { id: string; type: "terminal" | "logs"; containerId: string; containerName?: string }) => {
  switch (tab.type) {
    case "terminal": {
      return (
        <TerminalPanel
          containerId={tab.containerId}
          containerName={tab.containerName}
        />
      );
    }
    case "logs": {
      return (
        <LogsPanel
          containerId={tab.containerId}
          containerName={tab.containerName}
        />
      );
    }
    default:
      return null;
  }
};

interface BottomPanelHostProps {
  leftInset?: number;
}

const BottomPanelHost = ({ leftInset = 0 }: BottomPanelHostProps) => {
  const {
    tabs,
    activeTabId,
    isOpen,
    closePanel,
    closeTab,
    setActiveTab,
    panelHeight,
    minPanelHeight,
    maxPanelHeight,
    setPanelHeight,
    commitPanelHeight
  } = useBottomPanel();

  const panelTabs = useMemo(
    () =>
      tabs.map((tab) => ({
        id: tab.id,
        label: tab.label,
        content: renderTabContent(tab)
      })),
    [tabs]
  );

  if (!isOpen) {
    return null;
  }

  return (
    <BottomPanel
      tabs={panelTabs}
      activeTabId={activeTabId ?? undefined}
      height={panelHeight}
      minHeight={minPanelHeight}
      maxHeight={maxPanelHeight}
      leftOffset={leftInset}
      onTabChange={setActiveTab}
      onTabClose={closeTab}
      onClose={closePanel}
      onHeightChange={setPanelHeight}
      onHeightCommit={commitPanelHeight}
    />
  );
};

export default memo(BottomPanelHost);
