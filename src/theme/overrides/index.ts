import type { Theme } from "@mui/material/styles";
import appBarOverrides from "@/theme/overrides/app-bar";
import buttonOverrides from "@/theme/overrides/button";
import chipOverrides from "@/theme/overrides/chip";
import containerOverrides from "@/theme/overrides/container";
import cssBaselineOverrides from "@/theme/overrides/css-baseline";
import listItemButtonOverrides from "@/theme/overrides/list-item-button";
import paperOverrides from "@/theme/overrides/paper";
import toolbarOverrides from "@/theme/overrides/toolbar";

const buildComponentOverrides = (theme: Theme) => ({
  MuiCssBaseline: {
    styleOverrides: cssBaselineOverrides(theme)
  },
  MuiButton: {
    defaultProps: {
      variant: "contained" as const
    },
    styleOverrides: buttonOverrides(theme)
  },
  MuiPaper: {
    defaultProps: {
      elevation: 0,
      variant: "outlined" as const
    },
    styleOverrides: paperOverrides(theme)
  },
  MuiAppBar: {
    defaultProps: {
      color: "transparent" as const,
      elevation: 0
    },
    styleOverrides: appBarOverrides(theme)
  },
  MuiContainer: {
    defaultProps: {
      maxWidth: "xl" as const
    },
    styleOverrides: containerOverrides(theme)
  },
  MuiListItemButton: {
    styleOverrides: listItemButtonOverrides(theme)
  },
  MuiToolbar: {
    styleOverrides: toolbarOverrides
  },
  MuiChip: {
    styleOverrides: chipOverrides(theme)
  }
});

export default buildComponentOverrides;
