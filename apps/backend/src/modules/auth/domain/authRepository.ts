export type AuthUserRecord = {
  id: string;
  email: string | null;
  fullName: string | null;
  status: "AUTH_PENDING" | "PHONE_PENDING" | "OTP_VERIFIED" | "ONBOARDED";
};

export type LoginOtpRecord = {
  id: string;
  codeHash: string;
  attemptCount: number;
  expiresAt: Date;
  userId: string | null;
};

export type LoginThrottleDecision =
  | { allowed: true }
  | {
      allowed: false;
      reason: "COOLDOWN" | "HOURLY_LIMIT";
      retryAfterSeconds: number;
    };

export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  checkAndRecordLoginOtpRequest(input: {
    email: string;
    now: Date;
    cooldownSeconds: number;
    maxRequestsPerHour: number;
  }): Promise<LoginThrottleDecision>;
  createLoginOtp(input: {
    email: string;
    codeHash: string;
    expiresAt: Date;
    userId: string;
  }): Promise<void>;
  findLatestUsableLoginOtp(email: string): Promise<LoginOtpRecord | null>;
  incrementLoginOtpAttempt(otpId: string): Promise<void>;
  consumeLoginOtp(otpId: string): Promise<void>;
  createSession(input: {
    id: string;
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void>;
}
