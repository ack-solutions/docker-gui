"use client";

import CloudDoneIcon from "@mui/icons-material/CloudDone";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Button, Card, CardActionArea, CardContent, Chip, Skeleton, Stack, Typography } from "@mui/material";
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

  return (
    <StyledCard variant={active ? "outlined" : undefined}>
      <CardActionArea onClick={handleSelect}>
        <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">
              {site.serverNames.join(", ")}
            </Typography>
            <Chip
              icon={site.enabled ? <CloudDoneIcon fontSize="small" /> : <WarningAmberIcon fontSize="small" />}
              label={site.enabled ? "Enabled" : "Disabled"}
              color={site.enabled ? "success" : "default"}
              size="small"
            />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {site.upstreamType === "external" ? site.upstreamTarget : `${site.upstreamType} · ${site.upstreamTarget}`}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            {site.listen.map((listen) => (
              <Chip key={`${listen.protocol}-${listen.port}`} size="small" label={`${listen.protocol.toUpperCase()} · ${listen.port}`} />
            ))}
            {site.sslCertificateId && (
              <Chip size="small" color="primary" label="TLS" />
            )}
          </Stack>
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
