"use client";

import { useState } from "react";
import {
    Box,
    List,
    ListItemButton,
    Typography,
    Paper,
    InputBase,
    IconButton,
    Avatar,
    Stack,
    Checkbox,
    Tooltip,
    CircularProgress,
} from "@mui/material";
import {
    Search as SearchIcon,
    StarBorder,
    Star,
    Archive as ArchiveIcon,
    Delete as DeleteIcon,
    Label as LabelIcon,
    Refresh as RefreshIcon,
    AttachFile as AttachFileIcon,
} from "@mui/icons-material";
import moment from "moment";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface Email {
    id: string;
    subject: string;
    from: string;
    date: string;
    isRead: boolean;
    hasAttachments: boolean;
    snippet?: string;
}

interface EmailListProps {
    folderId: string;
    onSelectEmail: (emailId: string) => void;
    selectedEmailId: string | null;
}

export const EmailList = ({ folderId, onSelectEmail, selectedEmailId }: EmailListProps) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
    const [hoveredEmail, setHoveredEmail] = useState<string | null>(null);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["emails", folderId],
        queryFn: async () => {
            if (!folderId || folderId === "inbox") return { emails: [] };
            const res = await axios.get(`/api/email/messages?folderId=${folderId}`);
            return res.data;
        },
        enabled: !!folderId && folderId !== "inbox",
    });

    const emails: Email[] = data?.emails || [];

    const toggleSelectEmail = (emailId: string) => {
        const newSelected = new Set(selectedEmails);
        if (newSelected.has(emailId)) {
            newSelected.delete(emailId);
        } else {
            newSelected.add(emailId);
        }
        setSelectedEmails(newSelected);
    };

    const getInitial = (email: string) => {
        const name = email.split("<")[0].trim();
        return name[0]?.toUpperCase() || "?";
    };

    const formatDate = (date: string) => {
        const emailDate = moment(date);
        const now = moment();

        if (emailDate.isSame(now, 'day')) {
            return emailDate.format('h:mm A');
        } else if (emailDate.isSame(now, 'year')) {
            return emailDate.format('MMM D');
        } else {
            return emailDate.format('M/D/YY');
        }
    };

    return (
        <Box sx={{
            width: 350,
            borderRight: 1,
            borderColor: "divider",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            bgcolor: "background.paper"
        }}>
            {/* Search Bar */}
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
                <Paper
                    sx={{
                        p: "4px 12px",
                        display: "flex",
                        alignItems: "center",
                        bgcolor: "action.hover",
                        boxShadow: "none",
                        borderRadius: 3,
                    }}
                >
                    <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
                    <InputBase
                        sx={{ ml: 1, flex: 1, fontSize: 14 }}
                        placeholder="Search in mail"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <IconButton size="small" onClick={() => refetch()}>
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                </Paper>
            </Box>

            {/* Toolbar when emails selected */}
            {selectedEmails.size > 0 && (
                <Box sx={{
                    px: 2,
                    py: 1,
                    borderBottom: 1,
                    borderColor: "divider",
                    display: "flex",
                    gap: 1,
                    alignItems: "center",
                    bgcolor: "primary.50"
                }}>
                    <Typography variant="caption" fontWeight={600} color="primary">
                        {selectedEmails.size} selected
                    </Typography>
                    <Box sx={{ flex: 1 }} />
                    <Tooltip title="Archive">
                        <IconButton size="small">
                            <ArchiveIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton size="small">
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Box>
            )}

            {/* Email List */}
            {isLoading ? (
                <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : (
                <List sx={{ flex: 1, overflow: "auto", p: 0 }}>
                    {emails.length === 0 ? (
                        <Box sx={{ p: 4, textAlign: "center" }}>
                            <Typography variant="body2" color="text.secondary">No emails in this folder</Typography>
                        </Box>
                    ) : (
                        emails.map((email) => (
                            <ListItemButton
                                key={email.id}
                                selected={selectedEmailId === email.id}
                                onClick={() => onSelectEmail(email.id)}
                                onMouseEnter={() => setHoveredEmail(email.id)}
                                onMouseLeave={() => setHoveredEmail(null)}
                                sx={{
                                    py: 1,
                                    px: 1.5,
                                    borderBottom: "1px solid",
                                    borderColor: "divider",
                                    bgcolor: email.isRead ? "transparent" : "action.hover",
                                    "&:hover": {
                                        bgcolor: "action.selected",
                                    },
                                    "&.Mui-selected": {
                                        bgcolor: "primary.50",
                                        "&:hover": {
                                            bgcolor: "primary.100",
                                        },
                                    },
                                }}
                            >
                                <Stack direction="row" spacing={1.5} sx={{ width: "100%", minWidth: 0 }}>
                                    {/* Checkbox */}
                                    <Checkbox
                                        size="small"
                                        checked={selectedEmails.has(email.id)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleSelectEmail(email.id);
                                        }}
                                        sx={{ p: 0 }}
                                    />

                                    {/* Avatar */}
                                    <Avatar
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            bgcolor: "primary.main",
                                            fontSize: 14,
                                            fontWeight: 600
                                        }}
                                    >
                                        {getInitial(email.from)}
                                    </Avatar>

                                    {/* Email Content */}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                                            <Typography
                                                variant="body2"
                                                fontWeight={email.isRead ? 400 : 700}
                                                noWrap
                                                sx={{ flex: 1, minWidth: 0 }}
                                            >
                                                {email.from.split("<")[0].trim() || email.from}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                                                {formatDate(email.date)}
                                            </Typography>
                                        </Stack>

                                        <Typography
                                            variant="body2"
                                            fontWeight={email.isRead ? 400 : 600}
                                            noWrap
                                            sx={{ mt: 0.25 }}
                                        >
                                            {email.subject || "(No subject)"}
                                        </Typography>

                                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                                            {email.hasAttachments && (
                                                <AttachFileIcon sx={{ fontSize: 12, color: "text.secondary" }} />
                                            )}
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                                noWrap
                                                sx={{ flex: 1, minWidth: 0 }}
                                            >
                                                {email.snippet || ""}
                                            </Typography>
                                        </Stack>
                                    </Box>

                                    {/* Hover Actions */}
                                    {hoveredEmail === email.id && (
                                        <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                                            <Tooltip title="Archive">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // TODO: Archive action
                                                    }}
                                                >
                                                    <ArchiveIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        // TODO: Delete action
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Stack>
                                    )}
                                </Stack>
                            </ListItemButton>
                        ))
                    )}
                </List>
            )}
        </Box>
    );
};
