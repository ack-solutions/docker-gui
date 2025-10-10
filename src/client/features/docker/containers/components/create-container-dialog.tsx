"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Tabs,
  Tab,
  Box,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  Grid,
  Alert,
  LinearProgress
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import { toast } from "sonner";
import { pullImage } from "@/lib/api/docker";
import { useImages } from "@/features/docker/images/hooks/use-images";
import {
  useContainerActions
} from "@/features/docker/containers/context/container-provider";
import { serviceTemplates, getTemplateById } from "@/features/docker/containers/constants/service-templates";
import ServiceIcon from "@/features/docker/containers/components/service-icon";
import type {
  ContainerPortBindingInput,
  CreateContainerRequest,
  DockerRestartPolicy
} from "@/types/docker";

interface CreateContainerDialogProps {
  open: boolean;
  onClose: () => void;
  initialImage?: string;
}

const parseEnvVars = (value: string) => {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.map((line) => {
    const [key, ...rest] = line.split("=");
    return { key: key.trim(), value: rest.join("=").trim() };
  }).filter((entry) => entry.key.length > 0);
};

const parsePortMappings = (value: string) => {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const bindings: ContainerPortBindingInput[] = [];

  lines.forEach((line) => {
    const [bindingPart, protocolPart] = line.split("/");
    const protocol = protocolPart && protocolPart.toLowerCase() === "udp" ? "udp" : "tcp";

    const segments = bindingPart.split(":").map((segment) => segment.trim()).filter(Boolean);
    if (segments.length === 0 || segments.length > 3) {
      return;
    }

    let hostIp: string | undefined;
    let hostPort: number | undefined;
    let containerPort: number;

    if (segments.length === 1) {
      containerPort = Number(segments[0]);
    } else if (segments.length === 2) {
      hostPort = Number(segments[0]);
      containerPort = Number(segments[1]);
    } else {
      hostIp = segments[0];
      hostPort = Number(segments[1]);
      containerPort = Number(segments[2]);
    }

    if (!Number.isFinite(containerPort) || containerPort <= 0) {
      return;
    }

    const entry: ContainerPortBindingInput = {
      containerPort,
      protocol
    };

    if (Number.isFinite(hostPort) && (hostPort ?? 0) > 0) {
      entry.hostPort = hostPort;
    }

    if (hostIp && hostIp.length > 0) {
      entry.hostIp = hostIp;
    }

    bindings.push(entry);
  });

  return bindings;
};

const CreateContainerDialog = ({ open, onClose, initialImage }: CreateContainerDialogProps) => {
  const { data: images, refetch: refetchImages } = useImages();
  const { create } = useContainerActions();

  const [tabIndex, setTabIndex] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState("");
  const [containerName, setContainerName] = useState("");
  const [command, setCommand] = useState("");
  const [envVars, setEnvVars] = useState("");
  const [ports, setPorts] = useState("");
  const [autoStart, setAutoStart] = useState(true);
  const [restartPolicy, setRestartPolicy] = useState<DockerRestartPolicy>("no");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState<string>("");
  const [showProgress, setShowProgress] = useState(false);

  const imageOptions = useMemo(() => {
    if (!images) {
      return [] as string[];
    }

    const tags = new Set<string>();
    images.forEach((image) => {
      image.repoTags.forEach((tag) => {
        if (tag && tag !== "<none>:latest") {
          tags.add(tag);
        }
      });
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }, [images]);

  const formatEnvVarsForDisplay = (envArray: Array<{ key: string; value?: string }>) => {
    return envArray.map((e) => `${e.key}=${e.value ?? ""}`).join("\n");
  };

  const formatPortsForDisplay = (portsArray: ContainerPortBindingInput[]) => {
    return portsArray
      .map((p) => {
        const hostPart = p.hostPort ? `${p.hostPort}:` : "";
        const protocolPart = p.protocol === "udp" ? "/udp" : "";
        return `${hostPart}${p.containerPort}${protocolPart}`;
      })
      .join("\n");
  };

  const handleTemplateSelect = useCallback((templateId: string) => {
    const template = getTemplateById(templateId);
    if (!template) {
      return;
    }

    setSelectedTemplate(templateId);
    setSelectedImage(template.image);
    setEnvVars(formatEnvVarsForDisplay(template.defaultConfig.env || []));
    setPorts(formatPortsForDisplay(template.defaultConfig.ports || []));
    setAutoStart(template.defaultConfig.autoStart ?? true);
    setRestartPolicy(template.defaultConfig.restartPolicy || "no");
    setImageError(null);
  }, []);

  const handlePullImage = useCallback(async () => {
    if (!selectedImage.trim()) {
      setImageError("Please enter an image name");
      return;
    }

    setIsPulling(true);
    try {
      await toast.promise(pullImage(selectedImage.trim()), {
        loading: `Pulling ${selectedImage}...`,
        success: `Successfully pulled ${selectedImage}`,
        error: (err) => (err instanceof Error ? err.message : `Failed to pull ${selectedImage}`)
      });
      await refetchImages();
    } catch (error) {
      console.error("Failed to pull image:", error);
    } finally {
      setIsPulling(false);
    }
  }, [selectedImage, refetchImages]);

  const resetForm = useCallback(() => {
    setTabIndex(0);
    setSelectedTemplate(null);
    setSelectedImage("");
    setContainerName("");
    setCommand("");
    setEnvVars("");
    setPorts("");
    setAutoStart(true);
    setRestartPolicy("no");
    setImageError(null);
    setIsSubmitting(false);
    setIsPulling(false);
    setProgressMessage("");
    setShowProgress(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }

    if (initialImage && initialImage !== selectedImage) {
      setSelectedImage(initialImage);
      setImageError(null);
    }
  }, [open, initialImage, resetForm, selectedImage]);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async () => {
    if (!selectedImage.trim()) {
      setImageError("Container image is required");
      return;
    }

    const payload: CreateContainerRequest = {
      image: selectedImage.trim(),
      name: containerName.trim() || undefined,
      command: command.trim() || undefined,
      autoStart,
      restartPolicy,
      env: parseEnvVars(envVars),
      ports: parsePortMappings(ports)
    };

    setIsSubmitting(true);
    setShowProgress(true);

    try {
      // Step 1: Check if image exists locally, if not pull it
      const imageExists = imageOptions.includes(selectedImage.trim());
      
      if (!imageExists) {
        setProgressMessage(`Pulling image ${selectedImage}... This may take a few minutes.`);
        try {
          await pullImage(selectedImage.trim());
          await refetchImages();
          setProgressMessage("Image pulled successfully");
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (pullError) {
          console.warn("Image pull failed, will try to create anyway:", pullError);
          setProgressMessage("Image not found locally, attempting to use it anyway...");
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      // Step 2: Create container
      setProgressMessage(`Creating container${payload.name ? ` ${payload.name}` : ""}...`);
      const container = await create(payload);
      
      // Step 3: Success
      setProgressMessage("Container created successfully!");
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      toast.success(
        container?.name
          ? `Created container ${container.name}`
          : "Container created"
      );
      handleClose();
    } catch (error) {
      console.error("Failed to create container", error);
      toast.error(
        error instanceof Error ? error.message : "Unable to create container"
      );
      setShowProgress(false);
      setProgressMessage("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={isSubmitting ? undefined : handleClose} 
      maxWidth="md" 
      fullWidth
      disableEscapeKeyDown={isSubmitting}
    >
      <DialogTitle>Create container</DialogTitle>
      {showProgress && (
        <Box sx={{ px: 3, pt: 1 }}>
          <LinearProgress />
          {progressMessage && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 1 }}>
              {progressMessage}
            </Typography>
          )}
        </Box>
      )}
      <DialogContent dividers>
        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs value={tabIndex} onChange={(_e, newValue) => setTabIndex(newValue)}>
            <Tab label="Quick Start Templates" />
            <Tab label="Custom Configuration" />
          </Tabs>
        </Box>

        {tabIndex === 0 && (
          <Stack spacing={2}>
            <Alert severity="info">
              Select a pre-configured service template. The image will be pulled automatically if not available locally.
            </Alert>
            <Grid container spacing={2}>
              {serviceTemplates.map((template) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={template.id}>
                  <Card
                    variant={selectedTemplate === template.id ? "outlined" : "elevation"}
                    sx={{
                      height: "100%",
                      borderColor: selectedTemplate === template.id ? "primary.main" : undefined,
                      borderWidth: selectedTemplate === template.id ? 2 : 1
                    }}
                  >
                    <CardActionArea onClick={() => handleTemplateSelect(template.id)} sx={{ height: "100%", p: 2 }}>
                      <CardContent>
                        <Stack spacing={1}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <ServiceIcon 
                              iconName={template.icon} 
                              sx={{ 
                                fontSize: 40,
                                color: template.iconColor || "primary.main"
                              }} 
                            />
                            <Box>
                              <Typography variant="subtitle1">{template.name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {template.image}
                              </Typography>
                            </Box>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {template.description}
                          </Typography>
                          <Chip
                            label={template.category}
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{ width: "fit-content", textTransform: "capitalize" }}
                          />
                        </Stack>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
            {selectedTemplate && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Configuration Preview
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    label="Container name"
                    value={containerName}
                    onChange={(event) => setContainerName(event.target.value)}
                    placeholder="Optional custom name"
                    size="small"
                  />
                  <Typography variant="caption" color="text.secondary">
                    Environment variables and ports are pre-configured. You can modify them after creation.
                  </Typography>
                </Stack>
              </Box>
            )}
          </Stack>
        )}

        {tabIndex === 1 && (
          <Stack spacing={2.5}>
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Autocomplete
                value={selectedImage}
                onChange={(_event, value) => {
                  setSelectedImage(value ?? "");
                  setImageError(null);
                }}
                options={imageOptions}
                freeSolo
                fullWidth
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Image"
                    required
                    error={Boolean(imageError)}
                    helperText={imageError ?? "Use repository:tag format (e.g., redis:latest)"}
                  />
                )}
              />
              <Button
                variant="outlined"
                startIcon={<DownloadIcon />}
                onClick={handlePullImage}
                disabled={!selectedImage.trim() || isPulling}
                sx={{ minWidth: 100, height: 56 }}
              >
                {isPulling ? "Pulling..." : "Pull"}
              </Button>
            </Stack>
            <TextField
              label="Container name"
              value={containerName}
              onChange={(event) => setContainerName(event.target.value)}
              placeholder="Optional human-friendly name"
            />
            <TextField
              label="Command"
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              placeholder="Optional startup command"
              helperText="Run with /bin/sh -c when provided"
            />
            <FormControl fullWidth>
              <InputLabel id="restart-policy-label">Restart policy</InputLabel>
              <Select
                labelId="restart-policy-label"
                label="Restart policy"
                value={restartPolicy}
                onChange={(event) => setRestartPolicy(event.target.value as DockerRestartPolicy)}
              >
                <MenuItem value="no">No restart</MenuItem>
                <MenuItem value="always">Always</MenuItem>
                <MenuItem value="on-failure">On failure</MenuItem>
                <MenuItem value="unless-stopped">Unless stopped</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={autoStart}
                  onChange={(event) => setAutoStart(event.target.checked)}
                />
              }
              label="Start container immediately"
            />
            <TextField
              label="Environment variables"
              value={envVars}
              onChange={(event) => setEnvVars(event.target.value)}
              placeholder={"KEY=value\nAPI_URL=https://example"}
              helperText="One KEY=value pair per line"
              multiline
              minRows={3}
            />
            <TextField
              label="Port mappings"
              value={ports}
              onChange={(event) => setPorts(event.target.value)}
              placeholder={"8080:80\n0.0.0.0:5432:5432/udp"}
              helperText="Format: hostPort:containerPort[/protocol]. Use optional host IP prefix."
              multiline
              minRows={3}
            />
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={handleClose} disabled={isSubmitting || isPulling}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={isSubmitting || isPulling || !selectedImage.trim()}
        >
          {isSubmitting ? "Creating..." : "Create container"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateContainerDialog;
