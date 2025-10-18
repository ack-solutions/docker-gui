"use client";

import { ReactNode } from "react";
import { Box } from "@mui/material";
import { styled } from "@mui/material/styles";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import BottomPanelHost from "@/components/layout/bottom-panel-host";
import { useBottomPanel } from "@/components/common/bottom-panel-context";

interface MainLayoutProps {
  children: ReactNode;
  topBarTitle: string;
  topBarSubtitle: string;
  onRefresh?: () => void;
}

const SIDEBAR_WIDTH = 240;

const LayoutRoot = styled(Box)(({ theme }) => ({
  display: "flex",
  minHeight: "100vh",
  height: "100vh",
  width: "100%",
  backgroundColor: theme.palette.background.default,
  color: theme.palette.text.primary,
  overflow: "hidden",
  position: "relative"
}));

const SidebarRail = styled("aside")(({ theme }) => ({
  width: SIDEBAR_WIDTH,
  flexShrink: 0,
  display: "flex",
  flexDirection: "column",
  borderRight: `1px solid ${theme.palette.divider}`,
  background: theme.palette.mode === "dark"
    ? "linear-gradient(180deg, #0b1120 0%, #111827 100%)"
    : theme.palette.background.paper
}));

const MainColumn = styled("section")({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  overflow: "hidden",
  position: "relative"
});

const ScrollViewport = styled(Box)(({ theme }) => ({
  flex: 1,
  overflowY: "auto",
  overflowX: "hidden",
  minHeight: 0,
  padding: theme.spacing(3),
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  background: theme.palette.background.default
}));

const ContentContainer = styled(Box)({
  width: "100%",
  maxWidth: 1600,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  minHeight: 0
});

const MainLayout = ({ children, topBarTitle, topBarSubtitle, onRefresh }: MainLayoutProps) => {
  const { isOpen, panelHeight } = useBottomPanel();
  const bottomPadding = isOpen ? panelHeight + 32 : 32;

  return (
    <>
      <LayoutRoot>
        <SidebarRail>
          <Sidebar />
        </SidebarRail>

        <MainColumn>
          <TopBar title={topBarTitle} subtitle={topBarSubtitle} onRefresh={onRefresh} />
          <ScrollViewport sx={{ paddingBottom: `${bottomPadding}px` }}>
            <ContentContainer>
              {children}
            </ContentContainer>
          </ScrollViewport>
        </MainColumn>
      </LayoutRoot>
      <BottomPanelHost leftInset={SIDEBAR_WIDTH} />
    </>
  );
};

export default MainLayout;
