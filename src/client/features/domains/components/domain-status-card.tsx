"use client";

import { useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Divider,
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
  Alert,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import WarningIcon from "@mui/icons-material/Warning";
import PendingIcon from "@mui/icons-material/Pending";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import DnsIcon from "@mui/icons-material/Dns";
import HttpIcon from "@mui/icons-material/Http";
import LockIcon from "@mui/icons-material/Lock";
import SettingsIcon from "@mui/icons-material/Settings";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

interface DomainStatusCardProps {
  domainId: string;
  domainName: string;
  dnsMode: "managed" | "third-party" | "proxy-only";
  status: "active" | "pending" | "error" | "dns-pending";
  lastChecked?: Date;
  onTest?: () => Promise<void>;
}

interface TestResult {
  dns: {
    status: "pass" | "fail" | "pending";
    message: string;
    resolvedIp?: string;
  };
  http: {
    status: "pass" | "fail" | "pending" | "not-tested";
    message: string;
    statusCode?: number;
  };
  https: {
    status: "pass" | "fail" | "pending" | "not-tested";
    message: string;
    statusCode?: number;
    sslValid?: boolean;
  };
  nginx: {
    status: "pass" | "fail" | "pending";
    message: string;
  };
}

export default function DomainStatusCard({
  domainId,
  domainName,
  dnsMode,
  status,
  lastChecked,
  onTest,
}: DomainStatusCardProps) {
  const [testing, setTesting] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [testResults, setTestResults] = useState<TestResult | null>(null);

  const getStatusInfo = () => {
    switch (status) {
      case "active":
        return {
          color: "success" as const,
          icon: <CheckCircleIcon />,
          label: "Active",
          description: "Domain is working",
        };
      case "pending":
        return {
          color: "warning" as const,
          icon: <PendingIcon />,
          label: "Pending",
          description: "Configuration in progress",
        };
      case "dns-pending":
        return {
          color: "info" as const,
          icon: <WarningIcon />,
          label: "DNS Pending",
          description: "Waiting for DNS propagation",
        };
      case "error":
        return {
          color: "error" as const,
          icon: <ErrorIcon />,
          label: "Error",
          description: "Domain has issues",
        };
      default:
        return {
          color: "default" as const,
          icon: <PendingIcon />,
          label: "Unknown",
          description: "Status unknown",
        };
    }
  };

  const getDnsModeLabel = () => {
    switch (dnsMode) {
      case "managed":
        return "Manage DNS Here (PowerDNS)";
      case "third-party":
        return "External Provider";
      case "proxy-only":
        return "Proxy Only (Manual DNS)";
      default:
        return dnsMode;
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setShowDetails(true);

    try {
      // Initialize with pending status
      setTestResults({
        dns: { status: "pending", message: "Checking DNS..." },
        http: { status: "pending", message: "Checking HTTP..." },
        https: { status: "pending", message: "Checking HTTPS..." },
        nginx: { status: "pending", message: "Checking nginx..." },
      });

      // Call the test API
      const response = await fetch(`/api/domains/${domainId}/test`);
      const results = await response.json();

      setTestResults(results);

      if (onTest) {
        await onTest();
      }
    } catch (error) {
      setTestResults({
        dns: { status: "fail", message: "Test failed" },
        http: { status: "fail", message: "Test failed" },
        https: { status: "fail", message: "Test failed" },
        nginx: { status: "fail", message: "Test failed" },
      });
    } finally {
      setTesting(false);
    }
  };

  const statusInfo = getStatusInfo();

  const getTestStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircleIcon color="success" fontSize="small" />;
      case "fail":
        return <ErrorIcon color="error" fontSize="small" />;
      case "pending":
        return <CircularProgress size={16} />;
      case "not-tested":
        return <PendingIcon color="disabled" fontSize="small" />;
      default:
        return null;
    }
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Stack spacing={0.5} flex={1}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Typography variant="h6" component="div">
                  {domainName}
                </Typography>
                <Chip
                  icon={statusInfo.icon}
                  label={statusInfo.label}
                  color={statusInfo.color}
                  size="small"
                />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {getDnsModeLabel()}
              </Typography>
            </Stack>

            <Stack direction="row" spacing={1}>
              <Tooltip title="Test domain">
                <IconButton
                  size="small"
                  onClick={handleTest}
                  disabled={testing}
                  color="primary"
                >
                  {testing ? <CircularProgress size={20} /> : <RefreshIcon />}
                </IconButton>
              </Tooltip>
              <Tooltip title="View details">
                <IconButton
                  size="small"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Tooltip>
            </Stack>
          </Stack>

          {/* Quick Actions */}
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<OpenInNewIcon />}
              href={`http://${domainName}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={handleTest}
              disabled={testing}
            >
              Test
            </Button>
          </Stack>

          {/* Detailed Status */}
          <Collapse in={showDetails}>
            <Stack spacing={2}>
              <Divider />

              {/* Last Checked */}
              {lastChecked && (
                <Typography variant="caption" color="text.secondary">
                  Last checked: {new Date(lastChecked).toLocaleString()}
                </Typography>
              )}

              {/* Test Results */}
              {testResults && (
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2" fontWeight={600}>
                    Test Results:
                  </Typography>

                  {/* DNS Test */}
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                    sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}
                  >
                    <DnsIcon fontSize="small" color="action" />
                    <Box flex={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={500}>
                          DNS Resolution
                        </Typography>
                        {getTestStatusIcon(testResults.dns.status)}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {testResults.dns.message}
                      </Typography>
                      {testResults.dns.resolvedIp && (
                        <Typography
                          variant="caption"
                          fontFamily="monospace"
                          color="text.secondary"
                          display="block"
                        >
                          IP: {testResults.dns.resolvedIp}
                        </Typography>
                      )}
                    </Box>
                  </Stack>

                  {/* HTTP Test */}
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                    sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}
                  >
                    <HttpIcon fontSize="small" color="action" />
                    <Box flex={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={500}>
                          HTTP Connectivity
                        </Typography>
                        {getTestStatusIcon(testResults.http.status)}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {testResults.http.message}
                      </Typography>
                      {testResults.http.statusCode && (
                        <Typography
                          variant="caption"
                          fontFamily="monospace"
                          color="text.secondary"
                          display="block"
                        >
                          Status: {testResults.http.statusCode}
                        </Typography>
                      )}
                    </Box>
                  </Stack>

                  {/* HTTPS Test */}
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                    sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}
                  >
                    <LockIcon fontSize="small" color="action" />
                    <Box flex={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={500}>
                          HTTPS / SSL
                        </Typography>
                        {getTestStatusIcon(testResults.https.status)}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {testResults.https.message}
                      </Typography>
                      {testResults.https.sslValid !== undefined && (
                        <Chip
                          label={testResults.https.sslValid ? "SSL Valid" : "SSL Invalid"}
                          size="small"
                          color={testResults.https.sslValid ? "success" : "error"}
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    </Box>
                  </Stack>

                  {/* Nginx Test */}
                  <Stack
                    direction="row"
                    spacing={1.5}
                    alignItems="flex-start"
                    sx={{ p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}
                  >
                    <SettingsIcon fontSize="small" color="action" />
                    <Box flex={1}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={500}>
                          Nginx Configuration
                        </Typography>
                        {getTestStatusIcon(testResults.nginx.status)}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {testResults.nginx.message}
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>
              )}

              {/* DNS Mode Specific Info */}
              {dnsMode === "managed" && status === "dns-pending" && (
                <Alert severity="info">
                  <Typography variant="body2">
                    <strong>Waiting for nameserver delegation</strong>
                    <br />
                    Nameservers must be pointed to this server. This can take 24-48 hours to
                    propagate.
                  </Typography>
                </Alert>
              )}

              {dnsMode === "proxy-only" && status === "dns-pending" && (
                <Alert severity="warning">
                  <Typography variant="body2">
                    <strong>DNS not configured</strong>
                    <br />
                    Create DNS records at your DNS provider to point to this server.
                  </Typography>
                </Alert>
              )}

              {status === "error" && (
                <Alert severity="error">
                  <Typography variant="body2">
                    <strong>Domain has errors</strong>
                    <br />
                    Check the test results above for details on what&apos;s failing.
                  </Typography>
                </Alert>
              )}

              {/* Troubleshooting Links */}
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Troubleshooting:{" "}
                  <Link href="#" underline="hover" fontSize="inherit">
                    DNS Guide
                  </Link>
                  {" · "}
                  <Link href="#" underline="hover" fontSize="inherit">
                    SSL Issues
                  </Link>
                  {" · "}
                  <Link href="#" underline="hover" fontSize="inherit">
                    View Logs
                  </Link>
                </Typography>
              </Box>
            </Stack>
          </Collapse>
        </Stack>
      </CardContent>
    </Card>
  );
}

