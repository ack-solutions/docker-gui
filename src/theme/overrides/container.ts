import type { Theme } from "@mui/material/styles";

const containerOverrides = (theme: Theme) => ({
  root: {
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(3)
  }
});

export default containerOverrides;
