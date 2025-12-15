"use client";

import { useState, useMemo } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Collapse,
  IconButton,
  Grid,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import TableRowsIcon from "@mui/icons-material/TableRows";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { domainQueryKeys, useDomains } from "@/features/domains/hooks/use-domains";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";
import { createDomain, deleteDomain } from "@/features/domains/api";
import { useConfirmationDialog } from "@/components/common/confirmation-dialog-provider";
import DomainCard from "./domain-card";
import DomainsTableView from "./domains-table-view";
import SimpleDomainWizard from "./simple-domain-wizard";
import type { Domain } from "@/types/server";
import { usePersistentState } from "@/client/hooks/use-persistent-state";

export default function SimpleDomainManager() {
  const queryClient = useQueryClient();
  const { data: domains, isLoading, isError, error } = useDomains();
  const { data: containers = [] } = useContainers({ refetchOnWindowFocus: false });
  const { confirm } = useConfirmationDialog();

  const [search, setSearch] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);
  const [viewMode, setViewMode] = usePersistentState<"grid" | "table">("domains:view-mode", "grid");

  const createMutation = useMutation({
    mutationFn: createDomain,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: domainQueryKeys.all });
      toast.success("Domain created successfully!");
      setWizardOpen(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create domain");
    },
  });


  const deleteMutation = useMutation({
    mutationFn: deleteDomain,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: domainQueryKeys.all });
      toast.success("Domain deleted successfully!");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete domain");
    },
  });

  const filteredDomains = useMemo(() => {
    if (!domains) return [];
    if (!search.trim()) return domains;

    const term = search.toLowerCase();
    return domains.filter(
      (d) =>
        d.name.toLowerCase().includes(term) ||
        d.aliases.some((alias) => alias.toLowerCase().includes(term)) ||
        d.provider?.toLowerCase().includes(term)
    );
  }, [domains, search]);

  // Group domains by base domain (for subdomain grouping)
  const groupedDomains = useMemo(() => {
    const groups: { [key: string]: Domain[] } = {};
    
    filteredDomains.forEach((domain) => {
      const parts = domain.name.split('.');
      const baseDomain = parts.length > 2 ? parts.slice(-2).join('.') : domain.name;
      
      if (!groups[baseDomain]) {
        groups[baseDomain] = [];
      }
      groups[baseDomain].push(domain);
    });
    
    return groups;
  }, [filteredDomains]);


  const handleDelete = async (domain: Domain) => {
    const confirmed = await confirm({
      title: `Delete ${domain.name}?`,
      message: "This will remove the domain and all its configurations.",
      confirmLabel: "Delete",
      tone: "danger",
    });

    if (confirmed) {
      await deleteMutation.mutateAsync(domain.id);
    }
  };

  const toggleExpand = (domainId: string) => {
    setExpandedDomain(expandedDomain === domainId ? null : domainId);
  };

  if (isLoading) {
    return (
      <Stack spacing={2} alignItems="center" justifyContent="center" minHeight={300}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading domains...
        </Typography>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert severity="error">
        {error instanceof Error ? error.message : "Failed to load domains"}
      </Alert>
    );
  }

  return (
    <Stack spacing={3}>
      {/* Header */}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search domains..."
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
          <ToggleButton value="grid" aria-label="Grid view">
            <ViewModuleIcon fontSize="small" />
          </ToggleButton>
          <ToggleButton value="table" aria-label="Table view">
            <TableRowsIcon fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setWizardOpen(true)}
          sx={{ minWidth: 160 }}
        >
          Add Domain
        </Button>
      </Stack>

      {/* Domain Stats */}
      {domains && domains.length > 0 && (
        <Stack direction="row" spacing={2} flexWrap="wrap">
          <Chip label={`${domains.length} Total`} color="default" variant="outlined" />
          <Chip
            label={`${domains.filter((d) => d.status === "active").length} Active`}
            color="success"
            variant="outlined"
          />
          <Chip
            label={`${domains.filter((d) => d.status === "pending").length} Pending`}
            color="warning"
            variant="outlined"
          />
          {domains.filter((d) => d.status === "error").length > 0 && (
            <Chip
              label={`${domains.filter((d) => d.status === "error").length} Errors`}
              color="error"
              variant="outlined"
            />
          )}
        </Stack>
      )}

      {/* Domain List - Grid or Table View */}
      {filteredDomains.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            p: 6,
            textAlign: "center",
            borderStyle: "dashed",
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" gutterBottom>
            {search ? "No domains found" : "No domains yet"}
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {search
              ? "Try a different search term"
              : "Get started by adding your first domain"}
          </Typography>
          {!search && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setWizardOpen(true)}
              sx={{ mt: 2 }}
            >
              Add Your First Domain
            </Button>
          )}
        </Paper>
      ) : viewMode === "table" ? (
        <DomainsTableView
          domains={filteredDomains}
          onEdit={(domain) => {
            // Navigate to detail page
            window.location.href = `/domains/${domain.id}`;
          }}
          onDelete={handleDelete}
        />
      ) : (
        <Grid container spacing={3}>
          {filteredDomains.map((domain) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={domain.id}>
              <DomainCard
                domain={domain}
                onDelete={() => handleDelete(domain)}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Simple Wizard for creating new domains */}
      <SimpleDomainWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
      />
    </Stack>
  );
}
