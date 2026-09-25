import Link from "next/link";
import { toggleTaxExempt } from "@/app/actions/settings";
import { SwitchButton } from "@/components/admin/switch-button";
import { card, EmptyRow, ExportLink, row, table, td, th } from "@/components/admin/ui";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { customerRows } from "@/lib/admin-queries";
import { money, shortDate } from "@/lib/format";

// Customers (the prototype's a_cust): everyone who ordered or registered, by total spent.
export default async function AdminCustomers() {
  const admin = await requireAdminPage("/admin/customers", "customers.view");
  const customers = await customerRows();

  return (
    <>
      {can(admin, "customers.export") && (
        <div className="mb-4 flex justify-end">
          <ExportLink href="/admin/export/customers" />
        </div>
      )}
      <div className={card}>
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>Customer</th>
              <th className={th}>Email</th>
              <th className={th}>Account</th>
              <th className={th}>Orders</th>
              <th className={th}>Total spent</th>
              <th className={th}>Last order</th>
              <th className={th} title="No tax at checkout when signed in (B2B exemption certificate on file)">
                Tax-exempt
              </th>
            </tr>
          </thead>
          <tbody>
            {customers.length ? (
              customers.map((c) => (
                <tr key={c.id} className={row}>
                  <td className={`${td} font-bold`}>
                    <Link href={`/admin/customers/${c.id}`} className="hover:text-accent">
                      {c.name}
                    </Link>
                  </td>
                  <td className={td}>
                    <a href={`mailto:${c.email}`} className="hover:text-accent">
                      {c.email}
                    </a>
                  </td>
                  <td className={`${td} text-13`}>
                    {c.role === "ADMIN" ? <b className="text-accent">Admin</b> : c.registered ? "Registered" : <span className="text-muted">Guest</span>}
                  </td>
                  <td className={td}>{c.orders}</td>
                  <td className={td}>{money(c.spent)}</td>
                  <td className={`${td} whitespace-nowrap`}>{c.lastOrder ? shortDate(c.lastOrder) : "—"}</td>
                  <td className={td}>
                    {c.registered ? (
                      <SwitchButton readOnly={!can(admin, "customers.edit")} on={c.taxExempt} action={toggleTaxExempt.bind(null, c.id)} label={`${c.name}: ${c.taxExempt ? "tax-exempt" : "pays tax"}`} />
                    ) : (
                      <span className="text-12 text-muted" title="Only registered accounts can be tax-exempt">—</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={7}>No customers yet.</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-13 text-muted">{customers.length} customers. Spent excludes cancelled orders and refunds.</p>
    </>
  );
}
