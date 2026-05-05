"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Stack,
  Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import LanguageIcon from "@mui/icons-material/Language";
import StorageIcon from "@mui/icons-material/Storage";
import EmailIcon from "@mui/icons-material/Email";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { toast } from "sonner";
import {
  AuthGuard,
  ErrorState,
  LoadingState,
  PageShell
} from "@/components";
import { ApiError, apiFetch, type PublicUser } from "@/lib/v2/auth-client";

type FeatureKey = "caddy" | "minio" | "email" | "postgres-gui";
type FeatureCategory = "networking" | "storage" | "database" | "email";
type FeatureStatus = "stopped" | "starting" | "running" | "error" | "coming-soon";

interface Feature {
  key: FeatureKey;
  displayName: string;
  category: FeatureCategory;
  description: string;
  ports: number[];
  status: FeatureStatus;
  comingSoon: boolean;
  configHref?: string;
  details?: {
    containerId?: string;
    image?: string;
    state?: string;
    startedAt?: string;
    lastError?: string;
  };
}

const CATEGORY_ICON: Record<FeatureCategory, JSX.Element> = {
  networking: <LanguageIcon sx={{ fontSize: 36, color: "primary.main" }} />,
  storage: <StorageIcon sx={{ fontSize: 36, color: "primary.main" }} />,
  database: <AccountTreeIcon sx={{ fontSize: 36, color: "primary.main" }} />,
  email: <EmailIcon sx={{ fontSize: 36, color: "primary.main" }} />
};

const CATEGORY_LABEL: Record<FeatureCategory, string> = {
  networking: "Networking",
  storage: "Storage",
  database: "Database",
  email: "Email"
};

const STATUS_COLOR: Record<
  FeatureStatus,
  "default" | "success" | "info" | "warning" | "error"
> = {
  stopped: "default",
  starting: "info",
  running: "success",
  error: "error",
  "coming-soon": "warning"
};

const STATUS_LABEL: Record<FeatureStatus, string> = {
  stopped: "Disabled",
  starting: "Starting",
  running: "Running",
  error: "Error",
  "coming-soon": "Coming soon"
};

function FeaturesInner({ user }: { user: PublicUser }) {
  const router = useRouter();
  const [features, setFeatures] = useState<Feature[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<FeatureKey | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await apiFetch<Feature[]>("/api/v1/features");
      setFeatures(list);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const enable = useCallback(
    async (f: Feature) => {
      setBusyKey(f.key);
      try {
        await apiFetch(`/api/v1/features/${f.key}/enable`, { method: "POST" });
        toast.success(`${f.displayName} enabled`);
        await load();
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : String(err);
        toast.error(`Could not enable ${f.displayName}: ${msg}`);
        await load();
      } finally {
        setBusyKey(null);
      }
    },
    [load]
  );

  const disable = useCallback(
    async (f: Feature) => {
      setBusyKey(f.key);
      try {
        await apiFetch(`/api/v1/features/${f.key}/disable`, { method: "POST" });
        toast.success(`${f.displayName} disabled`);
        await load();
      } catch (err) {
        const msg = err instanceof ApiError ? err.message : String(err);
        toast.error(`Could not disable ${f.displayName}: ${msg}`);
        await load();
      } finally {
        setBusyKey(null);
      }
    },
    [load]
  );

  if (features === null && !loadError) {
    return (
      <PageShell title="Features" user={user}>
        <LoadingState />
      </PageShell>
    );
  }

  if (features === null && loadError) {
    return (
      <PageShell title="Features" user={user}>
        <ErrorState title="Cannot load features" message={loadError} onRetry={load} />
      </PageShell>
    );
  }

  const list = features ?? [];

  return (
    <PageShell
      title="Features"
      subtitle="Enable optional capabilities. Each one runs in its own container — disable to free the ports."
      user={user}
      actions={
        <Button startIcon={<RefreshIcon />} onClick={load} variant="outlined" size="small">
          Refresh
        </Button>
      }
    >
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: 2
        }}
      >
        {list.map((f) => {
          const busy = busyKey === f.key;
          return (
            <Card key={f.key} variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
                  {CATEGORY_ICON[f.category]}
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Typography variant="h6">{f.displayName}</Typography>
                      <Chip
                        size="small"
                        label={STATUS_LABEL[f.status]}
                        color={STATUS_COLOR[f.status]}
                        variant={f.status === "running" ? "filled" : "outlined"}
                      />
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {CATEGORY_LABEL[f.category]}
                      {f.ports.length > 0 && ` · ports ${f.ports.join(", ")}`}
                      {f.details?.containerId && ` · ${f.details.containerId}`}
                    </Typography>
                  </Box>
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {f.description}
                </Typography>
                {f.details?.lastError && (
                  <Alert severity="error" sx={{ mb: 1 }}>
                    {f.details.lastError}
                  </Alert>
                )}
              </CardContent>
              <CardActions sx={{ px: 2, pb: 2, justifyContent: "flex-end", gap: 1 }}>
                {f.configHref && f.status === "running" && (
                  <Button
                    size="small"
                    onClick={() => router.push(f.configHref!)}
                    endIcon={<OpenInNewIcon />}
                  >
                    Configure
                  </Button>
                )}
                {f.comingSoon ? (
                  <Button size="small" variant="outlined" disabled>
                    Coming soon
                  </Button>
                ) : f.status === "running" ? (
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={() => disable(f)}
                    disabled={busy}
                    startIcon={busy ? <CircularProgress size={14} /> : null}
                  >
                    Disable
                  </Button>
                ) : (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => enable(f)}
                    disabled={busy}
                    startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
                  >
                    Enable
                  </Button>
                )}
              </CardActions>
            </Card>
          );
        })}
      </Box>

      <Alert severity="info" sx={{ mt: 3 }}>
        Each feature runs as its own Docker container managed by docker-gui.
        Disabling preserves the data volume — re-enabling restores state. The
        host ports listed under each feature are reserved while it is running.
      </Alert>
    </PageShell>
  );
}

export default function FeaturesDashboard() {
  return <AuthGuard>{(user) => <FeaturesInner user={user} />}</AuthGuard>;
}
