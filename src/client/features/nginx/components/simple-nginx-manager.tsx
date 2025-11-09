"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Grid,
  Card,
  CardContent,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import TableRowsIcon from "@mui/icons-material/TableRows";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNginxSites } from "@/features/nginx/hooks/use-nginx-sites";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";
import { useConfirmationDialog } from "@/components/common/confirmation-dialog-provider";
import {
  createNginxSite,
  updateNginxSite,
  deleteNginxSite,
  deployNginxSite,
} from "@/features/nginx/api";
import NginxSitesTable from "./nginx-sites-table";
import NginxSitesCards from "./nginx-sites-cards";
import NginxSiteWizard from "./nginx-site-wizard";
import NginxSiteFormDialog, { type NginxSiteFormData } from "./nginx-site-form-dialog";
import NginxErrorDisplay from "./nginx-error-display";
import type { NginxSite } from "@/types/server";
import { usePersistentState } from "@/client/hooks/use-persistent-state";

export default function SimpleNginxManager() {
  const queryClient = useQueryClient();
  const { data: sitesData, isLoading, isError, error } = useNginxSites();
  const { data: containers = [] } = useContainers({ refetchOnWindowFocus: false });
  const { confirm } = useConfirmationDialog();

  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editFormOpen, setEditFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<NginxSite | null>(null);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<{ site: string; error: string } | null>(null);
  const [viewMode, setViewMode] = usePersistentState<"table" | "cards">("nginx:view-mode", "table");

  // Handle both old and new API response format
  const sites = sitesData ? (Array.isArray(sitesData) ? sitesData : (sitesData as any)?.sites || []) : [];
  const isDisabled = sitesData ? Boolean((sitesData as any)?.disabled) : false;
  const disabledMessage = sitesData ? (sitesData as any)?.message : undefined;

  const createMutation = useMutation({
    mutationFn: createNginxSite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nginx", "sites"] });
      toast.success("Nginx site created successfully!");
      setWizardOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create site");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateNginxSite(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nginx", "sites"] });
      toast.success("Nginx site updated successfully!");
      setEditFormOpen(false);
      setEditingSite(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update site");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteNginxSite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nginx", "sites"] });
      toast.success("Nginx site deleted successfully!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete site");
    },
  });

  const deployMutation = useMutation({
    mutationFn: deployNginxSite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["nginx", "sites"] });
      toast.success("Nginx site deployed successfully!");
      setDeployingId(null);
      setDeployError(null);
    },
    onError: (err, siteId) => {
      const errorMessage = err instanceof Error ? err.message : "Failed to deploy site";
      const site = sites.find(s => s.id === siteId);
      setDeployError({
        site: site?.primaryDomain || siteId,
        error: errorMessage,
      });
      setDeployingId(null);
    },
  });

  const filteredSites = sites.filter((site) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      site.primaryDomain.toLowerCase().includes(term) ||
      site.serverNames.some((name) => name.toLowerCase().includes(term)) ||
      site.upstreamTarget?.toLowerCase().includes(term) ||
      site.notes?.toLowerCase().includes(term)
    );
  });

  const handleCreate = () => {
    setWizardOpen(true);
  };

  const handleEdit = (site: NginxSite) => {
    setEditingSite(site);
    setEditFormOpen(true);
  };

  const handleDelete = async (site: NginxSite) => {
    const confirmed = await confirm({
      title: `Delete ${site.primaryDomain}?`,
      message: "This will remove the nginx configuration. This action cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    });

    if (confirmed) {
      await deleteMutation.mutateAsync(site.id);
    }
  };

  const handleDeploy = async (site: NginxSite) => {
    setDeployingId(site.id);
    await deployMutation.mutateAsync(site.id);
  };

  const handleFormSubmit = async (data: NginxSiteFormData) => {
    if (editingSite) {
      await updateMutation.mutateAsync({ id: editingSite.id, data });
    }
  };

  if (isLoading) {
    return (
      <Stack spacing={2} alignItems="center" justifyContent="center" minHeight={300}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading nginx sites...
        </Typography>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert severity="error">
        {error instanceof Error ? error.message : "Failed to load nginx sites"}
      </Alert>
    );
  }

  if (isDisabled) {
    return (
      <Alert severity="warning">
        {disabledMessage || "Nginx management is currently disabled"}
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Header & Search */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "center" }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Search by domain, target, or notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, value) => value && setViewMode(value)}
          size="small"
        >
          <ToggleButton value="table" aria-label="Table view">
            <TableRowsIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="cards" aria-label="Cards view">
            <ViewModuleIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
          sx={{ minWidth: 180 }}
        >
          Create Nginx Site
        </Button>
      </Stack>

      {/* Stats */}
      {sites.length > 0 && (
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Chip label={`${sites.length} Total`} variant="outlined" />
          <Chip
            label={`${sites.filter((s) => s.status === "active").length} Active`}
            color="success"
            variant="outlined"
          />
          <Chip
            label={`${sites.filter((s) => s.status === "pending").length} Pending`}
            color="warning"
            variant="outlined"
          />
          {sites.filter((s) => s.status === "error").length > 0 && (
            <Chip
              label={`${sites.filter((s) => s.status === "error").length} Errors`}
              color="error"
              variant="outlined"
            />
          )}
          <Chip
            label={`${sites.filter((s) => s.enableHttps).length} HTTPS`}
            color="info"
            variant="outlined"
          />
        </Stack>
      )}

      {/* Sites Display - Table or Cards */}
      {viewMode === "table" ? (
        <NginxSitesTable
          sites={filteredSites}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDeploy={handleDeploy}
          isDeploying={deployingId}
        />
      ) : (
        <NginxSitesCards
          sites={filteredSites}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onDeploy={handleDeploy}
          isDeploying={deployingId}
        />
      )}

      {/* Wizard for Creating Sites */}
      <NginxSiteWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
        containers={containers}
      />

      {/* Form Dialog for Editing Sites */}
      <NginxSiteFormDialog
        open={editFormOpen}
        site={editingSite}
        containers={containers}
        onClose={() => {
          setEditFormOpen(false);
          setEditingSite(null);
        }}
        onSubmit={handleFormSubmit}
      />

      {/* Detailed Error Dialog */}
      <Dialog
        open={!!deployError}
        onClose={() => setDeployError(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Deployment Error: {deployError?.site}</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            {deployError && <NginxErrorDisplay error={deployError.error} />}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeployError(null)}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              const site = sites.find(s => s.primaryDomain === deployError?.site);
              if (site) {
                handleEdit(site);
                setDeployError(null);
              }
            }}
          >
            Edit Configuration
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

