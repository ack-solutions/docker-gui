"use client";

import { useState } from "react";
import {
    Box,
    Typography,
    Avatar,
    Stack,
    IconButton,
    Divider,
    Tooltip,
    CircularProgress,
    Paper,
    Chip
} from "@mui/material";
import {
    Reply as ReplyIcon,
    ReplyAll as ReplyAllIcon,
    Forward as ForwardIcon,
    Delete as DeleteIcon,
    Archive as ArchiveIcon,
    MoreVert as MoreVertIcon,
    StarBorder,
    Star,
    Print as PrintIcon,
    AttachFile as AttachFileIcon,
} from "@mui/icons-material";
import moment from "moment";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { ComposeDialog } from "./compose-dialog";
import { toast } from "sonner";

interface EmailDetailProps {
    emailId: string | null;
}

export const EmailDetail = ({ emailId }: EmailDetailProps) => {
    const [composeMode, setComposeMode] = useState<"reply" | "reply-all" | "forward" | null>(null);
    const [isStarred, setIsStarred] = useState(false);
    const queryClient = useQueryClient();

    const { data: email, isLoading } = useQuery({
        queryKey: ["email", emailId],
        queryFn: async () => {
            if (!emailId) return null;
            const res = await axios.get(`/api/email/messages/${emailId}`);
            return res.data;
        },
        enabled: !!emailId,
    });

    const handleReply = () => {
        if (email) {
            setComposeMode("reply");
        }
    };

    const handleReplyAll = () => {
        if (email) {
            setComposeMode("reply-all");
        }
    };

    const handleForward = () => {
        if (email) {
            setComposeMode("forward");
        }
    };

    const handleDelete = async () => {
        if (confirm("Delete this email?")) {
            toast.info("Delete functionality coming soon");
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const parseSender = (from: string) => {
        const match = from.match(/(.*?)\s*<(.+)>/);
        if (match) {
            return { name: match[1].trim(), email: match[2].trim() };
        }
        return { name: from, email: from };
    };

    if (!emailId) {
        return (
            <Box sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "background.default"
            }}>
                <Typography variant="body1" color="text.secondary">
                    Select an email to view
                </Typography>
            </Box>
        );
    }

    if (isLoading) {
        return (
            <Box sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}>
                <CircularProgress />
            </Box>
        );
    }

    if (!email) {
        return (
            <Box sx={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
            }}>
                <Typography variant="body1" color="text.secondary">
                    Email not found
                </Typography>
            </Box>
        );
    }

    const sender = parseSender(email.from);

    return (
        <>
            <Box sx={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                bgcolor: "background.paper",
                overflow: "hidden"
            }}>
                {/* Compact Actions Bar */}
                <Box sx={{
                    px: 2,
                    py: 1,
                    borderBottom: 1,
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5
                }}>
                    <Tooltip title="Archive">
                        <IconButton size="small">
                            <ArchiveIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                        <IconButton size="small" onClick={handleDelete}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
                    <Tooltip title="Mark as unread">
                        <IconButton size="small">
                            <MoreVertIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Box sx={{ flex: 1 }} />
                    <Typography variant="caption" color="text.secondary">
                        {moment(email.date).format("MMM D, YYYY, h:mm A")}
                    </Typography>
                </Box>

                {/* Email Content */}
                <Box sx={{ flex: 1, overflow: "auto", p: 3 }}>
                    {/* Subject */}
                    <Typography variant="h5" fontWeight={500} sx={{ mb: 3 }}>
                        {email.subject || "(No Subject)"}
                    </Typography>

                    {/* Sender Info */}
                    <Paper
                        elevation={0}
                        sx={{
                            p: 2,
                            mb: 3,
                            bgcolor: "action.hover",
                            borderRadius: 2
                        }}
                    >
                        <Stack direction="row" spacing={2} alignItems="center">
                            <Avatar sx={{ width: 40, height: 40, bgcolor: "primary.main" }}>
                                {sender.name[0]?.toUpperCase()}
                            </Avatar>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="body2" fontWeight={600}>
                                    {sender.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                    {sender.email}
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={0.5}>
                                <Tooltip title="Reply">
                                    <IconButton size="small" onClick={handleReply}>
                                        <ReplyIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Reply All">
                                    <IconButton size="small" onClick={handleReplyAll}>
                                        <ReplyAllIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Forward">
                                    <IconButton size="small" onClick={handleForward}>
                                        <ForwardIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title={isStarred ? "Unstar" : "Star"}>
                                    <IconButton
                                        size="small"
                                        onClick={() => setIsStarred(!isStarred)}
                                        color={isStarred ? "warning" : "default"}
                                    >
                                        {isStarred ? <Star fontSize="small" /> : <StarBorder fontSize="small" />}
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Print">
                                    <IconButton size="small" onClick={handlePrint}>
                                        <PrintIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Stack>

                        {/* Attachments */}
                        {email.hasAttachments && email.attachments && email.attachments.length > 0 && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                    {email.attachments.map((attachment: any, idx: number) => (
                                        <Chip
                                            key={idx}
                                            icon={<AttachFileIcon />}
                                            label={attachment.filename}
                                            size="small"
                                            onClick={() => toast.info("Download functionality coming soon")}
                                        />
                                    ))}
                                </Stack>
                            </Box>
                        )}
                    </Paper>

                    {/* Email Body */}
                    <Box sx={{ 
                        flex: 1, 
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        minHeight: 0
                    }}>
                        {email.htmlBody ? (
                            <Box
                                component="iframe"
                                srcDoc={email.htmlBody}
                                sx={{
                                    width: "100%",
                                    flex: 1,
                                    border: "none",
                                    display: "block",
                                    minHeight: 0
                                }}
                                sandbox="allow-same-origin allow-scripts"
                            />
                        ) : email.textBody ? (
                            <Box sx={{ flex: 1, overflow: "auto", p: 2 }}>
                                <Typography
                                    component="pre"
                                    sx={{
                                        whiteSpace: "pre-wrap",
                                        fontFamily: "inherit",
                                        m: 0,
                                        fontSize: 14,
                                        lineHeight: 1.6
                                    }}
                                >
                                    {email.textBody}
                                </Typography>
                            </Box>
                        ) : (
                            <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <Typography color="text.secondary" fontStyle="italic">
                                    No content available
                                </Typography>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Compose Dialog for Reply/Forward */}
            {composeMode && (
                <ComposeDialog
                    open={true}
                    onClose={() => setComposeMode(null)}
                    mode={composeMode}
                    replyTo={{
                        subject: email.subject,
                        from: email.from,
                        body: email.textBody || email.htmlBody || "",
                    }}
                />
            )}
        </>
    );
};
