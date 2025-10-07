"use client";

import { createContext, ReactNode, useCallback, useContext, useState } from "react";

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

  const openTerminal = useCallback((containerId: string, containerName: string) => {
    const tabId = `terminal-${containerId}`;
    setTabs((current) => {
      if (current.some((tab) => tab.id === tabId)) {
        return current;
      }

      const newTab: PanelTab = {
        id: tabId,
        label: `${containerName} - Terminal`,
        type: "terminal",
        containerId,
        containerName
      };

      return [...current, newTab];
    });
    setActiveTabId(tabId);
  }, []);

  const openLogs = useCallback((containerId: string, containerName: string) => {
    const tabId = `logs-${containerId}`;
    setTabs((current) => {
      if (current.some((tab) => tab.id === tabId)) {
        return current;
      }

      const newTab: PanelTab = {
        id: tabId,
        label: `${containerName} - Logs`,
        type: "logs",
        containerId,
        containerName
      };

      return [...current, newTab];
    });
    setActiveTabId(tabId);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    let nextTabs: PanelTab[] = [];
    setTabs((current) => {
      nextTabs = current.filter((tab) => tab.id !== tabId);
      return nextTabs;
    });
    setActiveTabId((current) => {
      if (current === tabId) {
        return nextTabs[0]?.id ?? null;
      }
      return current;
    });
  }, []);

  const closePanel = useCallback(() => {
    setTabs([]);
    setActiveTabId(null);
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

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

