import { IconButton, IconButtonProps } from "@mui/material";
import { styled } from "@mui/material/styles";

const StyledIconButton = styled(IconButton)(({ theme, color = "default" }) => {
  const getColorStyles = () => {
    switch (color) {
      case "primary":
        return {
          backgroundColor: theme.palette.mode === "dark" 
            ? "rgba(56, 189, 248, 0.12)" 
            : theme.palette.primary.light + "20",
          color: theme.palette.primary.main,
          "&:hover": {
            backgroundColor: theme.palette.mode === "dark"
              ? "rgba(56, 189, 248, 0.20)"
              : theme.palette.primary.light + "40"
          }
        };
      case "secondary":
        return {
          backgroundColor: theme.palette.mode === "dark"
            ? "rgba(251, 191, 36, 0.12)"
            : theme.palette.secondary.light + "20",
          color: theme.palette.secondary.main,
          "&:hover": {
            backgroundColor: theme.palette.mode === "dark"
              ? "rgba(251, 191, 36, 0.20)"
              : theme.palette.secondary.light + "40"
          }
        };
      case "warning":
        return {
          backgroundColor: theme.palette.mode === "dark"
            ? "rgba(250, 204, 21, 0.12)"
            : theme.palette.warning.light + "20",
          color: theme.palette.warning.main,
          "&:hover": {
            backgroundColor: theme.palette.mode === "dark"
              ? "rgba(250, 204, 21, 0.20)"
              : theme.palette.warning.light + "40"
          }
        };
      case "error":
        return {
          backgroundColor: theme.palette.mode === "dark"
            ? "rgba(248, 113, 113, 0.12)"
            : theme.palette.error.light + "20",
          color: theme.palette.error.main,
          "&:hover": {
            backgroundColor: theme.palette.mode === "dark"
              ? "rgba(248, 113, 113, 0.20)"
              : theme.palette.error.light + "40"
          }
        };
      case "success":
        return {
          backgroundColor: theme.palette.mode === "dark"
            ? "rgba(74, 222, 128, 0.12)"
            : theme.palette.success.light + "20",
          color: theme.palette.success.main,
          "&:hover": {
            backgroundColor: theme.palette.mode === "dark"
              ? "rgba(74, 222, 128, 0.20)"
              : theme.palette.success.light + "40"
          }
        };
      default:
        return {
          backgroundColor: theme.palette.action.hover,
          color: theme.palette.text.primary,
          "&:hover": {
            backgroundColor: theme.palette.action.selected
          }
        };
    }
  };

  return {
    ...getColorStyles(),
    transition: theme.transitions.create(["background-color", "transform"], {
      duration: theme.transitions.duration.shorter
    }),
    "&:active": {
      transform: "scale(0.95)"
    }
  };
});

export const ActionIconButton = (props: IconButtonProps) => {
  return <StyledIconButton {...props} />;
};

export default ActionIconButton;

