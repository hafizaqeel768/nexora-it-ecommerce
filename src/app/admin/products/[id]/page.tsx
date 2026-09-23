import Link from "next/link";
import { notFound } from "next/navigation";
import { savePriceTiers, saveProductOptions } from "@/app/actions/catalog";
import { OptionsEditor, TiersEditor } from "@/components/admin/product-extras";
import { ProductForm } from "@/components/admin/product-form";
import { card, SectionTitle } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import { categoryGroups } from "@/lib/admin-queries";
import { db } from "@/lib/db";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

export default async function EditProduct({ params, searchParams }: Props) {
  const { id } = await params;
  const { created } = await searchParams;
  await requireAdminPage(`/admin/products/${id}`);
  const [p, categories, sold] = await Promise.all([
    db.product.findUnique({ where: { id }, include: { variants: { orderBy: { sortOrder: "asc" } }, priceTiers: { orderBy: { minQty: "asc" } } } }),
    categoryGroups(),
    db.orderItem.aggregate({ where: { productId: id, order: { status: { not: "CANCELLED" } } }, _sum: { quantity: true } }),
  ]);
  if (!p) notFound();
  const specs = Array.isArray(p.specs) ? (p.specs as { label: string; value: string }[]) : [];

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-13 text-muted">
        <Link href="/admin/products" className="text-accent">
          Products
        </Link>{" "}
        / {p.name}
      </nav>
      {created && (
        <p role="status" className="mb-4 max-w-[860px] rounded-12 border border-[#16a34a33] bg-[#16a34a14] px-4 py-3 text-14 text-success">
          Product created.
        </p>
      )}
      <p className="mb-4 text-13 text-muted">
        {sold._sum.quantity ?? 0} sold · URL /product/{p.slug}
        {p.isSample && " · prototype sample product"}
      </p>
      <div className={`${card} max-w-[860px]`}>
        <ProductForm
          categories={categories}
          values={{
            id: p.id,
            slug: p.slug,
            name: p.name,
            brand: p.brand,
            categoryId: p.categoryId,
            price: p.price.toString(),
            compareAtPrice: p.compareAtPrice?.toString() ?? "",
            stock: p.stock?.toString() ?? "",
            sku: p.sku ?? "",
            status: p.status,
            availability: p.availability,
            description: p.description ?? p.shortDescription ?? "",
            specs: specs.map((s) => (s.value ? `${s.label}: ${s.value}` : s.label)).join("\n"),
            images: [p.image, ...p.gallery].filter((u): u is string => !!u),
          }}
        />
      </div>

      <div className={`${card} mt-4 max-w-[860px]`}>
        <SectionTitle hint="E.g. memory or warranty choices. Each option can change the price.">Options</SectionTitle>
        <OptionsEditor
          action={saveProductOptions.bind(null, p.id)}
          basePrice={Number(p.price)}
          attribute={p.variants[0]?.attribute ?? ""}
          options={p.variants.map((v) => ({ id: v.id, name: v.name, delta: v.priceDelta.toString(), sku: v.sku ?? "" }))}
        />
      </div>

      <div className={`${card} mt-4 max-w-[860px]`}>
        <SectionTitle hint="Lower unit prices for larger quantities (shown on the product page as “Bulk pricing”).">Bulk pricing</SectionTitle>
        <TiersEditor
          action={savePriceTiers.bind(null, p.id)}
          basePrice={Number(p.price)}
          tiers={p.priceTiers.map((t) => ({
            min: String(t.minQty),
            max: t.maxQty == null ? "" : String(t.maxQty),
            pct: String(Math.round((1 - Number(t.multiplier)) * 1000) / 10),
          }))}
        />
      </div>
    </>
  );
}
