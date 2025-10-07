import type { Theme } from "@mui/material/styles";

const chipOverrides = (theme: Theme) => ({
  root: {
    borderRadius: theme.shape.borderRadius,
    fontWeight: 600
  }
});

export default chipOverrides;
