import Link from "next/link";
import { ProductForm } from "@/components/admin/product-form";
import { card } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import { categoryGroups } from "@/lib/admin-queries";

export default async function NewProduct() {
  await requireAdminPage("/admin/products/new", "products.create");
  const categories = await categoryGroups();
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-13 text-muted">
        <Link href="/admin/products" className="text-accent">
          Products
        </Link>{" "}
        / Add product
      </nav>
      <div className={`${card} max-w-[860px]`}>
        <ProductForm
          categories={categories}
          values={{
            id: null,
            slug: null,
            name: "",
            brand: "",
            categoryId: "",
            price: "",
            compareAtPrice: "",
            stock: "10",
            sku: "",
            status: "ACTIVE",
            availability: "IN_STOCK",
            description: "",
            specs: "",
            images: [],
          }}
        />
      </div>
    </>
  );
}
