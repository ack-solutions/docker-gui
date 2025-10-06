"use client";

import { useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { AppBar, IconButton, InputAdornment, Stack, TextField, Toolbar, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";

interface TopBarProps {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
}

const SearchField = styled(TextField)(({ theme }) => ({
  minWidth: 280,
  [theme.breakpoints.down("md")]: {
    width: "100%"
  }
}));

const TopBar = ({ title = "Dashboard", subtitle = "Manage Docker containers, images, networks, and volumes from a unified control plane.", onRefresh }: TopBarProps) => {
  const [query, setQuery] = useState("");

  return (
    <AppBar position="sticky">
      <Toolbar>
        <Stack spacing={0.5} flex={1}>
          <Typography variant="h5" fontWeight={600} gutterBottom>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Stack>
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
