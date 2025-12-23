"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
    Alert,
    Box,
    Button,
    Card,
    CircularProgress,
    Grid,
    Paper,
    Stack,
    Typography,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import StorageIcon from "@mui/icons-material/Storage";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import PolicyIcon from "@mui/icons-material/Policy";
import HistoryIcon from "@mui/icons-material/History";

interface BucketOverviewProps {
    bucket: string;
}

interface BucketDetails {
    name: string;
    creationDate: string;
    objectCount: number;
    totalSize: number;
    policy?: string;
    versioning: boolean;
    tags?: Record<string, string>;
}

function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function BucketOverview({ bucket }: BucketOverviewProps) {
    const { data: details, isLoading, error } = useQuery<BucketDetails>({
        queryKey: ["bucket-details", bucket],
        queryFn: async () => {
            const res = await axios.get(`/api/storage/buckets/${bucket}/details`);
            return res.data;
        },
    });

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !details) {
        return (
            <Alert severity="error">
                Failed to load bucket details. Please try again.
            </Alert>
        );
    }

    const stats = [
        {
            label: "Objects",
            value: details.objectCount?.toLocaleString() || "0",
            icon: <InsertDriveFileIcon />,
            color: "primary.main",
        },
        {
            label: "Total Size",
            value: formatBytes(details.totalSize || 0),
            icon: <StorageIcon />,
            color: "success.main",
        },
        {
            label: "Created",
            value: new Date(details.creationDate).toLocaleDateString(),
            icon: <CalendarTodayIcon />,
            color: "info.main",
        },
        {
            label: "Versioning",
            value: details.versioning ? "Enabled" : "Disabled",
            icon: <HistoryIcon />,
            color: details.versioning ? "success.main" : "text.secondary",
        },
    ];

    return (
        <Box>
            {/* Statistics Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                {stats.map((stat, index) => (
                    <Grid size={{ xs: 12, sm: 6, md: 3 }} key={index}>
                        <Paper
                            elevation={0}
                            sx={{
                                p: 3,
                                border: 1,
                                borderColor: "divider",
                                borderRadius: 2,
                            }}
                        >
                            <Stack spacing={2}>
                                <Box
                                    sx={{
                                        color: stat.color,
                                        display: "flex",
                                        alignItems: "center",
                                    }}
                                >
                                    {stat.icon}
                                </Box>
                                <Box>
                                    <Typography variant="h4" fontWeight={600}>
                                        {stat.value}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {stat.label}
                                    </Typography>
                                </Box>
                            </Stack>
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            {/* Bucket Information */}
            <Card variant="outlined" sx={{ mb: 3 }}>
                <Box sx={{ p: 2, bgcolor: "action.hover", borderBottom: 1, borderColor: "divider" }}>
                    <Typography variant="h6" fontWeight={600}>
                        Bucket Information
                    </Typography>
                </Box>
                <Box sx={{ p: 3 }}>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Bucket Name
                            </Typography>
                            <Typography variant="body1" fontWeight={500}>
                                {details.name}
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Creation Date
                            </Typography>
                            <Typography variant="body1" fontWeight={500}>
                                {new Date(details.creationDate).toLocaleString()}
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Policy Status
                            </Typography>
                            <Typography variant="body1" fontWeight={500}>
                                {details.policy ? "Custom Policy Applied" : "No Policy"}
                            </Typography>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Versioning
                            </Typography>
                            <Typography variant="body1" fontWeight={500}>
                                {details.versioning ? "Enabled" : "Disabled"}
                            </Typography>
                        </Grid>
                    </Grid>
                </Box>
            </Card>

            {/* Tags */}
            {details.tags && Object.keys(details.tags).length > 0 && (
                <Card variant="outlined">
                    <Box sx={{ p: 2, bgcolor: "action.hover", borderBottom: 1, borderColor: "divider" }}>
                        <Typography variant="h6" fontWeight={600}>
                            Tags
                        </Typography>
                    </Box>
                    <Box sx={{ p: 3 }}>
                        <Grid container spacing={2}>
                            {Object.entries(details.tags).map(([key, value]) => (
                                <Grid size={{ xs: 12, sm: 6 }} key={key}>
                                    <Paper variant="outlined" sx={{ p: 2 }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {key}
                                        </Typography>
                                        <Typography variant="body2" fontWeight={500}>
                                            {value}
                                        </Typography>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>
                    </Box>
                </Card>
            )}
        </Box>
    );
}
