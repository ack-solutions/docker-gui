"use client";

import LanIcon from "@mui/icons-material/Lan";
import ShieldIcon from "@mui/icons-material/Shield";
import { Chip, CircularProgress, Grid, Paper, Stack, Typography } from "@mui/material";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useNetworks } from "@/features/networks/hooks/useNetworks";

dayjs.extend(relativeTime);

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
      <Paper sx={{ p: 6, textAlign: "center" }}>
        <Typography variant="h6" gutterBottom>
          No networks discovered
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Create an overlay or bridge network to connect containers securely.
        </Typography>
      </Paper>
    );
  }

  return (
    <Grid container spacing={3}>
      {data.map((network) => (
        <Grid key={network.id} item xs={12} md={6}>
          <Paper sx={{ p: 3, borderRadius: 3, display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <LanIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={600}>
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
                Provisioned {dayjs(network.createdAt).fromNow()}
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      ))}
    </Grid>
  );
};

export default NetworkList;
