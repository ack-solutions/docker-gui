import crypto from 'crypto';

// In a real app, these should be in environment variables
const ALGORITHM = 'aes-256-cbc';
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '12345678901234567890123456789012'; // Must be 32 chars
const IV_LENGTH = 16;

export function encrypt(text: string): string {
    const iv: Buffer = crypto.randomBytes(IV_LENGTH);
    const key: Buffer = Buffer.from(ENCRYPTION_KEY);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted: Buffer = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
    const textParts = text.split(':');
    const ivHex = textParts.shift();
    const encryptedHex = textParts.join(':');

    if (!ivHex || !encryptedHex) {
        throw new Error('Invalid encrypted text format');
    }

    const iv: Buffer = Buffer.from(ivHex, 'hex');
    const encryptedText: Buffer = Buffer.from(encryptedHex, 'hex');
    const key: Buffer = Buffer.from(ENCRYPTION_KEY);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted: Buffer = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
