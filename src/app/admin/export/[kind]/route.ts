// CSV exports (the prototype's a_export): products (with the list's filters), orders (status filter), customers.
import { OrderStatus } from "@/generated/prisma/client";
import { getAdmin } from "@/lib/admin";
import { customerRows, productListWhere } from "@/lib/admin-queries";
import { csvResponse } from "@/lib/csv";
import { db } from "@/lib/db";

const paymentLabel = { CREDIT_CARD: "Credit card", PURCHASE_ORDER: "Purchase order", BANK_TRANSFER: "Bank transfer" } as const;

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  if (!(await getAdmin())) return new Response("Not found", { status: 404 });
  const { kind } = await params;
  const sp = new URL(request.url).searchParams;
  const day = new Date().toISOString().slice(0, 10);

  if (kind === "products") {
    const where = await productListWhere((sp.get("q") ?? "").slice(0, 100), sp.get("cat") ?? "", sp.get("status") ?? "");
    const rows = await db.product.findMany({ where, orderBy: { name: "asc" }, include: { category: { select: { name: true } } } });
    return csvResponse(`products-${day}.csv`, [
      ["SKU", "Name", "Brand", "Category", "Price", "Compare-at price", "Stock", "Status", "URL slug"],
      ...rows.map((p) => [p.sku, p.name, p.brand, p.category.name, p.price.toString(), p.compareAtPrice?.toString(), p.stock ?? "not tracked", p.status === "ACTIVE" ? "active" : "draft", p.slug]),
    ]);
  }

  if (kind === "orders") {
    const status = (Object.values(OrderStatus) as string[]).includes(sp.get("status") ?? "") ? (sp.get("status") as OrderStatus) : undefined;
    const rows = await db.order.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" } });
    return csvResponse(`orders-${day}.csv`, [
      ["Order", "Date", "Customer", "Email", "Payment", "Payment status", "Subtotal", "Discount", "Shipping", "Tax", "Total", "Status"],
      ...rows.map((o) => [o.number, o.createdAt, o.name, o.email, paymentLabel[o.paymentMethod], o.paymentStatus.toLowerCase(), o.subtotal.toString(), o.discount.toString(), o.shippingFee.toString(), o.tax.toString(), o.total.toString(), o.status.toLowerCase()]),
    ]);
  }

  if (kind === "customers") {
    const rows = await customerRows();
    return csvResponse(`customers-${day}.csv`, [
      ["Name", "Email", "Account", "Tax-exempt", "Orders", "Total spent", "Last order"],
      ...rows.map((c) => [c.name, c.email, c.role === "ADMIN" ? "admin" : c.registered ? "registered" : "guest", c.taxExempt ? "yes" : "no", c.orders, c.spent.toFixed(2), c.lastOrder]),
    ]);
  }

  return new Response("Not found", { status: 404 });
}
