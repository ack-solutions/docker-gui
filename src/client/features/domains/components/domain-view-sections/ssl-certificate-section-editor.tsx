"use client";

import {
  Box,
  Stack,
  Typography,
  Button,
  Chip,
  Paper,
  Link,
  IconButton,
} from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import LockIcon from "@mui/icons-material/Lock";
import { useSslCertificates } from "@/features/ssl/hooks/use-ssl-certificates";
import type { Domain as DomainModel } from "@/types/server";
import moment from "moment";

interface SslCertificateSectionEditorProps {
  domain: DomainModel;
  onEditSsl?: () => void;
}

export default function SslCertificateSectionEditor({
  domain,
  onEditSsl,
}: SslCertificateSectionEditorProps) {
  const { data: certificates = [] } = useSslCertificates();

  // Find certificate used by this domain
  const usedCertificate = domain.target?.sslCertificateId
    ? certificates.find((cert) => cert.id === domain.target.sslCertificateId)
    : null;

  // Find certificates associated with this domain
  const associatedCertificates = certificates.filter(
    (cert) =>
      cert.commonName === domain.name ||
      cert.altNames.includes(domain.name) ||
      cert.associatedDomains.includes(domain.name)
  );

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "valid":
        return { icon: <CheckCircleIcon />, color: "success" as const };
      case "expiring":
        return { icon: <WarningIcon />, color: "warning" as const };
      case "expired":
        return { icon: <ErrorIcon />, color: "error" as const };
      default:
        return { icon: null, color: "default" as const };
    }
  };

  if (!domain.target?.enableHttps) {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight={600}>
            SSL Certificate
          </Typography>
          <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderStyle: "dashed" }}>
            <Typography variant="body2" color="text.secondary">
              HTTPS is not enabled for this domain.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
              Enable HTTPS in SSL/TLS configuration to use SSL certificates.
            </Typography>
          </Paper>
        </Stack>
      </Box>
    );
  }

  if (domain.target.sslMode === "lets-encrypt") {
    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={600}>
              SSL Certificate
            </Typography>
            <Stack direction="row" spacing={1}>
              {onEditSsl && (
                <IconButton onClick={onEditSsl} size="small" color="primary">
                  <EditIcon />
                </IconButton>
              )}
              <Button
                size="small"
                variant="outlined"
                endIcon={<OpenInNewIcon />}
                href="/ssl"
                target="_blank"
              >
                Manage Certificates
              </Button>
            </Stack>
          </Stack>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                <LockIcon color="success" />
                <Typography variant="body1" fontWeight={600}>
                  Let's Encrypt Certificate
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Automatically managed by Let's Encrypt
              </Typography>
              {domain.target.letsEncryptEmail && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Email
                  </Typography>
                  <Typography variant="body2">{domain.target.letsEncryptEmail}</Typography>
                </Box>
              )}
            </Stack>
          </Paper>

          {associatedCertificates.length > 0 && (
            <Box>
              <Typography variant="body2" fontWeight={500} gutterBottom>
                Related Certificates
              </Typography>
              <Stack spacing={1}>
                {associatedCertificates.map((cert) => {
                  const status = getStatusConfig(cert.status);
                  return (
                    <Paper key={cert.id} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Stack direction="row" spacing={1} alignItems="center" flex={1}>
                          {status.icon}
                          <Box flex={1}>
                            <Typography variant="body2" fontWeight={500}>
                              {cert.commonName}
                            </Typography>
                            {cert.altNames.length > 0 && (
                              <Typography variant="caption" color="text.secondary">
                                +{cert.altNames.length} SAN
                              </Typography>
                            )}
                          </Box>
                        </Stack>
                        <Chip
                          label={cert.status}
                          size="small"
                          color={status.color}
                        />
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>
          )}
        </Stack>
      </Box>
    );
  }

  if (domain.target.sslMode === "custom" && usedCertificate) {
    const status = getStatusConfig(usedCertificate.status);
    const expiresAt = moment(usedCertificate.expiresAt);
    const isExpiring = expiresAt.diff(moment(), "days") < 30;

    return (
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6" fontWeight={600}>
              SSL Certificate
            </Typography>
            <Stack direction="row" spacing={1}>
              {onEditSsl && (
                <IconButton onClick={onEditSsl} size="small" color="primary">
                  <EditIcon />
                </IconButton>
              )}
              <Button
                size="small"
                variant="outlined"
                endIcon={<OpenInNewIcon />}
                href="/ssl"
                target="_blank"
              >
                Manage Certificates
              </Button>
            </Stack>
          </Stack>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center">
                {status.icon}
                <Typography variant="body1" fontWeight={600} color={`${status.color}.main`}>
                  {usedCertificate.commonName}
                </Typography>
                <Chip
                  label={usedCertificate.status}
                  size="small"
                  color={status.color}
                />
              </Stack>

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Issuer
                </Typography>
                <Typography variant="body2">{usedCertificate.issuer}</Typography>
              </Box>

              {usedCertificate.altNames.length > 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Subject Alternative Names
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {usedCertificate.altNames.map((name) => (
                      <Chip key={name} label={name} size="small" variant="outlined" />
                    ))}
                  </Stack>
                </Box>
              )}

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Expires
                </Typography>
                <Typography variant="body2" color={isExpiring ? "warning.main" : "text.primary"}>
                  {expiresAt.format("MMMM D, YYYY")} ({expiresAt.fromNow()})
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Type
                </Typography>
                <Typography variant="body2">
                  {usedCertificate.type === "lets-encrypt" ? "Let's Encrypt" : "Custom"}
                </Typography>
              </Box>

              {usedCertificate.autoRenew && (
                <Chip label="Auto Renew Enabled" size="small" color="info" />
              )}
            </Stack>
          </Paper>
        </Stack>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6" fontWeight={600}>
            SSL Certificate
          </Typography>
          <Button
            size="small"
            variant="outlined"
            endIcon={<OpenInNewIcon />}
            href="/ssl"
            target="_blank"
          >
            Manage Certificates
          </Button>
        </Stack>

        <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderStyle: "dashed" }}>
          <Typography variant="body2" color="text.secondary">
            {domain.target.sslMode === "custom"
              ? "No custom certificate selected."
              : "No SSL certificate information available."}
          </Typography>
        </Paper>
      </Stack>
    </Box>
  );
}

