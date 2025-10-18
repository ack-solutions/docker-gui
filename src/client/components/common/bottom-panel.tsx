"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import CloseIcon from "@mui/icons-material/Close";
import MinimizeIcon from "@mui/icons-material/Minimize";
import MaximizeIcon from "@mui/icons-material/Maximize";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import { Box, IconButton, Paper, Stack, Tab, Tabs, Typography, Portal } from "@mui/material";
import { styled } from "@mui/material/styles";
import { DEFAULT_PANEL_HEIGHT, MAX_PANEL_HEIGHT, MIN_PANEL_HEIGHT } from "@/components/common/bottom-panel-context";

interface BottomPanelTab {
  id: string;
  label: string;
  content: ReactNode;
  onClose?: () => void;
}

interface BottomPanelProps {
  tabs: BottomPanelTab[];
  activeTabId?: string;
  height?: number;
  minHeight?: number;
  maxHeight?: number;
  leftOffset?: number;
  onTabChange?: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
  onClose?: () => void;
  onHeightChange?: (height: number) => void;
  onHeightCommit?: (height: number) => void;
}

const PanelContainer = styled(Paper, {
  shouldForwardProp: (prop) => prop !== "$isMinimized" && prop !== "$height" && prop !== "$leftOffset"
})<{ $isMinimized: boolean; $height: number; $leftOffset: number }>(({ theme, $isMinimized, $height, $leftOffset }) => ({
  position: "fixed",
  bottom: 0,
  left: Math.max(0, $leftOffset),
  right: 0,
  height: $isMinimized ? 48 : $height,
  width: $leftOffset > 0 ? `calc(100% - ${$leftOffset}px)` : "100%",
  flexShrink: 0,
  borderTop: `1px solid ${theme.palette.divider}`,
  borderRadius: 0,
  display: "flex",
  flexDirection: "column",
  transition: $isMinimized ? theme.transitions.create("height", {
    duration: theme.transitions.duration.standard
  }) : "none",
  overflow: "hidden",
  backgroundColor: theme.palette.mode === "dark"
    ? "rgba(11, 17, 32, 0.96)"
    : theme.palette.background.paper,
  backdropFilter: $isMinimized ? "none" : "blur(12px)",
  zIndex: theme.zIndex.drawer + 2,
  [theme.breakpoints.down("md")]: {
    left: 0
  }
}));

const ResizeHandle = styled(Box)(({ theme }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 6,
  cursor: "ns-resize",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "transparent",
  "&:hover": {
    backgroundColor: theme.palette.primary.main + "20"
  },
  "&:active": {
    backgroundColor: theme.palette.primary.main + "40"
  }
}));

const ResizeIndicator = styled(DragHandleIcon)(({ theme }) => ({
  fontSize: 16,
  color: theme.palette.text.disabled,
  pointerEvents: "none"
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
  minHeight: 48,
  position: "relative"
}));

const PanelContent = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: "auto",
  backgroundColor: theme.palette.mode === "dark" 
    ? "rgba(11, 17, 32, 0.95)" 
    : theme.palette.background.default
}));

export const BottomPanel = ({
  tabs,
  activeTabId,
  height,
  minHeight,
  maxHeight,
  leftOffset = 0,
  onTabChange,
  onTabClose,
  onClose,
  onHeightChange,
  onHeightCommit
}: BottomPanelProps) => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [currentTabId, setCurrentTabId] = useState(activeTabId || tabs[0]?.id);
  const [isResizing, setIsResizing] = useState(false);
  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const latestHeightRef = useRef(height ?? DEFAULT_PANEL_HEIGHT);

  useEffect(() => {
    latestHeightRef.current = height ?? DEFAULT_PANEL_HEIGHT;
  }, [height]);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMinimized) {
      return;
    }
    setIsResizing(true);
    startYRef.current = e.clientY;
    startHeightRef.current = height ?? DEFAULT_PANEL_HEIGHT;
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = startYRef.current - e.clientY;
      const resolvedMin = minHeight ?? MIN_PANEL_HEIGHT;
      const resolvedMax = maxHeight ?? MAX_PANEL_HEIGHT;
      const newHeight = Math.max(resolvedMin, Math.min(resolvedMax, startHeightRef.current + deltaY));
      latestHeightRef.current = newHeight;
      onHeightChange?.(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      onHeightCommit?.(latestHeightRef.current);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, maxHeight, minHeight, onHeightChange, onHeightCommit]);

  const activeTab = tabs.find((tab) => tab.id === currentTabId);

  if (tabs.length === 0) return null;

  return (
    <Portal>
      <PanelContainer
        elevation={8}
        $isMinimized={isMinimized}
        $height={height ?? DEFAULT_PANEL_HEIGHT}
        $leftOffset={leftOffset}
      >
        {!isMinimized && (
          <ResizeHandle onMouseDown={handleMouseDown}>
            <ResizeIndicator />
          </ResizeHandle>
        )}
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
                    {(onTabClose || tab.onClose) && (
                      <IconButton
                        size="small"
                        onClick={(event) => {
                          event.stopPropagation();
                          tab.onClose?.();
                          onTabClose?.(tab.id);
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
    </Portal>
  );
};

export default BottomPanel;
