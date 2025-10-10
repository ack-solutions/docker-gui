import type { Theme } from "@mui/material/styles";

const cardOverrides = (theme: Theme) => ({
  root: {
    backgroundImage: "none",
    borderRadius:
      typeof theme.shape.borderRadius === "number"
        ? theme.shape.borderRadius * 1.5
        : theme.shape.borderRadius,
    borderColor: theme.palette.mode === "dark" ? "rgba(148, 163, 184, 0.16)" : theme.palette.divider
  }
});

export default cardOverrides;

