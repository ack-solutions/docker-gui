"use client";

import { useState } from "react";
import {
    Box,
    Card,
    CardContent,
    Alert,
    AlertTitle,
    CircularProgress,
    Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import ErrorIcon from "@mui/icons-material/Error";
import StorageBuckets from "@/client/features/storage/components/storage-buckets";
import StorageObjectBrowser from "@/client/features/storage/components/storage-object-browser";
import BucketDetailsPage from "@/client/features/storage/components/bucket-details-page";

interface StorageStatus {
    enabled: boolean;
    connected: boolean;
    endpoint?: string;
    port?: number;
    useSSL?: boolean;
    consoleUrl?: string;
    error?: string;
    s3Config?: {
        endpoint: string;
        region: string;
        forcePathStyle: boolean;
        exampleAwsCli: string;
        exampleNodejs: string;
        examplePython: string;
    };
}

export default function StoragePage() {
    const [view, setView] = useState<'list' | 'browser' | 'details'>('list');
    const [selectedBucket, setSelectedBucket] = useState<string | null>(null);

    const { data: status, isLoading, error } = useQuery<StorageStatus>({
        queryKey: ["storage-status"],
        queryFn: async () => {
            const res = await axios.get("/api/storage/status");
            return res.data;
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    const handleBucketSelect = (bucketName: string) => {
        setSelectedBucket(bucketName);
        setView('browser');
    };

    const handleBucketDetails = (bucketName: string) => {
        setSelectedBucket(bucketName);
        setView('details');
    };

    const handleBackToBuckets = () => {
        setSelectedBucket(null);
        setView('list');
    };

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 300 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !status?.enabled) {
        return (
            <Card>
                <CardContent>
                    <Alert severity="warning">
                        <AlertTitle>MinIO Storage Not Available</AlertTitle>
                        {!status?.enabled ? (
                            <>
                                MinIO storage is not enabled in the configuration. To enable it:
                                <ol style={{ margin: "12px 0", paddingLeft: 20 }}>
                                    <li>Set <code>minio.enabled: true</code> in <code>config.yml</code></li>
                                    <li>Ensure MinIO container is running in docker-compose</li>
                                    <li>Configure the endpoint, access key, and secret key</li>
                                </ol>
                            </>
                        ) : (
                            <Typography>
                                Error connecting to MinIO: {status?.error || "Unknown error"}
                            </Typography>
                        )}
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    if (!status.connected) {
        return (
            <Card>
                <CardContent>
                    <Alert severity="error" icon={<ErrorIcon />}>
                        <AlertTitle>MinIO Connection Failed</AlertTitle>
                        <Typography paragraph>
                            Cannot connect to MinIO at <code>{status.endpoint}:{status.port}</code>
                        </Typography>
                        {status.error && (
                            <Typography variant="body2" color="text.secondary">
                                Error: {status.error}
                            </Typography>
                        )}
                        <Typography variant="body2" sx={{ mt: 2 }}>
                            Make sure the MinIO container is running:
                            <code style={{ display: "block", marginTop: 8 }}>
                                docker-compose up -d minio
                            </code>
                        </Typography>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    return (
        <Box>
            {/* Main Content */}
            {view === 'details' && selectedBucket ? (
                <BucketDetailsPage
                    bucket={selectedBucket}
                    onBack={handleBackToBuckets}
                />
            ) : view === 'browser' && selectedBucket ? (
                <StorageObjectBrowser
                    bucket={selectedBucket}
                    onBack={handleBackToBuckets}
                />
            ) : (
                <StorageBuckets
                    onBucketSelect={handleBucketSelect}
                    onBucketDetails={handleBucketDetails}
                />
            )}
        </Box>
    );
}
