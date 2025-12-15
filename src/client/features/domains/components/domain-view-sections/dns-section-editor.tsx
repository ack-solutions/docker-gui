"use client";

import {
  Box,
  Stack,
  Typography,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import type { Domain as DomainModel, DomainUpsertInput, DomainDnsRecord } from "@/types/server";
import DnsRecordsView from "../dns-records-view";

interface DnsSectionEditorProps {
  domain: DomainModel;
  allDomains: DomainModel[];
  onEdit: () => void;
  onSave: (updates: Partial<DomainUpsertInput>) => Promise<void>;
  isSaving?: boolean;
}

export default function DnsSectionEditor({
  domain,
  allDomains,
  onEdit,
  onSave,
  isSaving = false,
}: DnsSectionEditorProps) {

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          DNS Configuration
        </Typography>
        <IconButton onClick={onEdit} size="small" color="primary">
          <EditIcon />
        </IconButton>
      </Stack>

      <Stack spacing={2}>
        <Box>
          <DnsRecordsView
            records={domain.records || []}
            domainName={domain.name}
            onUpdate={async (recordId, updates) => {
              const currentRecords = domain.records || [];
              const updatedRecords = currentRecords.map((r) =>
                r.id === recordId ? { ...r, ...updates } : r
              );
              await onSave({ records: updatedRecords });
            }}
            onDelete={async (recordId) => {
              const currentRecords = domain.records || [];
              const updatedRecords = currentRecords.filter((r) => r.id !== recordId);
              await onSave({ records: updatedRecords });
            }}
            onCreate={async (newRecord) => {
              const currentRecords = domain.records || [];
              const tempRecord: DomainDnsRecord = {
                id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                type: newRecord.type,
                host: newRecord.host,
                value: newRecord.value,
                ttl: newRecord.ttl,
                priority: newRecord.priority ?? null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };
              const updatedRecords = [...currentRecords, tempRecord];
              await onSave({ records: updatedRecords });
            }}
            isReadOnly={false}
            isSaving={isSaving}
          />
        </Box>
      </Stack>
    </Box>
  );
}

