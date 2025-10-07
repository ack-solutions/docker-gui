"use client";

import { createContext, ReactNode, useContext, useState } from "react";

interface PanelTab {
  id: string;
  label: string;
  type: "terminal" | "logs";
  containerId: string;
  containerName?: string;
}

interface BottomPanelContextType {
  tabs: PanelTab[];
  activeTabId: string | null;
  isOpen: boolean;
  openTerminal: (containerId: string, containerName: string) => void;
  openLogs: (containerId: string, containerName: string) => void;
  closeTab: (tabId: string) => void;
  closePanel: () => void;
  setActiveTab: (tabId: string) => void;
}

const BottomPanelContext = createContext<BottomPanelContextType | undefined>(undefined);

export const useBottomPanel = () => {
  const context = useContext(BottomPanelContext);
  if (!context) {
    throw new Error("useBottomPanel must be used within BottomPanelProvider");
  }
  return context;
};

interface BottomPanelProviderProps {
  children: ReactNode;
}

export const BottomPanelProvider = ({ children }: BottomPanelProviderProps) => {
  const [tabs, setTabs] = useState<PanelTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const openTerminal = (containerId: string, containerName: string) => {
    const tabId = `terminal-${containerId}`;
    const existingTab = tabs.find((tab) => tab.id === tabId);

    if (existingTab) {
      setActiveTabId(tabId);
    } else {
      const newTab: PanelTab = {
        id: tabId,
        label: `${containerName} - Terminal`,
        type: "terminal",
        containerId,
        containerName
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(tabId);
    }
  };

  const openLogs = (containerId: string, containerName: string) => {
    const tabId = `logs-${containerId}`;
    const existingTab = tabs.find((tab) => tab.id === tabId);

    if (existingTab) {
      setActiveTabId(tabId);
    } else {
      const newTab: PanelTab = {
        id: tabId,
        label: `${containerName} - Logs`,
        type: "logs",
        containerId,
        containerName
      };
      setTabs([...tabs, newTab]);
      setActiveTabId(tabId);
    }
  };

  const closeTab = (tabId: string) => {
    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);
    
    if (activeTabId === tabId) {
      setActiveTabId(newTabs.length > 0 ? newTabs[0].id : null);
    }
  };

  const closePanel = () => {
    setTabs([]);
    setActiveTabId(null);
  };

  const setActiveTab = (tabId: string) => {
    setActiveTabId(tabId);
  };

  const value = {
    tabs,
    activeTabId,
    isOpen: tabs.length > 0,
    openTerminal,
    openLogs,
    closeTab,
    closePanel,
    setActiveTab
  };

  return (
    <BottomPanelContext.Provider value={value}>
      {children}
    </BottomPanelContext.Provider>
  );
};

