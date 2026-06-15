"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Avatar,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Toolbar,
  Tooltip,
  Typography
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import LanOutlinedIcon from "@mui/icons-material/LanOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import DnsOutlinedIcon from "@mui/icons-material/DnsOutlined";
import CloudOutlinedIcon from "@mui/icons-material/CloudOutlined";
import DatasetOutlinedIcon from "@mui/icons-material/DatasetOutlined";
import ArchiveOutlinedIcon from "@mui/icons-material/ArchiveOutlined";
import MonitorHeartOutlinedIcon from "@mui/icons-material/MonitorHeartOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import ExtensionOutlinedIcon from "@mui/icons-material/ExtensionOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import type { ReactNode } from "react";
import { logout, type PublicUser } from "@/lib/v2/auth-client";

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  adminOnly?: boolean;
}

export interface PageShellProps {
  title?: string;
  subtitle?: ReactNode;
  user?: PublicUser | null;
  actions?: ReactNode;
  navItems?: NavItem[];
  hideChrome?: boolean;
  maxWidth?: "sm" | "md" | "lg" | "xl" | false;
  children: ReactNode;
}

interface NavGroup {
  heading: string;
  items: { label: string; href: string; icon: ReactNode; adminOnly?: boolean }[];
}

const DRAWER_WIDTH = 256;

const NAV: NavGroup[] = [
  {
    heading: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: <SpaceDashboardOutlinedIcon /> }]
  },
  {
    heading: "Compute",
    items: [
      { label: "Containers", href: "/containers", icon: <Inventory2OutlinedIcon /> },
      { label: "Images", href: "/images", icon: <LayersOutlinedIcon /> },
      { label: "Volumes", href: "/volumes", icon: <StorageOutlinedIcon /> },
      { label: "Networks", href: "/networks", icon: <LanOutlinedIcon /> }
    ]
  },
  {
    heading: "Networking",
    items: [
      { label: "Sites", href: "/sites", icon: <PublicOutlinedIcon /> },
      { label: "DNS", href: "/dns", icon: <DnsOutlinedIcon /> }
    ]
  },
  {
    heading: "Data",
    items: [
      { label: "Storage", href: "/storage", icon: <CloudOutlinedIcon /> },
      { label: "Databases", href: "/databases", icon: <DatasetOutlinedIcon /> },
      { label: "Registry", href: "/registry", icon: <ArchiveOutlinedIcon /> }
    ]
  },
  {
    heading: "Observability",
    items: [
      { label: "Health", href: "/health", icon: <MonitorHeartOutlinedIcon /> },
      { label: "Alerts", href: "/alerts", icon: <NotificationsActiveOutlinedIcon /> }
    ]
  },
  {
    heading: "System",
    items: [
      { label: "Features", href: "/features", icon: <ExtensionOutlinedIcon /> },
      { label: "Users", href: "/users", icon: <PeopleAltOutlinedIcon />, adminOnly: true },
      { label: "Audit", href: "/audit", icon: <ReceiptLongOutlinedIcon />, adminOnly: true },
      { label: "Settings", href: "/settings", icon: <SettingsOutlinedIcon /> }
    ]
  }
];

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PageShell({
  title,
  subtitle,
  user,
  actions,
  hideChrome = false,
  maxWidth = "xl",
  children
}: PageShellProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin = user?.role === "owner" || user?.role === "admin";

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname?.startsWith(`${href}/`);

  const sidebar = (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "#0f172a", color: "#cbd5e1" }}>
      {/* Brand */}
      <Box sx={{ px: 2.5, py: 2.25, display: "flex", alignItems: "center", gap: 1.25 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            background: "linear-gradient(135deg,#2563eb,#7c3aed)",
            display: "grid",
            placeItems: "center"
          }}
        >
          <HubOutlinedIcon sx={{ color: "#fff", fontSize: 20 }} />
        </Box>
        <Box>
          <Typography sx={{ color: "#fff", fontWeight: 700, fontSize: 15, lineHeight: 1.1 }}>
            Docker GUI
          </Typography>
          <Typography sx={{ color: "#64748b", fontSize: 11 }}>Server manager</Typography>
        </Box>
      </Box>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

      {/* Nav */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 1.5, py: 1.5 }}>
        {NAV.map((group) => {
          const items = group.items.filter((i) => !i.adminOnly || isAdmin);
          if (items.length === 0) return null;
          return (
            <Box key={group.heading} sx={{ mb: 1.5 }}>
              <Typography
                sx={{
                  px: 1.5,
                  mb: 0.5,
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "#475569"
                }}
              >
                {group.heading}
              </Typography>
              <List dense disablePadding>
                {items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <ListItemButton
                      key={item.href}
                      onClick={() => {
                        router.push(item.href);
                        setMobileOpen(false);
                      }}
                      sx={{
                        borderRadius: 2,
                        mb: 0.25,
                        py: 0.6,
                        color: active ? "#fff" : "#cbd5e1",
                        bgcolor: active ? "rgba(37,99,235,0.22)" : "transparent",
                        "&:hover": { bgcolor: active ? "rgba(37,99,235,0.28)" : "rgba(255,255,255,0.05)" }
                      }}
                    >
                      <ListItemIcon
                        sx={{ minWidth: 34, color: active ? "#60a5fa" : "#94a3b8", "& svg": { fontSize: 20 } }}
                      >
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.label}
                        primaryTypographyProps={{ fontSize: 13.5, fontWeight: active ? 600 : 500 }}
                      />
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          );
        })}
      </Box>

      {/* User footer */}
      {user && (
        <>
          <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
          <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1.25 }}>
            <Avatar sx={{ width: 34, height: 34, bgcolor: "#2563eb", fontSize: 13, fontWeight: 700 }}>
              {initials(user.name)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ color: "#fff", fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>
                {user.name}
              </Typography>
              <Typography noWrap sx={{ color: "#64748b", fontSize: 11 }}>
                {user.role}
              </Typography>
            </Box>
            <Tooltip title="Sign out">
              <IconButton onClick={handleLogout} size="small" sx={{ color: "#94a3b8" }}>
                <LogoutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </>
      )}
    </Box>
  );

  if (hideChrome) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          display: "flex",
          justifyContent: "center",
          alignItems: "flex-start"
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 440, px: 2, pb: 6 }}>{children}</Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Desktop permanent drawer */}
      <Drawer
        variant="permanent"
        sx={{
          display: { xs: "none", md: "block" },
          width: DRAWER_WIDTH,
          flexShrink: 0,
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, border: "none" }
        }}
        open
      >
        {sidebar}
      </Drawer>

      {/* Mobile temporary drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: "block", md: "none" },
          "& .MuiDrawer-paper": { width: DRAWER_WIDTH, border: "none" }
        }}
      >
        {sidebar}
      </Drawer>

      {/* Main column */}
      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <Box
          component="header"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            bgcolor: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            borderBottom: 1,
            borderColor: "divider",
            px: { xs: 2, sm: 3, md: 4 }
          }}
        >
          <Toolbar disableGutters sx={{ minHeight: { xs: 60, md: 68 }, gap: 1.5 }}>
            <IconButton
              onClick={() => setMobileOpen(true)}
              sx={{ display: { md: "none" } }}
              edge="start"
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {title && (
                <Typography variant="h5" noWrap sx={{ fontWeight: 700 }}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            {user && (
              <Chip
                size="small"
                label={user.email}
                variant="outlined"
                sx={{ display: { xs: "none", sm: "flex" }, maxWidth: 220 }}
              />
            )}
            {actions && <Stack direction="row" spacing={1}>{actions}</Stack>}
          </Toolbar>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, px: { xs: 2, sm: 3, md: 4 }, py: { xs: 2.5, md: 3.5 } }}>
          <Box sx={{ maxWidth: maxWidth === false ? "100%" : 1320, mx: "auto" }}>{children}</Box>
        </Box>
      </Box>
    </Box>
  );
}
