import { CatalogTabs } from "@/components/admin/catalog-tabs";
import { ImportForm } from "@/components/admin/import-form";
import { card, SectionTitle } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import { MAX_IMPORT_ROWS } from "@/lib/product-import";

export const metadata = { title: "Import products" };

export default async function ImportProducts() {
  await requireAdminPage("/admin/products/import", "products.import");
  return (
    <>
      <CatalogTabs />
      <div className="grid max-w-[900px] gap-4">
        <div className={card}>
          <SectionTitle hint="Add or update many products at once from a spreadsheet saved as CSV.">Import products from CSV</SectionTitle>
          <ol className="mb-4 grid list-decimal gap-1 pl-5 text-14 text-muted">
            <li>
              Start from{" "}
              <a href="/admin/export/products" className="font-bold text-accent" download>
                Export CSV
              </a>{" "}
              (same columns): SKU, Name, Brand, Category, Price, Compare-at price, Stock, Status, URL slug. A Description column is optional.
            </li>
            <li>Rows are matched to existing products by <b>URL slug</b>, then <b>SKU</b>; other rows become <b>new products</b> (Name, Brand, Category and Price required).</li>
            <li>Only columns in the file are changed. Empty Compare-at clears it; Stock “not tracked” or empty turns stock tracking off; Status is active or draft.</li>
            <li>Category is a category name or URL name that already exists. Photos, options and bulk pricing stay as they are (edit them per product).</li>
            <li>Preview first: nothing is saved until you press Apply. Up to {MAX_IMPORT_ROWS} rows / 2 MB per file.</li>
          </ol>
          <ImportForm />
        </div>
      </div>
    </>
  );
}
