import { createHmac, timingSafeEqual } from "node:crypto";

const secret = process.env.APP_SECRET ?? "sme-paddy-local-development-secret";

export function issueOnboardingToken(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({ userId, purpose: "onboarding", issuedAt: Date.now() }),
  ).toString("base64url");
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function verifyOnboardingToken(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);

  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: string;
      purpose?: string;
    };

    return decoded.purpose === "onboarding" && decoded.userId ? decoded.userId : null;
  } catch {
    return null;
  }
}

function sign(payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
