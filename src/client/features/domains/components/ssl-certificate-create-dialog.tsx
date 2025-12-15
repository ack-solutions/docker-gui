"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  TextField,
  Alert,
  Box,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import InfoIcon from "@mui/icons-material/Info";

interface SslCertificateCreateDialogProps {
  open: boolean;
  domainName: string;
  onClose: () => void;
  onCreate: (certificate: { commonName: string; certificate: string; privateKey: string }) => Promise<void>;
  isCreating: boolean;
}

export default function SslCertificateCreateDialog({
  open,
  domainName,
  onClose,
  onCreate,
  isCreating,
}: SslCertificateCreateDialogProps) {
  const [commonName, setCommonName] = useState(domainName);
  const [certificate, setCertificate] = useState("");
  const [privateKey, setPrivateKey] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    setError(null);

    if (!commonName.trim()) {
      setError("Common name is required");
      return;
    }
    if (!certificate.trim()) {
      setError("Certificate content is required");
      return;
    }
    if (!privateKey.trim()) {
      setError("Private key is required");
      return;
    }

    try {
      await onCreate({
        commonName: commonName.trim(),
        certificate: certificate.trim(),
        privateKey: privateKey.trim(),
      });
      // Reset form
      setCommonName(domainName);
      setCertificate("");
      setPrivateKey("");
      setError(null);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create certificate");
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setCommonName(domainName);
      setCertificate("");
      setPrivateKey("");
      setError(null);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Create SSL Certificate</Typography>
          <IconButton onClick={handleClose} size="small" disabled={isCreating}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Alert severity="info" icon={<InfoIcon />}>
            <Typography variant="body2" gutterBottom>
              <strong>Create SSL Certificate</strong>
            </Typography>
            <Typography variant="body2">
              Upload a custom SSL certificate that will be saved to the common SSL certificate library and can be used by this and other domains.
            </Typography>
          </Alert>

          <TextField
            label="Common Name (Domain)"
            fullWidth
            required
            value={commonName}
            onChange={(e) => setCommonName(e.target.value)}
            helperText="The primary domain name for this certificate"
            disabled={isCreating}
          />

          <TextField
            label="Certificate (PEM format)"
            fullWidth
            required
            multiline
            minRows={6}
            value={certificate}
            onChange={(e) => setCertificate(e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
            helperText="Paste your SSL certificate in PEM format"
            disabled={isCreating}
          />

          <TextField
            label="Private Key (PEM format)"
            fullWidth
            required
            multiline
            minRows={6}
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
            helperText="Paste your private key in PEM format"
            disabled={isCreating}
          />

          <Alert severity="warning" variant="outlined">
            <Typography variant="caption">
              <strong>Note:</strong> The certificate will be saved to the common SSL certificate library and can be reused for other domains. Make sure the certificate matches the domain name.
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={isCreating}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleCreate}
          disabled={isCreating || !commonName.trim() || !certificate.trim() || !privateKey.trim()}
        >
          {isCreating ? "Creating..." : "Create Certificate"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}




