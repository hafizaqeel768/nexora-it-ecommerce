import Link from "next/link";
import { renameBrand } from "@/app/actions/catalog";
import { Field } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { CatalogTabs } from "@/components/admin/catalog-tabs";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";

export const metadata = { title: "Brands" };

// Brands (Phase 12): every brand used by products, with rename / merge (e.g. "Ubiquiti Networks" → "Ubiquiti").
export default async function AdminBrands() {
  const admin = await requireAdminPage("/admin/brands", "products.view");
  const brands = await db.product.groupBy({
    by: ["brand"],
    _count: { _all: true },
    orderBy: [{ _count: { brand: "desc" } }, { brand: "asc" }],
  });
  const live = await db.product.groupBy({ by: ["brand"], where: { status: "ACTIVE" }, _count: { _all: true } });
  const liveOf = (b: string) => live.find((x) => x.brand === b)?._count._all ?? 0;

  return (
    <>
      <CatalogTabs />
      <div className="grid max-w-[900px] gap-4">
        <p className="text-14 text-muted">
          A brand is the <b>Brand</b> field of a product. Renaming changes it on every product; renaming to a brand that already exists
          <b> merges</b> the two (handy for spelling variants). Brand filters in the shop update right away.
        </p>
        <div className="grid gap-2">
          {brands.map((b) => (
            <details key={b.brand} className="rounded-12 border border-line bg-[#fafafa]">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 text-14">
                <b>{b.brand}</b>
                <span className="text-13 text-muted">
                  {b._count._all} product{b._count._all === 1 ? "" : "s"} · {liveOf(b.brand)} live
                </span>
                <Link href={`/admin/products?q=${encodeURIComponent(b.brand)}`} className="text-13 text-muted hover:text-accent">
                  List products
                </Link>
                <span className="ml-auto text-13 font-bold text-accent">Rename / merge</span>
              </summary>
              <div className="border-t border-line p-4">
                <ActionForm action={renameBrand} submitLabel="Rename" readOnly={!can(admin, "products.edit")} className="grid max-w-[420px] gap-3">
                  <input type="hidden" name="from" value={b.brand} />
                  <Field label="New name (an existing brand merges)" name="to" defaultValue={b.brand} list="brand-names" />
                </ActionForm>
              </div>
            </details>
          ))}
        </div>
        <datalist id="brand-names">
          {brands.map((b) => (
            <option key={b.brand} value={b.brand} />
          ))}
        </datalist>
      </div>
    </>
  );
}
