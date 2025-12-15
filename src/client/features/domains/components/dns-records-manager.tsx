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
  InputLabel,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import type { DomainDnsRecordType } from "@/types/server";

interface DnsRecord {
  id?: string;
  type: DomainDnsRecordType;
  host: string;
  value: string;
  ttl: number;
  priority?: number | null;
}

const COMMON_RECORD_TYPES: DomainDnsRecordType[] = ["A", "AAAA", "CNAME", "TXT", "MX"];

const COMMON_TEMPLATES = [
  { name: "Root Domain", type: "A" as const, host: "@", placeholder: "123.45.67.89" },
  { name: "WWW Subdomain", type: "CNAME" as const, host: "www", placeholder: "example.com" },
  { name: "Mail Server", type: "MX" as const, host: "@", placeholder: "mail.example.com" },
  { name: "Custom Subdomain", type: "A" as const, host: "", placeholder: "123.45.67.89" },
];

interface DnsRecordsManagerProps {
  records: DnsRecord[];
  onChange: (records: DnsRecord[]) => void;
  domainName: string;
}

export default function DnsRecordsManager({
  records,
  onChange,
  domainName,
}: DnsRecordsManagerProps) {
  const [showTemplates, setShowTemplates] = useState(records.length === 0);

  const handleAddRecord = (template?: { type: DomainDnsRecordType; host: string }) => {
    const newRecord: DnsRecord = {
      type: template?.type || "A",
      host: template?.host || "@",
      value: "",
      ttl: 300,
      priority: null,
    };
    onChange([...records, newRecord]);
    setShowTemplates(false);
  };

  const handleUpdateRecord = (index: number, updates: Partial<DnsRecord>) => {
    const updated = records.map((record, idx) =>
      idx === index ? { ...record, ...updates } : record
    );
    onChange(updated);
  };

  const handleDeleteRecord = (index: number) => {
    onChange(records.filter((_, idx) => idx !== index));
  };

  const getPreview = (record: DnsRecord) => {
    const host = record.host === "@" ? domainName : `${record.host}.${domainName}`;
    return `${host} → ${record.value || "(empty)"}`;
  };

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" fontWeight={600}>
          DNS Records
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => handleAddRecord()}
          variant="outlined"
        >
          Add Record
        </Button>
      </Stack>

      {/* Quick Templates */}
      {showTemplates && records.length === 0 && (
        <Alert severity="info">
          <Typography variant="subtitle2" gutterBottom>
            Quick Start: Choose a template
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
            {COMMON_TEMPLATES.map((template, idx) => (
              <Chip
                key={idx}
                label={template.name}
                onClick={() => handleAddRecord(template)}
                color="primary"
                variant="outlined"
                clickable
              />
            ))}
          </Stack>
        </Alert>
      )}

      {/* Records Table */}
      {records.length === 0 && !showTemplates ? (
        <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderStyle: "dashed" }}>
          <Typography variant="body2" color="text.secondary">
            No DNS records yet. Click &quot;Add Record&quot; to create one.
          </Typography>
        </Paper>
      ) : records.length > 0 ? (
        <Paper variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell width="15%">Type</TableCell>
                <TableCell width="20%">Host/Name</TableCell>
                <TableCell width="30%">Value</TableCell>
                <TableCell width="15%">TTL (sec)</TableCell>
                <TableCell width="10%">Priority</TableCell>
                <TableCell width="10%"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.map((record, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <FormControl size="small" fullWidth>
                      <Select
                        value={record.type}
                        onChange={(e) =>
                          handleUpdateRecord(index, {
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
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="@ or subdomain"
                      value={record.host}
                      onChange={(e) => handleUpdateRecord(index, { host: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder={
                        record.type === "A"
                          ? "192.0.2.1"
                          : record.type === "CNAME"
                          ? "example.com"
                          : "value"
                      }
                      value={record.value}
                      onChange={(e) => handleUpdateRecord(index, { value: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      size="small"
                      type="number"
                      fullWidth
                      value={record.ttl}
                      onChange={(e) =>
                        handleUpdateRecord(index, { ttl: parseInt(e.target.value) || 300 })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    {(record.type === "MX" || record.type === "SRV") && (
                      <TextField
                        size="small"
                        type="number"
                        fullWidth
                        value={record.priority ?? ""}
                        onChange={(e) => {
                          const value = e.target.value.trim();
                          // If empty, set to null. Otherwise parse as integer
                          // Only set if it's a valid positive number
                          if (value === "") {
                            handleUpdateRecord(index, { priority: null });
                          } else {
                            const num = parseInt(value, 10);
                            // Only set if it's a valid positive number (>= 1)
                            // 0 or negative will be treated as empty
                            if (!isNaN(num) && num >= 1) {
                              handleUpdateRecord(index, { priority: num });
                            } else {
                              // Invalid number, set to null
                              handleUpdateRecord(index, { priority: null });
                            }
                          }
                        }}
                        helperText="Priority (1 or higher, optional)"
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteRecord(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Preview */}
          <Box sx={{ p: 2, bgcolor: "action.hover", borderTop: "1px solid", borderColor: "divider" }}>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Preview:
            </Typography>
            <Stack spacing={0.5}>
              {records.slice(0, 3).map((record, idx) => (
                <Typography key={idx} variant="caption" fontFamily="monospace">
                  {getPreview(record)}
                </Typography>
              ))}
              {records.length > 3 && (
                <Typography variant="caption" color="text.secondary">
                  +{records.length - 3} more records
                </Typography>
              )}
            </Stack>
          </Box>
        </Paper>
      ) : null}

      {/* Helper Info */}
      {records.length > 0 && (
        <Alert severity="info" variant="outlined">
          <Typography variant="caption">
            <strong>Tip:</strong> Use &quot;@&quot; for the root domain ({domainName}) or enter a
            subdomain name (e.g., &quot;api&quot; for api.{domainName})
          </Typography>
        </Alert>
      )}
    </Stack>
  );
}

