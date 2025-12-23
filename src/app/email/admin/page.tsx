"use client";

import { useState, useMemo } from "react";
import {
    Box,
    Container,
    Paper,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControlLabel,
    Switch,
    CircularProgress,
    Chip,
    InputAdornment,
    Tooltip,
    MenuItem,
    Grid,
    Alert,
    LinearProgress,
    Stack,
    Divider
} from "@mui/material";
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    Search as SearchIcon,
    Email as EmailIcon,
    Lock as LockIcon,
    Storage as StorageIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    FilterList as FilterListIcon,
    Warning as WarningIcon
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

// --- Types ---

interface Mailbox {
    email: string;
    domain: string;
    quotaBytes: number;
    enabled: boolean;
    createdAt?: Date;
}

interface Domain {
    name: string;
    enabled: boolean;
}

// --- Components ---

const QuotaProgressBar = ({ used, total }: { used: number; total: number }) => {
    const percentage = Math.min(100, Math.max(0, (used / total) * 100));
    const color = percentage > 90 ? "error" : percentage > 70 ? "warning" : "success";

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
            <Box sx={{ width: '100%', mr: 1 }}>
                <LinearProgress variant="determinate" value={percentage} color={color} sx={{ height: 6, borderRadius: 3 }} />
            </Box>
            <Box sx={{ minWidth: 35 }}>
                <Typography variant="caption" color="text.secondary">{Math.round(percentage)}%</Typography>
            </Box>
        </Box>
    );
};

const PasswordStrengthIndicator = ({ password }: { password: string }) => {
    if (!password) return null;

    const hasLower = /[a-z]/.test(password);
    const hasUpper = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    const isLongEnough = password.length >= 8;

    const score = [hasLower, hasUpper, hasNumber, hasSpecial, isLongEnough].filter(Boolean).length;

    let color: "error" | "warning" | "success" = "error";
    let label = "Weak";
    let progress = 20;

    if (score >= 5) {
        color = "success";
        label = "Strong";
        progress = 100;
    } else if (score >= 3) {
        color = "warning";
        label = "Medium";
        progress = 60;
    }

    return (
        <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color={`text.${color === 'error' ? 'secondary' : 'primary'}`}>
                    Strength: <span style={{ color: color === 'error' ? '#d32f2f' : color === 'warning' ? '#ed6c02' : '#2e7d32', fontWeight: 600 }}>{label}</span>
                </Typography>
            </Box>
            <LinearProgress variant="determinate" value={progress} color={color} sx={{ height: 4, borderRadius: 2 }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontSize: '0.7rem' }}>
                Must be at least 8 chars with mixed case, numbers & symbols
            </Typography>
        </Box>
    );
};

// --- Main Page Component ---

const EmailAdminPage = () => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editingMailbox, setEditingMailbox] = useState<Mailbox | null>(null);
    const [mailboxToDelete, setMailboxToDelete] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [domainFilter, setDomainFilter] = useState("all");

    const queryClient = useQueryClient();

    // Fetch Mailboxes
    const { data: mailboxes, isLoading: isLoadingMailboxes } = useQuery<Mailbox[]>({
        queryKey: ["admin-mailboxes"],
        queryFn: async () => {
            const res = await axios.get("/api/email/admin/mailboxes");
            return res.data;
        },
    });

    // Fetch Domains (for filter and creation validation)
    const { data: domains, isLoading: isLoadingDomains } = useQuery<Domain[]>({
        queryKey: ["admin-domains"],
        queryFn: async () => {
            const res = await axios.get("/api/email/admin/domains");
            return res.data;
        },
    });

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: (email: string) => axios.delete(`/api/email/admin/mailboxes/${encodeURIComponent(email)}`),
        onSuccess: () => {
            toast.success("Email account deleted successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-mailboxes"] });
            setDeleteDialogOpen(false);
            setMailboxToDelete(null);
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error || "Failed to delete email account");
        },
    });

    // Handlers
    const handleEdit = (mailbox: Mailbox) => {
        setEditingMailbox(mailbox);
        setDialogOpen(true);
    };

    const handleDeleteClick = (email: string) => {
        setMailboxToDelete(email);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (mailboxToDelete) {
            deleteMutation.mutate(mailboxToDelete);
        }
    };

    const handleAddNew = () => {
        setEditingMailbox(null);
        setDialogOpen(true);
    };

    // Filtering
    const filteredMailboxes = useMemo(() => {
        if (!mailboxes) return [];

        return mailboxes.filter(mailbox => {
            const matchesSearch = mailbox.email.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesDomain = domainFilter === "all" || mailbox.domain === domainFilter;
            return matchesSearch && matchesDomain;
        });
    }, [mailboxes, searchQuery, domainFilter]);

    // Stats
    const stats = useMemo(() => {
        if (!mailboxes) return { total: 0, active: 0, totalQuota: 0 };
        return {
            total: mailboxes.length,
            active: mailboxes.filter(m => m.enabled).length,
            totalQuota: mailboxes.reduce((acc, curr) => acc + curr.quotaBytes, 0)
        };
    }, [mailboxes]);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    return (
        <Container maxWidth="xl" sx={{ py: 3 }}>
            {/* Header Section */}
            <Box sx={{ mb: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                        <Typography variant="h4" fontWeight="bold" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <EmailIcon fontSize="large" color="primary" />
                            Email Accounts
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Manage mailboxes, quotas, and access for your domains.
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<AddIcon />}
                        onClick={handleAddNew}
                        sx={{ px: 3, borderRadius: 2 }}
                    >
                        Create Account
                    </Button>
                </Box>

                {/* Stats Cards */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper sx={{ p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'primary.soft', color: 'primary.main' }}>
                                <EmailIcon />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight="bold">{stats.total}</Typography>
                                <Typography variant="body2" color="text.secondary">Total Accounts</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper sx={{ p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'success.soft', color: 'success.main' }}>
                                <CheckCircleIcon />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight="bold">{stats.active}</Typography>
                                <Typography variant="body2" color="text.secondary">Active Accounts</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                        <Paper sx={{ p: 2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'warning.soft', color: 'warning.main' }}>
                                <StorageIcon />
                            </Box>
                            <Box>
                                <Typography variant="h6" fontWeight="bold">{formatBytes(stats.totalQuota)}</Typography>
                                <Typography variant="body2" color="text.secondary">Total Quota Allocated</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                </Grid>

                {/* Filters Toolbar */}
                <Paper sx={{ p: 2, borderRadius: 2, mb: 3 }}>
                    <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                        <TextField
                            placeholder="Search by email..."
                            size="small"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            sx={{ flex: 1, minWidth: 250 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon color="action" />
                                    </InputAdornment>
                                ),
                            }}
                        />

                        <TextField
                            select
                            size="small"
                            value={domainFilter}
                            onChange={(e) => setDomainFilter(e.target.value)}
                            sx={{ minWidth: 200 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <FilterListIcon color="action" fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                        >
                            <MenuItem value="all">All Domains</MenuItem>
                            {domains?.map((d) => (
                                <MenuItem key={d.name} value={d.name}>{d.name}</MenuItem>
                            ))}
                        </TextField>

                        <Tooltip title="Refresh list">
                            <IconButton onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-mailboxes"] })}>
                                <RefreshIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Paper>
            </Box>

            {/* Mailboxes Table */}
            <Paper sx={{ borderRadius: 2, overflow: 'hidden' }}>
                <TableContainer>
                    <Table sx={{ minWidth: 650 }}>
                        <TableHead sx={{ bgcolor: 'action.hover' }}>
                            <TableRow>
                                <TableCell sx={{ fontWeight: 600 }}>Email Account</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Quota Usage</TableCell>
                                <TableCell sx={{ fontWeight: 600 }}>Created</TableCell>
                                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {isLoadingMailboxes ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                                        <CircularProgress size={40} />
                                        <Typography sx={{ mt: 2 }} color="text.secondary">Loading accounts...</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : filteredMailboxes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} align="center" sx={{ py: 8 }}>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0.7 }}>
                                            <EmailIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
                                            <Typography variant="h6" color="text.secondary">No accounts found</Typography>
                                            <Typography variant="body2" color="text.disabled">
                                                {searchQuery || domainFilter !== "all"
                                                    ? "Try adjusting your filters"
                                                    : "Create your first email account to get started"}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredMailboxes.map((mailbox) => (
                                    <TableRow
                                        key={mailbox.email}
                                        hover
                                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                    >
                                        <TableCell>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <AvatarPlaceholder name={mailbox.email} />
                                                <Box>
                                                    <Typography variant="subtitle2" fontWeight={600}>
                                                        {mailbox.email}
                                                    </Typography>
                                                    <Typography variant="caption" color="text.secondary">
                                                        {mailbox.domain}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                icon={mailbox.enabled ? <CheckCircleIcon fontSize="small" /> : <CancelIcon fontSize="small" />}
                                                label={mailbox.enabled ? "Active" : "Disabled"}
                                                color={mailbox.enabled ? "success" : "default"}
                                                size="small"
                                                variant={mailbox.enabled ? "filled" : "outlined"}
                                                sx={{ fontWeight: 500 }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ width: 250 }}>
                                            <Box>
                                                <Typography variant="body2" sx={{ mb: 0.5 }}>
                                                    {formatBytes(mailbox.quotaBytes)} Limit
                                                </Typography>
                                                {/* Note: We don't have 'used' quota in the interface yet, assuming 0 for visual or random for demo if needed, but better to just show limit */}
                                                <LinearProgress
                                                    variant="determinate"
                                                    value={0} // TODO: Hook up real usage stats when available
                                                    sx={{ height: 6, borderRadius: 3, bgcolor: 'action.selected' }}
                                                />
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                {mailbox.createdAt ? new Date(mailbox.createdAt).toLocaleDateString() : "Unknown"}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                                                <Tooltip title="Edit Account">
                                                    <IconButton size="small" onClick={() => handleEdit(mailbox)} color="primary">
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Delete Account">
                                                    <IconButton size="small" onClick={() => handleDeleteClick(mailbox.email)} color="error">
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>

            {/* Create/Edit Dialog */}
            <MailboxDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                mailbox={editingMailbox}
                domains={domains || []}
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'error.main' }}>
                    <WarningIcon /> Confirm Deletion
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete <strong>{mailboxToDelete}</strong>?
                    </Typography>
                    <Alert severity="error" sx={{ mt: 2 }}>
                        This action cannot be undone. All emails and data associated with this account will be permanently lost.
                    </Alert>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button onClick={() => setDeleteDialogOpen(false)} color="inherit">Cancel</Button>
                    <Button
                        onClick={handleConfirmDelete}
                        variant="contained"
                        color="error"
                        disabled={deleteMutation.isPending}
                        startIcon={deleteMutation.isPending ? <CircularProgress size={20} color="inherit" /> : <DeleteIcon />}
                    >
                        {deleteMutation.isPending ? "Deleting..." : "Delete Account"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Container>
    );
};

// --- Helper Components ---

const AvatarPlaceholder = ({ name }: { name: string }) => {
    const initial = name.charAt(0).toUpperCase();
    const colors = ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#0288d1', '#d32f2f'];
    const colorIndex = name.length % colors.length;

    return (
        <Box sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: colors[colorIndex],
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '0.875rem'
        }}>
            {initial}
        </Box>
    );
};

// --- Dialog Component ---

const MailboxDialog = ({
    open,
    onClose,
    mailbox,
    domains,
}: {
    open: boolean;
    onClose: () => void;
    mailbox: Mailbox | null;
    domains: Domain[];
}) => {
    const [emailUser, setEmailUser] = useState("");
    const [selectedDomain, setSelectedDomain] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [quotaGB, setQuotaGB] = useState(1);
    const [enabled, setEnabled] = useState(true);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const queryClient = useQueryClient();

    // Reset form when dialog opens
    useMemo(() => {
        if (open) {
            setErrors({});
            if (mailbox) {
                const [user, domain] = mailbox.email.split('@');
                setEmailUser(user);
                setSelectedDomain(domain);
                setPassword("");
                setConfirmPassword("");
                setQuotaGB(mailbox.quotaBytes ? mailbox.quotaBytes / 1024 / 1024 / 1024 : 1);
                setEnabled(mailbox.enabled ?? true);
            } else {
                setEmailUser("");
                setSelectedDomain(domains.length > 0 ? domains[0].name : "");
                setPassword("");
                setConfirmPassword("");
                setQuotaGB(1);
                setEnabled(true);
            }
        }
    }, [open, mailbox, domains]);

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!emailUser.trim()) newErrors.emailUser = "Username is required";
        if (!/^[a-zA-Z0-9._-]+$/.test(emailUser)) newErrors.emailUser = "Invalid characters. Use letters, numbers, dots, underscores, or hyphens.";

        if (!selectedDomain) newErrors.domain = "Domain is required";

        if (!mailbox) { // Creating new
            if (!password) newErrors.password = "Password is required";
            if (password.length < 8) newErrors.password = "Password must be at least 8 characters";
            if (password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";
        } else { // Editing
            if (password && password.length < 8) newErrors.password = "Password must be at least 8 characters";
            if (password && password !== confirmPassword) newErrors.confirmPassword = "Passwords do not match";
        }

        if (quotaGB <= 0) newErrors.quota = "Quota must be greater than 0";
        if (quotaGB > 1000) newErrors.quota = "Quota cannot exceed 1000 GB";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const mutation = useMutation({
        mutationFn: async () => {
            const data: any = {
                enabled,
                quotaBytes: Math.round(quotaGB * 1024 * 1024 * 1024),
            };

            if (mailbox) {
                if (password) data.password = password;
                await axios.patch(`/api/email/admin/mailboxes/${encodeURIComponent(mailbox.email)}`, data);
            } else {
                data.email = `${emailUser}@${selectedDomain}`;
                data.password = password;
                await axios.post("/api/email/admin/mailboxes", data);
            }
        },
        onSuccess: () => {
            toast.success(mailbox ? "Account updated successfully" : "Account created successfully");
            queryClient.invalidateQueries({ queryKey: ["admin-mailboxes"] });
            onClose();
        },
        onError: (error: any) => {
            console.error("Mailbox mutation error:", error);
            toast.error(error.response?.data?.error || (mailbox ? "Failed to update account" : "Failed to create account"));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (validate()) {
            mutation.mutate();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle sx={{ pb: 1 }}>
                    <Typography variant="h6" fontWeight="bold">
                        {mailbox ? "Edit Email Account" : "Create New Email Account"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {mailbox ? `Update settings for ${mailbox.email}` : "Set up a new mailbox for your domain"}
                    </Typography>
                </DialogTitle>
                <Divider />
                <DialogContent sx={{ pt: 3 }}>
                    <Grid container spacing={2}>
                        {/* Email Address Field */}
                        <Grid size={{ xs: 12 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                <TextField
                                    label="Username"
                                    value={emailUser}
                                    onChange={(e) => setEmailUser(e.target.value)}
                                    disabled={!!mailbox}
                                    error={!!errors.emailUser}
                                    helperText={errors.emailUser}
                                    fullWidth
                                    required={!mailbox}
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start"><EmailIcon fontSize="small" /></InputAdornment>,
                                    }}
                                />
                                <Typography sx={{ pt: 2, color: 'text.secondary' }}>@</Typography>
                                <TextField
                                    select
                                    label="Domain"
                                    value={selectedDomain}
                                    onChange={(e) => setSelectedDomain(e.target.value)}
                                    disabled={!!mailbox}
                                    error={!!errors.domain}
                                    helperText={errors.domain}
                                    fullWidth
                                    required={!mailbox}
                                >
                                    {domains.map((d) => (
                                        <MenuItem key={d.name} value={d.name}>{d.name}</MenuItem>
                                    ))}
                                    {domains.length === 0 && (
                                        <MenuItem value="" disabled>No domains available</MenuItem>
                                    )}
                                </TextField>
                            </Box>
                            {!mailbox && domains.length === 0 && (
                                <Alert severity="warning" sx={{ mt: 1 }}>
                                    You need to add a domain in the Domains section before creating email accounts.
                                </Alert>
                            )}
                        </Grid>

                        {/* Password Fields */}
                        <Grid size={{ xs: 12 }}>
                            <TextField
                                label={mailbox ? "New Password (leave blank to keep current)" : "Password"}
                                type="password"
                                fullWidth
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                error={!!errors.password}
                                helperText={errors.password}
                                required={!mailbox}
                                InputProps={{
                                    startAdornment: <InputAdornment position="start"><LockIcon fontSize="small" /></InputAdornment>,
                                }}
                            />
                            <PasswordStrengthIndicator password={password} />
                        </Grid>

                        {(password || !mailbox) && (
                            <Grid size={{ xs: 12 }}>
                                <TextField
                                    label="Confirm Password"
                                    type="password"
                                    fullWidth
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    error={!!errors.confirmPassword}
                                    helperText={errors.confirmPassword}
                                    required={!mailbox}
                                />
                            </Grid>
                        )}

                        {/* Quota Field */}
                        <Grid size={{ xs: 12, sm: 6 }}>
                            <TextField
                                label="Storage Quota (GB)"
                                type="number"
                                fullWidth
                                value={quotaGB}
                                onChange={(e) => setQuotaGB(Number(e.target.value))}
                                error={!!errors.quota}
                                helperText={errors.quota}
                                InputProps={{
                                    inputProps: { step: 0.1, min: 0.1 },
                                    startAdornment: <InputAdornment position="start"><StorageIcon fontSize="small" /></InputAdornment>,
                                    endAdornment: <InputAdornment position="end">GB</InputAdornment>,
                                }}
                            />
                        </Grid>

                        {/* Active Toggle */}
                        <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
                            <Paper variant="outlined" sx={{ p: 1, width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ ml: 1 }}>
                                    <Typography variant="body2" fontWeight="bold">Account Status</Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {enabled ? "Account is active and can receive mail" : "Account is disabled"}
                                    </Typography>
                                </Box>
                                <Switch
                                    checked={enabled}
                                    onChange={(e) => setEnabled(e.target.checked)}
                                    color="success"
                                />
                            </Paper>
                        </Grid>
                    </Grid>
                </DialogContent>
                <Divider />
                <DialogActions sx={{ p: 2.5 }}>
                    <Button onClick={onClose} disabled={mutation.isPending} variant="outlined" color="inherit">
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={mutation.isPending || (domains.length === 0 && !mailbox)}
                        startIcon={mutation.isPending ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
                    >
                        {mutation.isPending ? "Saving..." : mailbox ? "Update Account" : "Create Account"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};

export default EmailAdminPage;
