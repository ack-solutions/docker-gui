import { PaletteMode, ThemeOptions } from "@mui/material";
import { createTheme, responsiveFontSizes } from "@mui/material/styles";
import buildComponentOverrides from "@/theme/overrides";

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
  h5: { fontWeight: 600 },
  h6: { fontWeight: 600 },
  subtitle1: { fontWeight: 600 },
  subtitle2: { fontWeight: 600 }
};

const createAppTheme = (mode: PaletteMode = "dark") => {
  const baseTheme = createTheme({
    palette: paletteByMode(mode),
    typography,
    spacing: 8,
    shape: {
      borderRadius: 8
    }
  });

  const themeWithComponents = createTheme({
    ...baseTheme,
    components: buildComponentOverrides(baseTheme)
  });

  return responsiveFontSizes(themeWithComponents);
};

export default createAppTheme;
