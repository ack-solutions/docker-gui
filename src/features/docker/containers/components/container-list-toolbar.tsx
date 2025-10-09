"use client";

import AddIcon from "@mui/icons-material/Add";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import {
  Button,
  Chip,
  CircularProgress,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from "@mui/material";

interface ContainerListToolbarProps {
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onCreate: () => void;
  isRefreshing: boolean;
  totalCount: number;
}

const ContainerListToolbar = ({
  viewMode,
  onViewModeChange,
  onCreate,
  isRefreshing,
  totalCount
}: ContainerListToolbarProps) => (
  <Stack
    direction={{ xs: "column", sm: "row" }}
    spacing={1.5}
    alignItems={{ xs: "stretch", sm: "center" }}
    justifyContent="space-between"
  >
    <Stack direction="row" spacing={1.5} alignItems="center">
      <Typography variant="h6">Containers</Typography>
      <Chip
        size="small"
        label={`${totalCount} total`}
        variant="outlined"
        color="default"
      />
      {isRefreshing && <CircularProgress size={16} />}
    </Stack>
    <Stack direction="row" spacing={1} justifyContent={{ xs: "flex-start", sm: "flex-end" }}>
      <Button variant="contained" startIcon={<AddIcon />} onClick={onCreate}>
        New container
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
          <ViewModuleIcon fontSize="small" sx={{ mr: 1 }} />
          Grid
        </ToggleButton>
        <ToggleButton value="list" aria-label="list view">
          <ViewListIcon fontSize="small" sx={{ mr: 1 }} />
          List
        </ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  </Stack>
);

export default ContainerListToolbar;

