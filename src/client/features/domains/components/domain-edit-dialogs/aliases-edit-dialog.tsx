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
  Chip,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import type { Domain as DomainModel, DomainUpsertInput } from "@/types/server";

interface AliasesEditDialogProps {
  open: boolean;
  domain: DomainModel;
  onClose: () => void;
  onSave: (updates: Partial<DomainUpsertInput>) => Promise<void>;
  isSaving: boolean;
}

export default function AliasesEditDialog({
  open,
  domain,
  onClose,
  onSave,
  isSaving,
}: AliasesEditDialogProps) {
  const [aliases, setAliases] = useState<string[]>(domain.aliases || []);
  const [newAlias, setNewAlias] = useState("");

  useEffect(() => {
    if (open) {
      setAliases(domain.aliases || []);
      setNewAlias("");
    }
  }, [open, domain]);

  const handleAddAlias = () => {
    const trimmed = newAlias.trim().toLowerCase();
    if (!trimmed) return;
    
    // Validate domain format
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(trimmed)) {
      return; // Invalid format, could show error
    }

    // Don't allow the primary domain as an alias
    if (trimmed === domain.name.toLowerCase()) {
      return;
    }

    // Don't allow duplicates
    if (aliases.includes(trimmed)) {
      return;
    }

    setAliases([...aliases, trimmed]);
    setNewAlias("");
  };

  const handleRemoveAlias = (alias: string) => {
    setAliases(aliases.filter((a) => a !== alias));
  };

  const handleSave = async () => {
    await onSave({ aliases });
    onClose();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddAlias();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Manage Subdomains & Aliases</Typography>
          <IconButton onClick={onClose} size="small" disabled={isSaving}>
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

          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Primary Domain
            </Typography>
            <Typography variant="body1" fontWeight={600}>
              {domain.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              This is the main domain. Add subdomains or aliases below that will also be handled by nginx.
            </Typography>
          </Box>

          <Box>
            <Typography variant="body2" fontWeight={500} gutterBottom>
              Additional Domains
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
              These will be added to nginx server_name directive (e.g., www.example.com, api.example.com)
            </Typography>
            
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="www.example.com"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isSaving}
              />
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={handleAddAlias}
                disabled={isSaving || !newAlias.trim()}
              >
                Add
              </Button>
            </Stack>

            {aliases.length > 0 ? (
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {aliases.map((alias) => (
                  <Chip
                    key={alias}
                    label={alias}
                    onDelete={() => handleRemoveAlias(alias)}
                    deleteIcon={<DeleteIcon />}
                    disabled={isSaving}
                  />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic" }}>
                No aliases added yet
              </Typography>
            )}
          </Box>
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




