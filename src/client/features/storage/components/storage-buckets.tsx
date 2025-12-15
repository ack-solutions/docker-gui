"use client";

import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
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
import DeleteIcon from "@mui/icons-material/Delete";
import FolderIcon from "@mui/icons-material/Folder";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useConfirmationDialog } from "@/client/components/common/confirmation-dialog-provider";

interface BucketInfo {
    name: string;
    creationDate?: string;
    objectCount?: number;
    totalSize?: number;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateString?: string): string {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString();
}

interface StorageBucketsProps {
    onBucketSelect?: (bucketName: string) => void;
    onBucketDetails?: (bucketName: string) => void;
}

export default function StorageBuckets({ onBucketSelect, onBucketDetails }: StorageBucketsProps) {
    const queryClient = useQueryClient();
    const { confirm } = useConfirmationDialog();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newBucketName, setNewBucketName] = useState("");
    const [nameError, setNameError] = useState("");

    const { data: buckets, isLoading, refetch } = useQuery<BucketInfo[]>({
        queryKey: ["storage-buckets"],
        queryFn: async () => {
            const res = await axios.get("/api/storage/buckets");
            return res.data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (name: string) => {
            const res = await axios.post("/api/storage/buckets", { name });
            return res.data;
        },
        onSuccess: () => {
            toast.success("Bucket created successfully");
            queryClient.invalidateQueries({ queryKey: ["storage-buckets"] });
            setIsCreateOpen(false);
            setNewBucketName("");
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Failed to create bucket");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (name: string) => {
            await axios.delete(`/api/storage/buckets/${name}`);
        },
        onSuccess: () => {
            toast.success("Bucket deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["storage-buckets"] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Failed to delete bucket");
        },
    });

    const validateBucketName = (name: string): string => {
        if (!name) return "Bucket name is required";
        if (name.length < 3) return "Bucket name must be at least 3 characters";
        if (name.length > 63) return "Bucket name must be at most 63 characters";
        if (!/^[a-z0-9]/.test(name)) return "Must start with a lowercase letter or number";
        if (!/[a-z0-9]$/.test(name)) return "Must end with a lowercase letter or number";
        if (!/^[a-z0-9.-]+$/.test(name)) return "Only lowercase letters, numbers, dots, and hyphens allowed";
        if (/\.\./.test(name)) return "Cannot contain consecutive dots";
        if (/-$/.test(name) || /^-/.test(name)) return "Cannot start or end with a hyphen";
        return "";
    };

    const handleCreateSubmit = () => {
        const error = validateBucketName(newBucketName);
        if (error) {
            setNameError(error);
            return;
        }
        createMutation.mutate(newBucketName);
    };

    const handleDelete = (bucket: BucketInfo) => {
        confirm({
            title: "Delete Bucket",
            message: (
                <>
                    Are you sure you want to delete bucket <strong>{bucket.name}</strong>?
                    <br /><br />
                    <Alert severity="warning">
                        The bucket must be empty before it can be deleted.
                    </Alert>
                </>
            ),
            confirmLabel: "Delete",
            tone: "danger",
        }).then((confirmed) => {
            if (confirmed) {
                deleteMutation.mutate(bucket.name);
            }
        });
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
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                    Buckets ({buckets?.length || 0})
                </Typography>
                <Stack direction="row" spacing={1}>
                    <Button
                        size="small"
                        startIcon={<RefreshIcon />}
                        onClick={() => refetch()}
                    >
                        Refresh
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => setIsCreateOpen(true)}
                    >
                        Create Bucket
                    </Button>
                </Stack>
            </Stack>

            {/* Buckets Table */}
            {buckets && buckets.length > 0 ? (
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell>Created</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {buckets.map((bucket) => (
                                <TableRow
                                    key={bucket.name}
                                    hover
                                    onClick={() => onBucketDetails?.(bucket.name)}
                                    sx={{
                                        cursor: onBucketDetails ? 'pointer' : 'default',
                                        '&:hover': onBucketDetails ? {
                                            bgcolor: 'action.hover',
                                        } : {},
                                    }}
                                >
                                    <TableCell>
                                        <Stack direction="row" alignItems="center" spacing={1.5}>
                                            <FolderIcon color="primary" />
                                            <Box>
                                                <Typography variant="body1" fontWeight={500}>
                                                    {bucket.name}
                                                </Typography>
                                                {bucket.objectCount !== undefined && (
                                                    <Typography variant="caption" color="text.secondary">
                                                        {bucket.objectCount.toLocaleString()} objects
                                                        {bucket.totalSize !== undefined &&
                                                            ` • ${formatBytes(bucket.totalSize)}`}
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        <Typography variant="body2" color="text.secondary">
                                            {formatDate(bucket.creationDate)}
                                        </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                            {onBucketSelect && (
                                                <Tooltip title="Browse files">
                                                    <IconButton
                                                        size="small"
                                                        color="primary"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            onBucketSelect(bucket.name);
                                                        }}
                                                    >
                                                        <FolderOpenIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            <Tooltip title="Delete bucket">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(bucket);
                                                    }}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            ) : (
                <Alert severity="info" icon={<FolderIcon />}>
                    No buckets found. Create your first bucket to get started.
                </Alert>
            )}

            {/* Create Bucket Dialog */}
            <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create New Bucket</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <TextField
                            autoFocus
                            fullWidth
                            label="Bucket Name"
                            value={newBucketName}
                            onChange={(e) => {
                                const value = e.target.value.toLowerCase().replace(/[^a-z0-9.-]/g, "");
                                setNewBucketName(value);
                                setNameError("");
                            }}
                            error={!!nameError}
                            helperText={nameError || "Use lowercase letters, numbers, dots, and hyphens. 3-63 characters."}
                            placeholder="my-bucket-name"
                        />
                        <Alert severity="info" sx={{ mt: 2 }}>
                            <Typography variant="body2">
                                <strong>S3-Compatible Naming Rules:</strong>
                            </Typography>
                            <ul style={{ margin: "8px 0", paddingLeft: 20 }}>
                                <li>Must be 3-63 characters long</li>
                                <li>Only lowercase letters, numbers, dots (.), and hyphens (-)</li>
                                <li>Must start and end with a letter or number</li>
                                <li>Cannot contain consecutive dots or start/end with hyphens</li>
                            </ul>
                        </Alert>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCreateSubmit}
                        disabled={createMutation.isPending || !newBucketName}
                    >
                        {createMutation.isPending ? "Creating..." : "Create Bucket"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
