import { postJson } from "@/lib/api";

export type RequestOtpResponse = {
  phone: string;
  otpExpiresInSeconds: number;
};

export type RequestEmailOtpResponse = {
  email: string;
  otpExpiresInSeconds: number;
};

export type VerifyOtpResponse = {
  userId: string;
  onboardingToken: string;
};

export function requestOtp(phone: string) {
  return postJson<RequestOtpResponse>("/onboarding/request-otp", { phone });
}

export function requestEmailOtp(email: string) {
  return postJson<RequestEmailOtpResponse>("/onboarding/request-email-otp", {
    email,
  });
}

export function verifyOtp(phone: string, code: string) {
  return postJson<VerifyOtpResponse>("/onboarding/verify-otp", { phone, code });
}

export function verifyEmailOtp(email: string, code: string) {
  return postJson<VerifyOtpResponse>("/onboarding/verify-email-otp", {
    email,
    code,
  });
}

export function createPin(token: string, pin: string) {
  return postJson<{ ok: true }>("/onboarding/create-pin", { pin }, token);
}

export function saveBusinessInfo(
  token: string,
  input: { businessName: string; businessType: string },
) {
  return postJson<{ ok: true }>("/onboarding/business", input, token);
}

export function saveAboutYou(
  token: string,
  input: { fullName: string; email?: string },
) {
  return postJson<{ ok: true }>("/onboarding/about-you", input, token);
}

export function saveLocation(token: string, location: string) {
  return postJson<{ ok: true }>("/onboarding/location", { location }, token);
}
