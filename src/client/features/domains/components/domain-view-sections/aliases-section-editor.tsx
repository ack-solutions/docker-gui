"use client";

import { useState } from "react";
import {
  Box,
  Stack,
  Typography,
  TextField,
  IconButton,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import type { Domain as DomainModel, DomainUpsertInput } from "@/types/server";

interface AliasesSectionEditorProps {
  domain: DomainModel;
  onSave: (updates: Partial<DomainUpsertInput>) => Promise<void>;
  isSaving?: boolean;
}

export default function AliasesSectionEditor({
  domain,
  onSave,
  isSaving = false,
}: AliasesSectionEditorProps) {
  const [aliases, setAliases] = useState<string[]>(domain.aliases || []);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newAlias, setNewAlias] = useState("");
  const [savingIndex, setSavingIndex] = useState<number | null>(null);

  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    setEditingValue(aliases[index]);
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingValue("");
    setEditError(null);
  };

  const normalizeAlias = (input: string): string => {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return "";

    // If it's already a full domain, use it as is
    const fullDomainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (fullDomainRegex.test(trimmed)) {
      return trimmed;
    }

    // Otherwise, treat it as a subdomain and append the main domain
    const subdomainRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/i;
    if (subdomainRegex.test(trimmed)) {
      return `${trimmed}.${domain.name}`;
    }

    return "";
  };

  const validateAlias = (alias: string): string | null => {
    if (!alias) {
      return "Alias cannot be empty";
    }

    // Validate domain format
    const domainRegex = /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i;
    if (!domainRegex.test(alias)) {
      return "Invalid domain format";
    }

    // Don't allow the primary domain
    if (alias === domain.name.toLowerCase()) {
      return "Cannot use the primary domain as an alias";
    }

    return null;
  };

  const [editError, setEditError] = useState<string | null>(null);

  const handleSaveEdit = async (index: number) => {
    const normalized = normalizeAlias(editingValue);
    if (!normalized) {
      setEditError("Please enter a valid subdomain or domain");
      return;
    }

    const error = validateAlias(normalized);
    if (error) {
      setEditError(error);
      return;
    }

    // Don't allow duplicates
    if (aliases.some((a, i) => i !== index && a === normalized)) {
      setEditError("This alias already exists");
      return;
    }

    setEditError(null);
    const updated = [...aliases];
    updated[index] = normalized;
    setAliases(updated);
    setSavingIndex(index);
    await onSave({ aliases: updated });
    setSavingIndex(null);
    setEditingIndex(null);
    setEditingValue("");
  };

  const handleDelete = async (index: number) => {
    if (confirm("Are you sure you want to delete this alias?")) {
      const updated = aliases.filter((_, i) => i !== index);
      setAliases(updated);
      setSavingIndex(index);
      await onSave({ aliases: updated });
      setSavingIndex(null);
    }
  };

  const [createError, setCreateError] = useState<string | null>(null);

  const handleCreate = async () => {
    const normalized = normalizeAlias(newAlias);
    if (!normalized) {
      setCreateError("Please enter a valid subdomain or domain");
      return;
    }

    const error = validateAlias(normalized);
    if (error) {
      setCreateError(error);
      return;
    }

    // Don't allow duplicates
    if (aliases.includes(normalized)) {
      setCreateError("This alias already exists");
      return;
    }

    setCreateError(null);
    const updated = [...aliases, normalized];
    setAliases(updated);
    await onSave({ aliases: updated });
    setCreateDialogOpen(false);
    setNewAlias("");
  };

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Subdomains & Aliases
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Primary domain: <strong>{domain.name}</strong> (auto-managed)
          </Typography>
        </Box>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          disabled={isSaving}
        >
          Add Alias
        </Button>
      </Stack>

      <Stack spacing={2}>
        {aliases.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderStyle: "dashed" }}>
            <Typography variant="body2" color="text.secondary">
              No aliases configured. Add subdomains or aliases that will be handled by nginx.
            </Typography>
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{ mt: 2 }}
              disabled={isSaving}
            >
              Add Your First Alias
            </Button>
          </Paper>
        ) : (
          <Paper variant="outlined" sx={{ position: "relative" }}>
            {isSaving && savingIndex === null && (
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  bgcolor: "rgba(255, 255, 255, 0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 5,
                }}
              >
                <CircularProgress size={24} />
              </Box>
            )}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Domain/Alias</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {aliases.map((alias, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {editingIndex === index ? (
                        <Stack spacing={1}>
                          <TextField
                            size="small"
                            fullWidth
                            value={editingValue}
                            onChange={(e) => {
                              setEditingValue(e.target.value);
                              setEditError(null);
                            }}
                            onKeyPress={(e) => {
                              if (e.key === "Enter") {
                                handleSaveEdit(index);
                              } else if (e.key === "Escape") {
                                handleCancelEdit();
                              }
                            }}
                            InputProps={{
                              endAdornment: !editingValue.includes(".") && editingValue.trim() ? (
                                <InputAdornment position="end">
                                  <Typography variant="caption" color="text.secondary">
                                    .{domain.name}
                                  </Typography>
                                </InputAdornment>
                              ) : null,
                            }}
                            placeholder="www or www.example.com"
                            error={!!editError}
                            helperText={editError || (editingValue && !editingValue.includes(".") ? `Will become: ${editingValue}.${domain.name}` : "")}
                            autoFocus
                            disabled={savingIndex === index || isSaving}
                          />
                        </Stack>
                      ) : (
                        <Typography variant="body2">{alias}</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {editingIndex === index ? (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleSaveEdit(index)}
                            disabled={savingIndex === index || isSaving}
                          >
                            {savingIndex === index ? (
                              <CircularProgress size={16} />
                            ) : (
                              <SaveIcon fontSize="small" />
                            )}
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={handleCancelEdit}
                            disabled={savingIndex === index || isSaving}
                          >
                            <CancelIcon fontSize="small" />
                          </IconButton>
                        </Stack>
                      ) : (
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton
                            size="small"
                            color="primary"
                            onClick={() => handleStartEdit(index)}
                            disabled={isSaving || savingIndex !== null}
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(index)}
                            disabled={isSaving || savingIndex === index}
                          >
                            {savingIndex === index ? (
                              <CircularProgress size={16} />
                            ) : (
                              <DeleteIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}
      </Stack>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => {
        setCreateDialogOpen(false);
        setNewAlias("");
        setCreateError(null);
      }} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Alias</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {createError && (
              <Alert severity="error" onClose={() => setCreateError(null)}>
                {createError}
              </Alert>
            )}
            <TextField
              label="Subdomain or Domain"
              fullWidth
              placeholder="www"
              value={newAlias}
              onChange={(e) => {
                setNewAlias(e.target.value);
                setCreateError(null);
              }}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleCreate();
                }
              }}
              InputProps={{
                endAdornment: !newAlias.includes(".") && newAlias.trim() ? (
                  <InputAdornment position="end">
                    <Typography variant="body2" color="text.secondary">
                      .{domain.name}
                    </Typography>
                  </InputAdornment>
                ) : null,
              }}
              helperText={
                newAlias && !newAlias.includes(".")
                  ? `Will become: ${newAlias}.${domain.name}`
                  : "Enter just the subdomain (e.g., 'www') or full domain (e.g., 'www.example.com')"
              }
              disabled={isSaving}
              autoFocus
              error={!!createError}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setCreateDialogOpen(false);
            setNewAlias("");
            setCreateError(null);
          }} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={isSaving || !newAlias.trim()}
          >
            Add
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

