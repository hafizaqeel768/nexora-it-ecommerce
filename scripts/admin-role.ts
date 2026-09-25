// Make a registered account a super admin, or take its staff access away (run inside the container):
//   docker compose exec app npm run admin:promote -- you@example.com
//   docker compose exec app npm run admin:promote -- you@example.com --revoke
// This is the server-side way in (first admin, or recovery when nobody can log in). Everything else about
// staff is managed in Admin → System. Both commands are written to the activity log.
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const CLI = { actorId: null, actorEmail: "command line (admin:promote)" };

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  const revoke = process.argv.includes("--revoke");
  if (!email || email.startsWith("--")) throw new Error("Usage: npm run admin:promote -- <email> [--revoke]");

  const customer = await db.customer.findUnique({ where: { email }, select: { id: true, passwordHash: true, role: true, isSuperAdmin: true } });
  if (!customer?.passwordHash) throw new Error(`No registered account for ${email}. Register at /register first.`);

  await db.$transaction(async (tx) => {
    if (revoke) {
      if (customer.role !== "ADMIN") throw new Error(`${email} is not an admin.`);
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "isSuperAdmin" = true FOR UPDATE`;
      const others = await tx.customer.count({
        where: { role: "ADMIN", isSuperAdmin: true, adminDisabledAt: null, passwordHash: { not: null }, id: { not: customer.id } },
      });
      if (customer.isSuperAdmin && others < 1) throw new Error(`${email} is the last active super admin. Make someone else a super admin first.`);
      await tx.customer.update({
        where: { id: customer.id },
        data: { role: "CUSTOMER", isSuperAdmin: false, adminRoleId: null, adminDisabledAt: null, passwordChangedAt: new Date() },
      });
      await tx.adminAuditLog.create({ data: { ...CLI, action: "admin_user.deleted", targetType: "admin_user", targetId: customer.id, targetLabel: email, details: { via: "cli" } } });
    } else {
      await tx.customer.update({ where: { id: customer.id }, data: { role: "ADMIN", isSuperAdmin: true, adminDisabledAt: null } });
      await tx.adminAuditLog.create({ data: { ...CLI, action: "admin_user.super_admin_granted", targetType: "admin_user", targetId: customer.id, targetLabel: email, details: { via: "cli" } } });
    }
  });
  console.log(revoke ? `${email} is now a customer (staff access removed).` : `${email} is now a super admin. Log in and open /admin.`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
