import crypto from "node:crypto";

function getEncryptionKey() {
  const key = process.env.CREDENTIALS_ENCRYPTION_KEY;

  if (!key || !/^[a-fA-F0-9]{64}$/.test(key)) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY must be a 64-character hexadecimal key.",
    );
  }

  return Buffer.from(key, "hex");
}

export function encryptPassword(password) {
  if (typeof password !== "string" || !password) {
    throw new Error("A valid password is required.");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("hex"),
    authTag.toString("hex"),
    encrypted.toString("hex"),
  ].join(":");
}

export function decryptPassword(encryptedPassword) {
  if (typeof encryptedPassword !== "string") {
    throw new Error("Encrypted password is invalid.");
  }

  const [version, ivHex, authTagHex, encryptedHex] =
    encryptedPassword.split(":");

  if (version !== "v1" || !ivHex || !authTagHex || !encryptedHex) {
    throw new Error("Encrypted password format is invalid.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );

  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Encrypts a password for the "view credentials" feature, but never blocks
 * account creation when CREDENTIALS_ENCRYPTION_KEY is not configured: the
 * account is still created (bcrypt hash) and the admin simply has to reset the
 * password before it can be revealed.
 */
export function tryEncryptPassword(password) {
  try {
    return encryptPassword(password);
  } catch (error) {
    console.warn("Credential encryption skipped:", error.message);
    return null;
  }
}
