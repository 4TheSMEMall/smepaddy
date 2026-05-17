import { AppError } from "../../../shared/application/AppError.js";
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

    return {
      business: context.business,
    };
  }
}
