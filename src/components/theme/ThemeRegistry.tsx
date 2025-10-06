"use client";

import { ReactNode, useMemo } from "react";
import { CssBaseline, PaletteMode } from "@mui/material";
import { ThemeProvider, createTheme, responsiveFontSizes } from "@mui/material/styles";

const buildTheme = (mode: PaletteMode) =>
  responsiveFontSizes(
    createTheme({
      palette: {
        mode,
        primary: {
          main: "#38bdf8"
        },
        secondary: {
          main: "#fbbf24"
        },
        background: {
          default: "#0f172a",
          paper: "#111827"
        },
        text: {
          primary: "#f8fafc",
          secondary: "#cbd5f5"
        }
      },
      typography: {
        fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
        h1: {
          fontWeight: 600
        },
        h2: {
          fontWeight: 600
        },
        h3: {
          fontWeight: 600
        }
      },
      shape: {
        borderRadius: 12
      },
      components: {
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: "none"
            }
          }
        },
        MuiButton: {
          defaultProps: {
            variant: "contained"
          },
          styleOverrides: {
            root: {
              textTransform: "none",
              borderRadius: 999
            }
          }
        },
        MuiAppBar: {
          styleOverrides: {
            colorPrimary: {
              backgroundColor: "#0f172a"
            }
          }
        }
      }
    })
  );

interface ThemeRegistryProps {
  children: ReactNode;
  mode?: PaletteMode;
}

const ThemeRegistry = ({ children, mode = "dark" }: ThemeRegistryProps) => {
  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};

export default ThemeRegistry;
