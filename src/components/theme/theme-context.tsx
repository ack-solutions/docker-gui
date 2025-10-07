"use client";

import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { PaletteMode } from "@mui/material";

interface ThemeContextType {
  mode: PaletteMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useThemeMode = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useThemeMode must be used within ThemeContextProvider");
  }
  return context;
};

interface ThemeContextProviderProps {
  children: ReactNode;
}

export const ThemeContextProvider = ({ children }: ThemeContextProviderProps) => {
  const [mode, setMode] = useState<PaletteMode>(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("theme-mode");
      return (savedMode as PaletteMode) || "dark";
    }
    return "dark";
  });

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("theme-mode", mode);
    }
  }, [mode]);

  const toggleTheme = () => {
    setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
  };

  const value = useMemo(() => ({ mode, toggleTheme }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

