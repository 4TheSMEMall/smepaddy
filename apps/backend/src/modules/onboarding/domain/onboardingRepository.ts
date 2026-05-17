export type UserStatus =
  | "AUTH_PENDING"
  | "PHONE_PENDING"
  | "OTP_VERIFIED"
  | "ONBOARDED";

export type UserRecord = {
  id: string;
  phone: string | null;
  email: string | null;
  status: UserStatus;
};

export type OtpRecord = {
  id: string;
  codeHash: string;
  attemptCount: number;
  expiresAt: Date;
};

export type BusinessProfileInput = {
  businessName: string;
  businessType: string;
};

export type AboutYouInput = {
  fullName: string;
  email?: string;
};

export type OtpThrottleDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "COOLDOWN" | "HOURLY_LIMIT";
      retryAfterSeconds: number;
    };

export interface OnboardingRepository {
  upsertPhonePendingUser(phone: string): Promise<UserRecord>;
  upsertEmailPendingUser(email: string): Promise<UserRecord>;
  findUserById(userId: string): Promise<UserRecord | null>;
  checkAndRecordOtpRequest(input: {
    phone: string;
    now: Date;
    cooldownSeconds: number;
    maxRequestsPerHour: number;
  }): Promise<OtpThrottleDecision>;
  createOtp(input: {
    phone: string;
    codeHash: string;
    expiresAt: Date;
    userId: string;
  }): Promise<void>;
  findLatestUsableOtp(phone: string): Promise<OtpRecord | null>;
  countOtpRequestsSince(input: { phone: string; since: Date }): Promise<number>;
  incrementOtpAttempt(otpId: string): Promise<void>;
  consumeOtpAndVerifyPhoneUser(input: {
    otpId: string;
    phone: string;
  }): Promise<UserRecord>;
  consumeOtpAndVerifyEmailUser(input: {
    otpId: string;
    email: string;
  }): Promise<UserRecord>;
  setUserPin(input: { userId: string; pinHash: string }): Promise<void>;
  saveBusinessProfile(input: BusinessProfileInput & { userId: string }): Promise<void>;
  saveAboutYou(input: AboutYouInput & { userId: string }): Promise<void>;
  saveLocation(input: { userId: string; location: string }): Promise<void>;
  markOnboarded(userId: string): Promise<void>;
}
