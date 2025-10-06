"use client";

import { ReactNode, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Box, Container } from "@mui/material";
import Sidebar from "@/components/layout/Sidebar";
import TopBar from "@/components/layout/TopBar";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const pathname = usePathname();

  const { title, subtitle } = useMemo(() => {
    const defaults = {
      title: "Dashboard",
      subtitle: "Manage Docker containers, images, networks, and volumes from a unified control plane."
    };

    if (!pathname) {
      return defaults;
    }

    const lookup: Record<string, { title: string; subtitle: string }> = {
      "/": defaults,
      "/containers": {
        title: "Container Management",
        subtitle: "Start, stop, and inspect workload containers while tracking resource utilization."
      },
      "/images": {
        title: "Image Catalog",
        subtitle: "Review image versions, audit storage consumption, and prepare artifacts for deployment."
      },
      "/volumes": {
        title: "Volume Management",
        subtitle: "Manage persistent storage, monitor usage, and safely prune unused data."
      },
      "/networks": {
        title: "Network Management",
        subtitle: "Visualize Docker networks and confirm containers communicate across the right overlays."
      },
      "/logs": {
        title: "Logs & Debugging",
        subtitle: "Follow live logs, filter output, and troubleshoot services in real-time."
      },
      "/files": {
        title: "File Browser",
        subtitle: "Navigate container file systems to inspect configuration and generated assets."
      }
    };

    const key = Object.keys(lookup).find((route) => route !== "/" && pathname.startsWith(route));
    return key ? lookup[key] : lookup[pathname] ?? defaults;
  }, [pathname]);

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        background: "radial-gradient(circle at top, rgba(56, 189, 248, 0.2), transparent 45%), #0f172a"
      }}
    >
      <Sidebar />
      <Box component="section" sx={{ flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <TopBar title={title} subtitle={subtitle} />
        <Container maxWidth="xl" sx={{ py: 4, flex: 1, display: "flex", flexDirection: "column" }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
};

export default AppLayout;
