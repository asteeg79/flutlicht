// Übernommen aus Workgrid lib/crypto.ts, angepasst: feste Tag-Länge beim Entschlüsseln.
import {
  createHmac,
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * AES-256-GCM Verschlüsselung mit user-spezifischem Schlüssel.
 * Key = HMAC-SHA256(APP_ENCRYPTION_SECRET, userId) → 32 Byte.
 * Format: base64( iv[12] | authTag[16] | ciphertext ).
 */

function deriveKey(userId: string): Buffer {
  const secret = process.env.APP_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error("APP_ENCRYPTION_SECRET ist nicht gesetzt");
  }
  return createHmac("sha256", secret).update(userId).digest();
}

export function encrypt(data: string, userId: string): string {
  const key = deriveKey(userId);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(data, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decrypt(encryptedData: string, userId: string): string {
  const key = deriveKey(userId);
  const buffer = Buffer.from(encryptedData, "base64");
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  // Feste Tag-Länge: Ohne sie nähme GCM auch verkürzte Tags (ab 4 Byte) an.
  const decipher = createDecipheriv("aes-256-gcm", key, iv, {
    authTagLength: 16,
  });
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
