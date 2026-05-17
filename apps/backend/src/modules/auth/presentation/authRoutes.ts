import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import {
  handleOptions,
  readJson,
  sendJson,
} from "../../../shared/presentation/http.js";
import { AuthService } from "../application/authService.js";
import { PrismaAuthRepository } from "../infrastructure/prismaAuthRepository.js";
import { createOtpSender } from "../../onboarding/infrastructure/createOtpSender.js";

type RequestLoginOtpBody = { email?: string };
type VerifyLoginOtpBody = { email?: string; code?: string };

export function createAuthHandler() {
  const service = new AuthService(new PrismaAuthRepository(), createOtpSender());

  return async function authHandler(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    if (request.method === "OPTIONS") {
      handleOptions(response);
      return;
    }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "POST" && url.pathname === "/auth/request-login-otp") {
        const body = await readJson<RequestLoginOtpBody>(request);
        const result = await service.requestLoginOtp(required(body.email, "email"));
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/auth/verify-login-otp") {
        const body = await readJson<VerifyLoginOtpBody>(request);
        const result = await service.verifyLoginOtp(
          required(body.email, "email"),
          required(body.code, "code"),
        );
        sendJson(response, 200, result);
        return;
      }

      sendJson(response, 404, { error: "Route not found" });
    } catch (error) {
      if (error instanceof AppError) {
        sendJson(response, error.statusCode, {
          error: error.message,
          code: error.code,
        });
        return;
      }

      throw error;
    }
  };
}

function required(value: string | undefined, field: string) {
  if (!value || value.trim().length === 0) {
    throw new AppError(`${field} is required`, 422, "REQUIRED_FIELD");
  }

  return value;
}
