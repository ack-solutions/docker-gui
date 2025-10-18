"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

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
  panelHeight: number;
  minPanelHeight: number;
  maxPanelHeight: number;
  openTerminal: (containerId: string, containerName: string) => void;
  openLogs: (containerId: string, containerName: string) => void;
  closeTab: (tabId: string) => void;
  closePanel: () => void;
  setActiveTab: (tabId: string) => void;
  setPanelHeight: (height: number) => void;
  commitPanelHeight: (height: number) => void;
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

const STORAGE_KEY = "docker-gui-bottom-panel-height";
export const DEFAULT_PANEL_HEIGHT = 400;
export const MIN_PANEL_HEIGHT = 200;
export const MAX_PANEL_HEIGHT = 800;

const clampHeight = (height: number) => Math.max(MIN_PANEL_HEIGHT, Math.min(MAX_PANEL_HEIGHT, height));

export const BottomPanelProvider = ({ children }: BottomPanelProviderProps) => {
  const [tabs, setTabs] = useState<PanelTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [panelHeight, setPanelHeightState] = useState<number>(DEFAULT_PANEL_HEIGHT);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedHeight = window.localStorage.getItem(STORAGE_KEY);
    if (!savedHeight) {
      return;
    }

    const parsedHeight = parseInt(savedHeight, 10);
    if (!Number.isNaN(parsedHeight)) {
      setPanelHeightState(clampHeight(parsedHeight));
    }
  }, []);

  const setPanelHeight = useCallback((height: number) => {
    setPanelHeightState(clampHeight(height));
  }, []);

  const commitPanelHeight = useCallback((height: number) => {
    const clampedHeight = clampHeight(height);
    setPanelHeightState(clampedHeight);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, clampedHeight.toString());
    }
  }, []);

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
    panelHeight,
    minPanelHeight: MIN_PANEL_HEIGHT,
    maxPanelHeight: MAX_PANEL_HEIGHT,
    openTerminal,
    openLogs,
    closeTab,
    closePanel,
    setActiveTab,
    setPanelHeight,
    commitPanelHeight
  };

  return (
    <BottomPanelContext.Provider value={value}>
      {children}
    </BottomPanelContext.Provider>
  );
};
