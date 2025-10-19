"use client";

import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Collapse,
  IconButton,
  Paper,
  Stack,
  Typography,
  Divider,
  Chip,
  Link,
  CircularProgress,
  Skeleton,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import InfoIcon from "@mui/icons-material/Info";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DnsIcon from "@mui/icons-material/Dns";
import PublicIcon from "@mui/icons-material/Public";
import { useServerIp } from "../hooks/use-server-ip";

interface DnsSetupInstructionsProps {
  dnsMode: "managed" | "proxy-only";
  domainName: string;
}

export default function DnsSetupInstructions({
  dnsMode,
  domainName,
}: DnsSetupInstructionsProps) {
  const [showDetailedGuide, setShowDetailedGuide] = useState(false);
  const [copied, setCopied] = useState(false);
  
  // Fetch server IP
  const { data: serverIpData, isLoading: ipLoading } = useServerIp();
  const serverIp = serverIpData?.publicIp || "Loading...";

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (dnsMode === "managed") {
    return (
      <Paper variant="outlined" sx={{ p: 3, bgcolor: "action.hover" }}>
        <Stack spacing={2.5}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <DnsIcon color="primary" fontSize="large" />
            <Box>
              <Typography variant="subtitle1" fontWeight={600}>
                DNS Setup Required
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Point your domain&apos;s nameservers to this server
              </Typography>
            </Box>
          </Stack>

          <Alert severity="info" icon={<InfoIcon />}>
            To use &quot;Manage DNS Here&quot;, you need to delegate your domain&apos;s nameservers to this server.
            This allows us to manage all DNS records for you.
          </Alert>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Step 1: Update Nameservers at Your Registrar
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Go to your domain registrar (GoDaddy, Namecheap, Google Domains, etc.) and change nameservers to:
            </Typography>

            <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontFamily="monospace" color="text.primary">
                    ns1.{domainName}
                  </Typography>
                  <IconButton size="small" onClick={() => handleCopy(`ns1.${domainName}`)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontFamily="monospace" color="text.primary">
                    ns2.{domainName}
                  </Typography>
                  <IconButton size="small" onClick={() => handleCopy(`ns2.${domainName}`)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Paper>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Step 2: Create Glue Records
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Also at your registrar, create these glue records (host records):
            </Typography>

            <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack spacing={0.5}>
                    <Typography variant="body2" fontWeight={500} color="text.primary">
                      ns1.{domainName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Type: A → Value: {ipLoading ? <CircularProgress size={10} /> : serverIp}
                    </Typography>
                  </Stack>
                  <IconButton
                    size="small"
                    onClick={() => handleCopy(`ns1.${domainName} A ${serverIp}`)}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Stack>
                <Divider />
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Stack spacing={0.5}>
                    <Typography variant="body2" fontWeight={500} color="text.primary">
                      ns2.{domainName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Type: A → Value: {ipLoading ? <CircularProgress size={10} /> : serverIp}
                    </Typography>
                  </Stack>
                  <IconButton
                    size="small"
                    onClick={() => handleCopy(`ns2.${domainName} A ${serverIp}`)}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            </Paper>
          </Box>

          <Alert severity="warning">
            <Typography variant="body2">
              DNS propagation takes <strong>24-48 hours</strong>. You can still create this domain,
              but it won&apos;t work until nameservers are updated and propagated.
            </Typography>
          </Alert>

          {copied && (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              Copied to clipboard!
            </Alert>
          )}

          <Box>
            <Button
              variant="text"
              onClick={() => setShowDetailedGuide(!showDetailedGuide)}
              endIcon={showDetailedGuide ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              size="small"
            >
              {showDetailedGuide ? "Hide" : "Show"} Detailed Guide
            </Button>

            <Collapse in={showDetailedGuide}>
              <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: "background.default" }}>
                <Stack spacing={2}>
                  <Typography variant="subtitle2" color="text.primary">
                    Common Registrar Instructions:
                  </Typography>

                  <Box>
                    <Typography variant="caption" fontWeight={600}>
                      GoDaddy:
                    </Typography>
                    <Typography variant="caption" component="ol" sx={{ pl: 2, mt: 0.5 }}>
                      <li>Domain Settings → Manage DNS → Nameservers → Change</li>
                      <li>Select &quot;Custom&quot; and add ns1 and ns2</li>
                      <li>Under DNS Records, add Host Records (A records) for ns1 and ns2</li>
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" fontWeight={600}>
                      Namecheap:
                    </Typography>
                    <Typography variant="caption" component="ol" sx={{ pl: 2, mt: 0.5 }}>
                      <li>Domain List → Manage → Nameservers → Custom DNS</li>
                      <li>Add ns1 and ns2</li>
                      <li>Advanced DNS tab → Add Host Records for ns1 and ns2</li>
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="caption" fontWeight={600}>
                      Google Domains:
                    </Typography>
                    <Typography variant="caption" component="ol" sx={{ pl: 2, mt: 0.5 }}>
                      <li>DNS → Name servers → Custom name servers</li>
                      <li>Add ns1 and ns2</li>
                      <li>Resource records → Add glue records for ns1 and ns2</li>
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Collapse>
          </Box>
        </Stack>
      </Paper>
    );
  }

  // Proxy-only mode
  return (
    <Paper variant="outlined" sx={{ p: 3, bgcolor: "action.hover" }}>
      <Stack spacing={2.5}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <PublicIcon color="warning" fontSize="large" />
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Manual DNS Setup Required
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Create DNS records at your DNS provider
            </Typography>
          </Box>
        </Stack>

        <Alert severity="warning" icon={<InfoIcon />}>
          You need to create DNS records manually at your DNS provider (GoDaddy, Cloudflare, your
          registrar, etc.). This platform will only handle nginx routing.
        </Alert>

        <Divider />

        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Required DNS Records:
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Create these records at your DNS provider:
          </Typography>

          <Paper variant="outlined" sx={{ p: 2, bgcolor: "background.default" }}>
            <Stack spacing={2}>
              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack spacing={0.5} flex={1}>
                    <Chip label="Required" size="small" color="error" />
                    <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }} color="text.primary">
                      Root Domain (A Record)
                    </Typography>
                    <Box sx={{ fontFamily: "monospace", fontSize: "0.875rem", mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Record Type:
                      </Typography>{" "}
                      <Typography component="span" variant="caption" color="text.primary">A</Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        Host:
                      </Typography>{" "}
                      <Typography component="span" variant="caption" color="text.primary">@ (or leave blank)</Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        Value:
                      </Typography>{" "}
                      <Typography component="span" variant="caption" color="text.primary">
                        {ipLoading ? <CircularProgress size={10} /> : serverIp}
                      </Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        TTL:
                      </Typography>{" "}
                      <Typography component="span" variant="caption" color="text.primary">3600</Typography>
                    </Box>
                  </Stack>
                  <IconButton
                    size="small"
                    onClick={() => handleCopy(`${domainName} A ${serverIp}`)}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>

              <Divider />

              <Box>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Stack spacing={0.5} flex={1}>
                    <Chip label="Optional" size="small" />
                    <Typography variant="body2" fontWeight={600} sx={{ mt: 1 }} color="text.primary">
                      www Subdomain (CNAME Record)
                    </Typography>
                    <Box sx={{ fontFamily: "monospace", fontSize: "0.875rem", mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Record Type:
                      </Typography>{" "}
                      <Typography component="span" variant="caption" color="text.primary">CNAME</Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        Host:
                      </Typography>{" "}
                      <Typography component="span" variant="caption" color="text.primary">www</Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        Value:
                      </Typography>{" "}
                      <Typography component="span" variant="caption" color="text.primary">{domainName}</Typography>
                      <br />
                      <Typography variant="caption" color="text.secondary">
                        TTL:
                      </Typography>{" "}
                      <Typography component="span" variant="caption" color="text.primary">3600</Typography>
                    </Box>
                  </Stack>
                  <IconButton
                    size="small"
                    onClick={() => handleCopy(`www.${domainName} CNAME ${domainName}`)}
                  >
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </Box>

        <Alert severity="info">
          <Typography variant="body2">
            DNS propagation typically takes <strong>5-30 minutes</strong>. Test with{" "}
            <code>dig {domainName}</code> to verify.
          </Typography>
        </Alert>

        {copied && (
          <Alert severity="success" icon={<CheckCircleIcon />}>
            Copied to clipboard!
          </Alert>
        )}

        <Box>
          <Button
            variant="text"
            onClick={() => setShowDetailedGuide(!showDetailedGuide)}
            endIcon={showDetailedGuide ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            size="small"
          >
            {showDetailedGuide ? "Hide" : "Show"} Provider-Specific Instructions
          </Button>

          <Collapse in={showDetailedGuide}>
            <Paper variant="outlined" sx={{ p: 2, mt: 1, bgcolor: "background.default" }}>
              <Stack spacing={2}>
                <Typography variant="subtitle2" color="text.primary">Common DNS Providers:</Typography>

                <Box>
                  <Typography variant="caption" fontWeight={600}>
                    GoDaddy:
                  </Typography>
                    <Typography variant="caption" component="div" sx={{ pl: 2, mt: 0.5 }}>
                    1. My Products → DNS
                    <br />
                    2. Click &quot;Add&quot; under Records
                    <br />
                    3. Type: A, Name: @, Value: {ipLoading ? "..." : serverIp}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" fontWeight={600}>
                    Cloudflare:
                  </Typography>
                    <Typography variant="caption" component="div" sx={{ pl: 2, mt: 0.5 }}>
                    1. Select domain → DNS tab
                    <br />
                    2. Add record: Type A, Name: @, IPv4: {ipLoading ? "..." : serverIp}
                    <br />
                    3. Turn OFF orange cloud (DNS only mode)
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" fontWeight={600}>
                    AWS Route53:
                  </Typography>
                    <Typography variant="caption" component="div" sx={{ pl: 2, mt: 0.5 }}>
                    1. Route53 → Hosted zones → Your domain
                    <br />
                    2. Create record: Leave name blank, Type A, Value: {ipLoading ? "..." : serverIp}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Collapse>
        </Box>
      </Stack>
    </Paper>
  );
}

