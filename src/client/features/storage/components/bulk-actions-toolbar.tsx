"use client";

import {
    Box,
    Button,
    Chip,
    IconButton,
    Paper,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import DriveFileMoveIcon from "@mui/icons-material/DriveFileMove";
import CloseIcon from "@mui/icons-material/Close";

interface BulkActionsToolbarProps {
    selectedCount: number;
    onDelete: () => void;
    onDownload: () => void;
    onClear: () => void;
    isProcessing?: boolean;
}

export default function BulkActionsToolbar({
    selectedCount,
    onDelete,
    onDownload,
    onClear,
    isProcessing = false,
}: BulkActionsToolbarProps) {
    return (
        <Paper
            elevation={3}
            sx={{
                position: "fixed",
                bottom: 24,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 1000,
                px: 3,
                py: 1.5,
                borderRadius: 2,
            }}
        >
            <Stack direction="row" alignItems="center" spacing={2}>
                <Chip
                    label={`${selectedCount} selected`}
                    color="primary"
                    size="small"
                />
                <Stack direction="row" spacing={1}>
                    <Tooltip title="Download selected">
                        <span>
                            <Button
                                size="small"
                                startIcon={<DownloadIcon />}
                                onClick={onDownload}
                                disabled={isProcessing}
                            >
                                Download
                            </Button>
                        </span>
                    </Tooltip>
                    <Tooltip title="Delete selected">
                        <span>
                            <Button
                                size="small"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={onDelete}
                                disabled={isProcessing}
                            >
                                Delete
                            </Button>
                        </span>
                    </Tooltip>
                </Stack>
                <Tooltip title="Clear selection">
                    <IconButton size="small" onClick={onClear}>
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>
        </Paper>
    );
}
