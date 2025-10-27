"use client";

import AddIcon from "@mui/icons-material/Add";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import SearchIcon from "@mui/icons-material/Search";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import LayersIcon from "@mui/icons-material/Layers";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useState } from "react";

interface ContainerListToolbarProps {
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onCreate: () => void;
  onPruneContainers: () => void;
  onPruneImages: () => void;
  isRefreshing: boolean;
  isPruningContainers: boolean;
  isPruningImages: boolean;
  totalCount: number;
  filteredCount: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

const ContainerListToolbar = ({
  viewMode,
  onViewModeChange,
  onCreate,
  onPruneContainers,
  onPruneImages,
  isRefreshing,
  isPruningContainers,
  isPruningImages,
  totalCount,
  filteredCount,
  searchQuery,
  onSearchChange
}: ContainerListToolbarProps) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [maintenanceAnchor, setMaintenanceAnchor] = useState<null | HTMLElement>(null);
  
  const handleMaintenanceClick = (event: React.MouseEvent<HTMLElement>) => {
    setMaintenanceAnchor(event.currentTarget);
  };
  
  const handleMaintenanceClose = () => {
    setMaintenanceAnchor(null);
  };
  
  const handlePruneContainers = () => {
    onPruneContainers();
    handleMaintenanceClose();
  };
  
  const handlePruneImages = () => {
    onPruneImages();
    handleMaintenanceClose();
  };

  const toolbarContent = isMobile ? (
    <Stack spacing={1}>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          size="small"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
          sx={{ flex: 1 }}
        />
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onCreate}
          size="small"
        >
          New
        </Button>
        <Tooltip title="More actions">
          <IconButton
            size="small"
            onClick={handleMaintenanceClick}
            disabled={isPruningContainers || isPruningImages}
            sx={{ border: 1, borderColor: "divider" }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack direction="row" spacing={0.5} alignItems="center">
        <Chip
          size="small"
          label={searchQuery ? `${filteredCount}/${totalCount}` : `${totalCount}`}
          variant="outlined"
          color={searchQuery ? "primary" : "default"}
          sx={{ height: 24, fontSize: "0.75rem" }}
        />
        {isRefreshing && <CircularProgress size={14} />}
      </Stack>
    </Stack>
  ) : (
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{ flexWrap: "wrap", gap: 1 }}
    >
      <TextField
        size="small"
        placeholder="Search containers..."
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          )
        }}
        sx={{ minWidth: 280, maxWidth: 400 }}
      />

      <Chip
        size="small"
        label={searchQuery ? `${filteredCount}/${totalCount}` : `${totalCount}`}
        variant="outlined"
        color={searchQuery ? "primary" : "default"}
        sx={{ height: 28 }}
      />
      {isRefreshing && <CircularProgress size={16} />}

      <Box flex={1} />

      <Tooltip title="Maintenance">
        <IconButton
          size="small"
          onClick={handleMaintenanceClick}
          disabled={isPruningContainers || isPruningImages}
          sx={{ border: 1, borderColor: "divider" }}
        >
          <DeleteSweepIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate} size="small">
        New
      </Button>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={viewMode}
        onChange={(_event, value: "grid" | "list" | null) => {
          if (value) {
            onViewModeChange(value);
          }
        }}
        aria-label="container view switcher"
      >
        <ToggleButton value="grid" aria-label="grid view">
          <Tooltip title="Grid view">
            <ViewModuleIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
        <ToggleButton value="list" aria-label="list view">
          <Tooltip title="List view">
            <ViewListIcon fontSize="small" />
          </Tooltip>
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );

  return (
    <>
      {toolbarContent}
      <Menu
        anchorEl={maintenanceAnchor}
        open={Boolean(maintenanceAnchor)}
        onClose={handleMaintenanceClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "right"
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "right"
        }}
      >
        <MenuItem onClick={handlePruneContainers} disabled={isPruningContainers}>
          <DeleteSweepIcon fontSize="small" sx={{ mr: 1.5 }} />
          {isPruningContainers ? "Pruning containers..." : "Prune stopped containers"}
        </MenuItem>
        <MenuItem onClick={handlePruneImages} disabled={isPruningImages}>
          <LayersIcon fontSize="small" sx={{ mr: 1.5 }} />
          {isPruningImages ? "Pruning images..." : "Prune unused images"}
        </MenuItem>
      </Menu>
    </>
  );
};

export default ContainerListToolbar;
