import { createServer } from "node:http";

import "./shared/infrastructure/loadEnv.js";
import { prisma } from "./shared/infrastructure/prismaClient.js";
import { createAccountHandler } from "./modules/account/presentation/accountRoutes.js";
import { createAuthHandler } from "./modules/auth/presentation/authRoutes.js";
import { createConsignmentHandler } from "./modules/consignment/presentation/consignmentRoutes.js";
import { createAnalyticsHandler } from "./modules/analytics/presentation/analyticsRoutes.js";
import { createCustomerHandler } from "./modules/customers/presentation/customerRoutes.js";
import { createRedemptionHandler } from "./modules/redemption/presentation/redemptionRoutes.js";
import { createSavingsHandler } from "./modules/savings/presentation/savingsRoutes.js";
import { createCoinHandler } from "./modules/coins/presentation/coinRoutes.js";
import { createLoanHandler } from "./modules/loans/presentation/loanRoutes.js";
import { createExpenseHandler } from "./modules/expenses/presentation/expenseRoutes.js";
import { createNotificationHandler } from "./modules/notifications/presentation/notificationRoutes.js";
import { createRecurringExpenseHandler } from "./modules/recurring-expenses/presentation/recurringExpenseRoutes.js";
import { startRecurringExpenseCron } from "./shared/infrastructure/recurringExpenseCron.js";
import { startLoanReminderCron } from "./shared/infrastructure/loanReminderCron.js";
import { createDashboardHandler } from "./modules/dashboard/presentation/dashboardRoutes.js";
import { createInvoiceHandler } from "./modules/invoices/presentation/invoiceRoutes.js";
import { createOnboardingHandler } from "./modules/onboarding/presentation/onboardingRoutes.js";
import { createSalesHandler } from "./modules/sales/presentation/salesRoutes.js";
import { createStockHandler } from "./modules/stock/presentation/stockRoutes.js";
import { sendJson } from "./shared/presentation/http.js";

const port = Number(process.env.PORT ?? 4000);
const accountHandler = createAccountHandler();
const authHandler = createAuthHandler();
const consignmentHandler = createConsignmentHandler();
const dashboardHandler = createDashboardHandler();
const invoiceHandler = createInvoiceHandler();
const onboardingHandler = createOnboardingHandler();
const analyticsHandler = createAnalyticsHandler();
const customerHandler = createCustomerHandler();
const redemptionHandler = createRedemptionHandler();
const savingsHandler = createSavingsHandler();
const coinHandler = createCoinHandler();
const expenseHandler = createExpenseHandler();
const loanHandler = createLoanHandler();
const notificationHandler = createNotificationHandler();
const { handler: recurringExpenseHandler, service: recurringExpenseService } = createRecurringExpenseHandler();
const salesHandler = createSalesHandler();
const stockHandler = createStockHandler();

const server = createServer(async (request, response) => {
  try {
    if (request.url === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (request.url?.startsWith("/onboarding")) {
      await onboardingHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/auth")) {
      await authHandler(request, response);
      return;
    }

    if (request.url === "/me" || request.url?.startsWith("/business")) {
      await accountHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/analytics")) {
      await analyticsHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/customers")) {
      await customerHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/redemptions")) {
      await redemptionHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/savings")) {
      await savingsHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/dashboard")) {
      await dashboardHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/consignment")) {
      await consignmentHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/stock")) {
      await stockHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/wallet")) {
      await coinHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/notifications")) {
      await notificationHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/loans")) {
      await loanHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/expenses")) {
      await expenseHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/recurring-expenses")) {
      await recurringExpenseHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/sales")) {
      await salesHandler(request, response);
      return;
    }

    if (request.url?.startsWith("/invoices")) {
      await invoiceHandler(request, response);
      return;
    }

    sendJson(response, 200, { service: "sme-paddy-backend" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: "Internal server error" });
  }
});

server.listen(port, () => {
  console.log(`SME Paddy backend listening on http://127.0.0.1:${port}`);
  startRecurringExpenseCron(recurringExpenseService);
  startLoanReminderCron();
});

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
