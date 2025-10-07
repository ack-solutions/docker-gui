import type { Theme } from "@mui/material/styles";

const appBarOverrides = (theme: Theme) => ({
  root: {
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundColor:
      theme.palette.mode === "dark"
        ? "rgba(11, 17, 32, 0.85)"
        : theme.palette.background.paper,
    backdropFilter: "blur(10px)",
    minHeight: 56
  }
});

export default appBarOverrides;
