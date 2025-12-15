"use client";

import { useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Stack,
    IconButton,
    Box,
    Chip,
    Typography,
} from "@mui/material";
import {
    Close as CloseIcon,
    AttachFile as AttachFileIcon,
    ExpandMore,
    ExpandLess,
} from "@mui/icons-material";
import { toast } from "sonner";
import axios from "axios";

interface ComposeDialogProps {
    open: boolean;
    onClose: () => void;
    replyTo?: {
        subject: string;
        from: string;
        body?: string;
    };
    mode?: "compose" | "reply" | "reply-all" | "forward";
}

export const ComposeDialog = ({ open, onClose, replyTo, mode = "compose" }: ComposeDialogProps) => {
    const [to, setTo] = useState(mode === "reply" || mode === "reply-all" ? replyTo?.from || "" : "");
    const [cc, setCc] = useState("");
    const [bcc, setBcc] = useState("");
    const [subject, setSubject] = useState(
        replyTo
            ? mode === "forward"
                ? `Fwd: ${replyTo.subject}`
                : `Re: ${replyTo.subject}`
            : ""
    );
    const [body, setBody] = useState(
        replyTo && (mode === "reply" || mode === "reply-all" || mode === "forward")
            ? `\n\n--- Original Message ---\n${replyTo.body || ""}`
            : ""
    );
    const [sending, setSending] = useState(false);
    const [showCc, setShowCc] = useState(false);
    const [showBcc, setShowBcc] = useState(false);
    const [attachments, setAttachments] = useState<File[]>([]);

    const handleSend = async () => {
        if (!to || !subject || !body) {
            toast.error("Please fill in To, Subject, and Message");
            return;
        }

        setSending(true);
        try {
            await axios.post("/api/email/send", {
                to,
                cc: cc || undefined,
                bcc: bcc || undefined,
                subject,
                text: body,
                html: `<p>${body.replace(/\n/g, "<br>")}</p>`,
            });
            toast.success("Email sent successfully");
            onClose();
            resetForm();
        } catch (error) {
            console.error("Failed to send  email:", error);
            toast.error("Failed to send email");
        } finally {
            setSending(false);
        }
    };

    const resetForm = () => {
        setTo("");
        setCc("");
        setBcc("");
        setSubject("");
        setBody("");
        setAttachments([]);
        setShowCc(false);
        setShowBcc(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setAttachments([...attachments, ...Array.from(e.target.files)]);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(attachments.filter((_, i) => i !== index));
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ m: 0, p: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                {mode === "compose" ? "New Message" : mode === "reply" ? "Reply" : mode === "reply-all" ? "Reply All" : "Forward"}
                <IconButton aria-label="close" onClick={onClose} sx={{ color: (theme) => theme.palette.grey[500] }}>
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={1.5}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                        <TextField
                            label="To"
                            fullWidth
                            variant="standard"
                            value={to}
                            onChange={(e) => setTo(e.target.value)}
                            helperText="Separate multiple emails with commas"
                        />
                        <Button size="small" onClick={() => setShowCc(!showCc)}>
                            {showCc ? <ExpandLess /> : <ExpandMore />} Cc
                        </Button>
                        <Button size="small" onClick={() => setShowBcc(!showBcc)}>
                            {showBcc ? <ExpandLess /> : <ExpandMore />} Bcc
                        </Button>
                    </Box>

                    {showCc && (
                        <TextField
                            label="Cc"
                            fullWidth
                            variant="standard"
                            value={cc}
                            onChange={(e) => setCc(e.target.value)}
                        />
                    )}

                    {showBcc && (
                        <TextField
                            label="Bcc"
                            fullWidth
                            variant="standard"
                            value={bcc}
                            onChange={(e) => setBcc(e.target.value)}
                        />
                    )}

                    <TextField
                        label="Subject"
                        fullWidth
                        variant="standard"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                    />

                    <TextField
                        label="Message"
                        fullWidth
                        multiline
                        rows={14}
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        sx={{ mt: 2 }}
                    />

                    {attachments.length > 0 && (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1 }}>
                            {attachments.map((file, index) => (
                                <Chip
                                    key={index}
                                    label={file.name}
                                    onDelete={() => removeAttachment(index)}
                                    size="small"
                                />
                            ))}
                        </Box>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions sx={{ p: 2, justifyContent: "space-between" }}>
                <Box>
                    <input
                        type="file"
                        id="attach-file"
                        style={{ display: "none" }}
                        multiple
                        onChange={handleFileSelect}
                    />
                    <label htmlFor="attach-file">
                        <IconButton component="span">
                            <AttachFileIcon />
                        </IconButton>
                    </label>
                    {attachments.length > 0 && (
                        <Typography variant="caption" sx={{ ml: 1 }}>
                            {attachments.length} file(s) attached
                        </Typography>
                    )}
                </Box>
                <Box>
                    <Button onClick={() => { onClose(); resetForm(); }}>Discard</Button>
                    <Button variant="contained" onClick={handleSend} disabled={sending}>
                        {sending ? "Sending..." : "Send"}
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
};
