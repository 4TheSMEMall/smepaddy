import type { IncomingMessage } from "node:http";

import { AppError } from "../application/AppError.js";
import { prisma } from "../infrastructure/prismaClient.js";
import { verifyAuthToken } from "../security/authToken.js";
import { hashSecret } from "../security/hash.js";

export type AuthenticatedContext = {
  sessionId: string;
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
    phone: string | null;
    status: string;
  };
  business: {
    id: string;
    businessName: string;
    businessType: string;
    location: string | null;
    createdAt: Date;
  } | null;
};

export async function requireAuth(
  request: IncomingMessage,
): Promise<AuthenticatedContext> {
  const token = extractBearerToken(request);
  const tokenPayload = verifyAuthToken(token);

  if (!tokenPayload) {
    throw new AppError("Missing or invalid auth token", 401, "UNAUTHORIZED");
  }

  const session = await prisma.authSession.findFirst({
    where: {
      id: tokenPayload.sessionId,
      userId: tokenPayload.userId,
      tokenHash: hashSecret(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      user: {
        select: {
          id: true,
          email: true,
          fullName: true,
          phone: true,
          status: true,
          businessProfile: {
            select: {
              id: true,
              businessName: true,
              businessType: true,
              location: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (!session) {
    throw new AppError("Session expired or revoked", 401, "SESSION_INVALID");
  }

  await prisma.authSession.update({
    where: { id: session.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    sessionId: session.id,
    user: {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      phone: session.user.phone,
      status: session.user.status,
    },
    business: session.user.businessProfile,
  };
}

function extractBearerToken(request: IncomingMessage) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";

  if (!token) {
    throw new AppError("Missing auth token", 401, "UNAUTHORIZED");
  }

  return token;
}
