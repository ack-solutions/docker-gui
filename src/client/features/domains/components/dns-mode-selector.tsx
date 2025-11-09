"use client";

import {
  Box,
  FormControl,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
  Chip,
} from "@mui/material";
import CloudIcon from "@mui/icons-material/Cloud";
import DnsIcon from "@mui/icons-material/Dns";
import LinkIcon from "@mui/icons-material/Link";

export type DnsMode = "managed" | "third-party" | "proxy-only";

interface DnsModeOption {
  mode: DnsMode;
  icon: React.ReactNode;
  title: string;
  description: string;
  recommended?: boolean;
}

const DNS_MODES: DnsModeOption[] = [
  {
    mode: "managed",
    icon: <DnsIcon />,
    title: "Nameserver Managed",
    description: "Point your nameservers at this platform",
    recommended: true,
  },
  {
    mode: "third-party",
    icon: <CloudIcon />,
    title: "Provider API",
    description: "Sync with AWS, Cloudflare, Azure, etc.",
  },
  {
    mode: "proxy-only",
    icon: <LinkIcon />,
    title: "Manual DNS / Proxy Only",
    description: "Keep DNS external, manage only proxy/SSL",
  },
];

interface DnsModeSelectorProps {
  selected: DnsMode;
  onChange: (mode: DnsMode) => void;
}

export default function DnsModeSelector({ selected, onChange }: DnsModeSelectorProps) {
  return (
    <FormControl component="fieldset" fullWidth>
      <Typography variant="subtitle2" gutterBottom fontWeight={600}>
        How do you want to manage DNS?
      </Typography>
      
      <RadioGroup value={selected} onChange={(e) => onChange(e.target.value as DnsMode)}>
        <Stack spacing={1}>
          {DNS_MODES.map((option) => (
            <FormControlLabel
              key={option.mode}
              value={option.mode}
              control={<Radio />}
              label={
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ py: 0.5 }}>
                  <Box color="primary.main" sx={{ display: "flex", alignItems: "center" }}>
                    {option.icon}
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography variant="body2" fontWeight={500}>
                        {option.title}
                      </Typography>
                      {option.recommended && (
                        <Chip label="Recommended" size="small" color="success" />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {option.description}
                    </Typography>
                  </Box>
                </Stack>
              }
              sx={{
                m: 0,
                p: 1.5,
                border: "1px solid",
                borderColor: selected === option.mode ? "primary.main" : "divider",
                borderRadius: 1,
                bgcolor: selected === option.mode ? "primary.50" : "transparent",
                "&:hover": {
                  bgcolor: selected === option.mode ? "primary.50" : "action.hover",
                },
              }}
            />
          ))}
        </Stack>
      </RadioGroup>
    </FormControl>
  );
}
