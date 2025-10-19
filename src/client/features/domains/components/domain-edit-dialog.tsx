"use client";

import { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import InfoIcon from "@mui/icons-material/Info";
import DnsModeSelector, { type DnsMode } from "./dns-mode-selector";
import DnsSetupInstructions from "./dns-setup-instructions";
import ThirdPartyDnsSetup from "./third-party-dns-setup";
import DnsRecordsManager from "./dns-records-manager";
import SslConfiguration from "./ssl-configuration";

interface Domain {
  id: string;
  name: string;
  dnsMode: DnsMode;
  status: string;
  target?: {
    type: string;
    enableHttps?: boolean;
    sslMode?: string;
    letsEncryptEmail?: string;
  };
  dnsProvider?: {
    type: string;
    credentials: any;
  };
  records?: any[];
}

interface DomainEditDialogProps {
  open: boolean;
  domain: Domain | null;
  onClose: () => void;
  onSave: (updates: Partial<Domain>) => Promise<void>;
}

export default function DomainEditDialog({
  open,
  domain,
  onClose,
  onSave,
}: DomainEditDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [dnsMode, setDnsMode] = useState<DnsMode>("proxy-only");
  const [dnsModeChanged, setDnsModeChanged] = useState(false);
  const [thirdPartyConfig, setThirdPartyConfig] = useState<any>({ provider: "none" });
  const [dnsRecords, setDnsRecords] = useState<any[]>([]);
  
  // SSL state
  const [enableHttps, setEnableHttps] = useState(false);
  const [sslMode, setSslMode] = useState<"none" | "lets-encrypt" | "custom">("none");
  const [letsEncryptEmail, setLetsEncryptEmail] = useState("");
  const [customCertId, setCustomCertId] = useState("");
  const [forceHttps, setForceHttps] = useState(false);

  // Initialize form when domain changes
  useEffect(() => {
    if (domain) {
      setDnsMode(domain.dnsMode || "proxy-only");
      setDnsModeChanged(false);
      setDnsRecords(domain.records || []);
      setThirdPartyConfig(domain.dnsProvider || { provider: "none" });
      
      // SSL settings
      setEnableHttps(domain.target?.enableHttps || false);
      setSslMode((domain.target?.sslMode as any) || "none");
      setLetsEncryptEmail(domain.target?.letsEncryptEmail || "");
      setCustomCertId("");
      setForceHttps(false); // TODO: Get from domain
    }
  }, [domain]);

  const handleDnsModeChange = (newMode: DnsMode) => {
    setDnsMode(newMode);
    setDnsModeChanged(newMode !== domain?.dnsMode);
  };

  const handleSave = async () => {
    if (!domain) return;

    try {
      setLoading(true);
      setError(null);

      const updates: any = {};

      // DNS mode changed
      if (dnsModeChanged) {
        updates.dnsMode = dnsMode;
        
        if (dnsMode === "managed") {
          updates.records = dnsRecords;
        } else if (dnsMode === "third-party") {
          updates.dnsProvider = thirdPartyConfig;
        }
      }

      // SSL settings
      updates.target = {
        ...domain.target,
        enableHttps,
        sslMode: enableHttps ? sslMode : "none",
        letsEncryptEmail: sslMode === "lets-encrypt" ? letsEncryptEmail : undefined,
        sslCertificateId: sslMode === "custom" ? customCertId : undefined,
      };

      await onSave(updates);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update domain");
    } finally {
      setLoading(false);
    }
  };

  if (!domain) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: "60vh" },
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Edit Domain: {domain.name}</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={4}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* DNS Management Mode */}
          <Box>
            <Typography variant="subtitle1" fontWeight={600} gutterBottom>
              DNS Management
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Choose how you want to manage DNS for this domain
            </Typography>

            <DnsModeSelector selected={dnsMode} onChange={handleDnsModeChange} />

            {dnsModeChanged && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>DNS mode changed!</strong> Make sure to update your DNS configuration
                  accordingly.
                </Typography>
              </Alert>
            )}

            {/* Show instructions when DNS mode changes */}
            {dnsModeChanged && (dnsMode === "managed" || dnsMode === "proxy-only") && (
              <Box sx={{ mt: 2 }}>
                <DnsSetupInstructions dnsMode={dnsMode} domainName={domain.name} />
              </Box>
            )}

            {/* Third-party provider setup */}
            {dnsMode === "third-party" && (
              <Box sx={{ mt: 2 }}>
                <ThirdPartyDnsSetup config={thirdPartyConfig} onChange={setThirdPartyConfig} />
              </Box>
            )}

            {/* DNS Records manager */}
            {dnsMode === "managed" && (
              <Box sx={{ mt: 2 }}>
                <DnsRecordsManager
                  records={dnsRecords}
                  onChange={setDnsRecords}
                  domainName={domain.name}
                />
              </Box>
            )}
          </Box>

          <Divider />

          {/* SSL/TLS Configuration */}
          <SslConfiguration
            domainName={domain.name}
            enableHttps={enableHttps}
            sslMode={sslMode}
            letsEncryptEmail={letsEncryptEmail}
            certificateId={customCertId}
            forceHttps={forceHttps}
            onEnableHttpsChange={setEnableHttps}
            onSslModeChange={setSslMode}
            onLetsEncryptEmailChange={setLetsEncryptEmail}
            onCertificateIdChange={setCustomCertId}
            onForceHttpsChange={setForceHttps}
          />

          {/* Current Configuration Summary */}
          <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
            <Typography variant="subtitle2" fontWeight={600} gutterBottom>
              Current Configuration
            </Typography>
            <Stack spacing={1}>
              <Stack direction="row" spacing={2}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  Domain:
                </Typography>
                <Typography variant="caption" fontFamily="monospace">
                  {domain.name}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  DNS Mode:
                </Typography>
                <Typography variant="caption" fontFamily="monospace">
                  {dnsMode}
                  {dnsModeChanged && (
                    <Typography component="span" variant="caption" color="warning.main">
                      {" "}
                      (changed)
                    </Typography>
                  )}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  HTTPS:
                </Typography>
                <Typography variant="caption" fontFamily="monospace">
                  {enableHttps ? `Enabled (${sslMode})` : "Disabled"}
                </Typography>
              </Stack>
              <Stack direction="row" spacing={2}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 120 }}>
                  Status:
                </Typography>
                <Typography variant="caption" fontFamily="monospace">
                  {domain.status}
                </Typography>
              </Stack>
            </Stack>
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={loading}
          startIcon={loading ? null : <SaveIcon />}
        >
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
