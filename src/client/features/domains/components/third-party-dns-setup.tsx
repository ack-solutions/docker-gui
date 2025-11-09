"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  Paper,
  Collapse,
  Link,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CloudIcon from "@mui/icons-material/Cloud";
import SecurityIcon from "@mui/icons-material/Security";

type DnsProvider = "aws" | "azure" | "cloudflare" | "digitalocean" | "none";

interface DnsProviderConfig {
  provider: DnsProvider;
  awsAccessKey?: string;
  awsSecretKey?: string;
  awsRegion?: string;
  azureClientId?: string;
  azureClientSecret?: string;
  azureTenantId?: string;
  cloudflareApiToken?: string;
  cloudflareEmail?: string;
  cloudflareZoneId?: string;
  digitalOceanToken?: string;
}

interface ThirdPartyDnsSetupProps {
  config: DnsProviderConfig;
  onChange: (config: DnsProviderConfig) => void;
  configured?: boolean;
}

const DNS_PROVIDERS = [
  { value: "aws", label: "AWS Route53", docsUrl: "https://aws.amazon.com/route53/" },
  { value: "azure", label: "Azure DNS", docsUrl: "https://azure.microsoft.com/en-us/services/dns/" },
  { value: "cloudflare", label: "Cloudflare", docsUrl: "https://www.cloudflare.com/dns/" },
  { value: "digitalocean", label: "DigitalOcean DNS", docsUrl: "https://www.digitalocean.com/products/dns" },
];

export default function ThirdPartyDnsSetup({ config, onChange, configured }: ThirdPartyDnsSetupProps) {
  const [showHelp, setShowHelp] = useState(false);

  const handleProviderChange = (provider: DnsProvider) => {
    onChange({ provider });
  };

  const handleFieldChange = (field: keyof DnsProviderConfig, value: string) => {
    onChange({ ...config, [field]: value });
  };

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="subtitle1" fontWeight={600}>
          Choose DNS Provider
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Connect to your external DNS provider to automatically manage records
        </Typography>
      </Stack>

      <Alert severity="info" icon={<SecurityIcon />}>
        <Typography variant="body2">
          API credentials are stored <strong>per-domain</strong> and encrypted in the database.
          Different domains can use different provider accounts.
        </Typography>
      </Alert>
      {configured && (
        <Alert severity="success">
          <Typography variant="body2">Credentials already configured. Update the fields below to rotate tokens.</Typography>
        </Alert>
      )}

      <FormControl fullWidth>
        <InputLabel>DNS Provider</InputLabel>
        <Select
          value={config.provider || "none"}
          label="DNS Provider"
          onChange={(e) => handleProviderChange(e.target.value as DnsProvider)}
        >
          <MenuItem value="none">
            <em>Select a provider...</em>
          </MenuItem>
          {DNS_PROVIDERS.map((provider) => (
            <MenuItem key={provider.value} value={provider.value}>
              {provider.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* AWS Route53 */}
      {config.provider === "aws" && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CloudIcon color="primary" />
              <Typography variant="subtitle2">AWS Route53 Configuration</Typography>
            </Stack>

            <TextField
              label="AWS Access Key ID"
              fullWidth
              value={config.awsAccessKey || ""}
              onChange={(e) => handleFieldChange("awsAccessKey", e.target.value)}
              placeholder="AKIAIOSFODNN7EXAMPLE"
            />

            <TextField
              label="AWS Secret Access Key"
              type="password"
              fullWidth
              value={config.awsSecretKey || ""}
              onChange={(e) => handleFieldChange("awsSecretKey", e.target.value)}
              placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
            />

            <TextField
              label="AWS Region"
              fullWidth
              value={config.awsRegion || "us-east-1"}
              onChange={(e) => handleFieldChange("awsRegion", e.target.value)}
              placeholder="us-east-1"
              helperText="e.g., us-east-1, eu-west-1"
            />

            <Alert severity="info" icon={<SecurityIcon />}>
              <Typography variant="caption">
                Credentials are encrypted and stored securely. We recommend using IAM roles with minimal Route53 permissions.
              </Typography>
            </Alert>
          </Stack>
        </Paper>
      )}

      {/* Azure DNS */}
      {config.provider === "azure" && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CloudIcon color="primary" />
              <Typography variant="subtitle2">Azure DNS Configuration</Typography>
            </Stack>

            <TextField
              label="Client ID (Application ID)"
              fullWidth
              value={config.azureClientId || ""}
              onChange={(e) => handleFieldChange("azureClientId", e.target.value)}
            />

            <TextField
              label="Client Secret"
              type="password"
              fullWidth
              value={config.azureClientSecret || ""}
              onChange={(e) => handleFieldChange("azureClientSecret", e.target.value)}
            />

            <TextField
              label="Tenant ID (Directory ID)"
              fullWidth
              value={config.azureTenantId || ""}
              onChange={(e) => handleFieldChange("azureTenantId", e.target.value)}
            />

            <Alert severity="info" icon={<SecurityIcon />}>
              <Typography variant="caption">
                Create a service principal in Azure AD with DNS Zone Contributor role.
              </Typography>
            </Alert>
          </Stack>
        </Paper>
      )}

      {/* Cloudflare */}
      {config.provider === "cloudflare" && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CloudIcon color="primary" />
              <Typography variant="subtitle2">Cloudflare Configuration</Typography>
            </Stack>

            <TextField
              label="API Token"
              type="password"
              fullWidth
              value={config.cloudflareApiToken || ""}
              onChange={(e) => handleFieldChange("cloudflareApiToken", e.target.value)}
              helperText="Get your API token from Cloudflare dashboard → My Profile → API Tokens"
            />

            <TextField
              label="Zone ID"
              fullWidth
              value={config.cloudflareZoneId || ""}
              onChange={(e) => handleFieldChange("cloudflareZoneId", e.target.value)}
              helperText="Found under Overview → API (requires DNS:Edit permissions)"
            />

            <TextField
              label="Account Email"
              type="email"
              fullWidth
              value={config.cloudflareEmail || ""}
              onChange={(e) => handleFieldChange("cloudflareEmail", e.target.value)}
            />

            <Alert severity="info" icon={<SecurityIcon />}>
              <Typography variant="caption">
                Use an API Token with &quot;Edit DNS&quot; permissions for the specific zones.
              </Typography>
            </Alert>
          </Stack>
        </Paper>
      )}

      {/* DigitalOcean */}
      {config.provider === "digitalocean" && (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <CloudIcon color="primary" />
              <Typography variant="subtitle2">DigitalOcean DNS Configuration</Typography>
            </Stack>

            <TextField
              label="Personal Access Token"
              type="password"
              fullWidth
              value={config.digitalOceanToken || ""}
              onChange={(e) => handleFieldChange("digitalOceanToken", e.target.value)}
              helperText="Generate from DigitalOcean Control Panel → API → Tokens"
            />

            <Alert severity="info" icon={<SecurityIcon />}>
              <Typography variant="caption">
                The token needs &quot;read&quot; and &quot;write&quot; permissions for DNS records.
              </Typography>
            </Alert>
          </Stack>
        </Paper>
      )}

      {/* Help Section */}
      {config.provider && config.provider !== "none" && (
        <Box>
          <Button
            size="small"
            onClick={() => setShowHelp(!showHelp)}
            endIcon={showHelp ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            Need help setting this up?
          </Button>
          <Collapse in={showHelp}>
            <Paper variant="outlined" sx={{ p: 2, mt: 1 }}>
              <Typography variant="subtitle2" gutterBottom>
                Setup Instructions
              </Typography>
              <Stack spacing={1} component="ol" sx={{ pl: 2 }}>
                <Typography component="li" variant="body2">
                  Log in to your {DNS_PROVIDERS.find(p => p.value === config.provider)?.label} account
                </Typography>
                <Typography component="li" variant="body2">
                  Create API credentials with DNS management permissions
                </Typography>
                <Typography component="li" variant="body2">
                  Copy and paste the credentials above
                </Typography>
                <Typography component="li" variant="body2">
                  Test the connection and save
                </Typography>
              </Stack>
              <Box sx={{ mt: 2 }}>
                <Link
                  href={DNS_PROVIDERS.find(p => p.value === config.provider)?.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="body2"
                >
                  View official documentation →
                </Link>
              </Box>
            </Paper>
          </Collapse>
        </Box>
      )}
    </Stack>
  );
}
