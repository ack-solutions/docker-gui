"use client";

import {
  Box,
  Stack,
  Typography,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import type { Domain as DomainModel } from "@/types/server";

interface HierarchySectionEditorProps {
  domain: DomainModel;
  allDomains: DomainModel[];
  onEdit: () => void;
}

export default function HierarchySectionEditor({
  domain,
  allDomains,
  onEdit,
}: HierarchySectionEditorProps) {
  const parentDomain = allDomains.find((d) => d.id === domain.parentDomainId);

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Domain Hierarchy
        </Typography>
        <IconButton onClick={onEdit} size="small" color="primary">
          <EditIcon />
        </IconButton>
      </Stack>

      <Stack spacing={2}>
        <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
          <Typography variant="body1" fontWeight={500}>
            {parentDomain ? `Subdomain of ${parentDomain.name}` : "Root domain (no parent)"}
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}

