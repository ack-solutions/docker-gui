import { useState, useEffect, useMemo } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Stack,
    FormControlLabel,
    Checkbox,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Typography,
    Divider,
    Box,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useDomains } from "@/client/features/domains/hooks/use-domains";

interface AccountDialogProps {
    open: boolean;
    onClose: () => void;
    account?: {
        id: string;
        email: string;
        host: string;
        port: number;
        username: string;
        tls: boolean;
        imapTls?: boolean;
        smtpHost?: string;
        smtpPort?: number;
        smtpSecure?: boolean;
        smtpTls?: boolean;
        rejectUnauthorized?: boolean;
    } | null;
}

export const AccountDialog = ({ open, onClose, account }: AccountDialogProps) => {
    const queryClient = useQueryClient();
    const isEdit = !!account;
    const { data: domains } = useDomains();

    const [formData, setFormData] = useState({
        domainId: "",
        username: "",
        password: "",
        host: "",
        port: 993,
        smtpHost: "",
        smtpPort: 587,
        tls: true, // Deprecated, kept for backward compatibility
        imapTls: true,
        smtpSecure: false,
        smtpTls: true,
        rejectUnauthorized: false,
    });

    // Filter domains that can be used for email
    const availableDomains = useMemo(() => {
        return domains?.filter(d => d.status === "active") || [];
    }, [domains]);

    // Auto-fill host/port when domain is selected
    useEffect(() => {
        if (formData.domainId && !isEdit) {
            const selectedDomain = domains?.find(d => d.id === formData.domainId);
            if (selectedDomain) {
                // For local domains, use mailserver host
                if (selectedDomain.name.includes("localhost") || selectedDomain.mode === "managed") {
                    setFormData(prev => ({
                        ...prev,
                        host: "mailserver",
                        port: 993,
                        smtpHost: "mailserver",
                        smtpPort: 587,
                    }));
                } else {
                    // For external domains, use standard IMAP/SMTP
                    setFormData(prev => ({
                        ...prev,
                        host: `imap.${selectedDomain.name}`,
                        port: 993,
                        smtpHost: `smtp.${selectedDomain.name}`,
                        smtpPort: 587,
                    }));
                }
            }
        }
    }, [formData.domainId, domains, isEdit]);

    useEffect(() => {
        if (account) {
            // Parse email to extract domain and username
            const [usernamePart, domainPart] = account.email.split("@");
            const domain = domains?.find(d => d.name === domainPart);
            
            setFormData({
                domainId: domain?.id || "",
                username: usernamePart || account.username,
                password: "", // Don't show existing password
                host: account.host,
                port: account.port,
                smtpHost: (account as any).smtpHost || "",
                smtpPort: (account as any).smtpPort || 587,
                tls: account.tls,
                imapTls: (account as any).imapTls !== undefined ? (account as any).imapTls : account.tls,
                smtpSecure: (account as any).smtpSecure !== undefined ? (account as any).smtpSecure : false,
                smtpTls: (account as any).smtpTls !== undefined ? (account as any).smtpTls : true,
                rejectUnauthorized: (account as any).rejectUnauthorized !== undefined ? (account as any).rejectUnauthorized : false,
            });
        } else {
            setFormData({
                domainId: "",
                username: "",
                password: "",
                host: "",
                port: 993,
                smtpHost: "",
                smtpPort: 587,
                tls: true,
                imapTls: true,
                smtpSecure: false,
                smtpTls: true,
                rejectUnauthorized: false,
            });
        }
    }, [account, open, domains]);

    const mutation = useMutation({
        mutationFn: async (data: any) => {
            if (isEdit && account) {
                // For edit, only send password if it's changed (non-empty)
                const payload = { ...data };
                if (!payload.password) delete payload.password;
                return axios.patch(`/api/email/accounts/${account.id}`, payload);
            }
            return axios.post("/api/email/accounts", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
            toast.success(isEdit ? "Account updated successfully" : "Account added successfully");
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || (isEdit ? "Failed to update account" : "Failed to add account"));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        
        // Build email from domain and username
        const selectedDomain = domains?.find(d => d.id === formData.domainId);
        if (!selectedDomain && !isEdit) {
            toast.error("Please select a domain");
            return;
        }

        const email = selectedDomain 
            ? `${formData.username}@${selectedDomain.name}`
            : account?.email || "";

        mutation.mutate({
            email,
            password: formData.password,
            host: formData.host,
            port: Number(formData.port),
            smtpHost: formData.smtpHost || undefined,
            smtpPort: formData.smtpPort ? Number(formData.smtpPort) : undefined,
            username: formData.username || email,
            tls: formData.imapTls, // Keep for backward compatibility
            imapTls: formData.imapTls,
            smtpSecure: formData.smtpSecure,
            smtpTls: formData.smtpTls,
            rejectUnauthorized: formData.rejectUnauthorized,
        });
    };

    const selectedDomain = domains?.find(d => d.id === formData.domainId);
    const fullEmail = selectedDomain && formData.username 
        ? `${formData.username}@${selectedDomain.name}`
        : "";

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <form onSubmit={handleSubmit}>
                <DialogTitle>{isEdit ? "Edit Email Account" : "Add Email Account"}</DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 1 }}>
                        {/* Domain Selection */}
                        <FormControl fullWidth required>
                            <InputLabel>Domain</InputLabel>
                            <Select
                                label="Domain"
                                value={formData.domainId}
                                onChange={(e) => setFormData({ ...formData, domainId: e.target.value })}
                                disabled={isEdit}
                            >
                                {availableDomains.map((domain) => (
                                    <MenuItem key={domain.id} value={domain.id}>
                                        {domain.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Username */}
                        <TextField
                            label="Username"
                            fullWidth
                            required
                            value={formData.username}
                            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                            helperText={fullEmail ? `Email will be: ${fullEmail}` : "Enter username (without @domain)"}
                            disabled={isEdit}
                        />

                        {/* Password */}
                        <TextField
                            label={isEdit ? "New Password (leave blank to keep current)" : "Password"}
                            type="password"
                            fullWidth
                            required={!isEdit}
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            helperText={isEdit ? "Only enter if you want to change it. Used for both IMAP and SMTP." : "Password for IMAP and SMTP authentication"}
                        />

                        <Divider />

                        {/* IMAP Settings */}
                        <Typography variant="subtitle2" fontWeight={600}>IMAP Settings</Typography>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="IMAP Host"
                                fullWidth
                                required
                                value={formData.host}
                                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                            />
                            <TextField
                                label="Port"
                                type="number"
                                required
                                sx={{ width: 120 }}
                                value={formData.port}
                                onChange={(e) => setFormData({ ...formData, port: Number(e.target.value) })}
                            />
                        </Stack>

                        {/* SMTP Settings */}
                        <Typography variant="subtitle2" fontWeight={600}>SMTP Settings</Typography>
                        <Stack direction="row" spacing={2}>
                            <TextField
                                label="SMTP Host"
                                fullWidth
                                value={formData.smtpHost}
                                onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                                helperText="Leave empty to use IMAP host"
                            />
                            <TextField
                                label="Port"
                                type="number"
                                sx={{ width: 120 }}
                                value={formData.smtpPort}
                                onChange={(e) => setFormData({ ...formData, smtpPort: Number(e.target.value) })}
                            />
                        </Stack>

                        <Divider />
                        
                        {/* SSL/TLS Security Settings */}
                        <Typography variant="subtitle2" fontWeight={600}>Security Settings</Typography>
                        
                        {/* IMAP TLS */}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={formData.imapTls}
                                    onChange={(e) => setFormData({ ...formData, imapTls: e.target.checked })}
                                />
                            }
                            label="IMAP TLS/SSL"
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 4.5, mt: -1, mb: 1, display: "block" }}>
                            Enable TLS/SSL for IMAP connections (recommended)
                        </Typography>
                        
                        {/* SMTP Settings */}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={formData.smtpTls}
                                    onChange={(e) => setFormData({ ...formData, smtpTls: e.target.checked })}
                                />
                            }
                            label="SMTP TLS (STARTTLS)"
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 4.5, mt: -1, mb: 1, display: "block" }}>
                            Enable TLS for SMTP using STARTTLS (port 587)
                        </Typography>
                        
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={formData.smtpSecure}
                                    onChange={(e) => setFormData({ ...formData, smtpSecure: e.target.checked })}
                                />
                            }
                            label="SMTP SSL/TLS (Direct SSL)"
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 4.5, mt: -1, mb: 1, display: "block" }}>
                            Use direct SSL/TLS connection (port 465). If checked, STARTTLS is not used.
                        </Typography>
                        
                        {/* Certificate Validation */}
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={formData.rejectUnauthorized}
                                    onChange={(e) => setFormData({ ...formData, rejectUnauthorized: e.target.checked })}
                                />
                            }
                            label="Reject Self-Signed Certificates"
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: 4.5, mt: -1, mb: 1, display: "block" }}>
                            Enable to reject self-signed or invalid certificates (disable for local/testing)
                        </Typography>

                        {/* Setup Instructions */}
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography variant="subtitle2" fontWeight={600}>
                                    Client Setup Instructions
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Stack spacing={2}>
                                    <Box>
                                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                            IMAP Settings:
                                        </Typography>
                                        <Typography variant="body2" component="div" sx={{ fontFamily: "monospace", bgcolor: "action.hover", p: 1, borderRadius: 1 }}>
                                            Server: {formData.host || "imap.example.com"}<br />
                                            Port: {formData.port || 993}<br />
                                            Security: {formData.imapTls ? "TLS/SSL" : "None"}<br />
                                            Username: {fullEmail || formData.username || "username@domain.com"}<br />
                                            Password: [Your password]
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" fontWeight={600} gutterBottom>
                                            SMTP Settings:
                                        </Typography>
                                        <Typography variant="body2" component="div" sx={{ fontFamily: "monospace", bgcolor: "action.hover", p: 1, borderRadius: 1 }}>
                                            Server: {formData.smtpHost || formData.host || "smtp.example.com"}<br />
                                            Port: {formData.smtpPort || 587}<br />
                                            Security: {formData.smtpSecure ? "SSL/TLS (Direct)" : (formData.smtpTls ? "STARTTLS" : "None")}<br />
                                            Username: {fullEmail || formData.username || "username@domain.com"}<br />
                                            Password: [Your password]
                                        </Typography>
                                    </Box>
                                    <Alert severity="info">
                                        Use these settings to configure your email client (Outlook, Thunderbird, Apple Mail, etc.)
                                    </Alert>
                                </Stack>
                            </AccordionDetails>
                        </Accordion>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="submit" variant="contained" disabled={mutation.isPending}>
                        {mutation.isPending ? (isEdit ? "Updating..." : "Adding...") : (isEdit ? "Update Account" : "Add Account")}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};
