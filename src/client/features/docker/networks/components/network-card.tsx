"use client";

import LanIcon from "@mui/icons-material/Lan";
import ShieldIcon from "@mui/icons-material/Shield";
import { Box, Card, CardContent, Chip, Skeleton, Stack, Typography } from "@mui/material";
import moment from "moment";
import type { DockerNetwork } from "@/types/docker";

interface NetworkCardProps {
  network?: DockerNetwork | null;
}

const NetworkCard = ({ network }: NetworkCardProps) => {
  if (!network) {
    return (
      <Card sx={{ height: "100%" }}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Skeleton variant="circular" width={32} height={32} />
            <Skeleton variant="text" width="60%" />
          </Stack>
          <Skeleton variant="text" width="40%" />
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" width={90} height={26} />
            ))}
          </Box>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Skeleton variant="circular" width={24} height={24} />
            <Skeleton variant="text" width="50%" />
          </Stack>
        </CardContent>
      </Card>
    );
  }

  return (
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
  );
};

export default NetworkCard;
