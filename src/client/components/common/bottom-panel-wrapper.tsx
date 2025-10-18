"use client";

import { BottomPanel } from "./bottom-panel";
import { useBottomPanel } from "./bottom-panel-context";
import TerminalPanel from "./terminal-panel";
import LogsPanel from "./logs-panel";

export const BottomPanelWrapper = () => {
  const {
    tabs,
    activeTabId,
    isOpen,
    closePanel,
    setActiveTab,
    closeTab,
    panelHeight,
    minPanelHeight,
    maxPanelHeight,
    setPanelHeight,
    commitPanelHeight
  } = useBottomPanel();

  if (!isOpen) return null;

  const panelTabs = tabs.map((tab) => ({
    id: tab.id,
    label: tab.label,
    content: tab.type === "terminal" ? (
      <TerminalPanel containerId={tab.containerId} containerName={tab.containerName} />
    ) : (
      <LogsPanel containerId={tab.containerId} containerName={tab.containerName} />
    ),
    onClose: () => closeTab(tab.id)
  }));

  return (
    <BottomPanel
      tabs={panelTabs}
      activeTabId={activeTabId || undefined}
      onTabChange={setActiveTab}
      onTabClose={closeTab}
      onClose={closePanel}
      height={panelHeight}
      minHeight={minPanelHeight}
      maxHeight={maxPanelHeight}
      onHeightChange={setPanelHeight}
      onHeightCommit={commitPanelHeight}
    />
  );
};

export default BottomPanelWrapper;
