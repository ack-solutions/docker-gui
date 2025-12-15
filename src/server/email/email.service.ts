import { prisma } from "@/server/database/client";
import { CreateEmailAccountInput, SendEmailInput } from "./email.dto";
import * as nodemailer from "nodemailer";
import { encrypt, decrypt } from "@/server/utils/encryption";
import imaps from "imap-simple";
import { simpleParser } from "mailparser";
import { createMailUser, deleteMailUser, updateMailUserPassword } from "./mailserver.utils";

export class EmailService {
    static async getAccounts(userId: string) {
        return prisma.emailAccount.findMany({
            where: { userId },
            select: {
                id: true,
                email: true,
                host: true,
                port: true,
                username: true,
                tls: true,
                imapTls: true,
                createdAt: true,
                updatedAt: true,
                folders: true,
                smtpHost: true,
                smtpPort: true,
                smtpSecure: true,
                smtpTls: true,
                rejectUnauthorized: true,
            },
        });
    }

    static async createAccount(userId: string, data: CreateEmailAccountInput) {
        // Check if this is a local account request
        const isLocalAccount = data.email.endsWith("@localhost") || data.host === "localhost" || data.host === "mailserver";

        if (isLocalAccount) {
            try {
                await createMailUser(data.email, data.password);
            } catch (err) {
                console.error("Failed to create local mail user, proceeding anyway in case it exists:", err);
            }
        }

        // Use imapTls if provided, fallback to tls for backward compatibility
        const imapTls = data.imapTls !== undefined ? data.imapTls : (data.tls !== undefined ? data.tls : true);
        const rejectUnauthorized = data.rejectUnauthorized !== undefined ? data.rejectUnauthorized : false;

        // Verify credentials by connecting
        try {
            const config = {
                imap: {
                    user: data.username,
                    password: data.password,
                    host: data.host,
                    port: data.port || 993,
                    tls: imapTls,
                    authTimeout: 3000,
                    tlsOptions: { 
                        rejectUnauthorized: rejectUnauthorized 
                    },
                },
            };

            const connection = await imaps.connect(config);
            await connection.end();
        } catch (error) {
            // If we just created it, maybe we should rollback (delete it)?
            // For now, just throw.
            if (isLocalAccount) {
                // Try to cleanup
                try { await deleteMailUser(data.email); } catch (e) { }
            }
            throw new Error("Failed to connect to IMAP server. Check credentials. " + (error as any).message);
        }

        const account = await prisma.emailAccount.create({
            data: {
                userId,
                email: data.email,
                host: data.host,
                port: data.port,
                username: data.username,
                password: encrypt(data.password),
                tls: imapTls, // Keep for backward compatibility
                imapTls: imapTls,
                smtpHost: data.smtpHost,
                smtpPort: data.smtpPort,
                smtpSecure: data.smtpSecure !== undefined ? data.smtpSecure : false,
                smtpTls: data.smtpTls !== undefined ? data.smtpTls : true,
                rejectUnauthorized: rejectUnauthorized,
            },
        });

        // Create default folders
        const defaultFolders = ["INBOX", "Sent", "Drafts", "Trash", "Junk"];
        await prisma.emailFolder.createMany({
            data: defaultFolders.map((folder) => ({
                accountId: account.id,
                name: folder,
                path: folder,
                type: folder.toLowerCase() === "inbox" ? "inbox" : "custom",
            })),
        });

        return account;
    }

    static async deleteAccount(userId: string, accountId: string) {
        const account = await prisma.emailAccount.findFirst({
            where: { id: accountId, userId },
        });

        if (!account) {
            throw new Error("Account not found");
        }

        // If local account, delete from mailserver
        if (account.email.endsWith("@localhost") || account.host === "localhost" || account.host === "mailserver") {
            try {
                await deleteMailUser(account.email);
            } catch (err) {
                console.error("Failed to delete local mail user:", err);
            }
        }

        return prisma.emailAccount.delete({
            where: { id: accountId },
        });
    }

    static async updateAccount(userId: string, accountId: string, data: Partial<CreateEmailAccountInput>) {
        const account = await prisma.emailAccount.findFirst({
            where: { id: accountId, userId },
        });

        if (!account) {
            throw new Error("Account not found");
        }

        const updateData: any = { ...data };
        if (data.password) {
            updateData.password = encrypt(data.password);

            // If local account, update password on mailserver
            if (account.email.endsWith("@localhost") || account.host === "localhost" || account.host === "mailserver") {
                try {
                    await updateMailUserPassword(account.email, data.password);
                } catch (err) {
                    console.error("Failed to update local mail user password:", err);
                }
            }
        }

        return prisma.emailAccount.update({
            where: { id: accountId },
            data: updateData,
        });
    }

    static async sendEmail(userId: string, data: SendEmailInput) {
        const account = await prisma.emailAccount.findFirst({
            where: { userId },
        });

        if (!account) {
            throw new Error("No email account configured");
        }

        const decryptedPassword = decrypt(account.password);

        // Use smtpSecure if available, otherwise determine from port
        const smtpSecure = account.smtpSecure !== undefined 
            ? account.smtpSecure 
            : (account.smtpPort === 465 || account.smtpPort === 994);

        const transporter = nodemailer.createTransport({
            host: account.smtpHost || "smtp.gmail.com", // Fallback for backward compatibility
            port: account.smtpPort || 587,
            secure: smtpSecure, // true for SSL/TLS (port 465), false for STARTTLS (port 587)
            requireTLS: account.smtpTls !== undefined ? account.smtpTls : true,
            auth: {
                user: account.username,
                pass: decryptedPassword,
            },
            tls: {
                rejectUnauthorized: account.rejectUnauthorized !== undefined ? account.rejectUnauthorized : false,
            },
        });

        const info = await transporter.sendMail({
            from: `"${account.username}" <${account.email}>`,
            to: data.to,
            subject: data.subject,
            text: data.text,
            html: data.html,
        });

        return { messageId: info.messageId };
    }

    static async syncAccount(userId: string, accountId: string) {
        const account = await prisma.emailAccount.findFirst({
            where: { id: accountId, userId },
            include: { folders: true },
        });

        if (!account) {
            throw new Error("Account not found");
        }

        const decryptedPassword = decrypt(account.password);

        // Use imapTls if available, fallback to tls for backward compatibility
        const imapTls = account.imapTls !== undefined ? account.imapTls : (account.tls !== undefined ? account.tls : true);
        const rejectUnauthorized = account.rejectUnauthorized !== undefined ? account.rejectUnauthorized : false;

        const config = {
            imap: {
                user: account.username,
                password: decryptedPassword,
                host: account.host,
                port: account.port || 993,
                tls: imapTls,
                authTimeout: 10000,
                tlsOptions: { 
                    rejectUnauthorized: rejectUnauthorized 
                },
            },
        };

        const connection = await imaps.connect(config);

        try {
            // 1. Sync Folders
            const boxes = await connection.getBoxes();
            const folderNames: string[] = [];

            const processBoxes = (boxList: any, parent: string = "") => {
                for (const key in boxList) {
                    const box = boxList[key];
                    const fullPath = parent ? `${parent}${box.delimiter}${key}` : key;
                    folderNames.push(fullPath);
                    if (box.children) {
                        processBoxes(box.children, fullPath);
                    }
                }
            };
            processBoxes(boxes);

            // Create missing folders in DB
            for (const path of folderNames) {
                const existing = account.folders.find((f) => f.path === path);
                if (!existing) {
                    // Determine type
                    let type = "custom";
                    const lower = path.toLowerCase();
                    if (lower.includes("inbox")) type = "inbox";
                    else if (lower.includes("sent")) type = "sent";
                    else if (lower.includes("trash")) type = "trash";
                    else if (lower.includes("draft")) type = "drafts";
                    else if (lower.includes("junk") || lower.includes("spam")) type = "junk";

                    await prisma.emailFolder.create({
                        data: {
                            accountId: account.id,
                            name: path.split(boxes.INBOX ? boxes.INBOX.delimiter : "/").pop() || path,
                            path: path,
                            type,
                        },
                    });
                }
            }

            // Refresh folders list
            const updatedFolders = await prisma.emailFolder.findMany({ where: { accountId: account.id } });

            // 2. Sync Emails for each folder
            for (const folder of updatedFolders) {
                try {
                    await connection.openBox(folder.path);

                    // Fetch unseen or recent emails (last 30 days for example, or just last 50)
                    // For now, let's fetch last 20 messages to be safe and fast
                    const searchCriteria = ["ALL"];
                    const fetchOptions = {
                        bodies: ["HEADER", "TEXT", ""], // Empty string fetches full body
                        markSeen: false,
                        struct: true,
                    };

                    // Limit to last 20
                    const messages = await connection.search(searchCriteria, fetchOptions);
                    const recentMessages = messages.slice(-20);

                    for (const message of recentMessages) {
                        const uid = message.attributes.uid;

                        // Check if exists
                        const existing = await prisma.email.findFirst({
                            where: { folderId: folder.id, uid },
                        });

                        if (!existing) {
                            const allParts = message.parts;
                            const headerPart = allParts.find((p) => p.which === "HEADER");
                            const bodyPart = allParts.find((p) => p.which === ""); // Full body

                            if (bodyPart && bodyPart.body) {
                                const parsed = await simpleParser(bodyPart.body);

                                await prisma.email.create({
                                    data: {
                                        folderId: folder.id,
                                        uid: uid,
                                        subject: parsed.subject || "No Subject",
                                        from: parsed.from?.text || "Unknown",
                                        to: parsed.to ? JSON.parse(JSON.stringify(parsed.to)) : [],
                                        cc: parsed.cc ? JSON.parse(JSON.stringify(parsed.cc)) : undefined,
                                        bcc: parsed.bcc ? JSON.parse(JSON.stringify(parsed.bcc)) : undefined,
                                        date: parsed.date || new Date(),
                                        textBody: parsed.text,
                                        htmlBody: parsed.html || parsed.textAsHtml,
                                        isRead: message.attributes.flags.includes("\\Seen"),
                                        hasAttachments: parsed.attachments && parsed.attachments.length > 0,
                                    },
                                });
                            }
                        } else {
                            // Update flags if changed
                            const isRead = message.attributes.flags.includes("\\Seen");
                            if (existing.isRead !== isRead) {
                                await prisma.email.update({
                                    where: { id: existing.id },
                                    data: { isRead },
                                });
                            }
                        }
                    }
                } catch (err) {
                    console.error(`Failed to sync folder ${folder.path}:`, err);
                    // Continue to next folder
                }
            }

        } finally {
            await connection.end();
        }

        return { success: true };
    }
    static async getEmails(userId: string, folderId: string, page: number = 1, limit: number = 20) {
        const skip = (page - 1) * limit;

        // Verify folder belongs to user's account
        const folder = await prisma.emailFolder.findFirst({
            where: { id: folderId, account: { userId } },
        });

        if (!folder) {
            throw new Error("Folder not found");
        }

        const [emails, total] = await Promise.all([
            prisma.email.findMany({
                where: { folderId },
                orderBy: { date: "desc" },
                skip,
                take: limit,
                select: {
                    id: true,
                    subject: true,
                    from: true,
                    to: true,
                    date: true,
                    isRead: true,
                    hasAttachments: true,
                    // Don't fetch body for list view to save bandwidth
                },
            }),
            prisma.email.count({ where: { folderId } }),
        ]);

        return { emails, total, page, totalPages: Math.ceil(total / limit) };
    }

    static async getEmail(userId: string, emailId: string) {
        const email = await prisma.email.findFirst({
            where: {
                id: emailId,
                folder: { account: { userId } }
            },
            include: {
                attachments: true,
            }
        });

        if (!email) {
            throw new Error("Email not found");
        }

        return email;
    }
}
