"use client";

import {
  Box,
  Stack,
  Typography,
  IconButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import type { Domain as DomainModel } from "@/types/server";

interface AdvancedSectionEditorProps {
  domain: DomainModel;
  onEdit: () => void;
}

export default function AdvancedSectionEditor({
  domain,
  onEdit,
}: AdvancedSectionEditorProps) {

  return (
    <Box sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Advanced Configuration
        </Typography>
        <IconButton onClick={onEdit} size="small" color="primary">
          <EditIcon />
        </IconButton>
      </Stack>

      <Stack spacing={2}>
        <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
          <Typography variant="body1" fontWeight={500} gutterBottom>
            {domain.target?.customNginxConfig ? "Custom nginx configuration is set" : "No custom configuration"}
          </Typography>
        {domain.target?.customNginxConfig && (
          <Box sx={{ p: 2, bgcolor: "action.hover", borderRadius: 1 }}>
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              Configuration Preview:
            </Typography>
            <Typography variant="body2" component="pre" sx={{ fontFamily: "monospace", fontSize: "0.75rem", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {domain.target.customNginxConfig}
            </Typography>
          </Box>
        )}
        </Box>
      </Stack>
    </Box>
  );
}

