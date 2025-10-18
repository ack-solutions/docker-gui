"use client";

import AddIcon from "@mui/icons-material/Add";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import SearchIcon from "@mui/icons-material/Search";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import LayersIcon from "@mui/icons-material/Layers";
import {
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
  Tooltip,
  Typography
} from "@mui/material";
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

  return (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", lg: "center" }}
      >
        <TextField
          size="small"
          placeholder="Search by name, ID, image, status, or project..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
          sx={{ flex: 1, maxWidth: { lg: 500 } }}
        />
        
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            size="small"
            label={searchQuery ? `${filteredCount} of ${totalCount}` : `${totalCount} total`}
            variant="outlined"
            color={searchQuery ? "primary" : "default"}
          />
          {isRefreshing && <CircularProgress size={16} />}
          
          <Tooltip title="Maintenance actions">
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
              <ViewModuleIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list" aria-label="list view">
              <ViewListIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Stack>
      </Stack>

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
    </Stack>
  );
};

export default ContainerListToolbar;

