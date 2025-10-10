"use client";

import LanIcon from "@mui/icons-material/Lan";
import ShieldIcon from "@mui/icons-material/Shield";
import { Box, Card, CardContent, Chip, CircularProgress, Grid, Paper, Stack, Typography } from "@mui/material";
import moment from "moment";
import EmptyState from "@/components/common/empty-state";
import { useNetworks } from "@/features/docker/networks/hooks/use-networks";

const NetworkList = () => {
  const { data, isLoading, isError, error } = useNetworks();

  if (isLoading) {
    return (
      <Stack alignItems="center" justifyContent="center" py={6}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary" mt={2}>
          Inspecting Docker networks...
        </Typography>
      </Stack>
    );
  }

  if (isError) {
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

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No networks discovered"
        description="Create an overlay or bridge network to connect containers securely."
      />
    );
  }

  return (
    <Grid container spacing={2.5}>
      {data.map((network) => (
        <Grid key={network.id} size={{ xs: 12, md: 6, lg: 4 }}>
          <Card sx={{ height: "100%" }}>
            <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <LanIcon color="primary" />
                <Typography variant="subtitle1">
                  {network.name}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {network.id}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                <Chip label={network.driver} size="small" variant="outlined" />
                <Chip label={`${network.scope} scope`} size="small" variant="outlined" />
                <Chip label={`${network.containers} containers`} size="small" variant="outlined" color="primary" />
              </Box>
              <Stack direction="row" alignItems="center" spacing={1}>
                <ShieldIcon fontSize="small" color="secondary" />
                <Typography variant="body2" color="text.secondary">
                  Provisioned {moment(network.createdAt).fromNow()}
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
};

export default NetworkList;
