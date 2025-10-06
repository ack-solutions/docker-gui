"use client";

import { useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { AppBar, Box, IconButton, InputAdornment, TextField, Toolbar, Typography } from "@mui/material";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
}

const TopBar = ({ title = "Dashboard", subtitle = "Manage Docker containers, images, networks, and volumes from a unified control plane.", onRefresh }: TopBarProps) => {
  const [query, setQuery] = useState("");

  return (
    <AppBar position="sticky" elevation={0} color="transparent" sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
      <Toolbar sx={{ gap: 2, minHeight: 80 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        <TextField
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search containers, images, volumes..."
          variant="outlined"
          size="small"
          sx={{ minWidth: 320 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <IconButton color="inherit" onClick={onRefresh} aria-label="Refresh data">
          <RefreshIcon />
        </IconButton>
        <IconButton color="inherit" aria-label="Notifications">
          <NotificationsNoneIcon />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
