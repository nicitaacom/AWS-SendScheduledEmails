"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptResend = decryptResend;
async function decryptResend(encryptedEnv) {
    try {
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        const secretKey = JSON.stringify({
            secret: "DB",
            provider: "resend",
            APIKey: "someAPIKeyHere",
        });
        // Decode base64 to Uint8Array
        const encryptedData = Buffer.from(encryptedEnv, "base64");
        // Extract the salt, iv, and encrypted content
        const salt = encryptedData.slice(0, 16);
        const iv = encryptedData.slice(16, 28);
        const encrypted = encryptedData.slice(28);
        const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(secretKey), { name: "PBKDF2" }, false, [
            "deriveKey",
        ]);
        // Derive the key
        const key = await crypto.subtle.deriveKey({
            name: "PBKDF2",
            salt: salt,
            iterations: 310000,
            hash: "SHA-256",
        }, keyMaterial, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
        // Decrypt the data
        const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, encrypted);
        // Parse the decrypted data as JSON to extract key-value object
        const decodedText = decoder.decode(decrypted);
        const result = JSON.parse(decodedText);
        // Ensure the object contains only key and value fields
        if (Object.keys(result).length !== 2 || !('key' in result) || !('value' in result)) {
            return "error: decrypted object must contain only key and value fields";
        }
        return { key: result.key, value: result.value };
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during decryption.";
        return `Decryption failed: ${errorMessage}`;
    }
}
