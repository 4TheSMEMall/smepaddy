import { OtpPurpose } from "@prisma/client";

import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type {
  AuthRepository,
  LoginOtpRecord,
  LoginThrottleDecision,
} from "../domain/authRepository.js";

export class PrismaAuthRepository implements AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
      },
    });
  }

  async checkAndRecordLoginOtpRequest(input: {
    email: string;
    now: Date;
    cooldownSeconds: number;
    maxRequestsPerHour: number;
  }): Promise<LoginThrottleDecision> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.otpRequestThrottle.findUnique({
        where: { phone: input.email },
      });

      if (!existing) {
        await tx.otpRequestThrottle.create({
          data: {
            phone: input.email,
            lastRequestedAt: input.now,
            hourlyWindowStartedAt: input.now,
            hourlyCount: 1,
          },
        });
        return { allowed: true } as const;
      }

      const millisecondsSinceLastRequest =
        input.now.getTime() - existing.lastRequestedAt.getTime();
      const cooldownMilliseconds = input.cooldownSeconds * 1000;

      if (millisecondsSinceLastRequest < cooldownMilliseconds) {
        return {
          allowed: false,
          reason: "COOLDOWN",
          retryAfterSeconds: Math.ceil(
            (cooldownMilliseconds - millisecondsSinceLastRequest) / 1000,
          ),
        };
      }

      const windowAgeMilliseconds =
        input.now.getTime() - existing.hourlyWindowStartedAt.getTime();
      const hourMilliseconds = 60 * 60 * 1000;
      const isSameHourlyWindow = windowAgeMilliseconds < hourMilliseconds;

      if (isSameHourlyWindow && existing.hourlyCount >= input.maxRequestsPerHour) {
        return {
          allowed: false,
          reason: "HOURLY_LIMIT",
          retryAfterSeconds: Math.ceil(
            (hourMilliseconds - windowAgeMilliseconds) / 1000,
          ),
        };
      }

      await tx.otpRequestThrottle.update({
        where: { phone: input.email },
        data: {
          lastRequestedAt: input.now,
          hourlyWindowStartedAt: isSameHourlyWindow
            ? existing.hourlyWindowStartedAt
            : input.now,
          hourlyCount: isSameHourlyWindow ? { increment: 1 } : 1,
        },
      });

      return { allowed: true } as const;
    });
  }

  async createLoginOtp(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
    userId: string;
  }) {
    await prisma.otpCode.create({
      data: {
        phone: input.email,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        userId: input.userId,
        purpose: OtpPurpose.LOGIN,
      },
    });
  }

  async findLatestUsableLoginOtp(email: string): Promise<LoginOtpRecord | null> {
    return prisma.otpCode.findFirst({
      where: {
        phone: email,
        purpose: OtpPurpose.LOGIN,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        codeHash: true,
        attemptCount: true,
        expiresAt: true,
        userId: true,
      },
    });
  }

  async incrementLoginOtpAttempt(otpId: string) {
    await prisma.otpCode.update({
      where: { id: otpId },
      data: { attemptCount: { increment: 1 } },
    });
  }

  async consumeLoginOtp(otpId: string) {
    await prisma.otpCode.update({
      where: { id: otpId },
      data: { consumedAt: new Date() },
    });
  }

  async createSession(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }) {
    await prisma.authSession.create({
      data: input,
    });
  }
}
