"use client";

import { useState } from "react";
import {
    Box,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Typography,
    Button,
    Divider,
    IconButton,
    Badge,
    Avatar,
    Menu,
    MenuItem,
} from "@mui/material";
import {
    Inbox as InboxIcon,
    Send as SendIcon,
    Drafts as DraftsIcon,
    Delete as DeleteIcon,
    Star as StarIcon,
    Label as LabelIcon,
    Add as AddIcon,
    ExpandMore,
    Settings as SettingsIcon,
    Refresh as RefreshIcon,
    Edit as EditIcon,
} from "@mui/icons-material";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { useRouter } from "next/navigation";
import { ComposeDialog } from "./compose-dialog";
import { AccountDialog } from "./account-dialog";

interface EmailSidebarProps {
    onFolderSelect?: (folderId: string) => void;
    selectedFolderId?: string | null;
}

interface EmailAccount {
    id: string;
    email: string;
    name: string;
}

interface Folder {
    id: string;
    name: string;
    unreadCount?: number;
}

export const EmailSidebar = ({ onFolderSelect, selectedFolderId }: EmailSidebarProps) => {
    const router = useRouter();
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [isAccountDialogOpen, setIsAccountDialogOpen] = useState(false);
    const [accountMenuAnchor, setAccountMenuAnchor] = useState<null | HTMLElement>(null);
    const queryClient = useQueryClient();

    const { data: accounts } = useQuery<EmailAccount[]>({
        queryKey: ["email-accounts"],
        queryFn: async () => {
            const res = await axios.get("/api/email/accounts");
            return res.data;
        },
    });

    const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

    // Set first account as selected when loaded
    if (accounts && accounts.length > 0 && !selectedAccount) {
        setSelectedAccount(accounts[0].id);
    }

    const currentAccount = accounts?.find(a => a.id === selectedAccount);

    const folders = [
        { id: "inbox", name: "Inbox", icon: <InboxIcon />, unreadCount: 5 },
        { id: "starred", name: "Starred", icon: <StarIcon /> },
        { id: "sent", name: "Sent", icon: <SendIcon /> },
        { id: "drafts", name: "Drafts", icon: <DraftsIcon /> },
        { id: "trash", name: "Trash", icon: <DeleteIcon /> },
        { id: "labels", name: "Labels", icon: <LabelIcon /> },
    ];

    return (
        <>
            <Box sx={{
                width: 240,
                borderRight: 1,
                borderColor: "divider",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                bgcolor: "background.paper"
            }}>
                {/* Header with account selector */}
                <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                    <Button
                        fullWidth
                        onClick={(e) => setAccountMenuAnchor(e.currentTarget)}
                        sx={{
                            justifyContent: "space-between",
                            textTransform: "none",
                            color: "text.primary",
                            px: 1.5,
                            py: 1,
                        }}
                    >
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                            <Avatar sx={{ width: 28, height: 28, fontSize: 14, bgcolor: "primary.main" }}>
                                {currentAccount?.email[0].toUpperCase()}
                            </Avatar>
                            <Typography variant="body2" noWrap fontWeight={600}>
                                {currentAccount?.email || "No Account"}
                            </Typography>
                        </Box>
                        <ExpandMore fontSize="small" />
                    </Button>

                    {/* Account Menu */}
                    <Menu
                        anchorEl={accountMenuAnchor}
                        open={Boolean(accountMenuAnchor)}
                        onClose={() => setAccountMenuAnchor(null)}
                    >
                        {accounts?.map((account) => (
                            <MenuItem
                                key={account.id}
                                selected={account.id === selectedAccount}
                                onClick={() => {
                                    setSelectedAccount(account.id);
                                    setAccountMenuAnchor(null);
                                }}
                            >
                                <Avatar sx={{ width: 24, height: 24, fontSize: 12, mr: 1.5 }}>
                                    {account.email[0].toUpperCase()}
                                </Avatar>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="body2" noWrap>
                                        {account.email}
                                    </Typography>
                                </Box>
                            </MenuItem>
                        ))}
                        <Divider />
                        <MenuItem 
                            onClick={() => {
                                router.push("/email/accounts");
                                setAccountMenuAnchor(null);
                            }}
                            selected={false}
                        >
                            <SettingsIcon fontSize="small" sx={{ mr: 1.5 }} />
                            Manage Accounts
                        </MenuItem>
                        <MenuItem 
                            onClick={() => {
                                setIsAccountDialogOpen(true);
                                setAccountMenuAnchor(null);
                            }}
                            selected={false}
                        >
                            <AddIcon fontSize="small" sx={{ mr: 1.5 }} />
                            Add Account
                        </MenuItem>
                    </Menu>
                </Box>

                {/* Compose Button */}
                <Box sx={{ p: 2 }}>
                    <Button
                        fullWidth
                        variant="contained"
                        startIcon={<EditIcon />}
                        onClick={() => setIsComposeOpen(true)}
                        sx={{
                            borderRadius: 3,
                            py: 1.25,
                            textTransform: "none",
                            fontSize: 15,
                            fontWeight: 600,
                            boxShadow: 2,
                            "&:hover": {
                                boxShadow: 4,
                            }
                        }}
                    >
                        Compose
                    </Button>
                </Box>

                {/* Folders List */}
                <List sx={{ flex: 1, overflow: "auto", pt: 0, px: 1 }}>
                    {folders.map((folder) => (
                        <ListItemButton
                            key={folder.id}
                            selected={selectedFolderId === folder.id}
                            onClick={() => onFolderSelect?.(folder.id)}
                            sx={{
                                borderRadius: "0 20px 20px 0",
                                my: 0.25,
                                py: 0.75,
                                px: 2,
                                "&.Mui-selected": {
                                    bgcolor: "primary.100",
                                    fontWeight: 600,
                                    "&:hover": {
                                        bgcolor: "primary.200",
                                    },
                                },
                            }}
                        >
                            <ListItemIcon sx={{ minWidth: 36, color: selectedFolderId === folder.id ? "primary.main" : "inherit" }}>
                                {folder.icon}
                            </ListItemIcon>
                            <ListItemText
                                primary={folder.name}
                                primaryTypographyProps={{
                                    variant: "body2",
                                    fontWeight: selectedFolderId === folder.id ? 600 : 400,
                                }}
                            />
                            {folder.unreadCount && folder.unreadCount > 0 && (
                                <Typography variant="caption" fontWeight={600} color="text.secondary">
                                    {folder.unreadCount}
                                </Typography>
                            )}
                        </ListItemButton>
                    ))}
                </List>

                {/* Bottom Actions */}
                <Box sx={{ p: 2, borderTop: 1, borderColor: "divider" }}>
                    <IconButton
                        size="small"
                        onClick={() => queryClient.invalidateQueries({ queryKey: ["emails"] })}
                    >
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                </Box>
            </Box>

            <ComposeDialog
                open={isComposeOpen}
                onClose={() => setIsComposeOpen(false)}
            />
            <AccountDialog
                open={isAccountDialogOpen}
                onClose={() => setIsAccountDialogOpen(false)}
                account={null}
            />
        </>
    );
};
