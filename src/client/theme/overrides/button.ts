import type { Theme } from "@mui/material/styles";

const buttonOverrides = (theme: Theme) => ({
  root: {
    borderRadius:
      typeof theme.shape.borderRadius === "number"
        ? theme.shape.borderRadius * 2
        : theme.shape.borderRadius,
    textTransform: "none" as const,
    fontWeight: 600,
    paddingInline: theme.spacing(2),
    paddingBlock: theme.spacing(1)
  },
  sizeSmall: {
    paddingInline: theme.spacing(1.5),
    paddingBlock: theme.spacing(0.75),
    fontSize: theme.typography.pxToRem(13)
  }
});

export default buttonOverrides;
