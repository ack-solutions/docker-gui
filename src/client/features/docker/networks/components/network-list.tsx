"use client";

import { useCallback, useMemo, useState } from "react";
import SearchIcon from "@mui/icons-material/Search";
import { 
  Chip,
  CircularProgress,
  InputAdornment,
  Paper, 
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow, 
  TextField,
  Typography 
} from "@mui/material";
import { toast } from "sonner";
import EmptyState from "@/components/common/empty-state";
import { useConfirmationDialog } from "@/components/common/confirmation-dialog-provider";
import { useNetworks } from "@/features/docker/networks/hooks/use-networks";
import NetworkTableRow from "@/features/docker/networks/components/network-table-row";
import type { DockerNetwork } from "@/lib/api/docker";

const NetworkList = () => {
  const { data, isLoading, isError, error, isFetching } = useNetworks();
  const { confirm } = useConfirmationDialog();
  const networks = data as DockerNetwork[] | undefined;
  const [searchQuery, setSearchQuery] = useState("");

  // Filter networks based on search query
  const filteredNetworks = useMemo(() => {
    if (!networks || !searchQuery.trim()) {
      return networks;
    }
    
    const query = searchQuery.toLowerCase().trim();
    return networks.filter((network) => {
      return (
        network.name.toLowerCase().includes(query) ||
        network.id.toLowerCase().includes(query) ||
        (network.driver && network.driver.toLowerCase().includes(query)) ||
        (network.scope && network.scope.toLowerCase().includes(query))
      );
    });
  }, [networks, searchQuery]);

  const totalCount = networks?.length ?? 0;
  const filteredCount = filteredNetworks?.length ?? 0;

  const handleDeleteNetwork = useCallback(async (id: string, name: string) => {
    const confirmed = await confirm({
      title: "Delete network",
      message: `Delete network "${name}"? This will permanently remove the network. Ensure no containers are using it.`,
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    toast.info(`Network deletion for ${name} not yet implemented`);
    // TODO: Implement network delete API call
  }, [confirm]);

  const handleViewNetwork = useCallback((id: string) => {
    toast.info(`Network details not yet implemented`);
    // TODO: Implement network details view
  }, []);

  if (isError && (!networks || networks.length === 0)) {
    return (
      <Paper sx={{ p: 4 }}>
        <Typography variant="subtitle1" gutterBottom>
          Unable to load networks
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {error instanceof Error ? error.message : "Check your Docker connection and try again."}
        </Typography>
      </Paper>
    );
  }

  if (!isLoading && (!networks || networks.length === 0)) {
    return (
      <EmptyState
        title="No networks discovered"
        description="Create an overlay or bridge network to connect containers securely."
      />
    );
  }

  return (
    <Stack spacing={2.5}>
      <Stack
        direction={{ xs: "column", lg: "row" }}
        spacing={1.5}
        alignItems={{ xs: "stretch", lg: "center" }}
      >
        <TextField
          size="small"
          placeholder="Search by name, ID, driver, or scope..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
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
          {isFetching && <CircularProgress size={16} />}
        </Stack>
      </Stack>

      {filteredCount === 0 && searchQuery ? (
        <EmptyState
          title="No networks match your search"
          description={`No networks found matching "${searchQuery}". Try a different search term.`}
        />
      ) : (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Driver</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Scope</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading && (!networks || networks.length === 0)
                ? Array.from({ length: 5 }).map((_, index) => (
                    <NetworkTableRow key={`network-skeleton-${index}`} />
                  ))
                : filteredNetworks?.map((network) => (
                    <NetworkTableRow
                      key={network.id}
                      network={network}
                      onDelete={handleDeleteNetwork}
                      onView={handleViewNetwork}
                    />
                  ))}
            </TableBody>
          </Table>
        </Paper>
      )}
    </Stack>
  );
};

export default NetworkList;
