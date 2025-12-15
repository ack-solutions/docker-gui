"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    Stack,
    Divider,
    IconButton,
    Tooltip,
    Alert,
    CircularProgress,
    Table,
    TableBody,
    TableRow,
    TableCell,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import ImageIcon from "@mui/icons-material/Image";
import axios from "axios";
import { toast } from "sonner";

interface FileInfoDialogProps {
    open: boolean;
    onClose: () => void;
    bucket: string;
    objectName: string;
    prefix?: string;
}

interface ObjectMetadata {
    size: number;
    etag: string;
    lastModified: string;
    contentType?: string;
    metadata?: Record<string, string>;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleString();
}

function isImageFile(name: string): boolean {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ["jpg", "jpeg", "png", "gif", "webp", "svg", "ico"].includes(ext);
}

function isTextFile(name: string): boolean {
    const ext = name.split(".").pop()?.toLowerCase() || "";
    return ["txt", "md", "json", "html", "css", "js", "ts", "xml", "log", "csv"].includes(ext);
}

export default function FileInfoDialog({
    open,
    onClose,
    bucket,
    objectName,
    prefix = "",
}: FileInfoDialogProps) {
    const [metadata, setMetadata] = useState<ObjectMetadata | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const fullPath = prefix + objectName;
    const s3Path = `s3://${bucket}/${fullPath}`;

    useEffect(() => {
        if (open) {
            fetchMetadata();
            if (isImageFile(objectName)) {
                fetchPreview();
            }
        } else {
            // Reset state when dialog closes
            setMetadata(null);
            setPreviewUrl(null);
            setError(null);
        }
    }, [open, bucket, fullPath]);

    const fetchMetadata = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                bucket,
                objectName: fullPath,
            });
            const res = await axios.get(`/api/storage/metadata?${params}`);
            setMetadata(res.data);
        } catch (err: any) {
            setError(err.response?.data?.error || "Failed to load metadata");
        } finally {
            setIsLoading(false);
        }
    };

    const fetchPreview = async () => {
        try {
            const res = await axios.post("/api/storage/objects", {
                action: "download",
                bucket,
                objectName: fullPath,
            });
            setPreviewUrl(res.data.url);
        } catch (err) {
            console.error("Failed to load preview:", err);
        }
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1}>
                        {isImageFile(objectName) ? (
                            <ImageIcon color="primary" />
                        ) : (
                            <InsertDriveFileIcon color="action" />
                        )}
                        <Typography variant="h6">File Information</Typography>
                    </Stack>
                    <IconButton onClick={onClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent dividers>
                {isLoading && (
                    <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                        <CircularProgress />
                    </Box>
                )}

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {!isLoading && metadata && (
                    <Stack spacing={3}>
                        {/* File Name */}
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                File Name
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography variant="body1" sx={{ wordBreak: "break-all" }}>
                                    {objectName}
                                </Typography>
                                <Tooltip title="Copy name">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleCopy(objectName, "File name")}
                                    >
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Box>

                        {/* Preview */}
                        {previewUrl && isImageFile(objectName) && (
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                    Preview
                                </Typography>
                                <Box
                                    sx={{
                                        border: 1,
                                        borderColor: "divider",
                                        borderRadius: 1,
                                        p: 2,
                                        bgcolor: "action.hover",
                                        display: "flex",
                                        justifyContent: "center",
                                    }}
                                >
                                    <img
                                        src={previewUrl}
                                        alt={objectName}
                                        style={{
                                            maxWidth: "100%",
                                            maxHeight: "300px",
                                            objectFit: "contain",
                                        }}
                                    />
                                </Box>
                            </Box>
                        )}

                        <Divider />

                        {/* Properties Table */}
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Properties
                            </Typography>
                            <Table size="small">
                                <TableBody>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 500, width: "40%" }}>
                                            Size
                                        </TableCell>
                                        <TableCell>{formatBytes(metadata.size)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 500 }}>Type</TableCell>
                                        <TableCell>
                                            {metadata.contentType || "application/octet-stream"}
                                        </TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 500 }}>Last Modified</TableCell>
                                        <TableCell>{formatDate(metadata.lastModified)}</TableCell>
                                    </TableRow>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 500 }}>ETag</TableCell>
                                        <TableCell>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontFamily: "monospace",
                                                        fontSize: "0.85rem",
                                                    }}
                                                >
                                                    {metadata.etag}
                                                </Typography>
                                                <Tooltip title="Copy ETag">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            handleCopy(metadata.etag, "ETag")
                                                        }
                                                    >
                                                        <ContentCopyIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </Box>

                        <Divider />

                        {/* S3 Path */}
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                S3 Path
                            </Typography>
                            <Stack direction="row" alignItems="center" spacing={1}>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontFamily: "monospace",
                                        bgcolor: "action.hover",
                                        p: 1,
                                        borderRadius: 1,
                                        flex: 1,
                                        wordBreak: "break-all",
                                    }}
                                >
                                    {s3Path}
                                </Typography>
                                <Tooltip title="Copy S3 path">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleCopy(s3Path, "S3 path")}
                                    >
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Box>

                        {/* Bucket */}
                        <Box>
                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                Bucket
                            </Typography>
                            <Typography variant="body2">{bucket}</Typography>
                        </Box>

                        {/* Additional Metadata */}
                        {metadata.metadata && Object.keys(metadata.metadata).length > 0 && (
                            <>
                                <Divider />
                                <Box>
                                    <Typography
                                        variant="subtitle2"
                                        color="text.secondary"
                                        gutterBottom
                                    >
                                        Additional Metadata
                                    </Typography>
                                    <Table size="small">
                                        <TableBody>
                                            {Object.entries(metadata.metadata)
                                                .filter(([key]) => key !== "content-type")
                                                .map(([key, value]) => (
                                                    <TableRow key={key}>
                                                        <TableCell sx={{ fontWeight: 500, width: "40%" }}>
                                                            {key}
                                                        </TableCell>
                                                        <TableCell>{value}</TableCell>
                                                    </TableRow>
                                                ))}
                                        </TableBody>
                                    </Table>
                                </Box>
                            </>
                        )}
                    </Stack>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
