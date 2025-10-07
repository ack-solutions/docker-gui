import type { Theme } from "@mui/material/styles";

const listItemButtonOverrides = (theme: Theme) => ({
  root: {
    borderRadius: theme.shape.borderRadius,
    paddingBlock: theme.spacing(0.75),
    paddingInline: theme.spacing(1.25),
    color: theme.palette.text.secondary,
    transition: theme.transitions.create(["background-color", "color"], {
      duration: theme.transitions.duration.shortest
    }),
    '&:hover': {
      backgroundColor: theme.palette.action.hover
    },
    '&.Mui-selected': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.primary.contrastText,
      '&:hover': {
        backgroundColor: theme.palette.primary.main
      }
    },
    '& .MuiListItemIcon-root': {
      color: "inherit",
      minWidth: theme.spacing(4)
    }
  }
});

export default listItemButtonOverrides;
