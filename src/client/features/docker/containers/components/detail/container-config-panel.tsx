"use client";

import { useState } from "react";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography
} from "@mui/material";
import type { DockerContainerInspect } from "@/types/docker";
import { toast } from "sonner";

interface ContainerConfigPanelProps {
  inspect: DockerContainerInspect;
  onUpdate?: (config: { env?: string[] }) => Promise<void>;
}

const ContainerConfigPanel = ({ inspect, onUpdate }: ContainerConfigPanelProps) => {
  const [isEditingEnv, setIsEditingEnv] = useState(false);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    inspect.config.env.map((entry) => {
      const [key, ...valueParts] = entry.split("=");
      return { key: key || "", value: valueParts.join("=") || "" };
    })
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleAddEnvVar = () => {
    setEnvVars([...envVars, { key: "", value: "" }]);
  };

  const handleRemoveEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const handleEnvVarChange = (index: number, field: "key" | "value", value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  const handleSaveEnv = async () => {
    if (!onUpdate) {
      toast.error("Update functionality not available");
      return;
    }

    // Validate
    const hasEmptyKeys = envVars.some((env) => !env.key.trim());
    if (hasEmptyKeys) {
      toast.error("Environment variable keys cannot be empty");
      return;
    }

    setIsSaving(true);
    try {
      const envArray = envVars
        .filter((env) => env.key.trim())
        .map((env) => `${env.key}=${env.value}`);
      
      await onUpdate({ env: envArray });
      setIsEditingEnv(false);
      toast.success("Environment variables updated successfully");
    } catch (error) {
      console.error("Failed to update environment variables", error);
      toast.error(error instanceof Error ? error.message : "Failed to update environment variables");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEnv = () => {
    // Reset to original values
    setEnvVars(
      inspect.config.env.map((entry) => {
        const [key, ...valueParts] = entry.split("=");
        return { key: key || "", value: valueParts.join("=") || "" };
      })
    );
    setIsEditingEnv(false);
  };

  return (
    <Stack spacing={3}>
      {/* Environment Variables Section */}
      <Box>
        <Stack direction="row" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6">
            Environment Variables
          </Typography>
          {!isEditingEnv ? (
            <Tooltip title="Edit environment variables">
              <IconButton size="small" onClick={() => setIsEditingEnv(true)}>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          ) : (
            <Stack direction="row" spacing={1}>
              <Tooltip title="Save changes">
                <IconButton 
                  size="small" 
                  color="primary" 
                  onClick={handleSaveEnv}
                  disabled={isSaving}
                >
                  <SaveIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Cancel">
                <IconButton 
                  size="small" 
                  onClick={handleCancelEnv}
                  disabled={isSaving}
                >
                  <CancelIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Stack>
        <Divider sx={{ mb: 2 }} />
        
        {!isEditingEnv ? (
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            {envVars.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No environment variables defined.
              </Typography>
            ) : (
              envVars.map((env, index) => (
                <Chip 
                  key={index} 
                  label={`${env.key}=${env.value}`} 
                  size="small" 
                  variant="outlined" 
                />
              ))
            )}
          </Box>
        ) : (
          <Stack spacing={2}>
            {envVars.map((env, index) => (
              <Stack key={index} direction="row" spacing={1} alignItems="center">
                <TextField
                  size="small"
                  label="Key"
                  value={env.key}
                  onChange={(e) => handleEnvVarChange(index, "key", e.target.value)}
                  sx={{ flex: 1 }}
                  disabled={isSaving}
                />
                <TextField
                  size="small"
                  label="Value"
                  value={env.value}
                  onChange={(e) => handleEnvVarChange(index, "value", e.target.value)}
                  sx={{ flex: 2 }}
                  disabled={isSaving}
                />
                <Tooltip title="Remove">
                  <IconButton 
                    size="small" 
                    color="error" 
                    onClick={() => handleRemoveEnvVar(index)}
                    disabled={isSaving}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
            ))}
            <Box>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddEnvVar}
                disabled={isSaving}
              >
                Add Variable
              </Button>
            </Box>
          </Stack>
        )}
      </Box>

      {/* Labels Section */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Labels
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {Object.keys(inspect.config.labels).length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No labels applied.
            </Typography>
          ) : (
            Object.entries(inspect.config.labels).map(([key, value]) => (
              <Chip key={key} label={`${key}=${value}`} size="small" variant="outlined" />
            ))
          )}
        </Box>
      </Box>

      {/* Restart Policy Section */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Restart Policy
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Typography variant="body2">
          {inspect.hostConfig.restartPolicy?.name
            ? `${inspect.hostConfig.restartPolicy.name}${
                inspect.hostConfig.restartPolicy.maximumRetryCount
                  ? ` (${inspect.hostConfig.restartPolicy.maximumRetryCount} retries)`
                  : ""
              }`
            : "No restart policy"}
        </Typography>
      </Box>
    </Stack>
  );
};

export default ContainerConfigPanel;

