import { PaletteMode, ThemeOptions } from "@mui/material";
import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";

const paletteByMode = (mode: PaletteMode): ThemeOptions["palette"] => {
  if (mode === "dark") {
    return {
      mode: "dark",
      primary: {
        main: "#38bdf8",
        contrastText: "#0b1120"
      },
      secondary: {
        main: "#fbbf24"
      },
      success: {
        main: "#4ade80"
      },
      warning: {
        main: "#facc15"
      },
      error: {
        main: "#f87171"
      },
      background: {
        default: "#0b1120",
        paper: "#111827"
      },
      divider: "rgba(148, 163, 184, 0.16)",
      text: {
        primary: "#f8fafc",
        secondary: "#cbd5f5",
        disabled: "rgba(203, 213, 225, 0.48)"
      }
    };
  }

  return {
    mode: "light",
    primary: {
      main: "#0284c7"
    },
    secondary: {
      main: "#f97316"
    },
    background: {
      default: "#f8fafc",
      paper: "#ffffff"
    },
    divider: "rgba(148, 163, 184, 0.24)",
    text: {
      primary: "#0f172a",
      secondary: "#475569"
    }
  };
};

const typography: ThemeOptions["typography"] = {
  fontFamily: "'Inter', 'Roboto', 'Helvetica', 'Arial', sans-serif",
  h1: { fontWeight: 600 },
  h2: { fontWeight: 600 },
  h3: { fontWeight: 600 },
  subtitle1: { fontWeight: 600 }
};

const componentOverrides = (theme: Theme): ThemeOptions["components"] => ({
  MuiCssBaseline: {
    styleOverrides: {
      body: {
        background:
          theme.palette.mode === "dark"
            ? "radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.18), transparent 40%), #0b1120"
            : theme.palette.background.default,
        minHeight: "100vh",
        color: theme.palette.text.primary
      },
      "*, *::before, *::after": {
        boxSizing: "border-box"
      }
    }
  },
  MuiButton: {
    defaultProps: {
      variant: "contained"
    },
    styleOverrides: {
      root: {
        borderRadius:
          typeof theme.shape.borderRadius === "number"
            ? theme.shape.borderRadius * 3
            : theme.shape.borderRadius,
        textTransform: "none",
        fontWeight: 600,
        paddingInline: theme.spacing(2.5)
      }
    }
  },
  MuiPaper: {
    defaultProps: {
      elevation: 0,
      variant: "outlined"
    },
    styleOverrides: {
      root: {
        backgroundImage: "none",
        padding: theme.spacing(3),
        borderRadius:
          typeof theme.shape.borderRadius === "number"
            ? theme.shape.borderRadius * 1.5
            : theme.shape.borderRadius,
        borderColor: theme.palette.mode === "dark" ? "rgba(148, 163, 184, 0.18)" : theme.palette.divider
      }
    }
  },
  MuiAppBar: {
    defaultProps: {
      color: "transparent",
      elevation: 0
    },
    styleOverrides: {
      root: {
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.mode === "dark" ? "rgba(15, 23, 42, 0.92)" : theme.palette.background.paper,
        backdropFilter: "blur(12px)"
      }
    }
  },
  MuiContainer: {
    defaultProps: {
      maxWidth: "xl"
    },
    styleOverrides: {
      root: {
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(4)
      }
    }
  },
  MuiListItemButton: {
    styleOverrides: {
      root: {
        borderRadius: theme.shape.borderRadius,
        paddingBlock: theme.spacing(1),
        paddingInline: theme.spacing(1.5)
      }
    }
  },
  MuiToolbar: {
    styleOverrides: {
      root: {
        gap: 16,
        minHeight: 80
      }
    }
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: theme.shape.borderRadius
      }
    }
  }
});

const createAppTheme = (mode: PaletteMode = "dark") => {
  const baseTheme = createTheme({
    palette: paletteByMode(mode),
    typography,
    spacing: 8,
    shape: {
      borderRadius: 12
    }
  });

  const themeWithComponents = createTheme({
    ...baseTheme,
    components: componentOverrides(baseTheme)
  });

  return responsiveFontSizes(themeWithComponents);
};

export default createAppTheme;
