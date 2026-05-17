import { logger } from "./logger.js";
import { prisma } from "./prismaClient.js";
import { notificationService } from "../../modules/notifications/application/notificationService.js";

// Only send reminders once per day. Track the date string in memory.
let lastReminderDate = "";

export function startLoanReminderCron(): void {
  setInterval(() => void checkAndSendReminders(), 60_000);
  logger.info("Loan reminder cron started");
}

async function checkAndSendReminders(): Promise<void> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const hour = now.getHours();

  // Only run once per day, starting at 8 AM
  if (todayStr === lastReminderDate || hour < 8) return;
  lastReminderDate = todayStr;

  logger.info("Running daily loan reminders", { date: todayStr });

  const activeLoans = await prisma.loan.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      businessProfileId: true,
      loanType: true,
      balanceKobo: true,
      dueDate: true,
    },
  });

  if (activeLoans.length === 0) return;

  const todayMidnight = new Date(todayStr + "T00:00:00.000Z");

  for (const loan of activeLoans) {
    const msUntilDue = loan.dueDate.getTime() - todayMidnight.getTime();
    const daysUntilDue = Math.round(msUntilDue / 86_400_000);
    const tierLabel = loan.loanType === "NANO" ? "Nano" : loan.loanType === "MICRO" ? "Micro" : "Business";
    const balance = formatMoney(loan.balanceKobo / 100);

    let title: string | null = null;
    let body: string | null = null;

    if (daysUntilDue === 7) {
      title = `Loan due in 7 days 📅`;
      body = `Your ${tierLabel} Loan of ${balance} is due in one week. Plan your repayment now.`;
    } else if (daysUntilDue === 3) {
      title = `Loan due in 3 days ⚠️`;
      body = `Your ${tierLabel} Loan of ${balance} is due in 3 days. Make a repayment to stay on track.`;
    } else if (daysUntilDue === 1) {
      title = `Loan due tomorrow! 🔔`;
      body = `Your ${tierLabel} Loan of ${balance} is due tomorrow. Repay now to protect your credit score.`;
    } else if (daysUntilDue === 0) {
      title = `Loan due TODAY ❗`;
      body = `Your ${tierLabel} Loan of ${balance} is due today. Repay now — you have a 3-day grace period.`;
    } else if (daysUntilDue === -1) {
      title = `Grace period ends in 2 days ⚠️`;
      body = `Your ${tierLabel} Loan of ${balance} is overdue. Repay within 2 days to avoid late penalties.`;
    } else if (daysUntilDue === -3) {
      title = `Loan overdue — act now ❗`;
      body = `Your ${tierLabel} Loan of ${balance} is 3 days overdue. Late penalties are accruing. Please repay immediately.`;
    }

    if (title && body) {
      notificationService.send(loan.businessProfileId, {
        title,
        body,
        data: { type: "LOAN_REMINDER", loanId: loan.id },
      }).catch((err) => {
        logger.warn("Failed to send loan reminder", { loanId: loan.id, err });
      });
    }
  }
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency", currency: "NGN", maximumFractionDigits: 0,
  }).format(value);
}
