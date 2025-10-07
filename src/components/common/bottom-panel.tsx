"use client";

import { ReactNode, useEffect, useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import MinimizeIcon from "@mui/icons-material/Minimize";
import MaximizeIcon from "@mui/icons-material/Maximize";
import { Box, IconButton, Paper, Stack, Tab, Tabs, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

interface BottomPanelTab {
  id: string;
  label: string;
  content: ReactNode;
  onClose?: () => void;
}

interface BottomPanelProps {
  tabs: BottomPanelTab[];
  activeTabId?: string;
  onTabChange?: (tabId: string) => void;
  onClose?: () => void;
}

const PanelContainer = styled(Paper, {
  shouldForwardProp: (prop) => prop !== "$isMinimized"
})<{ $isMinimized: boolean }>(({ theme, $isMinimized }) => ({
  position: "fixed",
  bottom: 0,
  left: 240,
  right: 0,
  height: $isMinimized ? 48 : 400,
  borderTop: `1px solid ${theme.palette.divider}`,
  borderRadius: 0,
  display: "flex",
  flexDirection: "column",
  transition: theme.transitions.create("height", {
    duration: theme.transitions.duration.standard
  }),
  zIndex: theme.zIndex.appBar,
  overflow: "hidden"
}));

const PanelHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.mode === "dark" 
    ? "rgba(17, 24, 39, 0.95)" 
    : theme.palette.background.paper,
  backdropFilter: "blur(8px)",
  minHeight: 48
}));

const PanelContent = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: "auto",
  backgroundColor: theme.palette.mode === "dark" 
    ? "rgba(11, 17, 32, 0.95)" 
    : theme.palette.background.default
}));

export const BottomPanel = ({ tabs, activeTabId, onTabChange, onClose }: BottomPanelProps) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentTabId, setCurrentTabId] = useState(activeTabId || tabs[0]?.id);

  useEffect(() => {
    if (activeTabId && activeTabId !== currentTabId) {
      setCurrentTabId(activeTabId);
      return;
    }

    if (!activeTabId && tabs.length > 0 && !tabs.find((tab) => tab.id === currentTabId)) {
      setCurrentTabId(tabs[0].id);
    }
  }, [activeTabId, currentTabId, tabs]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: string) => {
    setCurrentTabId(newValue);
    onTabChange?.(newValue);
  };

  const handleClose = () => {
    onClose?.();
  };

  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const activeTab = tabs.find((tab) => tab.id === currentTabId);

  if (tabs.length === 0) return null;

  return (
    <PanelContainer elevation={8} $isMinimized={isMinimized}>
      <PanelHeader>
        <Tabs
          value={currentTabId}
          onChange={handleTabChange}
          sx={{ minHeight: 48 }}
        >
          {tabs.map((tab) => (
            <Tab
              key={tab.id}
              label={
                <Stack direction="row" alignItems="center" spacing={1} sx={{ textTransform: "none" }}>
                  <Typography variant="body2" sx={{ textTransform: "none" }}>
                    {tab.label}
                  </Typography>
                  {tab.onClose && (
                    <IconButton
                      size="small"
                      onClick={(event) => {
                        event.stopPropagation();
                        tab.onClose?.();
                      }}
                      onMouseDown={(event) => event.stopPropagation()}
                    >
                      <CloseIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  )}
                </Stack>
              }
              value={tab.id}
              sx={{ minHeight: 48 }}
            />
          ))}
        </Tabs>
        <Stack direction="row" spacing={0.5} sx={{ px: 1 }}>
          <IconButton size="small" onClick={handleToggleMinimize}>
            {isMinimized ? <MaximizeIcon fontSize="small" /> : <MinimizeIcon fontSize="small" />}
          </IconButton>
          <IconButton size="small" onClick={handleClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </PanelHeader>
      {!isMinimized && (
        <PanelContent>
          {activeTab?.content}
        </PanelContent>
      )}
    </PanelContainer>
  );
};

export default BottomPanel;

