import { randomUUID } from "node:crypto";

import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import {
  compareSecret,
  generateOtpCode,
  hashSecret,
  normalizeEmail,
} from "../../../shared/security/hash.js";
import { maskEmail } from "../../../shared/security/mask.js";
import {
  getAuthTokenExpiry,
  issueAuthToken,
} from "../../../shared/security/authToken.js";
import type { OtpSender } from "../../onboarding/domain/otpSender.js";
import type { AuthRepository } from "../domain/authRepository.js";

const otpTtlMinutes = 10;
const maxOtpAttempts = 5;
const otpCooldownSeconds = 60;
const maxOtpRequestsPerHour = 5;

export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly otpSender: OtpSender,
  ) {}

  async requestLoginOtp(rawEmail: string) {
    const email = this.validateEmail(rawEmail);
    logger.info("Login OTP request accepted", { email: maskEmail(email) });
    await this.enforceLoginOtpRateLimit(email);

    const user = await this.repository.findUserByEmail(email);

    if (!user || user.status !== "ONBOARDED") {
      logger.warn("Login OTP requested for unavailable account", {
        email: maskEmail(email),
        reason: !user ? "USER_NOT_FOUND" : user.status,
      });
      return {
        email,
        otpExpiresInSeconds: otpTtlMinutes * 60,
      };
    }

    const code = generateOtpCode();
    await this.repository.createLoginOtp({
      email,
      codeHash: hashSecret(code),
      userId: user.id,
      expiresAt: new Date(Date.now() + otpTtlMinutes * 60 * 1000),
    });
    await this.otpSender.send(email, code);

    logger.info("Login OTP request completed", {
      email: maskEmail(email),
      expiresInSeconds: otpTtlMinutes * 60,
    });

    return {
      email,
      otpExpiresInSeconds: otpTtlMinutes * 60,
    };
  }

  async verifyLoginOtp(rawEmail: string, code: string) {
    const email = this.validateEmail(rawEmail);
    const cleanCode = code.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      throw new AppError("OTP must be a 6 digit code", 422, "INVALID_OTP");
    }

    const otp = await this.repository.findLatestUsableLoginOtp(email);
    if (!otp || !otp.userId) {
      throw new AppError("OTP has expired or was not requested", 401, "OTP_NOT_FOUND");
    }

    if (otp.attemptCount >= maxOtpAttempts) {
      throw new AppError("Too many OTP attempts. Request a new code.", 429, "OTP_LOCKED");
    }

    if (!compareSecret(cleanCode, otp.codeHash)) {
      await this.repository.incrementLoginOtpAttempt(otp.id);
      throw new AppError("Invalid OTP code", 401, "INVALID_OTP");
    }

    const user = await this.repository.findUserByEmail(email);
    if (!user || user.status !== "ONBOARDED" || user.id !== otp.userId) {
      throw new AppError("Account is not ready for login", 403, "ACCOUNT_NOT_READY");
    }

    await this.repository.consumeLoginOtp(otp.id);

    const sessionId = randomUUID();
    const expiresAt = getAuthTokenExpiry();
    const accessToken = issueAuthToken({
      userId: user.id,
      sessionId,
      expiresAt,
    });

    await this.repository.createSession({
      id: sessionId,
      userId: user.id,
      tokenHash: hashSecret(accessToken),
      expiresAt,
    });

    logger.info("Login completed", {
      email: maskEmail(email),
      userId: user.id,
      sessionId,
    });

    return {
      accessToken,
      expiresAt: expiresAt.toISOString(),
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      },
    };
  }

  private validateEmail(rawEmail: string) {
    const email = normalizeEmail(rawEmail);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError("Enter a valid email address", 422, "INVALID_EMAIL");
    }

    return email;
  }

  private async enforceLoginOtpRateLimit(email: string) {
    const throttle = await this.repository.checkAndRecordLoginOtpRequest({
      email,
      now: new Date(),
      cooldownSeconds: otpCooldownSeconds,
      maxRequestsPerHour: maxOtpRequestsPerHour,
    });

    if (!throttle.allowed && throttle.reason === "COOLDOWN") {
      logger.warn("Login OTP cooldown rejected request", {
        email: maskEmail(email),
        retryAfterSeconds: throttle.retryAfterSeconds,
      });
      throw new AppError(
        `Please wait ${throttle.retryAfterSeconds}s before requesting another OTP`,
        429,
        "OTP_COOLDOWN",
      );
    }

    if (!throttle.allowed && throttle.reason === "HOURLY_LIMIT") {
      logger.warn("Login OTP hourly limit rejected request", {
        email: maskEmail(email),
        maxOtpRequestsPerHour,
        retryAfterSeconds: throttle.retryAfterSeconds,
      });
      throw new AppError(
        `Too many OTP requests. Try again in ${Math.ceil(throttle.retryAfterSeconds / 60)} minutes.`,
        429,
        "OTP_RATE_LIMITED",
      );
    }
  }
}
