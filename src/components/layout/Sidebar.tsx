"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DnsIcon from "@mui/icons-material/Dns";
import LayersIcon from "@mui/icons-material/Layers";
import StorageIcon from "@mui/icons-material/Storage";
import LanIcon from "@mui/icons-material/Lan";
import TerminalIcon from "@mui/icons-material/Terminal";
import FolderIcon from "@mui/icons-material/Folder";
import { Avatar, Box, Divider, List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";

const navigationItems = [
  { label: "Overview", href: "/", icon: <DashboardIcon /> },
  { label: "Containers", href: "/containers", icon: <DnsIcon /> },
  { label: "Images", href: "/images", icon: <LayersIcon /> },
  { label: "Volumes", href: "/volumes", icon: <StorageIcon /> },
  { label: "Networks", href: "/networks", icon: <LanIcon /> },
  { label: "Logs", href: "/logs", icon: <TerminalIcon /> },
  { label: "File Browser", href: "/files", icon: <FolderIcon /> }
];

const Sidebar = () => {
  const pathname = usePathname();

  return (
    <Box
      component="nav"
      sx={{
        width: 280,
        flexShrink: 0,
        position: "sticky",
        top: 0,
        alignSelf: "flex-start",
        height: "100vh",
        background: "linear-gradient(180deg, #0b1120 0%, #111827 100%)",
        borderRight: "1px solid",
        borderColor: "divider",
        p: 3,
        display: "flex",
        flexDirection: "column",
        gap: 2
      }}
    >
      <Box display="flex" alignItems="center" gap={1.5}>
        <Avatar sx={{ bgcolor: "primary.main" }}>DG</Avatar>
        <Box>
          <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
            Docker GUI
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Control Center
          </Typography>
        </Box>
      </Box>
      <Divider flexItem sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
      <List disablePadding sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
        {navigationItems.map((item) => {
          const isActive = item.href === "/" ? pathname === item.href : pathname?.startsWith(item.href);

          return (
            <ListItemButton
              key={item.href}
              component={Link}
              href={item.href}
              selected={isActive}
              sx={{
                borderRadius: 2,
                color: isActive ? "primary.contrastText" : "text.secondary",
                backgroundColor: isActive ? "primary.main" : "transparent",
                '&:hover': {
                  backgroundColor: isActive ? "primary.main" : "rgba(148, 163, 184, 0.08)"
                }
              }}
            >
              <ListItemIcon sx={{ color: isActive ? "primary.contrastText" : "text.secondary" }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
      <Box sx={{ p: 2, borderRadius: 3, backgroundColor: "rgba(148, 163, 184, 0.08)" }}>
        <Typography variant="subtitle2" gutterBottom fontWeight={600}>
          Docker Engine
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Configure your remote Docker Engine address in the settings to start managing resources.
        </Typography>
      </Box>
    </Box>
  );
};

export default Sidebar;
