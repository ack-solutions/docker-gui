"use client";

import { useState } from "react";
import {
    Alert,
    AlertTitle,
    Box,
    Button,
    Card,
    CardContent,
    Divider,
    IconButton,
    Stack,
    Tab,
    Tabs,
    Tooltip,
    Typography,
} from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CloudIcon from "@mui/icons-material/Cloud";
import { toast } from "sonner";

interface S3Config {
    endpoint: string;
    region: string;
    forcePathStyle: boolean;
    exampleAwsCli: string;
    exampleNodejs: string;
    examplePython: string;
}

interface StorageConfigHelpProps {
    s3Config?: S3Config;
}

interface CodeBlockProps {
    code: string;
    language?: string;
}

function CodeBlock({ code, language = "bash" }: CodeBlockProps) {
    const handleCopy = () => {
        navigator.clipboard.writeText(code);
        toast.success("Copied to clipboard");
    };

    return (
        <Box sx={{ position: "relative" }}>
            <Box
                component="pre"
                sx={{
                    bgcolor: "grey.900",
                    color: "grey.100",
                    p: 2,
                    borderRadius: 1,
                    overflow: "auto",
                    fontSize: "0.85rem",
                    lineHeight: 1.6,
                    fontFamily: "monospace",
                    m: 0,
                }}
            >
                <code>{code}</code>
            </Box>
            <Tooltip title="Copy to clipboard">
                <IconButton
                    size="small"
                    onClick={handleCopy}
                    sx={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        color: "grey.400",
                        "&:hover": { color: "grey.200" },
                    }}
                >
                    <ContentCopyIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
}

export default function StorageConfigHelp({ s3Config }: StorageConfigHelpProps) {
    const [activeTab, setActiveTab] = useState(0);

    if (!s3Config) {
        return (
            <Alert severity="warning">
                S3 configuration information is not available.
            </Alert>
        );
    }

    return (
        <Box>
            {/* S3 Endpoint Info */}
            <Alert severity="info" icon={<CloudIcon />} sx={{ mb: 3 }}>
                <AlertTitle>S3-Compatible Storage</AlertTitle>
                <Typography variant="body2" paragraph>
                    MinIO provides an S3-compatible API. You can use any S3 SDK or tool (like AWS CLI)
                    to interact with your storage. Simply point your application to the endpoint below.
                </Typography>
                <Stack spacing={1}>
                    <Typography variant="body2">
                        <strong>Endpoint:</strong> <code>{s3Config.endpoint}</code>
                    </Typography>
                    <Typography variant="body2">
                        <strong>Region:</strong> <code>{s3Config.region}</code>
                    </Typography>
                    <Typography variant="body2">
                        <strong>Path Style:</strong> <code>{s3Config.forcePathStyle ? "true (required)" : "false"}</code>
                    </Typography>
                </Stack>
            </Alert>

            {/* Migration Notice */}
            <Alert severity="success" sx={{ mb: 3 }}>
                <AlertTitle>Easy Migration to AWS S3</AlertTitle>
                <Typography variant="body2">
                    When you're ready to move to AWS S3, simply update your endpoint and credentials.
                    Your bucket structure and object paths will work the same way. MinIO is fully
                    compatible with the S3 API, so no code changes are needed beyond configuration.
                </Typography>
            </Alert>

            {/* Code Examples */}
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Configuration Examples
            </Typography>

            <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
                <Tabs
                    value={activeTab}
                    onChange={(_, newValue) => setActiveTab(newValue)}
                    aria-label="code examples"
                >
                    <Tab label="AWS CLI" />
                    <Tab label="Node.js" />
                    <Tab label="Python" />
                </Tabs>
            </Box>

            {activeTab === 0 && (
                <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Use the AWS CLI with the <code>--endpoint-url</code> flag to point to MinIO:
                    </Typography>
                    <CodeBlock code={s3Config.exampleAwsCli} language="bash" />
                </Box>
            )}

            {activeTab === 1 && (
                <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Configure the AWS SDK for JavaScript/TypeScript:
                    </Typography>
                    <CodeBlock code={s3Config.exampleNodejs} language="typescript" />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        <strong>Note:</strong> Install the SDK with: <code>npm install @aws-sdk/client-s3</code>
                    </Typography>
                </Box>
            )}

            {activeTab === 2 && (
                <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Configure Boto3 for Python:
                    </Typography>
                    <CodeBlock code={s3Config.examplePython} language="python" />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                        <strong>Note:</strong> Install Boto3 with: <code>pip install boto3</code>
                    </Typography>
                </Box>
            )}

            <Divider sx={{ my: 3 }} />

            {/* Access Keys Info */}
            <Alert severity="warning">
                <AlertTitle>Access Keys</AlertTitle>
                <Typography variant="body2" paragraph>
                    The examples above use placeholder credentials (<code>YOUR_ACCESS_KEY</code> and <code>YOUR_SECRET_KEY</code>).
                </Typography>
                <Typography variant="body2">
                    For development, you can use the root credentials configured in your environment.
                    For production, create dedicated service accounts via the MinIO Console for better security.
                </Typography>
                <Button
                    size="small"
                    variant="outlined"
                    startIcon={<OpenInNewIcon />}
                    href={s3Config.endpoint.replace(/:\d+$/, ':9001')}
                    target="_blank"
                    sx={{ mt: 1 }}
                >
                    Open MinIO Console
                </Button>
            </Alert>
        </Box>
    );
}
