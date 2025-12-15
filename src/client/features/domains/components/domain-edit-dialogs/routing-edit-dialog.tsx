"use client";

import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Radio,
  RadioGroup,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import type { Domain as DomainModel, DomainUpsertInput } from "@/types/server";
import { useContainers } from "@/features/docker/containers/hooks/use-containers";

interface RoutingEditDialogProps {
  open: boolean;
  domain: DomainModel;
  onClose: () => void;
  onSave: (updates: Partial<DomainUpsertInput>) => Promise<void>;
  isSaving: boolean;
}

export default function RoutingEditDialog({
  open,
  domain,
  onClose,
  onSave,
  isSaving,
}: RoutingEditDialogProps) {
  const { data: containers = [] } = useContainers({ refetchOnWindowFocus: false });
  const [targetType, setTargetType] = useState<"none" | "container" | "external" | "service" | "static">(
    domain.target?.type || "none"
  );
  const [selectedContainer, setSelectedContainer] = useState(domain.target?.containerId || "");
  const [containerPort, setContainerPort] = useState(domain.target?.containerPort?.toString() || "");
  const [externalUrl, setExternalUrl] = useState(domain.target?.externalUrl || "");
  const [serviceHost, setServiceHost] = useState(domain.target?.serviceHost || "");
  const [staticRoot, setStaticRoot] = useState(domain.target?.staticRoot || "");

  useEffect(() => {
    if (open) {
      setTargetType(domain.target?.type || "none");
      setSelectedContainer(domain.target?.containerId || "");
      setContainerPort(domain.target?.containerPort?.toString() || "");
      setExternalUrl(domain.target?.externalUrl || "");
      setServiceHost(domain.target?.serviceHost || "");
      setStaticRoot(domain.target?.staticRoot || "");
    }
  }, [open, domain]);

  const handleSave = async () => {
    const baseTarget = domain.target || {
      type: "none" as const,
      enableHttp: true,
      enableHttps: false,
      forceHttps: false,
      sslMode: "none" as const,
    };

    let targetConfig: any;

    if (targetType === "container") {
      if (!selectedContainer || !containerPort) {
        return;
      }
      targetConfig = {
        ...baseTarget,
        type: "container",
        containerId: selectedContainer,
        containerPort: parseInt(containerPort),
      };
    } else if (targetType === "external") {
      if (!externalUrl.trim()) {
        return;
      }
      let normalizedUrl = externalUrl.trim();
      if (!normalizedUrl.match(/^https?:\/\//i)) {
        normalizedUrl = `http://${normalizedUrl}`;
      }
      targetConfig = {
        ...baseTarget,
        type: "external",
        externalUrl: normalizedUrl,
      };
    } else if (targetType === "service") {
      if (!serviceHost.trim()) {
        return;
      }
      targetConfig = {
        ...baseTarget,
        type: "service",
        serviceHost: serviceHost.trim(),
      };
    } else if (targetType === "static") {
      if (!staticRoot.trim()) {
        return;
      }
      targetConfig = {
        ...baseTarget,
        type: "static",
        staticRoot: staticRoot.trim(),
      };
    } else {
      targetConfig = {
        ...baseTarget,
        type: "none",
        containerId: null,
        containerPort: null,
        externalUrl: null,
        serviceHost: null,
        staticRoot: null,
      };
    }

    await onSave({ target: targetConfig });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Edit Routing Configuration</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3} sx={{ mt: 1, position: "relative" }}>
          {isSaving && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                bgcolor: "rgba(255, 255, 255, 0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
              }}
            >
              <Stack spacing={2} alignItems="center">
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">
                  Saving...
                </Typography>
              </Stack>
            </Box>
          )}

          <FormControl component="fieldset">
            <RadioGroup
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as any)}
            >
              <FormControlLabel
                value="none"
                control={<Radio />}
                label="DNS Only (No routing)"
              />
              <FormControlLabel
                value="container"
                control={<Radio />}
                label="Docker Container"
              />
              <FormControlLabel
                value="external"
                control={<Radio />}
                label="External URL"
              />
              <FormControlLabel
                value="service"
                control={<Radio />}
                label="Internal Service"
              />
              <FormControlLabel
                value="static"
                control={<Radio />}
                label="Static Files"
              />
            </RadioGroup>
          </FormControl>

          {targetType === "container" && (
            <Stack spacing={2}>
              <FormControl fullWidth>
                <InputLabel>Container</InputLabel>
                <Select
                  label="Container"
                  value={selectedContainer}
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
                label="Container Port"
                type="number"
                fullWidth
                value={containerPort}
                onChange={(e) => setContainerPort(e.target.value)}
                helperText="Port number the container is listening on"
              />
            </Stack>
          )}

          {targetType === "external" && (
            <TextField
              label="External URL"
              fullWidth
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              helperText="Full URL to forward traffic to (e.g., https://example.com)"
            />
          )}

          {targetType === "service" && (
            <TextField
              label="Service Host"
              fullWidth
              value={serviceHost}
              onChange={(e) => setServiceHost(e.target.value)}
              helperText="Internal service hostname (e.g., service:8080)"
            />
          )}

          {targetType === "static" && (
            <TextField
              label="Static Root Directory"
              fullWidth
              value={staticRoot}
              onChange={(e) => setStaticRoot(e.target.value)}
              helperText="Path to static files directory (e.g., /var/www/html)"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveIcon />}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

