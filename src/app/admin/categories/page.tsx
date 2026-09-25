import Image from "next/image";
import Link from "next/link";
import { deleteCategory, saveCategory } from "@/app/actions/catalog";
import { Field, fieldClass } from "@/components/account/field";
import { ActionForm, ConfirmButton } from "@/components/admin/action-form";
import { CatalogTabs } from "@/components/admin/catalog-tabs";
import { card, CheckField, SectionTitle, select } from "@/components/admin/ui";
import { CategoryGlyph, GridIcon } from "@/components/icons";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { HOME_CATEGORY_TILES } from "@/lib/categories";
import { db } from "@/lib/db";
import { CATEGORY_ICONS, isCategoryIcon } from "@/lib/site-nav";

export const metadata = { title: "Categories" };

const label = "grid gap-1.5 text-13 text-muted";

type Cat = { id: string; name: string; slug: string; parentId: string | null; description: string | null; icon: string | null; image: string | null; showInMenu: boolean; sortOrder: number };

function CategoryFields({ c, tops }: { c?: Cat; tops: { id: string; name: string }[] }) {
  return (
    <>
      {c && <input type="hidden" name="id" value={c.id} />}
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <Field label="Name" name="name" defaultValue={c?.name} />
        <Field label="URL name (empty = from the name)" name="slug" placeholder="network-switches" defaultValue={c?.slug} />
        <label className={label}>
          <span>Parent</span>
          <select name="parentId" defaultValue={c?.parentId ?? ""} className={`${select} w-full py-3`}>
            <option value="">— Top-level category —</option>
            {tops
              .filter((t) => t.id !== c?.id)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  Under {t.name}
                </option>
              ))}
          </select>
        </label>
        <label className={label}>
          <span>Icon (when there is no image)</span>
          <select name="icon" defaultValue={c?.icon ?? ""} className={`${select} w-full py-3`}>
            <option value="">Generic grid</option>
            {CATEGORY_ICONS.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </label>
        <Field label="Order (lower first)" name="sortOrder" type="number" step="1" defaultValue={String(c?.sortOrder ?? 0)} />
        <label className={label}>
          <span>Image (JPG, PNG or WebP, up to 4 MB)</span>
          <input
            type="file"
            name="image"
            accept="image/jpeg,image/png,image/webp"
            className="text-13 text-ink file:mr-3 file:cursor-pointer file:rounded-pill file:border-0 file:bg-ink file:px-4 file:py-2 file:text-white"
          />
        </label>
      </div>
      <label className={label}>
        <span>Description (home page tile)</span>
        <textarea name="description" rows={2} defaultValue={c?.description ?? ""} className={fieldClass} />
      </label>
      <CheckField name="showInMenu" label="Show in the menu, footer and home tiles (top-level only)" defaultChecked={c?.showInMenu ?? true} />
      {c?.image && <CheckField name="removeImage" label="Remove the image (use the icon)" />}
    </>
  );
}

function Thumb({ c }: { c: Cat }) {
  return (
    <span className="grid size-10 flex-none place-items-center overflow-hidden rounded-10 bg-accent-soft text-accent">
      {c.image ? (
        <Image src={c.image} alt="" width={40} height={40} className="size-full bg-white object-contain" />
      ) : isCategoryIcon(c.icon) ? (
        <CategoryGlyph name={c.icon} className="size-5" />
      ) : (
        <GridIcon className="size-5" />
      )}
    </span>
  );
}

// Categories (Phase 12): two levels, image or icon, menu visibility, order. Products are assigned on the product form.
export default async function AdminCategories() {
  const admin = await requireAdminPage("/admin/categories", "categories.view");
  const [all, counts] = await Promise.all([
    db.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    db.product.groupBy({ by: ["categoryId"], _count: { _all: true } }),
  ]);
  const count = (id: string) => counts.find((x) => x.categoryId === id)?._count._all ?? 0;
  const tops = all.filter((c) => !c.parentId);
  const menuTops = tops.filter((c) => c.showInMenu);

  const row = (c: Cat, child: boolean) => {
    const own = count(c.id);
    const kids = all.filter((x) => x.parentId === c.id);
    const total = own + kids.reduce((s, k) => s + count(k.id), 0);
    const homeTile = !child && c.showInMenu && menuTops.findIndex((t) => t.id === c.id) < HOME_CATEGORY_TILES;
    return (
      <details key={c.id} className={`rounded-12 border border-line bg-[#fafafa] ${child ? "ml-8" : ""}`}>
        <summary className="flex cursor-pointer flex-wrap items-center gap-3 px-4 py-3 text-14">
          <Thumb c={c} />
          <b>{c.name}</b>
          <span className="text-12 text-muted">/{c.slug}</span>
          <span className="text-13 text-muted">
            {total} product{total === 1 ? "" : "s"}
          </span>
          {!child && !c.showInMenu && <span className="rounded-pill bg-[#6b72801f] px-2 py-0.5 text-12 font-bold text-[#6b7280]">Hidden from menu</span>}
          {homeTile && <span className="rounded-pill bg-accent-soft px-2 py-0.5 text-12 font-bold text-accent">Home tile</span>}
          <span className="ml-auto text-13 font-bold text-accent">Edit</span>
        </summary>
        <div className="border-t border-line p-4">
          <ActionForm action={saveCategory} submitLabel="Save category" readOnly={!can(admin, "categories.edit")}>
            <CategoryFields c={c} tops={tops} />
          </ActionForm>
          <div className="mt-3 flex flex-wrap gap-4 text-13">
            <Link href={`/shop?category=${c.slug}`} target="_blank" className="font-bold text-accent hover:underline">
              View in shop ↗
            </Link>
            {own || kids.length ? (
              <span className="text-muted">To delete it, move its {own ? `${own} products` : ""}{own && kids.length ? " and " : ""}{kids.length ? "subcategories" : ""} first.</span>
            ) : (
              can(admin, "categories.delete") && <ConfirmButton action={deleteCategory.bind(null, c.id)} confirmText={`Delete the category “${c.name}”?`} />
            )}
          </div>
        </div>
      </details>
    );
  };

  return (
    <>
      <CatalogTabs />
      <div className="grid max-w-[900px] gap-4">
        <p className="text-14 text-muted">
          Top-level categories appear in the <b>All categories</b> menu and the footer; the first {HOME_CATEGORY_TILES} (by order) are the home page
          tiles. Subcategories show as filters in the shop. Changing a URL name breaks old links to that category.
        </p>
        <div className="grid gap-2">
          {tops.map((t) => [row(t, false), ...all.filter((c) => c.parentId === t.id).map((c) => row(c, true))])}
        </div>
        {can(admin, "categories.create") && (
          <div className={card}>
            <SectionTitle>Add a category</SectionTitle>
            <ActionForm action={saveCategory} submitLabel="Add category" resetOnSuccess>
              <CategoryFields tops={tops} />
            </ActionForm>
          </div>
        )}
      </div>
    </>
  );
}
