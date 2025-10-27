"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputLabel,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  Alert
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SettingsEthernetIcon from "@mui/icons-material/SettingsEthernet";
import InfoIcon from "@mui/icons-material/Info";
import LockIcon from "@mui/icons-material/Lock";
import LockOpenIcon from "@mui/icons-material/LockOpen";
import type { DockerContainer } from "@/types/docker";

interface NginxWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (config: NginxFormData) => Promise<void>;
  containers?: DockerContainer[];
}

export interface NginxFormData {
  domain: string;
  sourceType: "container" | "url";
  containerId?: string;
  containerPort?: number;
  targetUrl?: string;
  enableSSL: boolean;
  email?: string;
}

export default function NginxWizard({ open, onClose, onSubmit, containers = [] }: NginxWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [formData, setFormData] = useState<NginxFormData>({
    domain: "",
    sourceType: "container",
    enableSSL: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps = ["Domain", "Source", "SSL", "Review"];

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => setActiveStep((prev) => prev - 1);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      await onSubmit(formData);
      onClose();
      setActiveStep(0);
      setFormData({
        domain: "",
        sourceType: "container",
        enableSSL: true,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create configuration");
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = () => {
    switch (activeStep) {
      case 0:
        return formData.domain.length > 0;
      case 1:
        if (formData.sourceType === "container") {
          return formData.containerId && formData.containerPort;
        }
        return formData.targetUrl && formData.targetUrl.length > 0;
      case 2:
        if (formData.enableSSL) {
          return formData.email && formData.email.includes("@");
        }
        return true;
      default:
        return true;
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1}>
          <SettingsEthernetIcon />
          <Typography variant="h6">Setup Reverse Proxy</Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 2 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          {/* Step 0: Domain */}
          {activeStep === 0 && (
            <Stack spacing={3}>
              <Alert severity="info" icon={<InfoIcon />}>
                Enter the domain name you want to use (e.g., myapp.com, api.example.com)
              </Alert>
              <TextField
                label="Domain Name"
                placeholder="example.com"
                fullWidth
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value.toLowerCase() })}
                helperText="Your domain should already be pointing to this server"
                autoFocus
              />
            </Stack>
          )}

          {/* Step 1: Source */}
          {activeStep === 1 && (
            <Stack spacing={3}>
              <Alert severity="info" icon={<InfoIcon />}>
                Choose what you want to show on this domain
              </Alert>

              <FormControl>
                <FormLabel>Traffic Source</FormLabel>
                <RadioGroup
                  value={formData.sourceType}
                  onChange={(e) => setFormData({ ...formData, sourceType: e.target.value as any })}
                >
                  <FormControlLabel
                    value="container"
                    control={<Radio />}
                    label="Docker Container (Recommended)"
                  />
                  <FormControlLabel value="url" control={<Radio />} label="External URL" />
                </RadioGroup>
              </FormControl>

              {formData.sourceType === "container" && (
                <Stack spacing={2}>
                  <FormControl fullWidth>
                    <InputLabel>Container</InputLabel>
                    <Select
                      value={formData.containerId || ""}
                      label="Container"
                      onChange={(e) => setFormData({ ...formData, containerId: e.target.value })}
                    >
                      {containers.filter(c => c.state === "running").map((container) => (
                        <MenuItem key={container.id} value={container.id}>
                          {container.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Port"
                    type="number"
                    fullWidth
                    value={formData.containerPort || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, containerPort: parseInt(e.target.value) })
                    }
                    helperText="Port number inside the container (e.g., 3000, 8080)"
                  />
                </Stack>
              )}

              {formData.sourceType === "url" && (
                <TextField
                  label="Target URL"
                  placeholder="https://example.com"
                  fullWidth
                  value={formData.targetUrl || ""}
                  onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                  helperText="Full URL including http:// or https://"
                />
              )}
            </Stack>
          )}

          {/* Step 2: SSL */}
          {activeStep === 2 && (
            <Stack spacing={3}>
              <Alert severity="info" icon={<InfoIcon />}>
                We can automatically get a free SSL certificate for you
              </Alert>

              <FormControl>
                <FormLabel>Enable HTTPS?</FormLabel>
                <RadioGroup
                  value={formData.enableSSL ? "yes" : "no"}
                  onChange={(e) => setFormData({ ...formData, enableSSL: e.target.value === "yes" })}
                >
                  <FormControlLabel
                    value="yes"
                    control={<Radio />}
                    label="Yes (Recommended) - Free SSL from Let's Encrypt"
                  />
                  <FormControlLabel value="no" control={<Radio />} label="No - HTTP only" />
                </RadioGroup>
              </FormControl>

              {formData.enableSSL && (
                <TextField
                  label="Email"
                  type="email"
                  placeholder="admin@example.com"
                  fullWidth
                  value={formData.email || ""}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  helperText="For certificate expiry notifications"
                />
              )}
            </Stack>
          )}

          {/* Step 3: Review */}
          {activeStep === 3 && (
            <Stack spacing={3}>
              <Alert severity="success" icon={<CheckCircleIcon />}>
                Everything looks good! Click &quot;Create&quot; to set it up.
              </Alert>

              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">DOMAIN</Typography>
                      <Typography variant="h6">{formData.domain}</Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="caption" color="text.secondary">ROUTES TO</Typography>
                      <Typography>
                        {formData.sourceType === "container" && formData.containerId
                          ? `Container: ${containers.find(c => c.id === formData.containerId)?.name} (port ${formData.containerPort})`
                          : formData.targetUrl}
                      </Typography>
                    </Box>
                    <Divider />
                    <Box>
                      <Typography variant="caption" color="text.secondary">SECURITY</Typography>
                      <Chip
                        label={formData.enableSSL ? "HTTPS Enabled" : "HTTP Only"}
                        color={formData.enableSSL ? "success" : "warning"}
                        size="small"
                        icon={formData.enableSSL ? <LockIcon /> : <LockOpenIcon />}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>Back</Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button variant="contained" onClick={handleNext} disabled={!isStepValid()}>
            Next
          </Button>
        ) : (
          <Button variant="contained" onClick={handleSubmit} disabled={!isStepValid() || loading}>
            {loading ? "Creating..." : "Create"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

