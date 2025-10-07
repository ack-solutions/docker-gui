"use client";

import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

interface TerminalPanelProps {
  containerId: string;
  containerName?: string;
}

const TerminalContainer = styled(Box)(({ theme }) => ({
  width: "100%",
  height: "100%",
  backgroundColor: theme.palette.mode === "dark" ? "#000000" : "#1e1e1e",
  color: "#00ff00",
  fontFamily: "'Courier New', monospace",
  padding: theme.spacing(2),
  overflow: "auto"
}));

export const TerminalPanel = ({ containerId, containerName }: TerminalPanelProps) => {
  // This would connect to your backend WebSocket for terminal
  // For now, showing a placeholder
  
  return (
    <TerminalContainer>
      <Stack spacing={1}>
        <Typography variant="body2" sx={{ fontFamily: "inherit", color: "inherit" }}>
          $ Connecting to container {containerName || containerId}...
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: "inherit", color: "inherit" }}>
          $ Terminal session will be available here
        </Typography>
        <Typography variant="body2" sx={{ fontFamily: "inherit", color: "#888" }}>
          # Note: Terminal WebSocket integration pending
        </Typography>
      </Stack>
    </TerminalContainer>
  );
};

export default TerminalPanel;

