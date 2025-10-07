import type { Theme } from "@mui/material/styles";

const cssBaselineOverrides = (theme: Theme) => ({
  body: {
    background:
      theme.palette.mode === "dark"
        ? "radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.18), transparent 42%), #0b1120"
        : theme.palette.background.default,
    minHeight: "100vh",
    color: theme.palette.text.primary,
    fontFeatureSettings: "\"ss01\"",
    letterSpacing: "0.01em"
  },
  "*, *::before, *::after": {
    boxSizing: "border-box"
  }
});

export default cssBaselineOverrides;
