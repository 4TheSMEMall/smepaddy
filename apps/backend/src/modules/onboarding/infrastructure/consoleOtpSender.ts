import type { OtpSender } from "../domain/otpSender.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { maskEmail, maskPhone } from "../../../shared/security/mask.js";

export class ConsoleOtpSender implements OtpSender {
  async send(recipient: string, code: string) {
    logger.info("OTP generated for local console delivery", {
      recipient: recipient.includes("@")
        ? maskEmail(recipient)
        : maskPhone(recipient),
      code,
      sender: "console",
    });
  }
}
