"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useReducer
} from "react";

export type UITabKind = "terminal" | "logs" | "custom";

export interface UITab {
  id: string;
  label: string;
  kind: UITabKind;
  payload?: Record<string, unknown>;
}

interface BottomPanelState {
  tabs: UITab[];
  activeTabId: string | null;
  isMinimized: boolean;
}

interface RightDrawerState {
  isOpen: boolean;
  view: string | null;
  payload: Record<string, unknown> | null;
}

interface UIState {
  bottomPanel: BottomPanelState;
  rightDrawer: RightDrawerState;
}

const initialState: UIState = {
  bottomPanel: {
    tabs: [],
    activeTabId: null,
    isMinimized: false
  },
  rightDrawer: {
    isOpen: false,
    view: null,
    payload: null
  }
};

type UIAction =
  | { type: "BOTTOM_TAB_OPEN"; tab: UITab }
  | { type: "BOTTOM_TAB_CLOSE"; tabId: string }
  | { type: "BOTTOM_TAB_SET_ACTIVE"; tabId: string }
  | { type: "BOTTOM_PANEL_CLOSE" }
  | { type: "BOTTOM_PANEL_TOGGLE_MINIMIZE" }
  | { type: "RIGHT_DRAWER_OPEN"; view: string; payload?: Record<string, unknown> | null }
  | { type: "RIGHT_DRAWER_CLOSE" };

const uiReducer = (state: UIState, action: UIAction): UIState => {
  switch (action.type) {
    case "BOTTOM_TAB_OPEN": {
      const existingIndex = state.bottomPanel.tabs.findIndex((tab) => tab.id === action.tab.id);
      const nextTabs = existingIndex >= 0
        ? state.bottomPanel.tabs.map((tab) => (tab.id === action.tab.id ? action.tab : tab))
        : [...state.bottomPanel.tabs, action.tab];

      return {
        ...state,
        bottomPanel: {
          tabs: nextTabs,
          activeTabId: action.tab.id,
          isMinimized: false
        }
      };
    }
    case "BOTTOM_TAB_CLOSE": {
      const remainingTabs = state.bottomPanel.tabs.filter((tab) => tab.id !== action.tabId);
      const activeTabId =
        state.bottomPanel.activeTabId === action.tabId
          ? remainingTabs[remainingTabs.length - 1]?.id ?? null
          : state.bottomPanel.activeTabId;

      return {
        ...state,
        bottomPanel: {
          tabs: remainingTabs,
          activeTabId,
          isMinimized: remainingTabs.length === 0 ? false : state.bottomPanel.isMinimized
        }
      };
    }
    case "BOTTOM_TAB_SET_ACTIVE":
      return {
        ...state,
        bottomPanel: {
          ...state.bottomPanel,
          activeTabId: action.tabId
        }
      };
    case "BOTTOM_PANEL_CLOSE":
      return {
        ...state,
        bottomPanel: {
          tabs: [],
          activeTabId: null,
          isMinimized: false
        }
      };
    case "BOTTOM_PANEL_TOGGLE_MINIMIZE":
      if (state.bottomPanel.tabs.length === 0) {
        return state;
      }
      return {
        ...state,
        bottomPanel: {
          ...state.bottomPanel,
          isMinimized: !state.bottomPanel.isMinimized
        }
      };
    case "RIGHT_DRAWER_OPEN":
      return {
        ...state,
        rightDrawer: {
          isOpen: true,
          view: action.view,
          payload: action.payload ?? null
        }
      };
    case "RIGHT_DRAWER_CLOSE":
      return {
        ...state,
        rightDrawer: {
          isOpen: false,
          view: null,
          payload: null
        }
      };
    default:
      return state;
  }
};

interface UIContextValue {
  state: UIState;
  dispatch: React.Dispatch<UIAction>;
}

const UIContext = createContext<UIContextValue | undefined>(undefined);

export const UIProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(uiReducer, initialState);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
};

const useUIContext = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
};

export const useBottomPanel = () => {
  const { state, dispatch } = useUIContext();

  const openTab = useCallback(
    (tab: UITab) => {
      dispatch({ type: "BOTTOM_TAB_OPEN", tab });
    },
    [dispatch]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      dispatch({ type: "BOTTOM_TAB_CLOSE", tabId });
    },
    [dispatch]
  );

  const setActiveTab = useCallback(
    (tabId: string) => {
      dispatch({ type: "BOTTOM_TAB_SET_ACTIVE", tabId });
    },
    [dispatch]
  );

  const closePanel = useCallback(() => {
    dispatch({ type: "BOTTOM_PANEL_CLOSE" });
  }, [dispatch]);

  const toggleMinimize = useCallback(() => {
    dispatch({ type: "BOTTOM_PANEL_TOGGLE_MINIMIZE" });
  }, [dispatch]);

  const openTerminal = useCallback(
    (containerId: string, containerName: string) => {
      openTab({
        id: `terminal-${containerId}`,
        label: `${containerName} · Shell`,
        kind: "terminal",
        payload: { containerId, containerName }
      });
    },
    [openTab]
  );

  const openLogs = useCallback(
    (containerId: string, containerName: string) => {
      openTab({
        id: `logs-${containerId}`,
        label: `${containerName} · Logs`,
        kind: "logs",
        payload: { containerId, containerName }
      });
    },
    [openTab]
  );

  return {
    tabs: state.bottomPanel.tabs,
    activeTabId: state.bottomPanel.activeTabId,
    isMinimized: state.bottomPanel.isMinimized,
    isOpen: state.bottomPanel.tabs.length > 0,
    openTab,
    closeTab,
    setActiveTab,
    closePanel,
    toggleMinimize,
    openTerminal,
    openLogs
  };
};

export const useRightDrawer = () => {
  const { state, dispatch } = useUIContext();

  const open = useCallback(
    (view: string, payload?: Record<string, unknown> | null) => {
      dispatch({ type: "RIGHT_DRAWER_OPEN", view, payload });
    },
    [dispatch]
  );

  const close = useCallback(() => {
    dispatch({ type: "RIGHT_DRAWER_CLOSE" });
  }, [dispatch]);

  return {
    state: state.rightDrawer,
    open,
    close
  };
};

export type { UIState };
