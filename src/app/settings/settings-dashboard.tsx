"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { PageShell } from "@/components/page-shell";
import { apiFetch, getCurrentUser, type PublicUser } from "@/lib/v2/auth-client";

interface ConfigKey {
  key: string;
  envName: string;
  group: string;
  label: string;
  description: string;
  type: string;
  enumValues?: string[];
  default?: unknown;
  required: boolean;
  secret: boolean;
  uiEditable: boolean;
  requiresRestart: boolean;
  examples?: string[];
  min?: number;
  max?: number;
  introducedIn: string;
  deprecatedIn?: string;
  current: {
    value: unknown;
    source: "default" | "yaml" | "env" | "db" | "runtime";
    isDefault: boolean;
  };
}

interface ConfigResponse {
  data: { keys: ConfigKey[]; warnings: string[] };
}

const GROUP_TITLES: Record<string, string> = {
  "core/auth": "Authentication",
  "core/networking": "Networking",
  "core/logging": "Logging",
  "core/rate-limit": "Rate limiting",
  docker: "Docker",
  caddy: "Caddy (reverse proxy)",
  dns: "DNS",
  storage: "Storage",
  features: "Features",
  system: "System"
};

const SOURCE_COLORS: Record<
  string,
  "default" | "primary" | "secondary" | "info" | "warning"
> = {
  default: "default",
  yaml: "info",
  env: "primary",
  db: "secondary",
  runtime: "warning"
};

function formatValue(k: ConfigKey): string {
  const v = k.current.value;
  if (v === undefined || v === null) return "—";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (Array.isArray(v)) return v.map(String).join(", ");
  return String(v);
}

export default function SettingsDashboard(): JSX.Element {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [keys, setKeys] = useState<ConfigKey[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showOnlyOverrides, setShowOnlyOverrides] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ConfigResponse>("/api/v1/config");
      setKeys(res.data.keys);
      setWarnings(res.data.warnings);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void getCurrentUser().then(setUser);
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const filtered = keys.filter((k) => {
      if (showOnlyOverrides && k.current.isDefault) return false;
      if (!f) return true;
      return (
        k.key.toLowerCase().includes(f) ||
        k.envName.toLowerCase().includes(f) ||
        k.label.toLowerCase().includes(f) ||
        k.description.toLowerCase().includes(f)
      );
    });
    const byGroup = new Map<string, ConfigKey[]>();
    for (const k of filtered) {
      const arr = byGroup.get(k.group) ?? [];
      arr.push(k);
      byGroup.set(k.group, arr);
    }
    return Array.from(byGroup.entries());
  }, [keys, filter, showOnlyOverrides]);

  const overrideCount = useMemo(
    () => keys.filter((k) => !k.current.isDefault).length,
    [keys]
  );

  return (
    <PageShell
      title="Settings"
      subtitle={`${keys.length} configurable values · ${overrideCount} overrides from defaults`}
      user={user}
      actions={
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => void load()}
          disabled={loading}
        >
          Refresh
        </Button>
      }
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {warnings.length > 0 && (
        <Alert
          severity="warning"
          icon={<WarningAmberIcon />}
          sx={{ mb: 2, whiteSpace: "pre-wrap" }}
        >
          {warnings.map((w, i) => (
            <Box key={i}>{w}</Box>
          ))}
        </Alert>
      )}

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ mb: 3 }}
        alignItems="center"
      >
        <TextField
          size="small"
          placeholder="Search keys, env names, descriptions…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          sx={{ flexGrow: 1, maxWidth: 480 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            )
          }}
        />
        <Button
          size="small"
          variant={showOnlyOverrides ? "contained" : "outlined"}
          onClick={() => setShowOnlyOverrides((v) => !v)}
        >
          {showOnlyOverrides ? "Showing overrides only" : "Show overrides only"}
        </Button>
      </Stack>

      {loading && keys.length === 0 ? (
        <Stack alignItems="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : grouped.length === 0 ? (
        <Alert severity="info">No keys match your filter.</Alert>
      ) : (
        grouped.map(([group, items]) => (
          <Box key={group} sx={{ mb: 4 }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {GROUP_TITLES[group] ?? group}
            </Typography>
            <TableContainer
              sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Key</TableCell>
                    <TableCell>Value</TableCell>
                    <TableCell>Source</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Notes</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((k) => (
                    <TableRow key={k.key} hover>
                      <TableCell sx={{ verticalAlign: "top", maxWidth: 260 }}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={0.5}
                        >
                          {k.secret && (
                            <Tooltip title="Secret — value is masked">
                              <LockIcon
                                fontSize="inherit"
                                sx={{ color: "text.secondary" }}
                              />
                            </Tooltip>
                          )}
                          <Box>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 500, fontFamily: "monospace" }}
                            >
                              {k.key}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ display: "block" }}
                            >
                              env: {k.envName}
                              {k.required && " · required"}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {k.label}
                            </Typography>
                          </Box>
                        </Stack>
                      </TableCell>
                      <TableCell sx={{ verticalAlign: "top", maxWidth: 280 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: "monospace",
                            wordBreak: "break-all"
                          }}
                        >
                          {formatValue(k)}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ verticalAlign: "top" }}>
                        <Chip
                          label={k.current.source}
                          size="small"
                          color={SOURCE_COLORS[k.current.source] ?? "default"}
                          variant={
                            k.current.isDefault ? "outlined" : "filled"
                          }
                        />
                      </TableCell>
                      <TableCell sx={{ verticalAlign: "top" }}>
                        <Typography variant="caption" color="text.secondary">
                          {k.type}
                          {k.enumValues
                            ? ` (${k.enumValues.join(" | ")})`
                            : ""}
                          {k.min !== undefined ? ` · ≥ ${k.min}` : ""}
                          {k.max !== undefined ? ` · ≤ ${k.max}` : ""}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ verticalAlign: "top", maxWidth: 320 }}>
                        <Typography variant="caption" color="text.secondary">
                          {k.description}
                        </Typography>
                        {k.requiresRestart && (
                          <Chip
                            label="restart required"
                            size="small"
                            color="warning"
                            variant="outlined"
                            sx={{ mt: 0.5 }}
                          />
                        )}
                        {k.deprecatedIn && (
                          <Chip
                            label={`deprecated v${k.deprecatedIn}`}
                            size="small"
                            color="error"
                            variant="outlined"
                            sx={{ mt: 0.5, ml: 0.5 }}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        ))
      )}
    </PageShell>
  );
}
