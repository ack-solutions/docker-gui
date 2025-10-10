import { styled } from "@mui/material/styles";

const UsageBarContainer = styled("div")(({ theme }) => ({
  height: 8,
  borderRadius: 4,
  backgroundColor: theme.palette.mode === "dark" ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.1)",
  position: "relative",
  overflow: "hidden"
}));

const UsageBarFill = styled("div")<{ value: number }>(({ theme, value }) => ({
  height: "100%",
  width: `${Math.min(value, 100)}%`,
  backgroundColor: theme.palette.primary.main,
  transition: "width 0.3s ease"
}));

interface UsageBarProps {
  value: number;
}

const UsageBar = ({ value }: UsageBarProps) => {
  return (
    <UsageBarContainer>
      <UsageBarFill value={Math.min(value, 100)} />
    </UsageBarContainer>
  );
};

export default UsageBar;

