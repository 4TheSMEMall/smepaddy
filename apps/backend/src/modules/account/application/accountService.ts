import { AppError } from "../../../shared/application/AppError.js";
import { prisma } from "../../../shared/infrastructure/prismaClient.js";
import type { AuthenticatedContext } from "../../../shared/presentation/authenticatedRequest.js";

export class AccountService {
  getMe(context: AuthenticatedContext) {
    return {
      user: context.user,
      business: context.business,
    };
  }

  getCurrentBusiness(context: AuthenticatedContext) {
    if (!context.business) {
      throw new AppError(
        "Business profile has not been created",
        404,
        "BUSINESS_NOT_FOUND",
      );
    }
    return { business: context.business };
  }

  async updateBusiness(
    context: AuthenticatedContext,
    input: { businessName?: string; businessType?: string; location?: string },
  ) {
    if (!context.business) {
      throw new AppError("Business profile not found", 404, "BUSINESS_NOT_FOUND");
    }

    const businessName = input.businessName?.trim();
    const businessType = input.businessType?.trim();
    const location = input.location?.trim() || null;

    if (!businessName) throw new AppError("Business name is required", 422, "REQUIRED_FIELD");
    if (!businessType) throw new AppError("Business type is required", 422, "REQUIRED_FIELD");

    const updated = await prisma.businessProfile.update({
      where: { id: context.business.id },
      data: { businessName, businessType, location },
    });

    return {
      business: {
        id: updated.id,
        businessName: updated.businessName,
        businessType: updated.businessType,
        location: updated.location,
        createdAt: updated.createdAt.toISOString(),
      },
    };
  }
}
