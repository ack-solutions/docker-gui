import type { Theme } from "@mui/material/styles";

const cardContentOverrides = (theme: Theme) => ({
  root: {
    padding: theme.spacing(2.5),
    "&:last-child": {
      paddingBottom: theme.spacing(2.5)
    }
  }
});

export default cardContentOverrides;

