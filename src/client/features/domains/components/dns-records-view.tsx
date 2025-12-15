"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import type { DomainDnsRecord, DomainDnsRecordType } from "@/types/server";

interface DnsRecordsViewProps {
  records: DomainDnsRecord[];
  domainName: string;
  onUpdate: (recordId: string, updates: Partial<DomainDnsRecord>) => Promise<void>;
  onDelete: (recordId: string) => Promise<void>;
  onCreate: (record: Omit<DomainDnsRecord, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  isReadOnly?: boolean;
  isSaving?: boolean;
}

const COMMON_RECORD_TYPES: DomainDnsRecordType[] = ["A", "AAAA", "CNAME", "TXT", "MX", "SRV", "CAA", "NS"];

export default function DnsRecordsView({
  records,
  domainName,
  onUpdate,
  onDelete,
  onCreate,
  isReadOnly = false,
  isSaving = false,
}: DnsRecordsViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<Partial<DomainDnsRecord> | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRecord, setNewRecord] = useState<Omit<DomainDnsRecord, "id" | "createdAt" | "updatedAt">>({
    type: "A",
    host: "@",
    value: "",
    ttl: 300,
    priority: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [savingRecordId, setSavingRecordId] = useState<string | null>(null);

  const handleStartEdit = (record: DomainDnsRecord) => {
    setEditingId(record.id);
    setEditingRecord({ ...record });
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingRecord(null);
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingRecord) return;

    // Validation
    if (!editingRecord.host?.trim()) {
      setError("Host/Name is required");
      return;
    }
    if (!editingRecord.value?.trim()) {
      setError("Value is required");
      return;
    }
    if (!editingRecord.ttl || editingRecord.ttl < 1) {
      setError("TTL must be at least 1 second");
      return;
    }
    if ((editingRecord.type === "MX" || editingRecord.type === "SRV") && editingRecord.priority === null) {
      setError("Priority is required for MX and SRV records");
      return;
    }

    try {
      setSavingRecordId(editingId);
      await onUpdate(editingId, editingRecord);
      setEditingId(null);
      setEditingRecord(null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update record");
    } finally {
      setSavingRecordId(null);
    }
  };

  const handleDelete = async (recordId: string) => {
    if (confirm("Are you sure you want to delete this DNS record?")) {
      try {
        setSavingRecordId(recordId);
        await onDelete(recordId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete record");
      } finally {
        setSavingRecordId(null);
      }
    }
  };

  const handleCreate = async () => {
    // Validation
    if (!newRecord.host?.trim()) {
      setError("Host/Name is required");
      return;
    }
    if (!newRecord.value?.trim()) {
      setError("Value is required");
      return;
    }
    if (!newRecord.ttl || newRecord.ttl < 1) {
      setError("TTL must be at least 1 second");
      return;
    }
    if ((newRecord.type === "MX" || newRecord.type === "SRV") && newRecord.priority === null) {
      setError("Priority is required for MX and SRV records");
      return;
    }

    try {
      await onCreate(newRecord);
      setCreateDialogOpen(false);
      setNewRecord({
        type: "A",
        host: "@",
        value: "",
        ttl: 300,
        priority: null,
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create record");
    }
  };

  const getFullHostname = (host: string) => {
    if (host === "@") return domainName;
    return `${host}.${domainName}`;
  };

  const getRecordTypeDescription = (type: DomainDnsRecordType) => {
    const descriptions: Record<DomainDnsRecordType, string> = {
      A: "IPv4 address",
      AAAA: "IPv6 address",
      CNAME: "Canonical name (alias)",
      TXT: "Text record",
      MX: "Mail exchange",
      SRV: "Service record",
      CAA: "Certificate authority authorization",
      NS: "Name server",
    };
    return descriptions[type] || type;
  };

  const renderRecordRow = (record: DomainDnsRecord) => {
    const isEditing = editingId === record.id;

    return (
      <TableRow key={record.id}>
        <TableCell>
          {isEditing ? (
            <FormControl size="small" fullWidth>
              <Select
                value={editingRecord?.type || "A"}
                onChange={(e) =>
                  setEditingRecord({
                    ...editingRecord,
                    type: e.target.value as DomainDnsRecordType,
                  })
                }
              >
                {COMMON_RECORD_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Tooltip title={getRecordTypeDescription(record.type)}>
              <Chip label={record.type} size="small" color="primary" variant="outlined" />
            </Tooltip>
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              size="small"
              fullWidth
              placeholder="@ or subdomain"
              value={editingRecord?.host || ""}
              onChange={(e) =>
                setEditingRecord({
                  ...editingRecord,
                  host: e.target.value,
                })
              }
            />
          ) : (
            <Box>
              <Typography variant="body2" fontWeight={500}>
                {record.host === "@" ? domainName : `${record.host}.${domainName}`}
              </Typography>
              {record.host !== "@" && (
                <Typography variant="caption" color="text.secondary">
                  {record.host}
                </Typography>
              )}
            </Box>
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              size="small"
              fullWidth
              placeholder={
                editingRecord?.type === "A"
                  ? "192.0.2.1"
                  : editingRecord?.type === "AAAA"
                    ? "2001:0db8::1"
                    : editingRecord?.type === "CNAME"
                      ? "example.com"
                      : editingRecord?.type === "MX"
                        ? "mail.example.com"
                        : "value"
              }
              value={editingRecord?.value || ""}
              onChange={(e) =>
                setEditingRecord({
                  ...editingRecord,
                  value: e.target.value,
                })
              }
            />
          ) : (
            <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: "break-all" }}>
              {record.value}
            </Typography>
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <TextField
              size="small"
              type="number"
              fullWidth
              value={editingRecord?.ttl || 300}
              onChange={(e) =>
                setEditingRecord({
                  ...editingRecord,
                  ttl: parseInt(e.target.value) || 300,
                })
              }
            />
          ) : (
            <Typography variant="body2">{record.ttl}s</Typography>
          )}
        </TableCell>
        <TableCell>
          {(record.type === "MX" || record.type === "SRV" || isEditing) && (
            <>
              {isEditing ? (
                <TextField
                  size="small"
                  type="number"
                  fullWidth
                  value={editingRecord?.priority ?? ""}
                  onChange={(e) => {
                    const value = e.target.value.trim();
                    setEditingRecord({
                      ...editingRecord,
                      priority: value === "" ? null : parseInt(value) || null,
                    });
                  }}
                  placeholder="0"
                />
              ) : (
                <Typography variant="body2">{record.priority ?? "-"}</Typography>
              )}
            </>
          )}
        </TableCell>
        <TableCell>
          {isEditing ? (
            <Stack direction="row" spacing={0.5}>
              <IconButton
                size="small"
                color="primary"
                onClick={handleSaveEdit}
                disabled={savingRecordId === record.id || isSaving}
              >
                {savingRecordId === record.id ? (
                  <CircularProgress size={16} />
                ) : (
                  <SaveIcon fontSize="small" />
                )}
              </IconButton>
              <IconButton
                size="small"
                onClick={handleCancelEdit}
                disabled={savingRecordId === record.id || isSaving}
              >
                <CancelIcon fontSize="small" />
              </IconButton>
            </Stack>
          ) : (
            !isReadOnly && (
              <Stack direction="row" spacing={0.5}>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handleStartEdit(record)}
                  disabled={isSaving || savingRecordId !== null}
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDelete(record.id)}
                  disabled={isSaving || savingRecordId === record.id}
                >
                  {savingRecordId === record.id ? (
                    <CircularProgress size={16} />
                  ) : (
                    <DeleteIcon fontSize="small" />
                  )}
                </IconButton>
              </Stack>
            )
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={600}>
          DNS Records ({records.length})
        </Typography>
        {!isReadOnly && (
          <Button
            size="small"
            startIcon={<AddIcon />}
            onClick={() => {
              setCreateDialogOpen(true);
              setError(null);
            }}
            variant="contained"
            disabled={isSaving}
          >
            Add Record
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {records.length === 0 ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderStyle: "dashed" }}>
          <Typography variant="body2" color="text.secondary">
            No DNS records configured yet.
          </Typography>
          {!isReadOnly && (
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setCreateDialogOpen(true)}
              sx={{ mt: 2 }}
              disabled={isSaving}
            >
              Add Your First Record
            </Button>
          )}
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ position: "relative" }}>
          {isSaving && savingRecordId === null && (
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
                <TableCell width="12%">Type</TableCell>
                <TableCell width="25%">Host/Name</TableCell>
                <TableCell width="35%">Value</TableCell>
                <TableCell width="10%">TTL</TableCell>
                <TableCell width="8%">Priority</TableCell>
                {!isReadOnly && <TableCell width="10%">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((record) => renderRecordRow(record))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add DNS Record</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <FormControl fullWidth>
              <Typography variant="body2" gutterBottom>
                Record Type
              </Typography>
              <Select
                value={newRecord.type}
                onChange={(e) =>
                  setNewRecord({
                    ...newRecord,
                    type: e.target.value as DomainDnsRecordType,
                  })
                }
              >
                {COMMON_RECORD_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>
                    {type} - {getRecordTypeDescription(type)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Host/Name"
              fullWidth
              placeholder="@ or subdomain"
              value={newRecord.host}
              onChange={(e) => setNewRecord({ ...newRecord, host: e.target.value })}
              helperText={`Use "@" for ${domainName} or enter a subdomain name`}
            />

            <TextField
              label="Value"
              fullWidth
              placeholder={
                newRecord.type === "A"
                  ? "192.0.2.1"
                  : newRecord.type === "AAAA"
                    ? "2001:0db8::1"
                    : newRecord.type === "CNAME"
                      ? "example.com"
                      : newRecord.type === "MX"
                        ? "mail.example.com"
                        : "value"
              }
              value={newRecord.value}
              onChange={(e) => setNewRecord({ ...newRecord, value: e.target.value })}
              helperText={getRecordTypeDescription(newRecord.type)}
            />

            <TextField
              label="TTL (Time To Live)"
              type="number"
              fullWidth
              value={newRecord.ttl}
              onChange={(e) => setNewRecord({ ...newRecord, ttl: parseInt(e.target.value) || 300 })}
              helperText="Time in seconds (default: 300)"
            />

            {(newRecord.type === "MX" || newRecord.type === "SRV") && (
              <TextField
                label="Priority"
                type="number"
                fullWidth
                required
                value={newRecord.priority ?? ""}
                onChange={(e) => {
                  const value = e.target.value.trim();
                  setNewRecord({
                    ...newRecord,
                    priority: value === "" ? null : parseInt(value) || null,
                  });
                }}
                helperText="Lower numbers have higher priority (required for MX/SRV)"
              />
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate}>
            Create Record
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

