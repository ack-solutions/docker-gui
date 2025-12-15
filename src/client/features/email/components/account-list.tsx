"use client";

import { useState } from "react";
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Typography,
    Button,
    Tooltip,
    Chip,
    Stack,
    CircularProgress,
} from "@mui/material";
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
    LockReset as PasswordIcon,
    Mail as MailIcon,
    Add as AddIcon,
} from "@mui/icons-material";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AccountDialog } from "./account-dialog";
import { useConfirmationDialog } from "@/components/common/confirmation-dialog-provider";

interface EmailAccount {
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
    createdAt: string;
}

export const AccountList = () => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { confirm } = useConfirmationDialog();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(null);

    const { data: accounts, isLoading } = useQuery<EmailAccount[]>({
        queryKey: ["email-accounts"],
        queryFn: async () => {
            const res = await axios.get("/api/email/accounts");
            return res.data;
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            return axios.delete(`/api/email/accounts/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["email-accounts"] });
            toast.success("Account deleted successfully");
        },
        onError: () => {
            toast.error("Failed to delete account");
        },
    });

    const handleEdit = (account: EmailAccount) => {
        setSelectedAccount(account);
        setIsDialogOpen(true);
    };

    const handleDelete = async (account: EmailAccount) => {
        const confirmed = await confirm({
            title: "Delete Account?",
            message: `Are you sure you want to delete ${account.email}? This action cannot be undone.`,
            confirmLabel: "Delete",
            tone: "danger",
        });

        if (confirmed) {
            deleteMutation.mutate(account.id);
        }
    };

    const handleAdd = () => {
        setSelectedAccount(null);
        setIsDialogOpen(true);
    };

    const handleOpenMailbox = (id: string) => {
        router.push(`/email/account/${id}`);
    };

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Stack direction="row" justifyContent="flex-end" alignItems="center" sx={{ mb: 2 }}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleAdd}>
                    Add Account
                </Button>
            </Stack>

            <TableContainer component={Paper} variant="outlined">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Email Address</TableCell>
                            <TableCell>Host</TableCell>
                            <TableCell>Connection</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {accounts?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                                    <Typography color="text.secondary">No email accounts configured</Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            accounts?.map((account) => (
                                <TableRow key={account.id}>
                                    <TableCell>
                                        <Stack direction="row" alignItems="center" spacing={1}>
                                            <MailIcon color="action" fontSize="small" />
                                            <Typography variant="body2" fontWeight={500}>
                                                {account.email}
                                            </Typography>
                                        </Stack>
                                    </TableCell>
                                    <TableCell>{account.host}</TableCell>
                                    <TableCell>
                                        <Chip
                                            label={`${account.port} ${account.tls ? "(TLS)" : ""}`}
                                            size="small"
                                            variant="outlined"
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                                            <Tooltip title="Open Mailbox">
                                                <IconButton
                                                    size="small"
                                                    color="primary"
                                                    onClick={() => handleOpenMailbox(account.id)}
                                                >
                                                    <MailIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Edit / Reset Password">
                                                <IconButton size="small" onClick={() => handleEdit(account)}>
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleDelete(account)}
                                                >
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

            <AccountDialog
                open={isDialogOpen}
                onClose={() => setIsDialogOpen(false)}
                account={selectedAccount}
            />
        </Box>
    );
};
