"use client";

import { ReactNode, useEffect, useState, useRef } from "react";
import CloseIcon from "@mui/icons-material/Close";
import MinimizeIcon from "@mui/icons-material/Minimize";
import MaximizeIcon from "@mui/icons-material/Maximize";
import DragHandleIcon from "@mui/icons-material/DragHandle";
import { Box, IconButton, Paper, Stack, Tab, Tabs, Typography, Portal, Tooltip } from "@mui/material";
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
    ? "rgba(11, 17, 32, 0.98)"
    : theme.palette.background.paper,
  backdropFilter: "blur(12px)",
  zIndex: theme.zIndex.drawer + 2,
  boxShadow: theme.shadows[16],
  [theme.breakpoints.down("md")]: {
    left: 0
  }
}));

const ResizeHandle = styled(Box, {
  shouldForwardProp: (prop) => prop !== "$isDragging"
})<{ $isDragging: boolean }>(({ theme, $isDragging }) => ({
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: 8,
  cursor: "ns-resize",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: $isDragging ? theme.palette.primary.main + "40" : "transparent",
  transition: theme.transitions.create("background-color", {
    duration: 150
  }),
  "&:hover": {
    backgroundColor: theme.palette.primary.main + "30"
  },
  "&::before": {
    content: '""',
    position: "absolute",
    top: 0,
    left: "50%",
    transform: "translateX(-50%)",
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: $isDragging 
      ? theme.palette.primary.main 
      : theme.palette.text.disabled,
    transition: theme.transitions.create(["background-color", "width"], {
      duration: 150
    })
  },
  "&:hover::before": {
    backgroundColor: theme.palette.primary.main,
    width: 80
  }
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
  minHeight: 40,
  position: "relative",
  paddingTop: 0
}));

const PanelContent = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: "auto",
  backgroundColor: theme.palette.mode === "dark" 
    ? "rgba(11, 17, 32, 0.95)" 
    : theme.palette.background.default
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  minHeight: 40,
  padding: theme.spacing(0.5, 2),
  textTransform: "none"
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
    document.body.style.cursor = "ns-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
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
          <ResizeHandle onMouseDown={handleMouseDown} $isDragging={isResizing}>
            <Tooltip title="Drag to resize" placement="top">
              <Box sx={{ width: "100%", height: "100%" }} />
            </Tooltip>
          </ResizeHandle>
        )}
        <PanelHeader>
          <Tabs
            value={currentTabId}
            onChange={handleTabChange}
            sx={{ minHeight: 40 }}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((tab) => (
              <StyledTab
                key={tab.id}
                label={
                  <Stack direction="row" alignItems="center" spacing={0.5}>
                    <Typography variant="body2" sx={{ fontSize: "0.875rem" }}>
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
                        sx={{ ml: 0.5, p: 0.25 }}
                      >
                        <CloseIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    )}
                  </Stack>
                }
                value={tab.id}
              />
            ))}
          </Tabs>
          <Stack direction="row" spacing={0.5} sx={{ px: 1 }}>
            <Tooltip title={isMinimized ? "Maximize" : "Minimize"}>
              <IconButton size="small" onClick={handleToggleMinimize}>
                {isMinimized ? <MaximizeIcon fontSize="small" /> : <MinimizeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Close panel">
              <IconButton size="small" onClick={handleClose}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
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
