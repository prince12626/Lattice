import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env.config.js";
import { Buffer } from "node:buffer";

const ALGORITHM = "aes-256-gcm";
const KEY = Buffer.from(env.ENCRYPTION_KEY, "hex");
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export function encryptSecret(plaintext: string): string {
  if (!plaintext.trim()) {
    throw new Error("Secret cannot be empty");
  }

  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, KEY, iv);

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    authTag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(".");
}

export function decryptSecret(encrypted: string): string {
  const parts = encrypted.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }

  const [ivEncoded, tagEncoded, ciphertextEncoded] = parts;

  if (!ivEncoded || !tagEncoded || ciphertextEncoded === undefined) {
    throw new Error("Invalid encrypted secret components");
  }

  const iv = Buffer.from(ivEncoded, "base64");
  const authTag = Buffer.from(tagEncoded, "base64");
  const ciphertext = Buffer.from(ciphertextEncoded, "base64");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("Invalid encrypted secret components");
  }

  const decipher = createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
