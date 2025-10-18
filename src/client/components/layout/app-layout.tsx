"use client";

import { ReactNode, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Box, CircularProgress, Container, Stack } from "@mui/material";
import { styled } from "@mui/material/styles";
import { Toaster } from "sonner";
import Sidebar from "@/components/layout/sidebar";
import TopBar from "@/components/layout/top-bar";
import { BottomPanelProvider } from "@/components/common/bottom-panel-context";
import BottomPanelWrapper from "@/components/common/bottom-panel-wrapper";
import { useThemeMode } from "@/components/theme/theme-context";
import { ConfirmationDialogProvider } from "@/components/common/confirmation-dialog-provider";
import {
  HeaderActionsProvider,
  useHeaderActionsConfig
} from "@/components/layout/header-actions-context";
import { useAuth } from "@/components/providers/auth-provider";
import SystemMetricsPoller from "@/features/system/components/system-metrics-poller";

interface AppLayoutProps {
  children: ReactNode;
}

const Shell = styled("div")(() => ({
  display: "flex",
  minHeight: "100vh"
}));

const MainSection = styled("section")(({ theme }) => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  minHeight: "100vh"
}));

const Content = styled(Container)(({ theme }) => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  paddingTop: theme.spacing(3),
  paddingBottom: theme.spacing(3)
}));

const AppLayout = ({ children }: AppLayoutProps) => {
  const { mode } = useThemeMode();
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();

  const isAuthRoute = pathname === "/auth/login";

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!isAuthenticated && !isAuthRoute) {
      const redirect =
        pathname && pathname !== "/"
          ? `?redirect=${encodeURIComponent(pathname)}`
          : "";
      router.replace(`/auth/login${redirect}`);
    } else if (isAuthenticated && isAuthRoute) {
      router.replace("/");
    }
  }, [isAuthenticated, isAuthRoute, loading, pathname, router]);

  const toaster = (
    <Toaster
      theme={mode}
      position="top-right"
      expand={false}
      richColors
      closeButton
    />
  );

  if (isAuthRoute) {
    if (isAuthenticated && !loading) {
      return (
        <>
          {toaster}
          <Box
            sx={{
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Stack spacing={2} alignItems="center">
              <CircularProgress size={32} />
            </Stack>
          </Box>
        </>
      );
    }
    return (
      <>
        {toaster}
        <Box
          component="main"
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            p: 3
          }}
        >
          {children}
        </Box>
      </>
    );
  }

  if (loading || !isAuthenticated) {
    return (
      <>
        {toaster}
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Stack spacing={2} alignItems="center">
            <CircularProgress size={32} />
          </Stack>
        </Box>
      </>
    );
  }

  return (
    <BottomPanelProvider>
      <ConfirmationDialogProvider>
        <HeaderActionsProvider>
          {toaster}
          <SystemMetricsPoller />
          <Shell>
            <Sidebar />
            <AppLayoutMain>{children}</AppLayoutMain>
            <BottomPanelWrapper />
          </Shell>
        </HeaderActionsProvider>
      </ConfirmationDialogProvider>
    </BottomPanelProvider>
  );
};

const AppLayoutMain = ({ children }: AppLayoutProps) => {
  const pathname = usePathname();
  const headerActions = useHeaderActionsConfig();

  const { title, subtitle } = useMemo(() => {
    const defaults = {
      title: "Dashboard",
      subtitle: "Monitor and operate your infrastructure from a unified control plane."
    };

    if (!pathname) {
      return defaults;
    }

    const lookup: Record<string, { title: string; subtitle: string }> = {
      "/": defaults,
      "/docker/containers": {
        title: "Container Management",
        subtitle: "Start, stop, and inspect workload containers while tracking resource utilization."
      },
      "/containers": {
        title: "Container Management",
        subtitle: "Start, stop, and inspect workload containers while tracking resource utilization."
      },
      "/docker/images": {
        title: "Image Catalog",
        subtitle: "Review image versions, audit storage consumption, and prepare artifacts for deployment."
      },
      "/docker/volumes": {
        title: "Volume Management",
        subtitle: "Manage persistent storage, monitor usage, and safely prune unused data."
      },
      "/docker/networks": {
        title: "Network Management",
        subtitle: "Visualize Docker networks and confirm containers communicate across the right overlays."
      },
      "/docker/logs": {
        title: "Logs & Debugging",
        subtitle: "Follow live logs, filter output, and troubleshoot services in real-time."
      },
      "/docker/files": {
        title: "File Browser",
        subtitle: "Navigate container file systems to inspect configuration and generated assets."
      },
      "/docker/images/": {
        title: "Image Detail",
        subtitle: "Inspect image metadata, layers, and history before deployment."
      },
      "/domains": {
        title: "Domain Management",
        subtitle: "Organize DNS records, hostnames, and domain-level routing policies."
      },
      "/ssl": {
        title: "SSL Certificates",
        subtitle: "Issue, renew, and deploy TLS certificates with confidence."
      },
      "/nginx": {
        title: "Nginx Configuration",
        subtitle: "Manage reverse proxy directives and site templates for your edge."
      },
      "/proxies": {
        title: "Proxy Manager",
        subtitle: "Configure load-balancing rules and traffic routing across services."
      },
      "/email": {
        title: "Email Management",
        subtitle: "Centralize SMTP relays, mailboxes, and deliverability monitoring."
      },
      "/users": {
        title: "User Management",
        subtitle: "Invite teammates and tailor module-level permissions for each role."
      },
      "/containers/": {
        title: "Container Detail",
        subtitle: "Review container health, logs, and configuration."
      }
    };

    const match = Object.keys(lookup)
      .filter((route) => route !== "/")
      .sort((a, b) => b.length - a.length)
      .find((route) => pathname.startsWith(route));

    return match ? lookup[match] : lookup[pathname] ?? defaults;
  }, [pathname]);

  return (
    <MainSection>
      <TopBar title={title} subtitle={subtitle} onRefresh={headerActions.onRefresh} />
      <Content maxWidth="xl">{children}</Content>
    </MainSection>
  );
};

export default AppLayout;
