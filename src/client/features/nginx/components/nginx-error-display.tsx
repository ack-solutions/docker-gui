"use client";

import { Alert, AlertTitle, Box, Collapse, IconButton, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { useState } from "react";
import { toast } from "sonner";

interface NginxErrorDisplayProps {
  error: string;
  title?: string;
}

export default function NginxErrorDisplay({ error, title = "Deployment Failed" }: NginxErrorDisplayProps) {
  const [expanded, setExpanded] = useState(false);

  // Parse error to extract nginx output if present
  const lines = error.split("\n");
  const hasNginxOutput = error.includes("nginx:") || error.includes("test failed") || lines.length > 1;

  const handleCopy = () => {
    navigator.clipboard.writeText(error);
    toast.success("Error copied to clipboard");
  };

  if (!hasNginxOutput || lines.length === 1) {
    // Simple error message
    return (
      <Alert severity="error">
        <AlertTitle>{title}</AlertTitle>
        {error}
      </Alert>
    );
  }

  // Complex error with nginx output
  const summary = lines[0];
  const details = lines.slice(1).join("\n");

  return (
    <Alert
      severity="error"
      action={
        <Box sx={{ display: "flex", gap: 1 }}>
          <IconButton
            size="small"
            color="inherit"
            onClick={handleCopy}
            title="Copy error"
          >
            <ContentCopyIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="inherit"
            onClick={() => setExpanded(!expanded)}
            title={expanded ? "Hide details" : "Show details"}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
        </Box>
      }
    >
      <AlertTitle>{title}</AlertTitle>
      <Typography variant="body2" gutterBottom>
        {summary}
      </Typography>

      <Collapse in={expanded}>
        <Box
          sx={{
            mt: 2,
            p: 2,
            bgcolor: "rgba(0,0,0,0.1)",
            borderRadius: 1,
            fontFamily: "monospace",
            fontSize: "0.875rem",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: 300,
            overflow: "auto",
          }}
        >
          {details}
        </Box>
        
        <Typography variant="caption" display="block" sx={{ mt: 1, fontWeight: 500 }}>
          💡 Common fixes:
        </Typography>
        <Typography variant="caption" component="div" sx={{ ml: 2 }}>
          • Check domain name format (e.g., example.com)
          <br />
          • Verify container is running
          <br />
          • Ensure port number is correct
          <br />
          • Check for duplicate server_name directives
          <br />
          • Verify SSL certificate paths (if using custom SSL)
        </Typography>
      </Collapse>
    </Alert>
  );
}

