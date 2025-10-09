"use client";

import ArticleIcon from "@mui/icons-material/Article";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import DeviceHubIcon from "@mui/icons-material/DeviceHub";
import DnsIcon from "@mui/icons-material/Dns";
import LanIcon from "@mui/icons-material/Lan";
import StorageIcon from "@mui/icons-material/Storage";
import TerminalIcon from "@mui/icons-material/Terminal";
import VpnLockIcon from "@mui/icons-material/VpnLock";
import {
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import { styled } from "@mui/material/styles";
import moment from "moment";
import type { ReactNode } from "react";
import type { DockerContainerInspect } from "@/types/docker";

const InfoCard = styled(Card)(({ theme }) => ({
  height: "100%",
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 1.5
      : theme.shape.borderRadius
}));

interface ContainerOverviewPanelProps {
  inspect: DockerContainerInspect;
}

const renderListItem = (icon: ReactNode, label: string, value?: ReactNode) => (
  <ListItem disableGutters>
    <ListItemIcon sx={{ minWidth: 36 }}>{icon}</ListItemIcon>
    <ListItemText
      primaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
      secondaryTypographyProps={{ variant: "subtitle2" }}
      primary={label}
      secondary={value ?? "—"}
    />
  </ListItem>
);

const ContainerOverviewPanel = ({ inspect }: ContainerOverviewPanelProps) => {
  const restartPolicy = inspect.hostConfig.restartPolicy?.name
    ? `${inspect.hostConfig.restartPolicy.name}${inspect.hostConfig.restartPolicy.maximumRetryCount ? ` (${inspect.hostConfig.restartPolicy.maximumRetryCount} retries)` : ""}`
    : "No restart";

  const healthStatus = inspect.state.health?.status ?? "unknown";

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <InfoCard sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Runtime & Status
            </Typography>
            <List disablePadding>
              {renderListItem(
                <DnsIcon fontSize="small" color="primary" />,
                "Status",
                <Chip
                  label={inspect.state.status}
                  size="small"
                  color={inspect.state.running ? "success" : "default"}
                />
              )}
              {renderListItem(
                <TerminalIcon fontSize="small" color="primary" />,
                "Command",
                inspect.config.cmd.length > 0 ? inspect.config.cmd.join(" ") : "—"
              )}
              {renderListItem(
                <StorageIcon fontSize="small" color="primary" />,
                "Working directory",
                inspect.config.workingDir || "—"
              )}
              {renderListItem(
                <CalendarTodayIcon fontSize="small" color="primary" />,
                "Started",
                inspect.state.startedAt
                  ? `${moment(inspect.state.startedAt).fromNow()} (${moment(inspect.state.startedAt).format("LLL")})`
                  : "—"
              )}
              {renderListItem(
                <ArticleIcon fontSize="small" color="primary" />,
                "Restart policy",
                restartPolicy
              )}
            </List>
          </CardContent>
        </InfoCard>
        <InfoCard sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Host & Network
            </Typography>
            <List disablePadding>
              {renderListItem(
                <LanIcon fontSize="small" color="primary" />,
                "Network mode",
                inspect.hostConfig.networkMode || "bridge"
              )}
              {renderListItem(
                <DeviceHubIcon fontSize="small" color="primary" />,
                "Container IP",
                inspect.networkSettings.ipAddress || "—"
              )}
              {renderListItem(
                <VpnLockIcon fontSize="small" color="primary" />,
                "MAC address",
                inspect.networkSettings.macAddress || "—"
              )}
              {renderListItem(
                <DeviceHubIcon fontSize="small" color="primary" />,
                "PID",
                inspect.state.pid || 0
              )}
              {renderListItem(
                <DeviceHubIcon fontSize="small" color="primary" />,
                "Restart count",
                inspect.state.restartCount ?? 0
              )}
              {inspect.state.health &&
                renderListItem(
                  <DeviceHubIcon fontSize="small" color="primary" />,
                  "Health",
                  healthStatus
                )}
            </List>
          </CardContent>
        </InfoCard>
      </Stack>

      {inspect.networkSettings.networks && Object.keys(inspect.networkSettings.networks).length > 0 && (
        <InfoCard>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Networks
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>IPv4</TableCell>
                  <TableCell>IPv6</TableCell>
                  <TableCell>Gateway</TableCell>
                  <TableCell>MAC</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(inspect.networkSettings.networks).map(([name, details]) => (
                  <TableRow key={name}>
                    <TableCell>{name}</TableCell>
                    <TableCell>{details.ipAddress || "—"}</TableCell>
                    <TableCell>{details.globalIPv6Address || "—"}</TableCell>
                    <TableCell>{details.gateway || details.ipv6Gateway || "—"}</TableCell>
                    <TableCell>{details.macAddress || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </InfoCard>
      )}

      {inspect.networkSettings.ports && Object.keys(inspect.networkSettings.ports).length > 0 && (
        <InfoCard>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Published Ports
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Container</TableCell>
                  <TableCell>Host bindings</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {Object.entries(inspect.networkSettings.ports).map(([port, bindings]) => (
                  <TableRow key={port}>
                    <TableCell>{port}</TableCell>
                    <TableCell>
                      {bindings && bindings.length > 0
                        ? bindings.map((binding, index) => (
                            <Chip
                              key={`${port}-${index}`}
                              label={`${binding.hostIp ?? "0.0.0.0"}:${binding.hostPort ?? ""}`}
                              size="small"
                              sx={{ mr: 1, mb: 1 }}
                            />
                          ))
                        : "Not published"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </InfoCard>
      )}

      <InfoCard>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Bind mounts
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Source</TableCell>
                <TableCell>Destination</TableCell>
                <TableCell>Mode</TableCell>
                <TableCell>Access</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {inspect.mounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary" textAlign="center">
                      No mounts configured.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                inspect.mounts.map((mount, index) => (
                  <TableRow key={`${mount.destination}-${index}`}>
                    <TableCell>{mount.source || "—"}</TableCell>
                    <TableCell>{mount.destination}</TableCell>
                    <TableCell>{mount.mode || "—"}</TableCell>
                    <TableCell>{mount.rw ? "Read / Write" : "Read only"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </InfoCard>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <InfoCard sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Environment variables
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {inspect.config.env.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No environment variables defined.
                </Typography>
              ) : (
                inspect.config.env.map((entry) => (
                  <Chip key={entry} label={entry} size="small" variant="outlined" />
                ))
              )}
            </Box>
          </CardContent>
        </InfoCard>
        <InfoCard sx={{ flex: 1 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Labels
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {Object.keys(inspect.config.labels).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No labels applied.
                </Typography>
              ) : (
                Object.entries(inspect.config.labels).map(([key, value]) => (
                  <Chip key={key} label={`${key}=${value}`} size="small" variant="outlined" />
                ))
              )}
            </Box>
          </CardContent>
        </InfoCard>
      </Stack>
    </Stack>
  );
};

export default ContainerOverviewPanel;
