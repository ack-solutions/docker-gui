"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
    Alert,
    Box,
    Button,
    Card,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import KeyIcon from "@mui/icons-material/Key";
import WarningIcon from "@mui/icons-material/Warning";
import InfoIcon from "@mui/icons-material/Info";
import { toast } from "sonner";

interface BucketAccessKeysProps {
    bucket: string;
}

interface ServiceAccount {
    accessKey: string;
    description?: string;
    policy?: string;
    createdAt?: Date;
}

const ACCESS_TEMPLATES = [
    { value: "readonly", label: "Read-Only Access" },
    { value: "readwrite", label: "Read-Write Access" },
    { value: "admin", label: "Full Admin Access" },
];

export default function BucketAccessKeys({ bucket }: BucketAccessKeysProps) {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [accountName, setAccountName] = useState("");
    const [accessTemplate, setAccessTemplate] = useState("readonly");
    const [createdCredentials, setCreatedCredentials] = useState<{
        accessKey: string;
        secretKey: string;
    } | null>(null);

    const { data: accounts, isLoading } = useQuery<ServiceAccount[]>({
        queryKey: ["service-accounts"],
        queryFn: async () => {
            const res = await axios.get("/api/storage/service-accounts");
            return res.data;
        },
    });

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    const handleCreateClick = () => {
        setIsCreateDialogOpen(true);
        setCreatedCredentials(null);
    };

    const handleCloseDialog = () => {
        setIsCreateDialogOpen(false);
        setAccountName("");
        setAccessTemplate("readonly");
        setCreatedCredentials(null);
    };

    const handleCreate = async () => {
        try {
            const res = await axios.post("/api/storage/service-accounts", {
                name: accountName,
                bucket,
                access: accessTemplate,
            });
            setCreatedCredentials(res.data);
            toast.success("Service account created successfully");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to create service account");
        }
    };

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
                <Typography variant="h6" fontWeight={600}>
                    Access Keys (Service Accounts)
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreateClick}
                >
                    Create Access Key
                </Button>
            </Stack>

            {/* Information Alert */}
            <Alert severity="info" icon={<InfoIcon />} sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight={500} gutterBottom>
                    About Service Accounts
                </Typography>
                <Typography variant="body2">
                    MinIO uses service accounts for access key management. Service accounts require
                    MinIO Admin API access. If you see an error, please create service accounts using
                    the MinIO Console or mc (MinIO Client) command-line tool.
                </Typography>
            </Alert>

            {/* Service Accounts List */}
            {accounts && accounts.length > 0 ? (
                <Card variant="outlined">
                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Access Key</TableCell>
                                    <TableCell>Description</TableCell>
                                    <TableCell>Created</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {accounts.map((account) => (
                                    <TableRow key={account.accessKey} hover>
                                        <TableCell>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <KeyIcon fontSize="small" color="action" />
                                                <Typography
                                                    variant="body2"
                                                    sx={{ fontFamily: "monospace" }}
                                                >
                                                    {account.accessKey}
                                                </Typography>
                                            </Stack>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2">
                                                {account.description || "—"}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {account.createdAt
                                                    ? new Date(account.createdAt).toLocaleDateString()
                                                    : "—"}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="Copy access key">
                                                <IconButton
                                                    size="small"
                                                    onClick={() =>
                                                        handleCopy(account.accessKey, "Access key")
                                                    }
                                                >
                                                    <ContentCopyIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Card>
            ) : (
                <Alert severity="info">
                    No service accounts found. Create an access key to get started.
                </Alert>
            )}

            {/* Create Service Account Dialog */}
            <Dialog open={isCreateDialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
                <DialogTitle>Create Access Key</DialogTitle>
                <DialogContent>
                    {!createdCredentials ? (
                        <Stack spacing={3} sx={{ pt: 1 }}>
                            <TextField
                                fullWidth
                                label="Account Name"
                                value={accountName}
                                onChange={(e) => setAccountName(e.target.value)}
                                placeholder="my-app-access"
                                helperText="A descriptive name for this access key"
                            />

                            <FormControl fullWidth>
                                <InputLabel>Access Level</InputLabel>
                                <Select
                                    value={accessTemplate}
                                    label="Access Level"
                                    onChange={(e) => setAccessTemplate(e.target.value)}
                                >
                                    {ACCESS_TEMPLATES.map((template) => (
                                        <MenuItem key={template.value} value={template.value}>
                                            {template.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <Alert severity="info">
                                {accessTemplate === "readonly" &&
                                    `Read-only access to ${bucket} bucket`}
                                {accessTemplate === "readwrite" &&
                                    `Full read-write access to ${bucket} bucket`}
                                {accessTemplate === "admin" && "Full administrative access to all buckets"}
                            </Alert>
                        </Stack>
                    ) : (
                        <Stack spacing={3} sx={{ pt: 1 }}>
                            <Alert severity="warning" icon={<WarningIcon />}>
                                <Typography variant="body2" fontWeight={500} gutterBottom>
                                    Save these credentials now!
                                </Typography>
                                <Typography variant="body2">
                                    The secret key will only be shown once and cannot be retrieved later.
                                </Typography>
                            </Alert>

                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom>
                                    Access Key
                                </Typography>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography
                                        variant="body2"
                                        sx={{ fontFamily: "monospace", flex: 1 }}
                                    >
                                        {createdCredentials.accessKey}
                                    </Typography>
                                    <Tooltip title="Copy access key">
                                        <IconButton
                                            size="small"
                                            onClick={() =>
                                                handleCopy(createdCredentials.accessKey, "Access key")
                                            }
                                        >
                                            <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Paper>

                            <Paper variant="outlined" sx={{ p: 2, bgcolor: "warning.lighter" }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom>
                                    Secret Key (Save this now!)
                                </Typography>
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            fontFamily: "monospace",
                                            flex: 1,
                                            wordBreak: "break-all",
                                        }}
                                    >
                                        {createdCredentials.secretKey}
                                    </Typography>
                                    <Tooltip title="Copy secret key">
                                        <IconButton
                                            size="small"
                                            onClick={() =>
                                                handleCopy(createdCredentials.secretKey, "Secret key")
                                            }
                                        >
                                            <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Paper>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>
                        {createdCredentials ? "Close" : "Cancel"}
                    </Button>
                    {!createdCredentials && (
                        <Button
                            variant="contained"
                            onClick={handleCreate}
                            disabled={!accountName}
                        >
                            Create
                        </Button>
                    )}
                </DialogActions>
            </Dialog>
        </Box>
    );
}
