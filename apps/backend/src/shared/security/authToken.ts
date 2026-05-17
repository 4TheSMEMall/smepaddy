import { createHmac, timingSafeEqual } from "node:crypto";

const secret = process.env.APP_SECRET ?? "sme-paddy-local-development-secret";
const authTokenTtlDays = 7;

export function getAuthTokenExpiry() {
  return new Date(Date.now() + authTokenTtlDays * 24 * 60 * 60 * 1000);
}

export function issueAuthToken(input: {
  userId: string;
  sessionId: string;
  expiresAt: Date;
}) {
  const payload = Buffer.from(
    JSON.stringify({
      userId: input.userId,
      sessionId: input.sessionId,
      purpose: "auth",
      expiresAt: input.expiresAt.toISOString(),
      issuedAt: Date.now(),
    }),
  ).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyAuthToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: string;
      sessionId?: string;
      purpose?: string;
      expiresAt?: string;
    };

    if (decoded.purpose !== "auth" || !decoded.userId || !decoded.sessionId) {
      return null;
    }

    if (!decoded.expiresAt || new Date(decoded.expiresAt).getTime() <= Date.now()) {
      return null;
    }

    return {
      userId: decoded.userId,
      sessionId: decoded.sessionId,
    };
  } catch {
    return null;
  }
}

function sign(payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
