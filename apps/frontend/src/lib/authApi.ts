import { postJson } from "@/lib/api";

export type RequestLoginOtpResponse = {
  email: string;
  otpExpiresInSeconds: number;
};

export type VerifyLoginOtpResponse = {
  accessToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string | null;
    fullName: string | null;
  };
};

export function requestLoginOtp(email: string) {
  return postJson<RequestLoginOtpResponse>("/auth/request-login-otp", { email });
}

export function verifyLoginOtp(email: string, code: string) {
  return postJson<VerifyLoginOtpResponse>("/auth/verify-login-otp", {
    email,
    code,
  });
}
