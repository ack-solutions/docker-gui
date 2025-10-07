"use client";

import { ReactNode, useMemo } from "react";
import { CssBaseline, PaletteMode } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import createAppTheme from "@/theme";

interface ThemeRegistryProps {
  children: ReactNode;
  mode?: PaletteMode;
}

const ThemeRegistry = ({ children, mode = "dark" }: ThemeRegistryProps) => {
  const theme = useMemo(() => createAppTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

export default ThemeRegistry;
