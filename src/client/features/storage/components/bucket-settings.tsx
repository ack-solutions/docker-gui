"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
    Alert,
    Box,
    Button,
    Card,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import PolicyIcon from "@mui/icons-material/Policy";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import { toast } from "sonner";
import { useConfirmationDialog } from "@/client/components/common/confirmation-dialog-provider";

interface BucketSettingsProps {
    bucket: string;
}

const POLICY_TEMPLATES = [
    { value: "", label: "Custom Policy" },
    { value: "readonly", label: "Read-Only Access" },
    { value: "readwrite", label: "Read-Write Access" },
    { value: "admin", label: "Full Admin Access" },
];

export default function BucketSettings({ bucket }: BucketSettingsProps) {
    const queryClient = useQueryClient();
    const { confirm } = useConfirmationDialog();
    const [policyTemplate, setPolicyTemplate] = useState("");
    const [customPolicy, setCustomPolicy] = useState("");

    const { data: currentPolicy, isLoading } = useQuery<{ policy: string | null }>({
        queryKey: ["bucket-policy", bucket],
        queryFn: async () => {
            const res = await axios.get(`/api/storage/buckets/${bucket}/policy`);
            return res.data;
        },
    });

    useEffect(() => {
        if (currentPolicy?.policy) {
            setCustomPolicy(currentPolicy.policy);
        }
    }, [currentPolicy]);

    const savePolicyMutation = useMutation({
        mutationFn: async ({ policy, template }: { policy?: string; template?: string }) => {
            await axios.put(`/api/storage/buckets/${bucket}/policy`, {
                policy,
                template,
            });
        },
        onSuccess: () => {
            toast.success("Bucket policy updated successfully");
            queryClient.invalidateQueries({ queryKey: ["bucket-policy", bucket] });
            queryClient.invalidateQueries({ queryKey: ["bucket-details", bucket] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Failed to update policy");
        },
    });

    const deletePolicyMutation = useMutation({
        mutationFn: async () => {
            await axios.delete(`/api/storage/buckets/${bucket}/policy`);
        },
        onSuccess: () => {
            toast.success("Bucket policy removed");
            setCustomPolicy("");
            setPolicyTemplate("");
            queryClient.invalidateQueries({ queryKey: ["bucket-policy", bucket] });
            queryClient.invalidateQueries({ queryKey: ["bucket-details", bucket] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Failed to remove policy");
        },
    });

    const handleSavePolicy = () => {
        if (policyTemplate) {
            // Save using template
            savePolicyMutation.mutate({ template: policyTemplate });
        } else if (customPolicy) {
            // Validate JSON
            try {
                JSON.parse(customPolicy);
                savePolicyMutation.mutate({ policy: customPolicy });
            } catch {
                toast.error("Invalid JSON policy");
            }
        } else {
            toast.error("Please select a template or enter a custom policy");
        }
    };

    const handleDeletePolicy = () => {
        confirm({
            title: "Remove Bucket Policy",
            message: "Are you sure you want to remove the bucket policy? This will reset access permissions.",
            confirmLabel: "Remove",
            tone: "danger",
        }).then((confirmed) => {
            if (confirmed) {
                deletePolicyMutation.mutate();
            }
        });
    };

    const handleTemplateChange = (template: string) => {
        setPolicyTemplate(template);
        if (template) {
            // Clear custom policy when template is selected
            setCustomPolicy("");
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
            {/* Policy Management */}
            <Card variant="outlined" sx={{ mb: 3 }}>
                <Box sx={{ p: 2, bgcolor: "action.hover", borderBottom: 1, borderColor: "divider" }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                        <PolicyIcon />
                        <Typography variant="h6" fontWeight={600}>
                            Bucket Policy
                        </Typography>
                    </Stack>
                </Box>
                <Box sx={{ p: 3 }}>
                    <Stack spacing={3}>
                        {/* Policy Template Selector */}
                        <FormControl fullWidth>
                            <InputLabel>Policy Template</InputLabel>
                            <Select
                                value={policyTemplate}
                                label="Policy Template"
                                onChange={(e) => handleTemplateChange(e.target.value)}
                            >
                                {POLICY_TEMPLATES.map((template) => (
                                    <MenuItem key={template.value} value={template.value}>
                                        {template.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Template Descriptions */}
                        {policyTemplate && (
                            <Alert severity="info">
                                {policyTemplate === "readonly" &&
                                    "Allows read-only access to this bucket (GetObject, ListBucket)"}
                                {policyTemplate === "readwrite" &&
                                    "Allows full read-write access to this bucket (all S3 operations)"}
                                {policyTemplate === "admin" &&
                                    "Allows full administrative access to all buckets"}
                            </Alert>
                        )}

                        {/* Custom Policy Editor */}
                        {!policyTemplate && (
                            <>
                                <Typography variant="body2" color="text.secondary">
                                    Enter a custom JSON policy or select a template above
                                </Typography>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={12}
                                    value={customPolicy}
                                    onChange={(e) => setCustomPolicy(e.target.value)}
                                    placeholder='{\n  "Version": "2012-10-17",\n  "Statement": [{\n    "Effect": "Allow",\n    "Action": ["s3:*"],\n    "Resource": ["arn:aws:s3:::bucket-name/*"]\n  }]\n}'
                                    sx={{
                                        fontFamily: "monospace",
                                        fontSize: "0.875rem",
                                    }}
                                />
                            </>
                        )}

                        {/* Current Policy Display */}
                        {currentPolicy?.policy && !policyTemplate && !customPolicy && (
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: "action.hover" }}>
                                <Typography variant="caption" color="text.secondary" gutterBottom>
                                    Current Policy
                                </Typography>
                                <pre
                                    style={{
                                        margin: 0,
                                        fontSize: "0.75rem",
                                        overflow: "auto",
                                        maxHeight: "300px",
                                    }}
                                >
                                    {currentPolicy.policy}
                                </pre>
                            </Paper>
                        )}

                        {/* Actions */}
                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="contained"
                                startIcon={<SaveIcon />}
                                onClick={handleSavePolicy}
                                disabled={savePolicyMutation.isPending || (!policyTemplate && !customPolicy)}
                            >
                                {savePolicyMutation.isPending ? "Saving..." : "Save Policy"}
                            </Button>
                            {currentPolicy?.policy && (
                                <Button
                                    variant="outlined"
                                    color="error"
                                    startIcon={<DeleteIcon />}
                                    onClick={handleDeletePolicy}
                                    disabled={deletePolicyMutation.isPending}
                                >
                                    Remove Policy
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </Box>
            </Card>

            {/* Information */}
            <Alert severity="info">
                <Typography variant="body2" fontWeight={500} gutterBottom>
                    About Bucket Policies
                </Typography>
                <Typography variant="body2">
                    Bucket policies control access to your bucket and its objects. Use templates for
                    common scenarios or create custom policies for specific requirements. Policies use
                    AWS IAM policy syntax.
                </Typography>
            </Alert>
        </Box>
    );
}
