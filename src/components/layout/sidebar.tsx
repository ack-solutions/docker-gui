"use client";

import { usePathname, useRouter } from "next/navigation";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DnsIcon from "@mui/icons-material/Dns";
import LayersIcon from "@mui/icons-material/Layers";
import StorageIcon from "@mui/icons-material/Storage";
import LanIcon from "@mui/icons-material/Lan";
import TerminalIcon from "@mui/icons-material/Terminal";
import FolderIcon from "@mui/icons-material/Folder";
import { Avatar, Divider, List, ListItemButton, ListItemIcon, ListItemText, Paper, Stack, Typography } from "@mui/material";
import type { ListItemButtonProps } from "@mui/material/ListItemButton";
import { styled } from "@mui/material/styles";

const navigationItems = [
  { label: "Overview", href: "/", icon: <DashboardIcon /> },
  { label: "Containers", href: "/containers", icon: <DnsIcon /> },
  { label: "Images", href: "/images", icon: <LayersIcon /> },
  { label: "Volumes", href: "/volumes", icon: <StorageIcon /> },
  { label: "Networks", href: "/networks", icon: <LanIcon /> },
  { label: "Logs", href: "/logs", icon: <TerminalIcon /> },
  { label: "File Browser", href: "/files", icon: <FolderIcon /> }
];

const SidebarRoot = styled("nav")(({ theme }) => ({
  width: 240,
  flexShrink: 0,
  position: "sticky",
  top: 0,
  alignSelf: "flex-start",
  height: "100vh",
  padding: theme.spacing(2.5),
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(2),
  borderRight: `1px solid ${theme.palette.divider}`,
  background: theme.palette.mode === "dark"
    ? "linear-gradient(180deg, #0b1120 0%, #111827 100%)"
    : theme.palette.background.paper
}));

const NavList = styled(List)(({ theme }) => ({
  flex: 1,
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.5),
  padding: 0
}));

const NavItem = styled(ListItemButton)<ListItemButtonProps>(({ theme }) => ({
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.secondary,
  transition: theme.transitions.create(["background-color", "color"], {
    duration: theme.transitions.duration.shortest
  }),
  '&:hover': {
    backgroundColor: theme.palette.action.hover
  },
  '&.Mui-selected': {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    '&:hover': {
      backgroundColor: theme.palette.primary.main
    }
  },
  '& .MuiListItemIcon-root': {
    minWidth: theme.spacing(4),
    color: "inherit"
  }
}));

const BrandAvatar = styled(Avatar)(({ theme }) => ({
  backgroundColor: theme.palette.primary.main,
  width: 40,
  height: 40,
  fontSize: theme.typography.pxToRem(16)
}));

const Note = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 1.5
      : theme.shape.borderRadius,
  backgroundColor: theme.palette.mode === "dark" ? "rgba(148, 163, 184, 0.08)" : theme.palette.background.default
}));

const Sidebar = () => {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <SidebarRoot>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <BrandAvatar>DG</BrandAvatar>
        <Stack spacing={0.5}>
          <Typography variant="subtitle1">
            Docker GUI
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Control Center
          </Typography>
        </Stack>
      </Stack>
      <Divider flexItem />
      <NavList disablePadding>
        {navigationItems.map((item) => {
          const isActive = item.href === "/" ? pathname === item.href : pathname?.startsWith(item.href);

          return (
            <NavItem
              key={item.href}
              selected={Boolean(isActive)}
              onClick={() => router.push(item.href)}
            >
              <ListItemIcon>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </NavItem>
          );
        })}
      </NavList>
      <Note variant="outlined">
        <Typography variant="subtitle2" gutterBottom>
          Docker Engine
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Configure your remote Docker Engine address in the settings to start managing resources.
        </Typography>
      </Note>
    </SidebarRoot>
  );
};

export default Sidebar;
