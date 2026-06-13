"use client";

import { useRouter, usePathname } from "next/navigation";
import {
  AppBar,
  Box,
  Button,
  Container,
  IconButton,
  Stack,
  Toolbar,
  Tooltip,
  Typography
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import type { ReactNode } from "react";
import { logout, type PublicUser } from "@/lib/v2/auth-client";

export interface NavItem {
  label: string;
  href: string;
  icon?: ReactNode;
  /** When true, only owners/admins see this nav item. */
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

const DEFAULT_NAV: NavItem[] = [
  { label: "Containers", href: "/containers" },
  { label: "Images", href: "/images" },
  { label: "Volumes", href: "/volumes" },
  { label: "Networks", href: "/networks" },
  { label: "Sites", href: "/sites" },
  { label: "DNS", href: "/dns" },
  { label: "Health", href: "/health" },
  { label: "Storage", href: "/storage" },
  { label: "Features", href: "/features" },
  { label: "Users", href: "/users", adminOnly: true },
  { label: "Audit", href: "/audit", adminOnly: true },
  { label: "Settings", href: "/settings" }
];

/**
 * Top-level page chrome: app bar with brand + nav + user menu, then a
 * page header (title/subtitle + actions), then children.
 *
 * Pages should *only* render this — never their own AppBar/Container.
 * Set `hideChrome` for unauthenticated screens (e.g. login).
 *
 * Usage:
 *   <PageShell title="Containers" user={user}
 *              actions={<Button>Refresh</Button>}>
 *     <ContainerTable />
 *   </PageShell>
 */
export function PageShell({
  title,
  subtitle,
  user,
  actions,
  navItems = DEFAULT_NAV,
  hideChrome = false,
  maxWidth = "xl",
  children
}: PageShellProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();

  const isAdmin = user?.role === "owner" || user?.role === "admin";
  const visibleNav = navItems.filter((n) => !n.adminOnly || isAdmin);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {!hideChrome && (
        <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
          <Toolbar sx={{ gap: 2 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <HubOutlinedIcon color="primary" />
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                Docker GUI
              </Typography>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ ml: 3, flexGrow: 1 }}>
              {visibleNav.map((n) => {
                const active = pathname === n.href || pathname?.startsWith(`${n.href}/`);
                return (
                  <Button
                    key={n.href}
                    onClick={() => router.push(n.href)}
                    color={active ? "primary" : "inherit"}
                    sx={{ textTransform: "none", fontWeight: active ? 600 : 400 }}
                    {...(n.icon ? { startIcon: n.icon } : {})}
                  >
                    {n.label}
                  </Button>
                );
              })}
            </Stack>
            {user && (
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box sx={{ textAlign: "right" }}>
                  <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                    {user.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                    {user.email} · {user.role}
                  </Typography>
                </Box>
                <Tooltip title="Sign out">
                  <IconButton onClick={handleLogout} size="small">
                    <LogoutIcon />
                  </IconButton>
                </Tooltip>
              </Stack>
            )}
          </Toolbar>
        </AppBar>
      )}

      <Container maxWidth={maxWidth} sx={{ py: hideChrome ? 0 : 4 }}>
        {(title || subtitle || actions) && (
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems={{ xs: "flex-start", sm: "center" }}
            sx={{ mb: 3, gap: 2 }}
          >
            <Box>
              {title && (
                <Typography variant="h4" sx={{ fontWeight: 600 }}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {subtitle}
                </Typography>
              )}
            </Box>
            {actions && (
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                {actions}
              </Stack>
            )}
          </Stack>
        )}
        {children}
      </Container>
    </Box>
  );
}
