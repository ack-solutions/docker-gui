"use client";

import { ReactNode } from "react";
import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import BottomPanelHost from "@/components/layout/bottom-panel-host";

interface MainLayoutProps {
  children: ReactNode;
  topBarTitle: string;
  topBarSubtitle: string;
  onRefresh?: () => void;
}

// Root container - full viewport with flexbox
const LayoutRoot = styled(Box)({
  display: "flex",
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  overflow: "hidden"
});

// Sidebar - fixed width, scrollable
const SidebarWrapper = styled(Box)(({ theme }) => ({
  width: 240,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  borderRight: `1px solid ${theme.palette.divider}`,
  background: theme.palette.mode === "dark"
    ? "linear-gradient(180deg, #0b1120 0%, #111827 100%)"
    : theme.palette.background.paper,
  overflow: "hidden"
}));

// Main area - flex 1, contains topbar and scrollable content
const MainArea = styled(Box)({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
});

// Content area - scrollable
const ContentArea = styled(Box)(({ theme }) => ({
  flex: 1,
  overflow: "auto",
  padding: theme.spacing(3),
  maxWidth: 1600,
  width: "100%",
  margin: "0 auto"
}));

const MainLayout = ({ children, topBarTitle, topBarSubtitle, onRefresh }: MainLayoutProps) => {
  return (
    <LayoutRoot>
      <SidebarWrapper>
        <Sidebar />
      </SidebarWrapper>
      
      <MainArea>
        <TopBar title={topBarTitle} subtitle={topBarSubtitle} onRefresh={onRefresh} />
        <ContentArea>
          {children}
        </ContentArea>
      </MainArea>
      
      <BottomPanelHost />
    </LayoutRoot>
  );
};

export default MainLayout;

