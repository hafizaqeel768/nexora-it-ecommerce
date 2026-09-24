import Link from "next/link";
import { EmptyRow, row, table, td, th } from "@/components/admin/ui";
import { StatusBadge } from "@/components/status-badge";
import { money, paymentStatusLabel, shortDate } from "@/lib/format";

export type OrderRow = { id: string; number: string; createdAt: Date; name: string; total: { toString(): string }; status: string; paymentStatus: string };

// Orders table (the prototype's a_otable); each row opens the order.
export function OrderTable({ orders }: { orders: OrderRow[] }) {
  return (
    <table className={table}>
      <thead>
        <tr>
          <th className={th}>Order</th>
          <th className={th}>Date</th>
          <th className={th}>Customer</th>
          <th className={th}>Total</th>
          <th className={th}>Payment</th>
          <th className={th}>Status</th>
        </tr>
      </thead>
      <tbody>
        {orders.length ? (
          orders.map((o) => (
            <tr key={o.id} className={row}>
              <td className={td}>
                <Link href={`/admin/orders/${o.id}`} className="font-bold hover:text-accent">
                  {o.number}
                </Link>
              </td>
              <td className={`${td} whitespace-nowrap`}>{shortDate(o.createdAt)}</td>
              <td className={td}>{o.name}</td>
              <td className={td}>{money(o.total)}</td>
              <td className={`${td} text-13 ${o.paymentStatus === "PAID" ? "text-success" : "text-muted"}`}>
                {paymentStatusLabel(o.paymentStatus)}
              </td>
              <td className={td}>
                <StatusBadge status={o.status} />
              </td>
            </tr>
          ))
        ) : (
          <EmptyRow cols={6}>No orders yet.</EmptyRow>
        )}
      </tbody>
    </table>
  );
}
