import crypto from "crypto";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({path: path.resolve(__dirname, "../../.env.secret")});

export class EncryptionManager {
    private static ALGORITHM = "aes-256-cbc";
    private static IV_LENGTH = 16; // For AES, this is always 16 bytes

    /**
     * Encrypts a text using AES-256-CBC
     * @param text The text to encrypt
     * @returns Encrypted string
     */
    static encrypt(text: string): string {
        const key = this.getEncryptionKey();
        const iv = crypto.randomBytes(this.IV_LENGTH); // Initialization vector
        const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

        let encrypted = cipher.update(text, "utf8", "hex");
        encrypted += cipher.final("hex");

        // Combine IV and encrypted text for storage
        return `${iv.toString("hex")}:${encrypted}`;
    }

    /**
     * Decrypts an encrypted string using AES-256-CBC
     * @param encryptedText The encrypted string
     * @returns Decrypted string
     */
    static decrypt(encryptedText: string): string {
        const key = this.getEncryptionKey();

        // Split IV and encrypted text
        const [iv, encrypted] = encryptedText.split(":");
        if (!iv || !encrypted) {
            throw new Error("Invalid encrypted text format");
        }

        const decipher = crypto.createDecipheriv(
            this.ALGORITHM,
            key,
            Buffer.from(iv, "hex")
        );

        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        return decrypted;
    }

    /**
     * Retrieves the encryption key from environment variables
     * @returns Buffer with the encryption key
     */
    private static getEncryptionKey(): Buffer {
        const key = process.env.ENCRYPTION_KEY;
        if (!key) {
            throw new Error("ENCRYPTION_KEY is not set in environment variables");
        }
        return Buffer.from(key, "hex");
    }
}
