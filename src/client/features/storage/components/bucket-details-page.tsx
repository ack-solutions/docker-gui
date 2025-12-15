"use client";

import { useState } from "react";
import {
    Box,
    Card,
    CardContent,
    Tab,
    Tabs,
    Typography,
    Button,
    Stack,
    Chip,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import FolderIcon from "@mui/icons-material/Folder";
import BucketOverview from "./bucket-overview";
import BucketSettings from "./bucket-settings";
import BucketAccessKeys from "./bucket-access-keys";
import StorageObjectBrowser from "./storage-object-browser";

interface BucketDetailsPageProps {
    bucket: string;
    onBack: () => void;
}

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`bucket-tabpanel-${index}`}
            aria-labelledby={`bucket-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
        </div>
    );
}

export default function BucketDetailsPage({ bucket, onBack }: BucketDetailsPageProps) {
    const [activeTab, setActiveTab] = useState(0);

    const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
    };

    return (
        <Box>
            {/* Header */}
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
                <Button startIcon={<ArrowBackIcon />} onClick={onBack}>
                    Back to Buckets
                </Button>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <FolderIcon color="primary" sx={{ fontSize: 32 }} />
                    <Typography variant="h5" fontWeight={600}>
                        {bucket}
                    </Typography>
                </Stack>
                <Chip label="Bucket Details" size="small" variant="outlined" />
            </Stack>

            {/* Tabs */}
            <Card>
                <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                    <Tabs
                        value={activeTab}
                        onChange={handleTabChange}
                        aria-label="bucket details tabs"
                    >
                        <Tab label="Overview" id="bucket-tab-0" />
                        <Tab label="Objects" id="bucket-tab-1" />
                        <Tab label="Settings" id="bucket-tab-2" />
                        <Tab label="Access Keys" id="bucket-tab-3" />
                    </Tabs>
                </Box>
                <CardContent>
                    <TabPanel value={activeTab} index={0}>
                        <BucketOverview bucket={bucket} />
                    </TabPanel>
                    <TabPanel value={activeTab} index={1}>
                        <StorageObjectBrowser bucket={bucket} />
                    </TabPanel>
                    <TabPanel value={activeTab} index={2}>
                        <BucketSettings bucket={bucket} />
                    </TabPanel>
                    <TabPanel value={activeTab} index={3}>
                        <BucketAccessKeys bucket={bucket} />
                    </TabPanel>
                </CardContent>
            </Card>
        </Box>
    );
}
