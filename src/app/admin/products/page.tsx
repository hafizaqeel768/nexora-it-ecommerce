import Image from "next/image";
import Link from "next/link";
import { toggleProductStatus } from "@/app/actions/admin";
import { CatalogTabs } from "@/components/admin/catalog-tabs";
import { Pager, pageParam } from "@/components/admin/pager";
import { SwitchButton } from "@/components/admin/switch-button";
import { card, EmptyRow, ExportLink, row, select, table, td, th } from "@/components/admin/ui";
import { fieldClass } from "@/components/account/field";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { productListWhere } from "@/lib/admin-queries";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { getConfig } from "@/lib/config";

const PER_PAGE = 50;

type Props = { searchParams: Promise<{ q?: string; cat?: string; status?: string; page?: string }> };

// Products (the prototype's a_prod): search, category and status filters, live switch, edit, CSV export.
export default async function AdminProducts({ searchParams }: Props) {
  const sp = await searchParams;
  const admin = await requireAdminPage("/admin/products", "products.view");
  const q = (sp.q ?? "").trim().slice(0, 100);
  const cat = sp.cat ?? "";
  const status = sp.status ?? "";
  const page = pageParam(sp.page);
  const where = await productListWhere(q, cat, status);

  const [{ lowStockAt }, total, products, categories] = await Promise.all([
    getConfig("inventory"),
    db.product.count({ where }),
    db.product.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { name: "asc" }],
      skip: (page - 1) * PER_PAGE,
      take: PER_PAGE,
      include: { category: { select: { name: true } } },
    }),
    db.category.findMany({ where: { parentId: null }, orderBy: { sortOrder: "asc" }, select: { slug: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (p: number) => `/admin/products?${new URLSearchParams({ ...(q && { q }), ...(cat && { cat }), ...(status && { status }), ...(p > 1 && { page: String(p) }) })}`;
  const exportQs = new URLSearchParams({ ...(q && { q }), ...(cat && { cat }), ...(status && { status }) }).toString();

  return (
    <>
      <CatalogTabs />
      <form className="mb-4 flex flex-wrap items-center gap-3" role="search">
        <input name="q" defaultValue={q} placeholder="Search name, brand or SKU…" aria-label="Search products" className={`${fieldClass} max-w-[320px] min-w-[160px] flex-1 py-2.5`} />
        <select name="cat" defaultValue={cat} aria-label="Category" className={select}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} aria-label="Status" className={select}>
          <option value="">Live and draft</option>
          <option value="ACTIVE">Live only</option>
          <option value="DRAFT">Draft only</option>
        </select>
        <button type="submit" className="btn cursor-pointer border-0 bg-ink text-14">
          Filter
        </button>
        <span className="ml-auto flex items-center gap-4">
          {can(admin, "products.export") && <ExportLink href={`/admin/export/products${exportQs ? `?${exportQs}` : ""}`} />}
          {can(admin, "products.create") && (
            <Link href="/admin/products/new" className="btn text-14">
              + Add product
            </Link>
          )}
        </span>
      </form>

      <div className={card}>
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>
                <span className="sr-only">Photo</span>
              </th>
              <th className={th}>Product</th>
              <th className={th}>Category</th>
              <th className={th}>Price</th>
              <th className={th}>Stock</th>
              <th className={th}>Live</th>
              <th className={th}>
                <span className="sr-only">Edit</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {products.length ? (
              products.map((p) => (
                <tr key={p.id} className={row}>
                  <td className={td}>
                    <span className="grid size-11 place-items-center overflow-hidden rounded-10 bg-[#f4f6f9]">
                      {p.image && <Image src={p.image} alt="" width={44} height={44} className="size-full object-contain mix-blend-multiply" />}
                    </span>
                  </td>
                  <td className={td}>
                    <Link href={`/admin/products/${p.id}`} className="font-bold hover:text-accent">
                      {p.name}
                    </Link>
                    <small className="block text-12 text-muted">
                      {p.brand}
                      {p.sku ? ` · ${p.sku}` : ""}
                    </small>
                  </td>
                  <td className={td}>{p.category.name}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    {money(p.price)}
                    {p.compareAtPrice && <s className="ml-1.5 text-12 text-muted">{money(p.compareAtPrice)}</s>}
                  </td>
                  <td className={`${td} ${p.stock != null && p.stock <= lowStockAt ? "font-bold text-[#dc2626]" : ""}`}>
                    {p.stock ?? <span className="text-muted" title="Stock not tracked">—</span>}
                  </td>
                  <td className={td}>
                    <SwitchButton
                      readOnly={!can(admin, "products.edit")}
                      on={p.status === "ACTIVE"}
                      action={toggleProductStatus.bind(null, p.id)}
                      label={`${p.name}: ${p.status === "ACTIVE" ? "live, click to hide" : "draft, click to publish"}`}
                    />
                  </td>
                  <td className={td}>
                    <Link href={`/admin/products/${p.id}`} className="text-13 font-bold text-accent hover:underline">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={7}>No products match.</EmptyRow>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} total={total} href={qs} />
    </>
  );
}
