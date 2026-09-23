// Runs once when the server starts. With JOBS_INTERVAL_MINUTES set (docker-compose.yml sets 15), the email jobs
// run on a timer inside the server, so no separate scheduler is needed for a single long-running server.
// Serverless hosting has no long-running process: use /api/cron/email-jobs there instead.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const minutes = Number(process.env.JOBS_INTERVAL_MINUTES);
  if (!(minutes > 0)) return;
  const g = globalThis as unknown as { nexoraJobsTimer?: NodeJS.Timeout };
  if (g.nexoraJobsTimer) return;
  const { runEmailJobs } = await import("@/lib/jobs");
  const tick = () =>
    runEmailJobs().then(
      (r) => {
        if ("orderEmails" in r && (r.orderEmails.tried || r.cartReminders.due)) console.log("[jobs] email jobs", JSON.stringify(r));
      },
      (e) => console.error("[jobs] email jobs failed", e),
    );
  g.nexoraJobsTimer = setInterval(tick, minutes * 60 * 1000);
  setTimeout(tick, 30 * 1000); // first run shortly after start
  console.log(`[jobs] email jobs every ${minutes} min`);
}
