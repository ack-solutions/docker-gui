"use client";

import { ReactNode, useState } from "react";
import { Box, Drawer, IconButton, useMediaQuery } from "@mui/material";
import { useTheme, styled } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import BottomPanelHost from "@/components/layout/bottom-panel-host";
import MobileBottomNav from "@/components/layout/bottom-nav";
import { useBottomPanel } from "@/components/common/bottom-panel-context";

interface MainLayoutProps {
  children: ReactNode;
  topBarTitle: string;
  topBarSubtitle: string;
  onRefresh?: () => void;
}

const SIDEBAR_WIDTH = 240;
const MOBILE_NAV_HEIGHT = 72;

const LayoutRoot = styled(Box)(({ theme }) => ({
  display: "flex",
  minHeight: "100vh",
  height: "100dvh", // Dynamic viewport height for mobile browsers
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
    : theme.palette.background.paper,
  [theme.breakpoints.down("md")]: {
    display: "none"
  }
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
  background: theme.palette.background.default,
  WebkitOverflowScrolling: "touch", // Smooth scrolling on iOS
  overscrollBehavior: "contain", // Prevent scroll chaining on mobile
  [theme.breakpoints.down("md")]: {
    padding: theme.spacing(2),
    // Fixed bottom padding: 64px nav + 16px spacing + safe area
    paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))"
  },
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(1.5),
    paddingBottom: "calc(80px + env(safe-area-inset-bottom, 0px))"
  }
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { isOpen, panelHeight } = useBottomPanel();
  const bottomInset = (isMobile ? MOBILE_NAV_HEIGHT + 16 : 16) + (isOpen ? panelHeight + 24 : 0);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <>
      <LayoutRoot>
        <SidebarRail>
          <Sidebar />
        </SidebarRail>

        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true // Better open performance on mobile
          }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { 
              boxSizing: "border-box", 
              width: SIDEBAR_WIDTH,
              background: theme.palette.mode === "dark"
                ? "linear-gradient(180deg, #0b1120 0%, #111827 100%)"
                : theme.palette.background.paper
            }
          }}
        >
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </Drawer>

        <MainColumn>
          <TopBar 
            title={topBarTitle} 
            subtitle={topBarSubtitle} 
            onRefresh={onRefresh}
            onMenuClick={isMobile ? handleDrawerToggle : undefined}
          />
          <ScrollViewport sx={{ paddingBottom: `${bottomInset}px` }}>
            <ContentContainer>
              {children}
            </ContentContainer>
          </ScrollViewport>
        </MainColumn>
      </LayoutRoot>
      <BottomPanelHost leftInset={isMobile ? 0 : SIDEBAR_WIDTH} />
      {isMobile && <MobileBottomNav />}
    </>
  );
};

export default MainLayout;
