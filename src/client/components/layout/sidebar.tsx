"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DnsIcon from "@mui/icons-material/Dns";
import LayersIcon from "@mui/icons-material/Layers";
import StorageIcon from "@mui/icons-material/Storage";
import LanIcon from "@mui/icons-material/Lan";
import TerminalIcon from "@mui/icons-material/Terminal";
import FolderIcon from "@mui/icons-material/Folder";
import LanguageIcon from "@mui/icons-material/Language";
import LockIcon from "@mui/icons-material/Lock";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import EmailIcon from "@mui/icons-material/Email";
import AppsIcon from "@mui/icons-material/Apps";
import PeopleIcon from "@mui/icons-material/People";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import {
  Avatar,
  Collapse,
  Divider,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography
} from "@mui/material";
import type { ListItemButtonProps } from "@mui/material/ListItemButton";
import { styled } from "@mui/material/styles";
import type { UserPermission } from "@/types/user";
import { useAuth } from "@/components/providers/auth-provider";

interface NavigationNode {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  permission?: UserPermission | UserPermission[];
  children?: NavigationNode[];
}

const navigationTree: Array<{ label: string; items: NavigationNode[] }> = [
  {
    label: "Main",
    items: [
      { label: "Overview", href: "/", icon: <DashboardIcon />, permission: "dashboard:view" }
    ]
  },
  {
    label: "Management",
    items: [
      {
        label: "Docker",
        icon: <AppsIcon />,
        children: [
          { label: "Containers", href: "/docker/containers", icon: <DnsIcon />, permission: "containers:view" },
          { label: "Images", href: "/docker/images", icon: <LayersIcon />, permission: "images:view" },
          { label: "Volumes", href: "/docker/volumes", icon: <StorageIcon />, permission: "volumes:view" },
          { label: "Networks", href: "/docker/networks", icon: <LanIcon />, permission: "networks:view" },
          { label: "Logs", href: "/docker/logs", icon: <TerminalIcon />, permission: "logs:view" },
          { label: "File Browser", href: "/docker/files", icon: <FolderIcon />, permission: "files:view" }
        ]
      },
      { label: "Domain Management", href: "/domains", icon: <LanguageIcon />, permission: "domains:view" },
      { label: "SSL Certificates", href: "/ssl", icon: <LockIcon />, permission: "ssl:view" },
      { label: "Nginx Config", href: "/nginx", icon: <SettingsEthernetIcon />, permission: "nginx:view" },
      { label: "Proxy Manager", href: "/proxies", icon: <CompareArrowsIcon />, permission: "proxies:view" },
      { label: "Email", href: "/email", icon: <EmailIcon />, permission: "email:view" },
      { label: "User Management", href: "/users", icon: <PeopleIcon />, permission: "users:manage" }
    ]
  }
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
  padding: 0,
  margin: 0
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
  const { hasPermission } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const isPathActive = useCallback(
    (href: string | undefined) => {
      if (!href) {
        return false;
      }
      return href === "/" ? pathname === href : pathname?.startsWith(href ?? "");
    },
    [pathname]
  );

  const determineActive = useCallback(
    (node: NavigationNode): boolean => {
      if (node.href) {
        return isPathActive(node.href);
      }
      return Boolean(node.children?.some(determineActive));
    },
    [isPathActive]
  );

  const filteredNavigation = useMemo(() => {
    const filterNode = (node: NavigationNode): NavigationNode | null => {
      if (node.permission && !hasPermission(node.permission)) {
        return null;
      }

      if (node.children?.length) {
        const children = node.children
          .map(filterNode)
          .filter((child): child is NavigationNode => child !== null);
        if (!children.length) {
          return null;
        }
        return { ...node, children };
      }

      return node;
    };

    return navigationTree
      .map((section) => ({
        label: section.label,
        items: section.items
          .map(filterNode)
          .filter((item): item is NavigationNode => item !== null)
      }))
      .filter((section) => section.items.length > 0);
  }, [hasPermission]);

  useEffect(() => {
    setOpenGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      filteredNavigation.forEach((section) => {
        section.items.forEach((item) => {
          if (item.children) {
            const prevValue = prev[item.label];
            const shouldForceOpen = determineActive(item);
            const desired = shouldForceOpen ? true : prevValue ?? false;

            if (prevValue === undefined) {
              next[item.label] = desired;
              if (desired !== prevValue) {
                changed = true;
              }
            } else if (desired !== prevValue) {
              next[item.label] = desired;
              changed = true;
            }
          }
        });
      });
      return changed ? next : prev;
    });
  }, [determineActive, filteredNavigation]);

  const handleToggle = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <SidebarRoot>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <BrandAvatar>DG</BrandAvatar>
        <Stack spacing={0.5}>
          <Typography variant="subtitle1">Server Control</Typography>
          <Typography variant="caption" color="text.secondary">
            Unified operations dashboard
          </Typography>
        </Stack>
      </Stack>
      <Divider flexItem />
      <NavList disablePadding>
        {filteredNavigation.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
            No modules available. Contact an administrator to request access.
          </Typography>
        ) : null}
        {filteredNavigation.map((section) => (
          <Stack key={section.label} spacing={1} sx={{ mb: 2 }}>
            <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>
              {section.label}
            </Typography>
            {section.items.map((item) => {
              const itemIsActive = determineActive(item);

              if (item.children?.length) {
                const isOpen = openGroups[item.label] ?? itemIsActive;

                return (
                  <Stack key={item.label} spacing={0.5}>
                    <NavItem selected={itemIsActive} onClick={() => handleToggle(item.label)}>
                      {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                      <ListItemText primary={item.label} />
                      {isOpen ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                    </NavItem>
                    <Collapse in={isOpen} timeout="auto" unmountOnExit>
                      <Stack spacing={0.25} sx={{ pl: 2 }}>
                        {item.children.map((child) => (
                          <NavItem
                            key={child.href ?? child.label}
                            selected={Boolean(child.href && isPathActive(child.href))}
                            onClick={() => child.href && router.push(child.href)}
                            sx={{ pl: 2 }}
                          >
                            {child.icon && <ListItemIcon>{child.icon}</ListItemIcon>}
                            <ListItemText primary={child.label} />
                          </NavItem>
                        ))}
                      </Stack>
                    </Collapse>
                  </Stack>
                );
              }

              return (
                <NavItem
                  key={item.href ?? item.label}
                  selected={Boolean(item.href && isPathActive(item.href))}
                  onClick={() => item.href && router.push(item.href)}
                >
                  {item.icon && <ListItemIcon>{item.icon}</ListItemIcon>}
                  <ListItemText primary={item.label} />
                </NavItem>
              );
            })}
          </Stack>
        ))}
      </NavList>
      <Note variant="outlined">
        <Typography variant="subtitle2" gutterBottom>
          Server Modules
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block">
          Navigation reflects the modules granted to your account. Ask an administrator if something is missing.
        </Typography>
      </Note>
    </SidebarRoot>
  );
};

export default Sidebar;
