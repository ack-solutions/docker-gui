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

// Helper function to get initial theme mode
const getInitialMode = (): PaletteMode => {
  if (typeof window === "undefined") {
    return "light"; // SSR default
  }

  // First, check localStorage for saved preference
  const savedMode = localStorage.getItem("theme-mode");
  if (savedMode === "light" || savedMode === "dark") {
    return savedMode;
  }

  // If no saved preference, use system preference
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
};

export const ThemeContextProvider = ({ children }: ThemeContextProviderProps) => {
  // Initialize with the correct value immediately to avoid flash
  const [mode, setMode] = useState<PaletteMode>(getInitialMode);

  // Initialize on mount and listen for system theme changes
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const savedMode = localStorage.getItem("theme-mode");
    
    // If there's a saved preference, use it
    if (savedMode === "light" || savedMode === "dark") {
      setMode(savedMode);
      return;
    }

    // No saved preference - use system preference
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const systemMode = mediaQuery.matches ? "dark" : "light";
    setMode(systemMode);

    // Listen for system theme changes (only if no saved preference)
    const handleChange = (e: MediaQueryListEvent) => {
      setMode(e.matches ? "dark" : "light");
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    } else {
      // Fallback for older browsers
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, []);

  // Update document attribute whenever mode changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.dataset.themeMode = mode;
    }
  }, [mode]);

  const toggleTheme = () => {
    setMode((prevMode) => {
      const newMode = prevMode === "light" ? "dark" : "light";
      // Save to localStorage when user explicitly toggles
      if (typeof window !== "undefined") {
        localStorage.setItem("theme-mode", newMode);
      }
      return newMode;
    });
  };

  const value = useMemo(() => ({ mode, toggleTheme }), [mode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
