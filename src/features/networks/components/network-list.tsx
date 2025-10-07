"use client";

import LanIcon from "@mui/icons-material/Lan";
import ShieldIcon from "@mui/icons-material/Shield";
import { Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/GridLegacy";
import { styled } from "@mui/material/styles";
import moment from "moment";
import { useNetworks } from "@/features/networks/hooks/use-networks";

const NetworkCard = styled(Paper)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1.5)
}));

const EmptyState = styled(Paper)(({ theme }) => ({
  textAlign: "center",
  padding: theme.spacing(6)
}));

const NetworkList = () => {
  const { data, isLoading } = useNetworks();

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

  if (!data || data.length === 0) {
    return (
      <EmptyState>
        <Typography variant="h6" gutterBottom>
          No networks discovered
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create an overlay or bridge network to connect containers securely.
        </Typography>
      </EmptyState>
    );
  }

  return (
    <Grid container spacing={3}>
      {data.map((network) => (
        <Grid key={network.id} item xs={12} md={6}>
          <NetworkCard>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <LanIcon color="primary" />
              <Typography variant="subtitle1">
                {network.name}
              </Typography>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {network.id}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip label={network.driver} size="small" variant="outlined" />
              <Chip label={`${network.scope} scope`} size="small" variant="outlined" />
              <Chip label={`${network.containers} containers`} size="small" variant="outlined" />
            </Stack>
            <Stack direction="row" alignItems="center" spacing={1}>
              <ShieldIcon fontSize="small" color="secondary" />
              <Typography variant="body2" color="text.secondary">
                Provisioned {moment(network.createdAt).fromNow()}
              </Typography>
            </Stack>
          </NetworkCard>
        </Grid>
      ))}
    </Grid>
  );
};

export default NetworkList;
