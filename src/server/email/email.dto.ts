import * as yup from "yup";

export const createEmailAccountSchema = yup.object({
    email: yup.string().email("Invalid email address").required("Email is required"),
    host: yup.string().min(1, "Host is required").required("Host is required"),
    port: yup
        .number()
        .integer("Port must be an integer")
        .positive("Port must be a positive integer")
        .required("Port is required"),
    username: yup.string().min(1, "Username is required").required("Username is required"),
    password: yup.string().min(1, "Password is required").required("Password is required"),
    tls: yup.boolean().default(true).optional(), // Deprecated, use imapTls
    imapTls: yup.boolean().default(true).optional(),
    smtpHost: yup.string().optional(),
    smtpPort: yup.number().integer().positive().optional(),
    smtpSecure: yup.boolean().default(false).optional(), // true = SSL/TLS, false = STARTTLS
    smtpTls: yup.boolean().default(true).optional(),
    rejectUnauthorized: yup.boolean().default(false).optional(),
});

export const sendEmailSchema = yup.object({
    to: yup.string().email("Invalid recipient email").required("Recipient email is required"),
    subject: yup.string().min(1, "Subject is required").required("Subject is required"),
    text: yup.string().optional(),
    html: yup.string().optional(),
}).test("body-required", "Either text or html body is required", function (value) {
    if (!value) return false;
    return !!(value.text || value.html);
});

export type CreateEmailAccountInput = yup.InferType<typeof createEmailAccountSchema>;
export type SendEmailInput = yup.InferType<typeof sendEmailSchema>;
