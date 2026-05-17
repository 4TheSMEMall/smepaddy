import type { IncomingMessage, ServerResponse } from "node:http";

import { AppError } from "../../../shared/application/AppError.js";
import { logger } from "../../../shared/infrastructure/logger.js";
import { verifyOnboardingToken } from "../../../shared/security/onboardingToken.js";
import {
  handleOptions,
  readJson,
  sendJson,
} from "../../../shared/presentation/http.js";
import { OnboardingService } from "../application/onboardingService.js";
import { createOtpSender } from "../infrastructure/createOtpSender.js";
import { PrismaOnboardingRepository } from "../infrastructure/prismaOnboardingRepository.js";

type RequestOtpBody = { phone?: string };
type VerifyOtpBody = { phone?: string; code?: string };
type RequestEmailOtpBody = { email?: string };
type VerifyEmailOtpBody = { email?: string; code?: string };
type CreatePinBody = { pin?: string };
type BusinessBody = { businessName?: string; businessType?: string };
type AboutBody = { fullName?: string; email?: string };
type LocationBody = { location?: string };

export function createOnboardingHandler() {
  const service = new OnboardingService(
    new PrismaOnboardingRepository(),
    createOtpSender(),
  );

  return async function onboardingHandler(
    request: IncomingMessage,
    response: ServerResponse,
  ) {
    if (request.method === "OPTIONS") {
      handleOptions(response);
      return;
    }

    try {
      const url = new URL(request.url ?? "/", "http://localhost");

      if (request.method === "POST" && url.pathname === "/onboarding/request-otp") {
        const body = await readJson<RequestOtpBody>(request);
        logger.info("HTTP request received", {
          method: request.method,
          path: url.pathname,
        });
        const result = await service.requestOtp(required(body.phone, "phone"));
        sendJson(response, 200, result);
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/onboarding/request-email-otp"
      ) {
        const body = await readJson<RequestEmailOtpBody>(request);
        logger.info("HTTP request received", {
          method: request.method,
          path: url.pathname,
        });
        const result = await service.requestEmailOtp(
          required(body.email, "email"),
        );
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/onboarding/verify-otp") {
        const body = await readJson<VerifyOtpBody>(request);
        const result = await service.verifyOtp(
          required(body.phone, "phone"),
          required(body.code, "code"),
        );
        sendJson(response, 200, result);
        return;
      }

      if (
        request.method === "POST" &&
        url.pathname === "/onboarding/verify-email-otp"
      ) {
        const body = await readJson<VerifyEmailOtpBody>(request);
        const result = await service.verifyEmailOtp(
          required(body.email, "email"),
          required(body.code, "code"),
        );
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/onboarding/create-pin") {
        const body = await readJson<CreatePinBody>(request);
        const result = await service.createPin(
          requireUserId(request),
          required(body.pin, "pin"),
        );
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/onboarding/business") {
        const body = await readJson<BusinessBody>(request);
        const result = await service.saveBusinessInfo(requireUserId(request), {
          businessName: required(body.businessName, "businessName"),
          businessType: required(body.businessType, "businessType"),
        });
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/onboarding/about-you") {
        const body = await readJson<AboutBody>(request);
        const result = await service.saveAboutYou(requireUserId(request), {
          fullName: required(body.fullName, "fullName"),
          email: body.email,
        });
        sendJson(response, 200, result);
        return;
      }

      if (request.method === "POST" && url.pathname === "/onboarding/location") {
        const body = await readJson<LocationBody>(request);
        const result = await service.saveLocation(
          requireUserId(request),
          required(body.location, "location"),
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

function requireUserId(request: IncomingMessage) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const userId = token ? verifyOnboardingToken(token) : null;

  if (!userId) {
    throw new AppError("Missing or invalid onboarding token", 401, "UNAUTHORIZED");
  }

  return userId;
}
