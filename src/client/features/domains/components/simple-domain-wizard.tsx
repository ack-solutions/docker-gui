"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Step,
  StepLabel,
  Stepper,
  TextField,
  Typography,
  Alert,
  Paper,
  Switch,
  Collapse,
} from "@mui/material";
import LanguageIcon from "@mui/icons-material/Language";
import InfoIcon from "@mui/icons-material/Info";
import type { DockerContainer } from "@/types/docker";
import type { DomainMode, DomainUpsertInput } from "@/types/server";

interface SimpleDomainWizardProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (domain: DomainUpsertInput) => Promise<void>;
  containers?: DockerContainer[];
}

export default function SimpleDomainWizard({
  open,
  onClose,
  onSubmit,
  containers = [],
}: SimpleDomainWizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form data
  const [domainName, setDomainName] = useState("");
  const [targetType, setTargetType] = useState<"none" | "container" | "external">("none");
  const [selectedContainer, setSelectedContainer] = useState("");
  const [containerPort, setContainerPort] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [enableHttps, setEnableHttps] = useState(true);
  const [email, setEmail] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [dnsRecordValue, setDnsRecordValue] = useState("");

  const steps = ["Domain Name", "What to Show", "Security & DNS"];

  const resetForm = () => {
    setActiveStep(0);
    setDomainName("");
    setTargetType("none");
    setSelectedContainer("");
    setContainerPort("");
    setExternalUrl("");
    setEnableHttps(true);
    setEmail("");
    setShowAdvanced(false);
    setDnsRecordValue("");
    setError(null);
  };

  const handleNext = () => {
    if (validateStep()) {
      setActiveStep((prev) => prev + 1);
      setError(null);
    }
  };

  const handleBack = () => {
    setActiveStep((prev) => prev - 1);
    setError(null);
  };

  const validateStep = () => {
    switch (activeStep) {
      case 0: // Domain name
        if (!domainName.trim()) {
          setError("Please enter a domain name");
          return false;
        }
        if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domainName)) {
          setError("Please enter a valid domain (e.g., example.com)");
          return false;
        }
        return true;

      case 1: // Target
        if (targetType === "container") {
          if (!selectedContainer) {
            setError("Please select a container");
            return false;
          }
          if (!containerPort) {
            setError("Please enter a container port");
            return false;
          }
        } else if (targetType === "external") {
          if (!externalUrl) {
            setError("Please enter an external URL");
            return false;
          }
          if (!/^https?:\/\/.+/.test(externalUrl)) {
            setError("URL must start with http:// or https://");
            return false;
          }
        }
        return true;

      case 2: // Security
        // Email is optional - can be added later
        if (enableHttps && email.trim() && !email.includes("@")) {
          setError("Please enter a valid email address");
          return false;
        }
        if (showAdvanced && !dnsRecordValue.trim()) {
          setError("Please enter your server IP address");
          return false;
        }
        return true;

      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    if (!validateStep()) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build the payload
      const payload: DomainUpsertInput = {
        name: domainName.toLowerCase().trim(),
        mode: "pointer-only" as DomainMode, // Simplified mode
        status: "pending",
      };

      // Add DNS record if provided
      if (showAdvanced && dnsRecordValue.trim()) {
        payload.records = [
          {
            type: "A",
            host: "@",
            value: dnsRecordValue.trim(),
            ttl: 300,
          },
        ];
      }

      // Add target configuration
      if (targetType === "none") {
        payload.target = {
          type: "none",
          enableHttp: !enableHttps,
          enableHttps: enableHttps,
          forceHttps: enableHttps,
          sslMode: enableHttps ? "lets-encrypt" : "none",
          letsEncryptEmail: enableHttps ? email.trim() : undefined,
        };
      } else if (targetType === "container") {
        payload.target = {
          type: "container",
          containerId: selectedContainer,
          containerPort: parseInt(containerPort),
          enableHttp: true,
          enableHttps: enableHttps,
          forceHttps: enableHttps,
          sslMode: enableHttps ? "lets-encrypt" : "none",
          letsEncryptEmail: enableHttps ? email.trim() : undefined,
        };
      } else if (targetType === "external") {
        payload.target = {
          type: "external",
          externalUrl: externalUrl.trim(),
          enableHttp: true,
          enableHttps: enableHttps,
          forceHttps: enableHttps,
          sslMode: enableHttps ? "lets-encrypt" : "none",
          letsEncryptEmail: enableHttps ? email.trim() : undefined,
        };
      }

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
        <Box sx={{ mt: 2 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {/* Step 0: Domain Name */}
          {activeStep === 0 && (
            <Stack spacing={3}>
              <Alert severity="info" icon={<InfoIcon />}>
                  Enter your domain name. Make sure it&apos;s pointing to this server&apos;s IP.
              </Alert>

              <TextField
                label="Domain Name"
                placeholder="myapp.com"
                fullWidth
                value={domainName}
                onChange={(e) => setDomainName(e.target.value.toLowerCase())}
                helperText="Example: myapp.com or api.myapp.com"
                autoFocus
              />

              <Paper sx={{ p: 2, bgcolor: "primary.50" }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Tip:</strong> Update your domain&apos;s DNS settings at your registrar to point to this server before continuing.
                </Typography>
              </Paper>
            </Stack>
          )}

          {/* Step 1: Target */}
          {activeStep === 1 && (
            <Stack spacing={3}>
              <Alert severity="info" icon={<InfoIcon />}>
                What should visitors see when they go to your domain?
              </Alert>

              <FormControl>
                <RadioGroup
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as any)}
                >
                  <FormControlLabel
                    value="none"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          Nothing Yet (DNS Only)
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Just setup the domain, I&apos;ll configure it later
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="container"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          A Docker Container
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Show a web app running in a container
                        </Typography>
                      </Box>
                    }
                  />
                  <FormControlLabel
                    value="external"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="body1" fontWeight={500}>
                          Another Website
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Forward traffic to an external URL
                        </Typography>
                      </Box>
                    }
                  />
                </RadioGroup>
              </FormControl>

              {targetType === "container" && (
                <Stack spacing={2} sx={{ mt: 2 }}>
                  <FormControl fullWidth>
                    <InputLabel>Container</InputLabel>
                    <Select
                      value={selectedContainer}
                      label="Container"
                      onChange={(e) => setSelectedContainer(e.target.value)}
                    >
                      {containers.map((container) => (
                        <MenuItem key={container.id} value={container.id}>
                          {container.name} - {container.image}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    label="Port Number"
                    type="number"
                    placeholder="3000"
                    fullWidth
                    value={containerPort}
                    onChange={(e) => setContainerPort(e.target.value)}
                    helperText="Which port is your app listening on? (e.g., 3000, 8080)"
                  />
                </Stack>
              )}

              {targetType === "external" && (
                <TextField
                  label="External URL"
                  placeholder="https://example.com"
                  fullWidth
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  helperText="The full URL to forward traffic to"
                />
              )}
            </Stack>
          )}

          {/* Step 2: Security & DNS */}
          {activeStep === 2 && (
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  HTTPS (Recommended)
                </Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={enableHttps}
                      onChange={(e) => setEnableHttps(e.target.checked)}
                    />
                  }
                  label="Enable HTTPS with free SSL certificate"
                />
              </Box>

              <Collapse in={enableHttps}>
                <Stack spacing={1}>
                  <TextField
                    label="Your Email (Optional)"
                    type="email"
                    placeholder="admin@example.com"
                    fullWidth
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    helperText="For SSL certificate notifications. Can be added later."
                  />
                  <Typography variant="caption" color="text.secondary">
                    You can enable or renew SSL after creating the domain
                  </Typography>
                </Stack>
              </Collapse>

              <Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={showAdvanced}
                      onChange={(e) => setShowAdvanced(e.target.checked)}
                    />
                  }
                  label="Add DNS Record (Advanced)"
                />
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                  Only if you want this platform to manage DNS records
                </Typography>
              </Box>

              <Collapse in={showAdvanced}>
                <TextField
                  label="Server IP Address"
                  placeholder="123.45.67.89"
                  fullWidth
                  value={dnsRecordValue}
                  onChange={(e) => setDnsRecordValue(e.target.value)}
                  helperText="The IP address of this server"
                />
              </Collapse>

              <Paper sx={{ p: 2, bgcolor: "success.lighter", border: "1px solid", borderColor: "success.main" }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                  You&apos;re all set!
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {targetType === "none"
                    ? "Your domain will be added to the system. You can configure routing later."
                    : targetType === "container"
                    ? `Your domain will route to the selected container on port ${containerPort}.`
                    : `Your domain will forward traffic to ${externalUrl}.`}
                  {enableHttps && " HTTPS will be automatically configured."}
                </Typography>
              </Paper>
            </Stack>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        {activeStep > 0 && (
          <Button onClick={handleBack} disabled={loading}>
            Back
          </Button>
        )}
        {activeStep < steps.length - 1 ? (
          <Button variant="contained" onClick={handleNext}>
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Creating..." : "Create Domain"}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

