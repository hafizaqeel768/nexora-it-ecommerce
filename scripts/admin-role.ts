// Give or take admin rights for a registered account (run inside the container):
//   docker compose exec app npm run admin:promote -- you@example.com
//   docker compose exec app npm run admin:promote -- you@example.com --revoke
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const revoke = process.argv.includes("--revoke");
  if (!email || email.startsWith("--")) throw new Error("Usage: npm run admin:promote -- <email> [--revoke]");

  const customer = await db.customer.findUnique({ where: { email }, select: { id: true, passwordHash: true } });
  if (!customer?.passwordHash) throw new Error(`No registered account for ${email}. Register at /register first.`);
  await db.customer.update({ where: { id: customer.id }, data: { role: revoke ? "CUSTOMER" : "ADMIN" } });
  console.log(revoke ? `${email} is now a customer.` : `${email} is now an admin. Log in and open /admin.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
