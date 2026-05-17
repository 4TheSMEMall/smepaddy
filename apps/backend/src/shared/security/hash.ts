import { createHash, randomInt, timingSafeEqual } from "node:crypto";

const pepper = process.env.AUTH_HASH_PEPPER ?? "sme-paddy-dev-pepper";

export function generateOtpCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

export function hashSecret(value: string) {
  return createHash("sha256").update(`${value}:${pepper}`).digest("hex");
}

export function compareSecret(value: string, hash: string) {
  const left = Buffer.from(hashSecret(value), "hex");
  const right = Buffer.from(hash, "hex");

  return left.length === right.length && timingSafeEqual(left, right);
}

export function normalizePhone(phone: string) {
  const trimmed = phone.trim().replace(/\s+/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("0")) return `+234${trimmed.slice(1)}`;
  return trimmed;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}
