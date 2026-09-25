import { deleteCoupon, toggleCoupon } from "@/app/actions/admin";
import { DeleteCouponButton, NewCouponForm } from "@/components/admin/coupon-forms";
import { SwitchButton } from "@/components/admin/switch-button";
import { card, EmptyRow, row, table, td, th } from "@/components/admin/ui";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";

// Coupons (the prototype's a_coup): add, switch on/off, delete. Codes are checked at the cart and at checkout.
export default async function AdminCoupons() {
  const admin = await requireAdminPage("/admin/coupons", "coupons.view");
  const [coupons, uses] = await Promise.all([
    db.coupon.findMany({ orderBy: { createdAt: "asc" } }),
    db.order.groupBy({ by: ["couponCode"], where: { couponCode: { not: null } }, _count: { _all: true } }),
  ]);
  const usedBy = (code: string) => uses.find((u) => u.couponCode === code)?._count._all ?? 0;

  return (
    <>
      {can(admin, "coupons.create") && (
        <div className={`${card} mb-4`}>
          <NewCouponForm />
        </div>
      )}
      <div className={card}>
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>Code</th>
              <th className={th}>Discount</th>
              <th className={th}>Used</th>
              <th className={th}>Active</th>
              <th className={th}>
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {coupons.length ? (
              coupons.map((c) => (
                <tr key={c.id} className={row}>
                  <td className={`${td} font-bold`}>{c.code}</td>
                  <td className={td}>{c.percentOff}% off</td>
                  <td className={td}>
                    {usedBy(c.code)} order{usedBy(c.code) === 1 ? "" : "s"}
                  </td>
                  <td className={td}>
                    <SwitchButton readOnly={!can(admin, "coupons.edit")} on={c.active} action={toggleCoupon.bind(null, c.id)} label={`${c.code}: ${c.active ? "active, click to disable" : "disabled, click to enable"}`} />
                  </td>
                  <td className={td}>
                    {can(admin, "coupons.delete") && <DeleteCouponButton code={c.code} action={deleteCoupon.bind(null, c.id)} />}
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={5}>No coupons yet.</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
