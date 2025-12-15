import imaps from "imap-simple";
import nodemailer from "nodemailer";

async function main() {
    const email = "test-verify@localhost";
    const password = "password123";

    console.log(`Testing IMAP connection for ${email}...`);

    const imapConfig = {
        imap: {
            user: email,
            password: password,
            host: "localhost",
            port: 143,
            tls: false,
            authTimeout: 10000,
        },
    };

    try {
        const connection = await imaps.connect(imapConfig);
        console.log("IMAP connection successful!");
        await connection.end();
    } catch (err) {
        console.error("IMAP connection failed:", err);
        process.exit(1);
    }

    console.log(`Testing SMTP connection for ${email}...`);

    const transporter = nodemailer.createTransport({
        host: "localhost",
        port: 587,
        secure: false,
        auth: {
            user: email,
            pass: password,
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    try {
        await transporter.verify();
        console.log("SMTP connection successful!");
    } catch (err) {
        console.error("SMTP connection failed:", err);
        process.exit(1);
    }

    console.log("All connection tests passed.");
}

main().catch(err => {
    console.error("Unexpected error:", err);
    process.exit(1);
});
