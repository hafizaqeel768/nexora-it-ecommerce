// Background email jobs (server-only): retry order emails that failed, send abandoned-cart reminders.
// Run by src/instrumentation.ts on a timer, by /api/cron/email-jobs (for an external cron), or from the admin dashboard.
import { deliverPendingOrderEmails } from "@/lib/order-emails";
import { sendAbandonedCartReminders } from "@/lib/saved-carts";

let running = false;

export type EmailJobsResult =
  | { skipped: true }
  | { orderEmails: { tried: number; sent: number }; cartReminders: { due: number; sent: number } };

export async function runEmailJobs(): Promise<EmailJobsResult> {
  if (running) return { skipped: true };
  running = true;
  try {
    const orderEmails = await deliverPendingOrderEmails();
    const cartReminders = await sendAbandonedCartReminders();
    return { orderEmails, cartReminders };
  } finally {
    running = false;
  }
}
