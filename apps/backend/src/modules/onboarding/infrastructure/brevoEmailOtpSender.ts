import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { maskEmail } from "../../../shared/security/mask.js";
import type { OtpSender } from "../domain/otpSender.js";

type BrevoEmailResponse = {
  messageId?: string;
  code?: string;
  message?: string;
};

export class BrevoEmailOtpSender implements OtpSender {
  constructor(
    private readonly config: {
      apiKey: string;
      sendEmailUrl: string;
      senderEmail: string;
      senderName: string;
      subject: string;
    },
  ) {}

  async send(email: string, code: string) {
    logger.info("Sending OTP email via Brevo", {
      email: maskEmail(email),
      senderEmail: this.config.senderEmail,
      url: this.config.sendEmailUrl,
    });

    const response = await fetch(this.config.sendEmailUrl, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": this.config.apiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: this.config.senderName,
          email: this.config.senderEmail,
        },
        to: [{ email }],
        subject: this.config.subject,
        htmlContent: buildHtmlContent(code),
        textContent: `Your SME Paddy verification code is ${code}. It expires in 10 minutes.`,
        tags: ["onboarding_otp"],
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as BrevoEmailResponse;

    if (!response.ok) {
      logger.error("Brevo OTP email delivery failed", {
        email: maskEmail(email),
        httpStatus: response.status,
        providerCode: payload.code,
        providerMessage: payload.message,
        url: this.config.sendEmailUrl,
      });
      throw new AppError(
        "Unable to send OTP at the moment",
        502,
        "OTP_PROVIDER_FAILED",
      );
    }

    logger.info("Brevo OTP email delivery accepted", {
      email: maskEmail(email),
      messageId: payload.messageId ?? "unknown",
    });
  }
}

function buildHtmlContent(code: string) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;color:#071122">
      <h1 style="font-size:24px;margin:0 0 12px">Verify your SME Paddy account</h1>
      <p style="font-size:16px;line-height:1.5;margin:0 0 20px">
        Use this code to continue setting up your business workspace.
      </p>
      <div style="font-size:34px;font-weight:800;letter-spacing:8px;background:#eef4ff;border-radius:14px;padding:18px;text-align:center;color:#2563eb">
        ${code}
      </div>
      <p style="font-size:14px;line-height:1.5;color:#64748b;margin:20px 0 0">
        This code expires in 10 minutes. If you did not request it, you can ignore this email.
      </p>
    </div>
  `;
}
