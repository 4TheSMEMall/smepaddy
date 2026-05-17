import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import type { OtpSender } from "../domain/otpSender.js";
import { BrevoEmailOtpSender } from "./brevoEmailOtpSender.js";
import { BrevoOtpSender } from "./brevoOtpSender.js";
import { CompositeOtpSender } from "./compositeOtpSender.js";
import { ConsoleOtpSender } from "./consoleOtpSender.js";
import { TermiiOtpSender } from "./termiiOtpSender.js";

type OtpSenderMode =
  | "console"
  | "termii"
  | "brevo"
  | "brevo_email"
  | "console_and_termii"
  | "console_and_brevo"
  | "console_and_brevo_email";

export function createOtpSender(): OtpSender {
  const mode = getOtpSenderMode();

  logger.info("OTP sender mode selected", { mode });

  if (mode === "console") return new ConsoleOtpSender();
  if (mode === "termii") return createTermiiSender();
  if (mode === "brevo") return createBrevoSender();
  if (mode === "brevo_email") return createBrevoEmailSender();

  if (mode === "console_and_termii") {
    return new CompositeOtpSender([new ConsoleOtpSender(), createTermiiSender()], {
      failOnProviderError: false,
    });
  }

  if (mode === "console_and_brevo") {
    return new CompositeOtpSender([new ConsoleOtpSender(), createBrevoSender()], {
      failOnProviderError: false,
    });
  }

  return new CompositeOtpSender([new ConsoleOtpSender(), createBrevoEmailSender()], {
    failOnProviderError: false,
  });
}

function getOtpSenderMode(): OtpSenderMode {
  const mode = process.env.OTP_SENDER_MODE;

  if (
    mode === "console" ||
    mode === "termii" ||
    mode === "brevo" ||
    mode === "brevo_email" ||
    mode === "console_and_termii" ||
    mode === "console_and_brevo" ||
    mode === "console_and_brevo_email"
  ) {
    return mode;
  }

  return process.env.NODE_ENV === "production" ? "brevo_email" : "console";
}

function createTermiiSender() {
  const apiKey = process.env.TERMII_API_KEY;
  const senderId = process.env.TERMII_SENDER_ID;
  const baseUrl = trimTrailingSlash(
    process.env.TERMII_BASE_URL ?? "https://api.ng.termii.com/api",
  );
  const sendSmsUrl = process.env.TERMII_SEND_SMS_URL
    ? process.env.TERMII_SEND_SMS_URL
    : `${baseUrl}${getDefaultSendSmsPath(baseUrl)}`;
  const channel = process.env.TERMII_CHANNEL ?? "generic";

  if (!apiKey) {
    throw new AppError(
      "TERMII_API_KEY is required when OTP_SENDER_MODE uses Termii",
      500,
      "TERMII_NOT_CONFIGURED",
    );
  }

  if (!senderId) {
    throw new AppError(
      "TERMII_SENDER_ID is required when OTP_SENDER_MODE uses Termii",
      500,
      "TERMII_NOT_CONFIGURED",
    );
  }

  return new TermiiOtpSender({ apiKey, senderId, sendSmsUrl, channel });
}

function createBrevoSender() {
  const apiKey = process.env.BREVO_API_KEY;
  const sender = process.env.BREVO_SMS_SENDER;
  const sendSmsUrl =
    process.env.BREVO_SEND_SMS_URL ??
    "https://api.brevo.com/v3/transactionalSMS/send";
  const smsType = parseBrevoSmsType(process.env.BREVO_SMS_TYPE);
  const organisationPrefix = process.env.BREVO_ORGANISATION_PREFIX;

  if (!apiKey) {
    throw new AppError(
      "BREVO_API_KEY is required when OTP_SENDER_MODE uses Brevo",
      500,
      "BREVO_NOT_CONFIGURED",
    );
  }

  if (!sender) {
    throw new AppError(
      "BREVO_SMS_SENDER is required when OTP_SENDER_MODE uses Brevo",
      500,
      "BREVO_NOT_CONFIGURED",
    );
  }

  if (!/^[a-zA-Z0-9]{3,11}$/.test(sender)) {
    throw new AppError(
      "BREVO_SMS_SENDER must be 3-11 letters/numbers with no spaces or symbols",
      500,
      "BREVO_NOT_CONFIGURED",
    );
  }

  return new BrevoOtpSender({
    apiKey,
    sender,
    sendSmsUrl,
    smsType,
    organisationPrefix,
  });
}

function parseBrevoSmsType(value: string | undefined): "transactional" | "marketing" {
  return value === "marketing" ? "marketing" : "transactional";
}

function createBrevoEmailSender() {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_EMAIL_SENDER_EMAIL;
  const senderName = process.env.BREVO_EMAIL_SENDER_NAME ?? "SME Paddy";
  const sendEmailUrl =
    process.env.BREVO_SEND_EMAIL_URL ?? "https://api.brevo.com/v3/smtp/email";
  const subject = process.env.BREVO_OTP_EMAIL_SUBJECT ?? "Your SME Paddy code";

  if (!apiKey) {
    throw new AppError(
      "BREVO_API_KEY is required when OTP_SENDER_MODE uses Brevo email",
      500,
      "BREVO_NOT_CONFIGURED",
    );
  }

  if (!senderEmail) {
    throw new AppError(
      "BREVO_EMAIL_SENDER_EMAIL is required when OTP_SENDER_MODE uses Brevo email",
      500,
      "BREVO_NOT_CONFIGURED",
    );
  }

  return new BrevoEmailOtpSender({
    apiKey,
    senderEmail,
    senderName,
    sendEmailUrl,
    subject,
  });
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getDefaultSendSmsPath(baseUrl: string) {
  if (process.env.TERMII_SEND_SMS_PATH) {
    return normalizePath(process.env.TERMII_SEND_SMS_PATH);
  }

  const pathname = new URL(baseUrl).pathname.replace(/\/+$/, "");
  return pathname.endsWith("/api") ? "/sms/send" : "/api/sms/send";
}

function normalizePath(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}
