import { logger } from "./logger.js";
import type { RecurringExpenseService } from "../../modules/recurring-expenses/application/recurringExpenseService.js";

const INTERVAL_MS = 60_000; // check every minute

export function startRecurringExpenseCron(service: RecurringExpenseService): void {
  // Process immediately on startup to catch any missed runs (e.g. after a server restart).
  void runSafe(service);

  setInterval(() => void runSafe(service), INTERVAL_MS);

  logger.info("Recurring expense cron started", { intervalMs: INTERVAL_MS });
}

async function runSafe(service: RecurringExpenseService): Promise<void> {
  try {
    await service.processDue();
  } catch (err) {
    logger.error("Recurring expense cron tick failed", {
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
}
