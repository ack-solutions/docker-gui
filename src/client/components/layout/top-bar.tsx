"use client";

import { useMemo, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  TextField,
  Toolbar,
  Tooltip,
  Typography
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useThemeMode } from "@/components/theme/theme-context";
import PageBreadcrumbs from "@/components/layout/page-breadcrumbs";
import { useAuth } from "@/components/providers/auth-provider";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
}

const SearchField = styled(TextField)(({ theme }) => ({
  minWidth: 220,
  [theme.breakpoints.down("md")]: {
    width: "100%"
  }
}));

const TopBar = ({
  title = "Dashboard",
  subtitle = "Manage Docker containers, images, networks, and volumes from a unified control plane.",
  onRefresh
}: TopBarProps) => {
  const [query, setQuery] = useState("");
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { mode, toggleTheme } = useThemeMode();
  const { user, logout } = useAuth();

  const initials = useMemo(() => {
    if (!user) {
      return "U";
    }
    if (user.name) {
      return user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
    }
    return user.email.charAt(0).toUpperCase();
  }, [user]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleMenuClose();
    logout();
  };

  return (
    <AppBar position="static" elevation={0} sx={{ borderRadius: 0, border: 'none', flexShrink: 0 }}>
      <Toolbar sx={{ px: 3, py: 2, minHeight: { xs: 64, sm: 70 } }}>
        <Stack spacing={0.5} flex={1}>
          <PageBreadcrumbs />
          <Typography variant="h6">
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: "600px" }}>
            {subtitle}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <SearchField
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search containers, images, volumes..."
            variant="outlined"
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          <IconButton color="inherit" onClick={onRefresh} aria-label="Refresh data" size="small">
            <RefreshIcon fontSize="small" />
          </IconButton>
          <IconButton color="inherit" onClick={toggleTheme} aria-label="Toggle theme" size="small">
            {mode === "dark" ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
          </IconButton>
          <IconButton color="inherit" aria-label="Notifications" size="small">
            <NotificationsNoneIcon fontSize="small" />
          </IconButton>
          <Divider flexItem orientation="vertical" sx={{ height: 28 }} />
          <Tooltip title="Account options">
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="subtitle2">
                  {user?.name ?? user?.email ?? "Unknown user"}
                </Typography>
                {user?.role ? (
                  <Typography variant="caption" color="text.secondary">
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Typography>
                ) : null}
              </Box>
              <IconButton onClick={handleMenuOpen} size="small" sx={{ p: 0 }}>
                <Avatar
                  sx={{
                    width: 32,
                    height: 32,
                    bgcolor: "primary.main",
                    color: "primary.contrastText"
                  }}
                >
                  {initials}
                </Avatar>
              </IconButton>
            </Stack>
          </Tooltip>
          <Menu
            open={Boolean(anchorEl)}
            anchorEl={anchorEl}
            onClose={handleMenuClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <Box sx={{ px: 2, py: 1.5 }}>
              <Typography variant="subtitle2">
                {user?.name ?? user?.email ?? "Signed in"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.role ? `${user.role} • ${user?.permissions.length ?? 0} permissions` : ""}
              </Typography>
            </Box>
            <Divider />
            <MenuItem onClick={handleLogout}>Sign out</MenuItem>
          </Menu>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
