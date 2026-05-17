import { OtpPurpose, Prisma, UserStatus } from "@prisma/client";

import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type {
  AboutYouInput,
  BusinessProfileInput,
  OnboardingRepository,
  OtpThrottleDecision,
  OtpRecord,
  UserRecord,
} from "../domain/onboardingRepository.js";

export class PrismaOnboardingRepository implements OnboardingRepository {
  async upsertPhonePendingUser(phone: string): Promise<UserRecord> {
    const user = await prisma.user.upsert({
      where: { phone },
      update: {},
      create: { phone, status: UserStatus.PHONE_PENDING },
      select: { id: true, phone: true, email: true, status: true },
    });

    return user;
  }

  async upsertEmailPendingUser(email: string): Promise<UserRecord> {
    return prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, status: UserStatus.AUTH_PENDING },
      select: { id: true, phone: true, email: true, status: true },
    });
  }

  async findUserById(userId: string): Promise<UserRecord | null> {
    return prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, phone: true, email: true, status: true },
    });
  }

  async checkAndRecordOtpRequest(input: {
    phone: string;
    now: Date;
    cooldownSeconds: number;
    maxRequestsPerHour: number;
  }): Promise<OtpThrottleDecision> {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.otpRequestThrottle.findUnique({
        where: { phone: input.phone },
      });

      if (!existing) {
        await tx.otpRequestThrottle.create({
          data: {
            phone: input.phone,
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
        where: { phone: input.phone },
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

  async createOtp(input: {
    phone: string;
    codeHash: string;
    expiresAt: Date;
    userId: string;
  }): Promise<void> {
    await prisma.otpCode.create({
      data: {
        phone: input.phone,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        userId: input.userId,
        purpose: OtpPurpose.SIGNUP,
      },
    });
  }

  async findLatestUsableOtp(phone: string): Promise<OtpRecord | null> {
    return prisma.otpCode.findFirst({
      where: {
        phone,
        purpose: OtpPurpose.SIGNUP,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        codeHash: true,
        attemptCount: true,
        expiresAt: true,
      },
    });
  }

  async countOtpRequestsSince(input: {
    phone: string;
    since: Date;
  }): Promise<number> {
    return prisma.otpCode.count({
      where: {
        phone: input.phone,
        purpose: OtpPurpose.SIGNUP,
        createdAt: { gte: input.since },
      },
    });
  }

  async incrementOtpAttempt(otpId: string): Promise<void> {
    await prisma.otpCode.update({
      where: { id: otpId },
      data: { attemptCount: { increment: 1 } },
    });
  }

  async consumeOtpAndVerifyPhoneUser(input: {
    otpId: string;
    phone: string;
  }): Promise<UserRecord> {
    return prisma.$transaction(async (tx) => {
      await tx.otpCode.update({
        where: { id: input.otpId },
        data: { consumedAt: new Date() },
      });

      const user = await tx.user.update({
        where: { phone: input.phone },
        data: { status: UserStatus.OTP_VERIFIED },
        select: { id: true, phone: true, email: true, status: true },
      });

      return user;
    });
  }

  async consumeOtpAndVerifyEmailUser(input: {
    otpId: string;
    email: string;
  }): Promise<UserRecord> {
    return prisma.$transaction(async (tx) => {
      await tx.otpCode.update({
        where: { id: input.otpId },
        data: { consumedAt: new Date() },
      });

      return tx.user.update({
        where: { email: input.email },
        data: { status: UserStatus.OTP_VERIFIED },
        select: { id: true, phone: true, email: true, status: true },
      });
    });
  }

  async setUserPin(input: { userId: string; pinHash: string }): Promise<void> {
    await prisma.user.update({
      where: { id: input.userId },
      data: { pinHash: input.pinHash },
    });
  }

  async saveBusinessProfile(
    input: BusinessProfileInput & { userId: string },
  ): Promise<void> {
    await prisma.businessProfile.upsert({
      where: { userId: input.userId },
      update: {
        businessName: input.businessName,
        businessType: input.businessType,
      },
      create: {
        userId: input.userId,
        businessName: input.businessName,
        businessType: input.businessType,
      },
    });
  }

  async saveAboutYou(input: AboutYouInput & { userId: string }): Promise<void> {
    await prisma.user.update({
      where: { id: input.userId },
      data: {
        fullName: input.fullName,
        email: input.email,
      },
    });
  }

  async saveLocation(input: { userId: string; location: string }): Promise<void> {
    await prisma.businessProfile.update({
      where: { userId: input.userId },
      data: { location: input.location },
    });
  }

  async markOnboarded(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { status: UserStatus.ONBOARDED },
    });
  }
}
