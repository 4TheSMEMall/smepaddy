import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import {
  compareSecret,
  generateOtpCode,
  hashSecret,
  normalizeEmail,
  normalizePhone,
} from "../../../shared/security/hash.js";
import { maskEmail, maskPhone } from "../../../shared/security/mask.js";
import { issueOnboardingToken } from "../../../shared/security/onboardingToken.js";
import type {
  AboutYouInput,
  BusinessProfileInput,
  OnboardingRepository,
} from "../domain/onboardingRepository.js";
import type { OtpSender } from "../domain/otpSender.js";

const otpTtlMinutes = 10;
const maxOtpAttempts = 5;
const otpCooldownSeconds = 60;
const maxOtpRequestsPerHour = 5;

export class OnboardingService {
  constructor(
    private readonly repository: OnboardingRepository,
    private readonly otpSender: OtpSender,
  ) {}

  async requestOtp(rawPhone: string) {
    const phone = this.validatePhone(rawPhone);
    logger.info("OTP request accepted for validation", { phone: maskPhone(phone) });
    await this.enforceOtpRateLimit(phone);

    const user = await this.repository.upsertPhonePendingUser(phone);
    const code = generateOtpCode();

    await this.repository.createOtp({
      phone,
      codeHash: hashSecret(code),
      userId: user.id,
      expiresAt: new Date(Date.now() + otpTtlMinutes * 60 * 1000),
    });
    await this.otpSender.send(phone, code);
    logger.info("OTP request completed", {
      phone: maskPhone(phone),
      expiresInSeconds: otpTtlMinutes * 60,
    });

    return {
      phone,
      otpExpiresInSeconds: otpTtlMinutes * 60,
    };
  }

  async requestEmailOtp(rawEmail: string) {
    const email = this.validateEmail(rawEmail);
    logger.info("Email OTP request accepted for validation", {
      email: maskEmail(email),
    });
    await this.enforceOtpRateLimit(email);

    const user = await this.repository.upsertEmailPendingUser(email);
    const code = generateOtpCode();

    await this.repository.createOtp({
      phone: email,
      codeHash: hashSecret(code),
      userId: user.id,
      expiresAt: new Date(Date.now() + otpTtlMinutes * 60 * 1000),
    });
    await this.otpSender.send(email, code);
    logger.info("Email OTP request completed", {
      email: maskEmail(email),
      expiresInSeconds: otpTtlMinutes * 60,
    });

    return {
      email,
      otpExpiresInSeconds: otpTtlMinutes * 60,
    };
  }

  async verifyOtp(rawPhone: string, code: string) {
    const phone = this.validatePhone(rawPhone);
    const cleanCode = code.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      throw new AppError("OTP must be a 6 digit code", 422, "INVALID_OTP");
    }

    const otp = await this.repository.findLatestUsableOtp(phone);
    if (!otp) {
      throw new AppError("OTP has expired or was not requested", 401, "OTP_NOT_FOUND");
    }

    if (otp.attemptCount >= maxOtpAttempts) {
      throw new AppError("Too many OTP attempts. Request a new code.", 429, "OTP_LOCKED");
    }

    if (!compareSecret(cleanCode, otp.codeHash)) {
      await this.repository.incrementOtpAttempt(otp.id);
      throw new AppError("Invalid OTP code", 401, "INVALID_OTP");
    }

    const user = await this.repository.consumeOtpAndVerifyPhoneUser({
      otpId: otp.id,
      phone,
    });

    return {
      userId: user.id,
      onboardingToken: issueOnboardingToken(user.id),
    };
  }

  async verifyEmailOtp(rawEmail: string, code: string) {
    const email = this.validateEmail(rawEmail);
    const cleanCode = code.trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      throw new AppError("OTP must be a 6 digit code", 422, "INVALID_OTP");
    }

    const otp = await this.repository.findLatestUsableOtp(email);
    if (!otp) {
      throw new AppError("OTP has expired or was not requested", 401, "OTP_NOT_FOUND");
    }

    if (otp.attemptCount >= maxOtpAttempts) {
      throw new AppError("Too many OTP attempts. Request a new code.", 429, "OTP_LOCKED");
    }

    if (!compareSecret(cleanCode, otp.codeHash)) {
      await this.repository.incrementOtpAttempt(otp.id);
      throw new AppError("Invalid OTP code", 401, "INVALID_OTP");
    }

    const user = await this.repository.consumeOtpAndVerifyEmailUser({
      otpId: otp.id,
      email,
    });

    return {
      userId: user.id,
      onboardingToken: issueOnboardingToken(user.id),
    };
  }

  async createPin(userId: string, pin: string) {
    if (!/^\d{4}$/.test(pin)) {
      throw new AppError("PIN must be exactly 4 digits", 422, "INVALID_PIN");
    }

    await this.ensureUser(userId);
    await this.repository.setUserPin({ userId, pinHash: hashSecret(pin) });

    return { ok: true };
  }

  async saveBusinessInfo(userId: string, input: BusinessProfileInput) {
    await this.ensureUser(userId);

    if (input.businessName.trim().length < 2) {
      throw new AppError("Business name is required", 422, "BUSINESS_NAME_REQUIRED");
    }

    if (input.businessType.trim().length < 2) {
      throw new AppError("Business type is required", 422, "BUSINESS_TYPE_REQUIRED");
    }

    await this.repository.saveBusinessProfile({
      userId,
      businessName: input.businessName.trim(),
      businessType: input.businessType.trim(),
    });

    return { ok: true };
  }

  async saveAboutYou(userId: string, input: AboutYouInput) {
    await this.ensureUser(userId);

    if (input.fullName.trim().length < 2) {
      throw new AppError("Full name is required", 422, "FULL_NAME_REQUIRED");
    }

    await this.repository.saveAboutYou({
      userId,
      fullName: input.fullName.trim(),
      email: input.email?.trim() || undefined,
    });

    return { ok: true };
  }

  async saveLocation(userId: string, location: string) {
    await this.ensureUser(userId);

    if (location.trim().length < 2) {
      throw new AppError("Location is required", 422, "LOCATION_REQUIRED");
    }

    await this.repository.saveLocation({ userId, location: location.trim() });
    await this.repository.markOnboarded(userId);

    return { ok: true };
  }

  private validatePhone(rawPhone: string) {
    const phone = normalizePhone(rawPhone);

    if (!/^\+?\d{10,15}$/.test(phone)) {
      throw new AppError("Enter a valid phone number", 422, "INVALID_PHONE");
    }

    return phone;
  }

  private validateEmail(rawEmail: string) {
    const email = normalizeEmail(rawEmail);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AppError("Enter a valid email address", 422, "INVALID_EMAIL");
    }

    return email;
  }

  private async ensureUser(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");
    return user;
  }

  private async enforceOtpRateLimit(recipient: string) {
    const throttle = await this.repository.checkAndRecordOtpRequest({
      phone: recipient,
      now: new Date(),
      cooldownSeconds: otpCooldownSeconds,
      maxRequestsPerHour: maxOtpRequestsPerHour,
    });
    const maskedRecipient = recipient.includes("@")
      ? maskEmail(recipient)
      : maskPhone(recipient);

    if (!throttle.allowed && throttle.reason === "COOLDOWN") {
      logger.warn("OTP cooldown rejected request", {
        recipient: maskedRecipient,
        retryAfterSeconds: throttle.retryAfterSeconds,
      });
      throw new AppError(
        `Please wait ${throttle.retryAfterSeconds}s before requesting another OTP`,
        429,
        "OTP_COOLDOWN",
      );
    }

    if (!throttle.allowed && throttle.reason === "HOURLY_LIMIT") {
      logger.warn("OTP hourly limit rejected request", {
        recipient: maskedRecipient,
        maxOtpRequestsPerHour,
        retryAfterSeconds: throttle.retryAfterSeconds,
      });
      throw new AppError(
        `Too many OTP requests. Try again in ${Math.ceil(throttle.retryAfterSeconds / 60)} minutes.`,
        429,
        "OTP_RATE_LIMITED",
      );
    }

    logger.info("OTP rate limit passed", {
      recipient: maskedRecipient,
      maxOtpRequestsPerHour,
    });
  }
}
