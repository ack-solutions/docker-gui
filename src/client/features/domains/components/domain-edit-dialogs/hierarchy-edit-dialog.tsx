"use client";

import { useState, useEffect, useMemo } from "react";
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
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import type { Domain as DomainModel, DomainUpsertInput } from "@/types/server";

interface HierarchyEditDialogProps {
  open: boolean;
  domain: DomainModel;
  allDomains: DomainModel[];
  onClose: () => void;
  onSave: (updates: Partial<DomainUpsertInput>) => Promise<void>;
  isSaving: boolean;
}

export default function HierarchyEditDialog({
  open,
  domain,
  allDomains,
  onClose,
  onSave,
  isSaving,
}: HierarchyEditDialogProps) {
  const [parentDomainId, setParentDomainId] = useState<string | null>(domain.parentDomainId ?? null);

  const parentOptions = useMemo(
    () => allDomains.filter((candidate) => candidate.id !== domain.id),
    [allDomains, domain.id]
  );

  useEffect(() => {
    if (open) {
      setParentDomainId(domain.parentDomainId ?? null);
    }
  }, [open, domain]);

  const handleSave = async () => {
    await onSave({ parentDomainId: parentDomainId ?? null });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">Edit Domain Hierarchy</Typography>
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

          <FormControl fullWidth>
            <InputLabel>Parent Domain</InputLabel>
            <Select
              label="Parent Domain"
              value={parentDomainId ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                setParentDomainId(value ? String(value) : null);
              }}
            >
              <MenuItem value="">
                <em>No parent (root domain)</em>
              </MenuItem>
              {parentOptions.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  {option.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
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

