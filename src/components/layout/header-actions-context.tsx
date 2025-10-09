"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface HeaderActions {
  onRefresh?: () => void;
}

interface HeaderActionsContextValue {
  actions: HeaderActions;
  setActions: (actions: HeaderActions) => void;
  clearActions: () => void;
}

const HeaderActionsContext = createContext<HeaderActionsContextValue | null>(null);

export const HeaderActionsProvider = ({ children }: { children: ReactNode }) => {
  const [actions, setActionsState] = useState<HeaderActions>({});

  const setActions = useCallback((next: HeaderActions) => {
    setActionsState(next);
  }, []);

  const clearActions = useCallback(() => {
    setActionsState({});
  }, []);

  const value = useMemo<HeaderActionsContextValue>(
    () => ({ actions, setActions, clearActions }),
    [actions, setActions, clearActions]
  );

  return (
    <HeaderActionsContext.Provider value={value}>
      {children}
    </HeaderActionsContext.Provider>
  );
};

export const useHeaderActions = () => {
  const context = useContext(HeaderActionsContext);
  if (!context) {
    throw new Error("useHeaderActions must be used within a HeaderActionsProvider.");
  }
  return context;
};

export const useHeaderActionsConfig = () => useHeaderActions().actions;

export default HeaderActionsContext;
