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
  TextField,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import type { Domain as DomainModel, DomainUpsertInput } from "@/types/server";

interface AdvancedEditDialogProps {
  open: boolean;
  domain: DomainModel;
  onClose: () => void;
  onSave: (updates: Partial<DomainUpsertInput>) => Promise<void>;
  isSaving: boolean;
}

export default function AdvancedEditDialog({
  open,
  domain,
  onClose,
  onSave,
  isSaving,
}: AdvancedEditDialogProps) {
  const [customNginxConfig, setCustomNginxConfig] = useState(domain.target?.customNginxConfig || "");

  useEffect(() => {
    if (open) {
      setCustomNginxConfig(domain.target?.customNginxConfig || "");
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

    const targetConfig = {
      ...baseTarget,
      customNginxConfig: customNginxConfig || null,
    };

    await onSave({ target: targetConfig });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Edit Advanced Configuration</Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1, position: "relative" }}>
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

          <TextField
            label="Custom Nginx Configuration"
            multiline
            minRows={8}
            fullWidth
            value={customNginxConfig}
            onChange={(e) => setCustomNginxConfig(e.target.value)}
            placeholder="location /health { return 200 'ok'; }"
            helperText="Custom nginx directives for advanced routing, caching, or header behaviors"
          />
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

