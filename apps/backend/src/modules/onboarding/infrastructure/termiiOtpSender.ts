import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { maskPhone } from "../../../shared/security/mask.js";
import type { OtpSender } from "../domain/otpSender.js";

type TermiiSendMessageResponse = {
  code?: string | number;
  message?: string;
  message_id?: string;
  balance?: number;
};

export class TermiiOtpSender implements OtpSender {
  constructor(
    private readonly config: {
      apiKey: string;
      sendSmsUrl: string;
      senderId: string;
      channel: string;
    },
  ) {}

  async send(phone: string, code: string) {
    const termiiPhone = formatTermiiPhone(phone);

    logger.info("Sending OTP via Termii", {
      phone: maskPhone(phone),
      senderId: this.config.senderId,
      channel: this.config.channel,
      url: this.config.sendSmsUrl,
    });

    const response = await fetch(this.config.sendSmsUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: this.config.apiKey,
        to: termiiPhone,
        from: this.config.senderId,
        sms: `Your SME Paddy verification code is ${code}. It expires in 10 minutes.`,
        type: "plain",
        channel: this.config.channel,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as TermiiSendMessageResponse;

    if (!response.ok || payload.code === "error") {
      logger.error("Termii OTP delivery failed", {
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

    logger.info("Termii OTP delivery accepted", {
      phone: maskPhone(phone),
      messageId: payload.message_id ?? "unknown",
      providerMessage: payload.message,
      balance: payload.balance,
    });
  }
}

function formatTermiiPhone(phone: string) {
  return phone.replace(/^\+/, "");
}
