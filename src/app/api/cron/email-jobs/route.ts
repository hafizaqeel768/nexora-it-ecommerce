// For an external scheduler (e.g. Vercel Cron, or `curl` from system cron every 15 minutes):
//   curl -H "Authorization: Bearer $CRON_SECRET" https://<site>/api/cron/email-jobs
// Disabled (404) unless CRON_SECRET is set.
import { timingSafeEqual } from "node:crypto";
import { runEmailJobs } from "@/lib/jobs";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (!secret || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response("Not found", { status: 404 });
  }
  return Response.json(await runEmailJobs());
}
