"use client";

import {
  Box,
  Stack,
  Typography,
  IconButton,
  Chip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import LockIcon from "@mui/icons-material/Lock";
import { useSslCertificates } from "@/features/ssl/hooks/use-ssl-certificates";
import type { Domain as DomainModel } from "@/types/server";

interface SslSectionEditorProps {
  domain: DomainModel;
  onEdit: () => void;
}

export default function SslSectionEditor({
  domain,
  onEdit,
}: SslSectionEditorProps) {
  const { data: certificates = [] } = useSslCertificates();
  const usedCertificate = domain.target?.sslCertificateId
    ? certificates.find((cert) => cert.id === domain.target.sslCertificateId)
    : null;

  const getSslDisplay = () => {
    if (!domain.target?.enableHttps) {
      return { status: "Disabled", mode: null, details: [] };
    }
    const mode = domain.target.sslMode === "lets-encrypt" ? "Let's Encrypt" : domain.target.sslMode === "custom" ? "Custom Certificate" : "None";
    const details: Array<{ label: string; value: string }> = [];
    if (domain.target.sslMode === "lets-encrypt" && domain.target.letsEncryptEmail) {
      details.push({ label: "Email", value: domain.target.letsEncryptEmail });
    }
    if (domain.target.sslMode === "custom" && usedCertificate) {
      details.push({ label: "Certificate", value: usedCertificate.commonName });
    }
    if (domain.target.forceHttps) {
      details.push({ label: "Force HTTPS", value: "Enabled" });
    }
    return { status: "Enabled", mode, details };
  };

  const sslInfo = getSslDisplay();

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          SSL/TLS Configuration
        </Typography>
        <IconButton onClick={onEdit} size="small" color="primary">
          <EditIcon />
        </IconButton>
      </Stack>

      <Stack spacing={2}>
        <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <LockIcon color={domain.target?.enableHttps ? "success" : "disabled"} />
              <Typography variant="body1" fontWeight={600}>
                HTTPS {sslInfo.status}
              </Typography>
            </Stack>
            {sslInfo.mode && (
              <Typography variant="body2" color="text.secondary">
                Mode: {sslInfo.mode}
              </Typography>
            )}
            {usedCertificate && (
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" color="text.secondary">
                  Certificate:
                </Typography>
                <Chip
                  label={usedCertificate.commonName}
                  size="small"
                  color={usedCertificate.status === "valid" ? "success" : usedCertificate.status === "expiring" ? "warning" : "error"}
                />
              </Stack>
            )}
            {sslInfo.details.length > 0 && (
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {sslInfo.details.map((detail, idx) => (
                  <Stack key={idx} direction="row" spacing={1}>
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                      {detail.label}:
                    </Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {detail.value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

