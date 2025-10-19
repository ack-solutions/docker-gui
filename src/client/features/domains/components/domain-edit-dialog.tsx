"use client";

import { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  FormControlLabel,
  Switch,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DnsIcon from "@mui/icons-material/Dns";
import SettingsIcon from "@mui/icons-material/Settings";
import SecurityIcon from "@mui/icons-material/Security";
import type { Domain, DomainUpsertInput } from "@/types/server";
import DnsRecordsManager from "./dns-records-manager";

interface DomainEditDialogProps {
  open: boolean;
  domain: Domain;
  onClose: () => void;
  onSubmit: (data: DomainUpsertInput) => Promise<void>;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box role="tabpanel" hidden={value !== index} sx={{ pt: 2 }}>
      {value === index && children}
    </Box>
  );
}

export default function DomainEditDialog({
  open,
  domain,
  onClose,
  onSubmit,
}: DomainEditDialogProps) {
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"active" | "pending" | "error">("pending");
  const [notes, setNotes] = useState("");
  const [dnsRecords, setDnsRecords] = useState<any[]>([]);
  const [enableHttps, setEnableHttps] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (open && domain) {
      setName(domain.name);
      setStatus(domain.status);
      setNotes(domain.notes || "");
      setDnsRecords(domain.records || []);
      setEnableHttps(domain.target?.enableHttps || false);
      setEmail(domain.target?.letsEncryptEmail || "");
      setTab(0);
      setError(null);
    }
  }, [open, domain]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const payload: DomainUpsertInput = {
        name: name.trim(),
        status,
        notes: notes.trim() || undefined,
        records: dnsRecords.map(r => ({
          id: r.id,
          type: r.type,
          host: r.host,
          value: r.value,
          ttl: r.ttl,
          priority: r.priority,
        })),
        target: domain.target ? {
          ...domain.target,
          enableHttps,
          letsEncryptEmail: enableHttps ? email.trim() : undefined,
        } : undefined,
      };

      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update domain");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ pb: 0 }}>
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <EditIcon color="primary" fontSize="small" />
            <Box>
              <Typography variant="h6" fontSize="1rem">
                Edit Domain
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {domain.name}
              </Typography>
            </Box>
          </Stack>
          <Tabs 
            value={tab} 
            onChange={(_, v) => setTab(v)}
            sx={{ 
              minHeight: 40,
              '& .MuiTab-root': {
                minHeight: 40,
                py: 1,
              }
            }}
          >
            <Tab icon={<SettingsIcon fontSize="small" />} label="General" iconPosition="start" />
            <Tab icon={<DnsIcon fontSize="small" />} label="DNS" iconPosition="start" />
            <Tab icon={<SecurityIcon fontSize="small" />} label="SSL" iconPosition="start" />
          </Tabs>
        </Stack>
      </DialogTitle>

      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <TabPanel value={tab} index={0}>
          <Stack spacing={3}>
            <TextField
              label="Domain Name"
              fullWidth
              value={name}
              disabled
              helperText="Domain name cannot be changed"
            />

            <TextField
              label="Status"
              select
              fullWidth
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              SelectProps={{ native: true }}
            >
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="error">Error</option>
            </TextField>

            <TextField
              label="Notes"
              multiline
              rows={4}
              fullWidth
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this domain..."
            />

            {domain.mode && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  DNS Mode
                </Typography>
                <Typography variant="body2">
                  {domain.mode === "managed" && "Managed on this platform"}
                  {domain.mode === "pointer-only" && "Pointer only (proxy here)"}
                  {domain.mode === "external-dns" && "External DNS (tracking only)"}
                </Typography>
              </Box>
            )}

            {domain.target && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Routing Target
                </Typography>
                <Typography variant="body2">
                  {domain.target.type === "container" && `Container: ${domain.target.containerId?.substring(0, 12)}:${domain.target.containerPort}`}
                  {domain.target.type === "external" && `External: ${domain.target.externalUrl}`}
                  {domain.target.type === "service" && `Service: ${domain.target.serviceHost}`}
                  {domain.target.type === "none" && "No routing configured"}
                </Typography>
              </Box>
            )}
          </Stack>
        </TabPanel>

        <TabPanel value={tab} index={1}>
          <Stack spacing={2}>
            <Alert severity="info">
              Manage DNS records for {domain.name}. Changes will take effect after saving.
            </Alert>
            <DnsRecordsManager
              records={dnsRecords}
              onChange={setDnsRecords}
              domainName={domain.name}
            />
          </Stack>
        </TabPanel>

        <TabPanel value={tab} index={2}>
          <Stack spacing={3}>
            <Alert severity="info">
              Configure SSL/HTTPS settings for {domain.name}
            </Alert>

            <FormControlLabel
              control={
                <Switch
                  checked={enableHttps}
                  onChange={(e) => setEnableHttps(e.target.checked)}
                />
              }
              label={
                <Box>
                  <Typography variant="body2" fontWeight={500}>
                    Enable HTTPS
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Free SSL certificate from Let&apos;s Encrypt
                  </Typography>
                </Box>
              }
            />

            {enableHttps && (
              <TextField
                label="Email for SSL Certificate"
                type="email"
                placeholder="admin@example.com"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                helperText="Required for Let's Encrypt certificate notifications"
              />
            )}

            {domain.target?.enableHttps && (
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Current SSL Status
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
                  <Chip
                    label={domain.target.sslMode === "lets-encrypt" ? "Let's Encrypt" : domain.target.sslMode}
                    size="small"
                    color="primary"
                  />
                  {domain.target.forceHttps && (
                    <Chip label="Force HTTPS" size="small" />
                  )}
                </Stack>
              </Box>
            )}

            <Alert severity="warning">
              After updating SSL settings, remember to redeploy the domain for changes to take effect.
            </Alert>
          </Stack>
        </TabPanel>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          {loading ? "Saving..." : "Save Changes"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

