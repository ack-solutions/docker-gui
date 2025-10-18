"use client";

import { ReactNode, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Toaster } from "sonner";
import MainLayout from "@/components/layout/main-layout";
import AuthLayout from "@/components/layout/auth-layout";
import { BottomPanelProvider } from "@/components/common/bottom-panel-context";
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

const pageMetadata: Record<string, { title: string; subtitle: string }> = {
  "/": {
    title: "Dashboard",
    subtitle: "Monitor and operate your infrastructure from a unified control plane."
  },
  "/docker/containers": {
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

  // Auth routes - simple centered layout
  if (isAuthRoute) {
    return (
      <>
        {toaster}
        <AuthLayout loading={isAuthenticated && !loading}>
          {children}
        </AuthLayout>
      </>
    );
  }

  // Loading state
  if (loading || !isAuthenticated) {
    return (
      <>
        {toaster}
        <AuthLayout loading>
          <></>
        </AuthLayout>
      </>
    );
  }

  // Main authenticated layout  
  return (
    <BottomPanelProvider>
      <ConfirmationDialogProvider>
        <HeaderActionsProvider>
          {toaster}
          <SystemMetricsPoller />
          <AppLayoutMain>{children}</AppLayoutMain>
        </HeaderActionsProvider>
      </ConfirmationDialogProvider>
    </BottomPanelProvider>
  );
};

const AppLayoutMain = ({ children }: AppLayoutProps) => {
  const pathname = usePathname();
  const headerActions = useHeaderActionsConfig();

  const { title, subtitle } = useMemo(() => {
    const defaults = pageMetadata["/"];

    if (!pathname) {
      return defaults;
    }

    // Find matching route (longest match first for nested routes)
    const match = Object.keys(pageMetadata)
      .filter((route) => route !== "/")
      .sort((a, b) => b.length - a.length)
      .find((route) => pathname.startsWith(route));

    return match ? pageMetadata[match] : pageMetadata[pathname] ?? defaults;
  }, [pathname]);

  return (
    <MainLayout
      topBarTitle={title}
      topBarSubtitle={subtitle}
      onRefresh={headerActions.onRefresh}
    >
      {children}
    </MainLayout>
  );
};

export default AppLayout;
