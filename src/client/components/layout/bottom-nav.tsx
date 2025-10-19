"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DnsIcon from "@mui/icons-material/Dns";
import LayersIcon from "@mui/icons-material/Layers";
import AppsIcon from "@mui/icons-material/Apps";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import {
  BottomNavigation,
  BottomNavigationAction,
  Paper,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  IconButton,
  Typography,
  Stack,
  Divider,
  ListSubheader
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useState } from "react";
import CloseIcon from "@mui/icons-material/Close";
import StorageIcon from "@mui/icons-material/Storage";
import LanIcon from "@mui/icons-material/Lan";
import LanguageIcon from "@mui/icons-material/Language";
import LockIcon from "@mui/icons-material/Lock";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import EmailIcon from "@mui/icons-material/Email";
import PeopleIcon from "@mui/icons-material/People";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import FolderIcon from "@mui/icons-material/Folder";
import ArticleIcon from "@mui/icons-material/Article";
import { useBottomPanel } from "@/components/common/bottom-panel-context";

const BottomNavContainer = styled(Paper)(({ theme }) => ({
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: theme.zIndex.appBar,
  borderTop: `1px solid ${theme.palette.divider}`,
  borderRadius: 0,
  display: "none",
  paddingBottom: "env(safe-area-inset-bottom, 0px)",
  transition: "bottom 0.3s ease",
  [theme.breakpoints.down("md")]: {
    display: "block"
  }
}));

const MobileBottomNav = () => {
  const pathname = usePathname();
  const [showMore, setShowMore] = useState(false);
  const { isOpen, panelHeight } = useBottomPanel();

  const getCurrentValue = () => {
    if (pathname === "/") return "/";
    if (pathname.startsWith("/docker/containers")) return "/docker/containers";
    if (pathname.startsWith("/docker/images")) return "/docker/images";
    if (pathname.startsWith("/docker/volumes")) return "/docker/volumes";
    if (pathname.startsWith("/docker/networks")) return "/docker/networks";
    return "more";
  };

  const dockerMenuItems = [
    { label: "Volumes", href: "/docker/volumes", icon: <StorageIcon /> },
    { label: "Networks", href: "/docker/networks", icon: <LanIcon /> },
    { label: "Files", href: "/docker/files", icon: <FolderIcon /> },
    { label: "Logs", href: "/docker/logs", icon: <ArticleIcon /> }
  ];

  const managementItems = [
    { label: "Domains", href: "/domains", icon: <LanguageIcon /> },
    { label: "SSL Certificates", href: "/ssl", icon: <LockIcon /> },
    { label: "Nginx Config", href: "/nginx", icon: <SettingsEthernetIcon /> },
    { label: "Email", href: "/email", icon: <EmailIcon /> }
  ];

  const systemItems = [
    { label: "User Management", href: "/users", icon: <PeopleIcon /> }
  ];

  return (
    <>
      <BottomNavContainer elevation={8} sx={{ bottom: isOpen ? `${panelHeight}px` : 0 }}>
        <BottomNavigation
          value={getCurrentValue()}
          onChange={(_, newValue) => {
            if (newValue === "more") {
              setShowMore(true);
            }
          }}
          showLabels
          sx={{ height: { xs: 64, sm: 70 } }}
        >
          <BottomNavigationAction
            label="Home"
            value="/"
            icon={<DashboardIcon />}
            component={Link}
            href="/"
          />
          <BottomNavigationAction
            label="Containers"
            value="/docker/containers"
            icon={<DnsIcon />}
            component={Link}
            href="/docker/containers"
          />
          <BottomNavigationAction
            label="Images"
            value="/docker/images"
            icon={<LayersIcon />}
            component={Link}
            href="/docker/images"
          />
          <BottomNavigationAction
            label="Docker"
            value="/docker"
            icon={<AppsIcon />}
          />
          <BottomNavigationAction
            label="More"
            value="more"
            icon={<MoreHorizIcon />}
            onClick={() => setShowMore(true)}
          />
        </BottomNavigation>
      </BottomNavContainer>

      <Drawer
        anchor="bottom"
        open={showMore}
        onClose={() => setShowMore(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: "75vh",
            paddingBottom: "env(safe-area-inset-bottom)"
          }
        }}
      >
        <Box sx={{ pb: 2 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" px={2} pt={2} pb={1}>
            <Typography variant="h6">All Menus</Typography>
            <IconButton size="small" onClick={() => setShowMore(false)}>
              <CloseIcon />
            </IconButton>
          </Stack>
          <Divider />
          
          <List>
            <ListSubheader sx={{ bgcolor: "transparent", lineHeight: "36px" }}>
              Docker Management
            </ListSubheader>
            <ListItemButton
              component={Link}
              href="/docker/containers"
              selected={pathname.startsWith("/docker/containers")}
              onClick={() => setShowMore(false)}
              sx={{ borderRadius: 2, mx: 1 }}
            >
              <ListItemIcon><DnsIcon /></ListItemIcon>
              <ListItemText primary="Containers" />
            </ListItemButton>
            <ListItemButton
              component={Link}
              href="/docker/images"
              selected={pathname.startsWith("/docker/images")}
              onClick={() => setShowMore(false)}
              sx={{ borderRadius: 2, mx: 1 }}
            >
              <ListItemIcon><LayersIcon /></ListItemIcon>
              <ListItemText primary="Images" />
            </ListItemButton>
            {dockerMenuItems.map((item) => (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={pathname.startsWith(item.href)}
                onClick={() => setShowMore(false)}
                sx={{ borderRadius: 2, mx: 1 }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}

            <ListSubheader sx={{ bgcolor: "transparent", lineHeight: "36px", mt: 1 }}>
              Server Management
            </ListSubheader>
            {managementItems.map((item) => (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={pathname.startsWith(item.href)}
                onClick={() => setShowMore(false)}
                sx={{ borderRadius: 2, mx: 1 }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}

            <ListSubheader sx={{ bgcolor: "transparent", lineHeight: "36px", mt: 1 }}>
              System
            </ListSubheader>
            {systemItems.map((item) => (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={pathname.startsWith(item.href)}
                onClick={() => setShowMore(false)}
                sx={{ borderRadius: 2, mx: 1 }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>
    </>
  );
};

export default MobileBottomNav;
