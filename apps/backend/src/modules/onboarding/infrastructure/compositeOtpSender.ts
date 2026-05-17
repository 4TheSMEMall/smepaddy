import type { OtpSender } from "../domain/otpSender.js";
import { logger } from "../../../shared/infrastructure/logger.js";

export class CompositeOtpSender implements OtpSender {
  constructor(
    private readonly senders: OtpSender[],
    private readonly options: { failOnProviderError: boolean },
  ) {}

  async send(phone: string, code: string) {
    const errors: Error[] = [];

    for (const sender of this.senders) {
      try {
        await sender.send(phone, code);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error("Unknown sender error"));
        logger.warn("OTP sender failed inside composite sender", {
          sender: sender.constructor.name,
          error: error instanceof Error ? error.message : "Unknown sender error",
        });
      }
    }

    if (errors.length > 0 && this.options.failOnProviderError) {
      throw errors[0];
    }
  }
}
