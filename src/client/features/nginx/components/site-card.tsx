"use client";

import CloudDoneIcon from "@mui/icons-material/CloudDone";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { Alert, Button, Card, CardActionArea, CardContent, Chip, Skeleton, Stack, Tooltip, Typography } from "@mui/material";
import { styled } from "@mui/material/styles";
import type { NginxSite } from "@/types/server";

const StyledCard = styled(Card)(({ theme }) => ({
  borderRadius:
    typeof theme.shape.borderRadius === "number"
      ? theme.shape.borderRadius * 1.5
      : theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`
}));

interface SiteCardProps {
  site?: NginxSite | null;
  active?: boolean;
  onSelect?: (site: NginxSite) => void;
  onDeploy?: (site: NginxSite) => void;
  onToggle?: (site: NginxSite) => void;
}

const SiteCard = ({ site, active = false, onSelect, onDeploy, onToggle }: SiteCardProps) => {
  if (!site) {
    return (
      <StyledCard variant={active ? "outlined" : undefined}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="60%" />
          <Stack direction="row" spacing={1} alignItems="center">
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" width={90} height={26} />
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            {Array.from({ length: 2 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" width={96} height={32} />
            ))}
          </Stack>
        </CardContent>
      </StyledCard>
    );
  }

  const handleSelect = () => onSelect?.(site);

  const statusChipColor =
    site.status === "active"
      ? "success"
      : site.status === "pending"
        ? "warning"
        : site.status === "error"
          ? "error"
          : "default";

  const tlsLabel =
    site.sslMode === "lets-encrypt"
      ? "Let's Encrypt"
      : site.sslMode === "custom"
        ? "Custom TLS"
        : "HTTP only";

  const upstreamDescription =
    site.upstreamType === "container" && site.containerId
      ? `${site.containerId.slice(0, 12)}:${site.containerPort ?? ""}`
      : site.upstreamTarget;

  return (
    <StyledCard variant={active ? "outlined" : undefined}>
      <CardActionArea onClick={handleSelect}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">
              {site.primaryDomain}
            </Typography>
            <Chip
              icon={site.status === "active" ? <CloudDoneIcon fontSize="small" /> : <WarningAmberIcon fontSize="small" />}
              label={site.status.toUpperCase()}
              color={statusChipColor as any}
              size="small"
            />
          </Stack>

          {site.serverNames.length > 1 && (
            <Typography variant="caption" color="text.secondary">
              Aliases: {site.serverNames.filter((name) => name !== site.primaryDomain).join(", ")}
            </Typography>
          )}

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Chip size="small" label={`${site.upstreamType} · ${upstreamDescription}`} />
            <Chip size="small" color={site.enableHttps ? "primary" : "default"} label={tlsLabel} />
            <Chip size="small" label={site.enableHttp ? "HTTP" : "HTTP disabled"} />
            <Chip size="small" label={site.enableHttps ? "HTTPS" : "HTTPS disabled"} />
            {site.forceHttps && <Chip size="small" color="success" label="Force HTTPS" />}
          </Stack>

          {site.lastLog && (
            <Tooltip title={new Date(site.lastLog.createdAt).toLocaleString()}>
              <Stack direction="row" spacing={1} alignItems="center">
                <InfoOutlinedIcon fontSize="small" />
                <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                  {site.lastLog.message}
                </Typography>
              </Stack>
            </Tooltip>
          )}

          {site.lastError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {site.lastError}
            </Alert>
          )}

          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onDeploy?.(site);
              }}
            >
              Deploy
            </Button>
            <Button
              size="small"
              onClick={(event) => {
                event.stopPropagation();
                onToggle?.(site);
              }}
            >
              {site.enabled ? "Disable" : "Enable"}
            </Button>
          </Stack>
        </CardContent>
      </CardActionArea>
    </StyledCard>
  );
};

export default SiteCard;
