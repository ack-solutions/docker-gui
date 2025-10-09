"use client";

import { useMemo, useState } from "react";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloudIcon from "@mui/icons-material/Cloud";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import PublicIcon from "@mui/icons-material/Public";
import SearchIcon from "@mui/icons-material/Search";
import ShieldIcon from "@mui/icons-material/Shield";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import Grid from "@mui/material/Grid";
import moment from "moment";
import { useDomains } from "@/features/domains/hooks/use-domains";
import type { DomainStatus } from "@/types/server";

const statusConfig: Record<
  DomainStatus,
  { label: string; color: "success" | "warning" | "error"; icon: JSX.Element }
> = {
  active: { label: "Active", color: "success", icon: <CheckCircleIcon fontSize="small" /> },
  pending: { label: "Pending", color: "warning", icon: <PendingActionsIcon fontSize="small" /> },
  error: { label: "Attention", color: "error", icon: <ErrorOutlineIcon fontSize="small" /> }
};

const renderManagedChip = (managed: boolean) => (
  <Chip
    size="small"
    icon={managed ? <ShieldIcon fontSize="small" /> : <PublicIcon fontSize="small" />}
    label={managed ? "Managed" : "External"}
    color={managed ? "primary" : "default"}
    variant={managed ? "filled" : "outlined"}
  />
);

const renderProviderChip = (provider?: string) =>
  provider ? (
    <Chip size="small" icon={<CloudIcon fontSize="small" />} label={provider} variant="outlined" />
  ) : null;

const renderServiceChip = (service?: string | null) =>
  service ? (
    <Chip
      size="small"
      icon={<ManageAccountsIcon fontSize="small" />}
      label={`Routes to ${service}`}
      variant="outlined"
    />
  ) : null;

const DomainManager = () => {
  const { data, isLoading, isError, error } = useDomains();
  const [search, setSearch] = useState("");

  const filteredDomains = useMemo(() => {
    if (!data) {
      return [];
    }

    const term = search.trim().toLowerCase();

    if (!term) {
      return data;
    }

    return data.filter((domain) => {
      const haystack = [
        domain.name,
        domain.provider,
        domain.notes,
        domain.targetService,
        domain.records.map((record) => `${record.type} ${record.host} ${record.value}`).join(" ")
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [data, search]);

  if (isLoading) {
    return (
      <Stack spacing={2} alignItems="center" justifyContent="center" minHeight={240}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          Loading domains...
        </Typography>
      </Stack>
    );
  }

  if (isError) {
    return (
      <Alert severity="error" variant="outlined">
        {error instanceof Error ? error.message : "Unable to load domains at the moment."}
      </Alert>
    );
  }

  if (!data?.length) {
    return (
      <Paper
        variant="outlined"
        sx={{
          borderStyle: "dashed",
          p: 5,
          borderRadius: 3,
          textAlign: "center",
          borderColor: "divider"
        }}
      >
        <Typography variant="h6">No domains connected yet</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
          Connect your domain registrar, import DNS zones, and tie hostnames to upstream services to
          unlock the automation features here.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={3}>
      <TextField
        fullWidth
        size="small"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        label="Search domains, providers, or DNS records"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" sx={{ color: "text.disabled" }} />
            </InputAdornment>
          )
        }}
      />

      {!filteredDomains.length ? (
        <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: "center" }}>
          <Typography variant="h6">No matches</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Adjust your search term or clear the filter to see all managed domains.
          </Typography>
        </Paper>
      ) : (
        <Grid container spacing={3}>
          {filteredDomains.map((domain) => {
            const status = statusConfig[domain.status];
            return (
              <Grid size={{ xs: 12 }} key={domain.id}>
                <Card variant="outlined" sx={{ borderRadius: 3 }}>
                  <CardContent>
                    <Stack spacing={2.5}>
                      <Stack
                        direction={{ xs: "column", md: "row" }}
                        alignItems={{ xs: "flex-start", md: "center" }}
                        justifyContent="space-between"
                        spacing={2}
                      >
                        <Stack spacing={1}>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="h6" component="div">
                              {domain.name}
                            </Typography>
                            <Chip
                              size="small"
                              color={status.color}
                              icon={status.icon}
                              label={status.label}
                            />
                          </Stack>
                          <Stack direction="row" spacing={1}>
                            {renderManagedChip(domain.managed)}
                            {renderProviderChip(domain.provider)}
                            {renderServiceChip(domain.targetService)}
                            {domain.sslCertificateId ? (
                              <Chip
                                size="small"
                                icon={<ShieldIcon fontSize="small" />}
                                label={`TLS: ${domain.sslCertificateId}`}
                                variant="outlined"
                              />
                            ) : (
                              <Chip size="small" label="TLS pending" variant="outlined" />
                            )}
                          </Stack>
                        </Stack>
                        <Stack direction="row" spacing={3} divider={<Divider flexItem orientation="vertical" />}>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Last updated
                            </Typography>
                            <Tooltip title={moment(domain.updatedAt).format("MMM D, YYYY h:mm A")}>
                              <Typography variant="body1">
                                {moment(domain.updatedAt).fromNow()}
                              </Typography>
                            </Tooltip>
                          </Box>
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              Created
                            </Typography>
                            <Tooltip title={moment(domain.createdAt).format("MMM D, YYYY h:mm A")}>
                              <Typography variant="body1">
                                {moment(domain.createdAt).fromNow()}
                              </Typography>
                            </Tooltip>
                          </Box>
                        </Stack>
                      </Stack>

                      {domain.notes ? (
                        <Typography variant="body2" color="text.secondary">
                          {domain.notes}
                        </Typography>
                      ) : null}

                      <Paper variant="outlined" sx={{ borderRadius: 2.5 }}>
                        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.5 }}>
                          <Typography variant="subtitle2" color="text.secondary">
                            DNS records ({domain.records.length})
                          </Typography>
                        </Stack>
                        <Divider />
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell width="12%">Type</TableCell>
                              <TableCell width="18%">Host</TableCell>
                              <TableCell>Value</TableCell>
                              <TableCell width="10%">TTL</TableCell>
                              <TableCell width="18%">Updated</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {domain.records.map((record) => (
                              <TableRow key={record.id} hover>
                                <TableCell>
                                  <Chip label={record.type} size="small" variant="outlined" />
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">{record.host}</Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                                    {record.value}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2">{record.ttl}s</Typography>
                                </TableCell>
                                <TableCell>
                                  <Tooltip title={moment(record.updatedAt).format("MMM D, YYYY h:mm A")}>
                                    <Typography variant="body2">
                                      {moment(record.updatedAt).fromNow()}
                                    </Typography>
                                  </Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </Paper>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Stack>
  );
};

export default DomainManager;
