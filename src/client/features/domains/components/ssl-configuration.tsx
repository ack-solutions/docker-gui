"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import AutorenewIcon from "@mui/icons-material/Autorenew";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import InfoIcon from "@mui/icons-material/Info";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import type { SSLCertificate } from "@/types/server";

interface SslConfigurationProps {
  domainName: string;
  enableHttps: boolean;
  sslMode: "none" | "lets-encrypt" | "custom";
  letsEncryptEmail?: string;
  certificateId?: string;
  forceHttps?: boolean;
  onEnableHttpsChange: (enabled: boolean) => void;
  onSslModeChange: (mode: "none" | "lets-encrypt" | "custom") => void;
  onLetsEncryptEmailChange: (email: string) => void;
  onCertificateIdChange: (id: string) => void;
  onForceHttpsChange?: (force: boolean) => void;
  availableCertificates?: SSLCertificate[];
}

export default function SslConfiguration({
  domainName,
  enableHttps,
  sslMode,
  letsEncryptEmail = "",
  certificateId = "",
  forceHttps = false,
  onEnableHttpsChange,
  onSslModeChange,
  onLetsEncryptEmailChange,
  onCertificateIdChange,
  onForceHttpsChange,
  availableCertificates = []
}: SslConfigurationProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction="row" alignItems="center" spacing={2}>
          {enableHttps ? (
            <LockIcon color="success" fontSize="large" />
          ) : (
            <LockOpenIcon color="disabled" fontSize="large" />
          )}
          <Box flex={1}>
            <Typography variant="subtitle1" fontWeight={600}>
              SSL/TLS Configuration
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Secure your domain with HTTPS encryption
            </Typography>
          </Box>
          <Chip
            label={enableHttps ? "HTTPS Enabled" : "HTTP Only"}
            color={enableHttps ? "success" : "default"}
            size="small"
          />
        </Stack>

        <Divider />

        {/* Enable HTTPS Toggle */}
        <FormControlLabel
          control={
            <Switch checked={enableHttps} onChange={(e) => onEnableHttpsChange(e.target.checked)} />
          }
          label={
            <Box>
              <Typography variant="body2" fontWeight={500}>
                Enable HTTPS
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Serve traffic over encrypted connection
              </Typography>
            </Box>
          }
        />

        {/* SSL Mode Selection */}
        {enableHttps && (
          <>
            <FormControl fullWidth>
              <InputLabel>Certificate Source</InputLabel>
              <Select
                value={sslMode}
                label="Certificate Source"
                onChange={(e) => onSslModeChange(e.target.value as any)}
              >
                <MenuItem value="lets-encrypt">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <AutorenewIcon fontSize="small" color="success" />
                    <Box>
                      <Typography variant="body2">Let&apos;s Encrypt</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Free, automatic SSL certificate with auto-renewal
                      </Typography>
                    </Box>
                  </Stack>
                </MenuItem>
                <MenuItem value="custom">
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <UploadFileIcon fontSize="small" color="primary" />
                    <Box>
                      <Typography variant="body2">Custom Certificate</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Use your own SSL certificate
                      </Typography>
                    </Box>
                  </Stack>
                </MenuItem>
              </Select>
            </FormControl>

            {/* Let's Encrypt Configuration */}
            {sslMode === "lets-encrypt" && (
              <Box>
                <TextField
                  label="Email Address"
                  type="email"
                  fullWidth
                  value={letsEncryptEmail}
                  onChange={(e) => onLetsEncryptEmailChange(e.target.value)}
                  placeholder="admin@example.com"
                  required
                  helperText="Required for certificate expiration notices and account recovery"
                />

                <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Automatic SSL Management</strong>
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    • Certificate will be requested from Let&apos;s Encrypt
                    <br />
                    • Automatically renewed before expiration (every 90 days)
                    <br />
                    • Domain must be publicly accessible
                    <br />
                    • DNS must resolve to this server
                  </Typography>
                </Alert>

                <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1 }}>
                  <Typography variant="caption">
                    <strong>Requirements:</strong> DNS must be configured and propagated before
                    requesting certificate. Test domain accessibility first.
                  </Typography>
                </Alert>
              </Box>
            )}

            {/* Custom Certificate */}
            {sslMode === "custom" && (
              <Box>
                <FormControl fullWidth>
                  <InputLabel>Select Certificate</InputLabel>
                  <Select
                    value={certificateId}
                    label="Select Certificate"
                    onChange={(e) => onCertificateIdChange(e.target.value)}
                  >
                    <MenuItem value="">
                      <em>Select a certificate...</em>
                    </MenuItem>
                    {availableCertificates.length === 0 ? (
                      <MenuItem value="" disabled>
                        <Typography variant="caption" color="text.secondary">
                          No uploaded certificates
                        </Typography>
                      </MenuItem>
                    ) : (
                      availableCertificates.map((cert) => (
                        <MenuItem key={cert.id} value={cert.id}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2">{cert.commonName}</Typography>
                            {cert.altNames?.length ? (
                              <Chip label={`${cert.altNames.length} SAN`} size="small" color="primary" />
                            ) : null}
                          </Stack>
                        </MenuItem>
                      ))
                    )}
                  </Select>
                </FormControl>

                <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
                  <Typography variant="body2">
                    <strong>Custom SSL Certificate</strong>
                  </Typography>
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    • Upload certificates in the SSL/Certificates page
                    <br />
                    • Certificate must match this domain name
                    <br />
                    • You&apos;re responsible for renewal
                    <br />• Format: PEM (certificate + private key)
                  </Typography>
                </Alert>

                <Button
                  variant="outlined"
                  startIcon={<UploadFileIcon />}
                  size="small"
                  sx={{ mt: 2 }}
                >
                  Upload New Certificate
                </Button>
              </Box>
            )}

            {/* Force HTTPS */}
            {enableHttps && sslMode !== "none" && onForceHttpsChange && (
              <FormControlLabel
                control={
                  <Switch
                    checked={forceHttps}
                    onChange={(e) => onForceHttpsChange(e.target.checked)}
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" fontWeight={500}>
                      Force HTTPS Redirect
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Automatically redirect all HTTP requests to HTTPS
                    </Typography>
                  </Box>
                }
              />
            )}

            {/* SSL Status Display */}
            {enableHttps && (
              <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
                <Stack spacing={1.5}>
                  <Typography variant="caption" fontWeight={600} color="text.secondary">
                    SSL Configuration Summary:
                  </Typography>

                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
                      Protocol:
                    </Typography>
                    <Chip label="HTTPS" size="small" color="success" icon={<LockIcon />} />
                  </Stack>

                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
                      Certificate:
                    </Typography>
                    <Typography variant="caption" fontFamily="monospace">
                      {sslMode === "lets-encrypt" && "Let's Encrypt (Auto-renewed)"}
                      {sslMode === "custom" && `Custom (ID: ${certificateId || "Not selected"})`}
                      {sslMode === "none" && "None"}
                    </Typography>
                  </Stack>

                  {sslMode === "lets-encrypt" && letsEncryptEmail && (
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
                        Contact Email:
                      </Typography>
                      <Typography variant="caption" fontFamily="monospace">
                        {letsEncryptEmail}
                      </Typography>
                    </Stack>
                  )}

                  <Stack direction="row" spacing={2} alignItems="center">
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
                      HTTP Redirect:
                    </Typography>
                    <Chip
                      label={forceHttps ? "Enabled" : "Disabled"}
                      size="small"
                      color={forceHttps ? "success" : "default"}
                    />
                  </Stack>
                </Stack>
              </Paper>
            )}
          </>
        )}
      </Stack>
    </Paper>
  );
}
