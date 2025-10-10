"use client";

import { memo, useMemo } from "react";
import { BottomPanel } from "@/components/common/bottom-panel";
import TerminalPanel from "@/components/common/terminal-panel";
import LogsPanel from "@/components/common/logs-panel";
import { useBottomPanel } from "@/store/ui-store";

const renderTabContent = (tab: ReturnType<typeof useBottomPanel>["tabs"][number]) => {
  switch (tab.kind) {
    case "terminal": {
      const { containerId, containerName } = tab.payload ?? {};
      return (
        <TerminalPanel
          containerId={String(containerId ?? "")}
          containerName={typeof containerName === "string" ? containerName : undefined}
        />
      );
    }
    case "logs": {
      const { containerId, containerName } = tab.payload ?? {};
      return (
        <LogsPanel
          containerId={String(containerId ?? "")}
          containerName={typeof containerName === "string" ? containerName : undefined}
        />
      );
    }
    default:
      return null;
  }
};

const BottomPanelHost = () => {
  const {
    tabs,
    activeTabId,
    isMinimized,
    isOpen,
    closePanel,
    closeTab,
    setActiveTab,
    toggleMinimize
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
      isMinimized={isMinimized}
      onTabChange={setActiveTab}
      onTabClose={closeTab}
      onToggleMinimize={toggleMinimize}
      onClose={closePanel}
    />
  );
};

export default memo(BottomPanelHost);
