"use client";

import { useMemo } from "react";
import { Box, Card, CardContent, Chip, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import NetworkCheckIcon from "@mui/icons-material/NetworkCheck";
import RouterIcon from "@mui/icons-material/Router";
import type { DockerNetwork } from "@/types/docker";

interface NetworkInfoCardProps {
  networks: DockerNetwork[];
}

const NetworkInfoCard = ({ networks }: NetworkInfoCardProps) => {
  const stats = useMemo(() => {
    const byDriver = networks.reduce((acc, network) => {
      acc[network.driver] = (acc[network.driver] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalContainers = networks.reduce((sum, net) => sum + net.containers, 0);

    return {
      total: networks.length,
      byDriver,
      totalContainers,
      topNetworks: [...networks].sort((a, b) => b.containers - a.containers).slice(0, 5)
    };
  }, [networks]);

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <RouterIcon color="primary" />
            <Typography variant="h6">Network Status</Typography>
          </Stack>

          <Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip
                icon={<NetworkCheckIcon />}
                label={`${stats.total} Networks`}
                color="primary"
                variant="outlined"
                size="small"
              />
              <Chip
                label={`${stats.totalContainers} Connected`}
                color="success"
                variant="outlined"
                size="small"
              />
            </Stack>
          </Box>

          <Box>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Network Drivers
            </Typography>
            <Stack spacing={0.5}>
              {Object.entries(stats.byDriver).map(([driver, count]) => (
                <Stack key={driver} direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">
                    {driver}
                  </Typography>
                  <Typography variant="body2">{count}</Typography>
                </Stack>
              ))}
            </Stack>
          </Box>

          {stats.topNetworks.length > 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Most Active Networks
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell align="right">Containers</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {stats.topNetworks.map((network) => (
                    <TableRow key={network.id}>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {network.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {network.driver}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip label={network.containers} size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default NetworkInfoCard;

