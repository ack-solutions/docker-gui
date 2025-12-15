"use client";

import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ShareIcon from "@mui/icons-material/Share";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";

interface ShareDialogProps {
    open: boolean;
    onClose: () => void;
    bucket: string;
    objectName: string;
    prefix?: string;
}

const EXPIRY_PRESETS = [
    { label: "1 Hour", value: 3600 },
    { label: "24 Hours", value: 86400 },
    { label: "7 Days", value: 604800 },
    { label: "Custom", value: 0 },
];

export default function ShareDialog({
    open,
    onClose,
    bucket,
    objectName,
    prefix = "",
}: ShareDialogProps) {
    const [expiryPreset, setExpiryPreset] = useState(3600);
    const [customExpiry, setCustomExpiry] = useState(3600);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [showQR, setShowQR] = useState(false);

    const fullPath = prefix + objectName;

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            const expirySeconds = expiryPreset === 0 ? customExpiry : expiryPreset;
            const res = await axios.post("/api/storage/objects", {
                action: "download",
                bucket,
                objectName: fullPath,
            });
            setShareUrl(res.data.url);
            toast.success("Share link generated");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to generate link");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopy = () => {
        if (shareUrl) {
            navigator.clipboard.writeText(shareUrl);
            toast.success("Link copied to clipboard");
        }
    };

    const handleClose = () => {
        setShareUrl(null);
        setShowQR(false);
        setExpiryPreset(3600);
        onClose();
    };

    const expiryTime = expiryPreset === 0 ? customExpiry : expiryPreset;
    const expiryDate = new Date(Date.now() + expiryTime * 1000);

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <ShareIcon color="primary" />
                        <Typography variant="h6">Share File</Typography>
                    </Stack>
                    <IconButton onClick={handleClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Stack>
            </DialogTitle>

            <DialogContent dividers>
                <Stack spacing={3}>
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                            File
                        </Typography>
                        <Typography variant="body2">{objectName}</Typography>
                    </Box>

                    <FormControl fullWidth>
                        <InputLabel>Link Expiry</InputLabel>
                        <Select
                            value={expiryPreset}
                            label="Link Expiry"
                            onChange={(e) => setExpiryPreset(Number(e.target.value))}
                        >
                            {EXPIRY_PRESETS.map((preset) => (
                                <MenuItem key={preset.value} value={preset.value}>
                                    {preset.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {expiryPreset === 0 && (
                        <TextField
                            fullWidth
                            type="number"
                            label="Custom Expiry (seconds)"
                            value={customExpiry}
                            onChange={(e) => setCustomExpiry(Number(e.target.value))}
                            helperText="Maximum: 604800 seconds (7 days)"
                            inputProps={{ min: 60, max: 604800 }}
                        />
                    )}

                    <Box>
                        <Typography variant="caption" color="text.secondary">
                            Link will expire on: {expiryDate.toLocaleString()}
                        </Typography>
                    </Box>

                    {!shareUrl ? (
                        <Button
                            variant="contained"
                            fullWidth
                            onClick={handleGenerate}
                            disabled={isGenerating}
                        >
                            {isGenerating ? "Generating..." : "Generate Share Link"}
                        </Button>
                    ) : (
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="subtitle2" gutterBottom>
                                    Share Link
                                </Typography>
                                <TextField
                                    fullWidth
                                    value={shareUrl}
                                    InputProps={{
                                        readOnly: true,
                                        endAdornment: (
                                            <Tooltip title="Copy link">
                                                <IconButton onClick={handleCopy} edge="end">
                                                    <ContentCopyIcon />
                                                </IconButton>
                                            </Tooltip>
                                        ),
                                    }}
                                    sx={{
                                        "& .MuiInputBase-input": {
                                            fontFamily: "monospace",
                                            fontSize: "0.85rem",
                                        },
                                    }}
                                />
                            </Box>

                            <Button
                                variant="outlined"
                                startIcon={<QrCode2Icon />}
                                onClick={() => setShowQR(!showQR)}
                            >
                                {showQR ? "Hide" : "Show"} QR Code
                            </Button>

                            {showQR && (
                                <Box
                                    sx={{
                                        display: "flex",
                                        justifyContent: "center",
                                        p: 2,
                                        bgcolor: "white",
                                        borderRadius: 1,
                                    }}
                                >
                                    <img
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                                            shareUrl
                                        )}`}
                                        alt="QR Code"
                                        style={{ width: 200, height: 200 }}
                                    />
                                </Box>
                            )}
                        </Stack>
                    )}
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}
