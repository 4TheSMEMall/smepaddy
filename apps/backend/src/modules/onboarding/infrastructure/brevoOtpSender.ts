import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { maskPhone } from "../../../shared/security/mask.js";
import type { OtpSender } from "../domain/otpSender.js";

type BrevoSmsResponse = {
  messageId?: number | string;
  code?: string;
  message?: string;
};

export class BrevoOtpSender implements OtpSender {
  constructor(
    private readonly config: {
      apiKey: string;
      sendSmsUrl: string;
      sender: string;
      smsType: "transactional" | "marketing";
      organisationPrefix?: string;
    },
  ) {}

  async send(phone: string, code: string) {
    const recipient = formatBrevoPhone(phone);

    logger.info("Sending OTP via Brevo", {
      phone: maskPhone(phone),
      sender: this.config.sender,
      type: this.config.smsType,
      url: this.config.sendSmsUrl,
    });

    const response = await fetch(this.config.sendSmsUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": this.config.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: this.config.sender,
        recipient,
        content: `Your SME Paddy verification code is ${code}. It expires in 10 minutes.`,
        type: this.config.smsType,
        tag: "onboarding_otp",
        unicodeEnabled: false,
        ...(this.config.organisationPrefix
          ? { organisationPrefix: this.config.organisationPrefix }
          : {}),
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as BrevoSmsResponse;

    if (!response.ok) {
      logger.error("Brevo OTP delivery failed", {
        phone: maskPhone(phone),
        httpStatus: response.status,
        providerCode: payload.code,
        providerMessage: payload.message,
        url: this.config.sendSmsUrl,
      });
      throw new AppError(
        "Unable to send OTP at the moment",
        502,
        "OTP_PROVIDER_FAILED",
      );
    }

    logger.info("Brevo OTP delivery accepted", {
      phone: maskPhone(phone),
      messageId: payload.messageId ?? "unknown",
    });
  }
}

function formatBrevoPhone(phone: string) {
  return phone.replace(/^\+/, "");
}
