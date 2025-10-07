"use client";

import { ReactNode, useMemo } from "react";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import createAppTheme from "@/theme";
import { ThemeContextProvider, useThemeMode } from "./theme-context";

interface ThemeRegistryProps {
  children: ReactNode;
}

const ThemeRegistryInner = ({ children }: ThemeRegistryProps) => {
  const { mode } = useThemeMode();
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

const ThemeRegistry = ({ children }: ThemeRegistryProps) => {
  return (
    <ThemeContextProvider>
      <ThemeRegistryInner>{children}</ThemeRegistryInner>
    </ThemeContextProvider>
  );
};

export default ThemeRegistry;
