"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
  Alert,
  Chip,
} from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import InfoIcon from "@mui/icons-material/Info";
import type { DomainUpsertInput } from "@/types/server";

interface SimpleDomainWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (domain: DomainUpsertInput) => Promise<void>;
}

export default function SimpleDomainWizard({
  open,
  onClose,
  onSubmit,
}: SimpleDomainWizardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [domainName, setDomainName] = useState("");
  const [aliasInput, setAliasInput] = useState("");
  const [aliases, setAliases] = useState<string[]>([]);

  const resetForm = () => {
    setDomainName("");
    setAliasInput("");
    setAliases([]);
    setError(null);
  };

  const handleAddAlias = () => {
    const trimmed = aliasInput.trim().toLowerCase();
    if (trimmed && !aliases.includes(trimmed) && trimmed !== domainName.toLowerCase()) {
      if (/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(trimmed)) {
        setAliases([...aliases, trimmed]);
        setAliasInput("");
      } else {
        setError("Please enter a valid domain name for alias");
      }
    }
  };

  const handleRemoveAlias = (alias: string) => {
    setAliases(aliases.filter((a) => a !== alias));
  };

  const validateForm = () => {
    if (!domainName.trim()) {
      setError("Please enter a domain name");
      return false;
    }
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domainName)) {
      setError("Please enter a valid domain name (e.g., example.com)");
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload: DomainUpsertInput = {
        name: domainName.toLowerCase().trim(),
        aliases: aliases.length > 0 ? aliases : undefined,
        mode: "manual",
        status: "pending",
        target: {
          type: "none",
          enableHttp: true,
          enableHttps: false,
          forceHttps: false,
          sslMode: "none",
        },
        records: [],
      };

      await onSubmit(payload);
      resetForm();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create domain");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      resetForm();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <LanguageIcon color="primary" />
          <Typography variant="h6">Add New Domain</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={3} sx={{ mt: 1 }}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          <Alert severity="info" icon={<InfoIcon />}>
            Enter your domain name. You can configure DNS, SSL, and routing settings after creation.
          </Alert>

          <TextField
            label="Domain Name"
            placeholder="example.com"
            fullWidth
            required
            value={domainName}
            onChange={(e) => setDomainName(e.target.value.toLowerCase())}
            helperText="Enter your primary domain name"
            autoFocus
            disabled={loading}
          />

          <Box>
            <TextField
              label="Alias Domains (Optional)"
              placeholder="www.example.com"
              fullWidth
              value={aliasInput}
              onChange={(e) => setAliasInput(e.target.value.toLowerCase())}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddAlias();
                }
              }}
              helperText="Press Enter to add alias domains"
              disabled={loading}
            />
            {aliases.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1.5 }}>
                {aliases.map((alias) => (
                  <Chip
                    key={alias}
                    label={alias}
                    onDelete={() => handleRemoveAlias(alias)}
                    size="small"
                    disabled={loading}
                  />
                ))}
              </Stack>
            )}
          </Box>

          <Alert severity="success" variant="outlined">
            <Typography variant="body2">
              <strong>Next Steps:</strong> After creating the domain, you can configure DNS records, SSL certificates, and routing in the domain settings.
            </Typography>
          </Alert>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? "Creating..." : "Create Domain"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
