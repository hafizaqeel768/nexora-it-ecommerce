import type { Metadata } from "next";
import Link from "next/link";
import { toggleAttribute } from "@/app/actions/attributes";
import { CatalogTabs } from "@/components/admin/catalog-tabs";
import { SwitchButton } from "@/components/admin/switch-button";
import { card, EmptyRow, row, select, table, td, th } from "@/components/admin/ui";
import { fieldClass } from "@/components/account/field";
import type { Prisma } from "@/generated/prisma/client";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { ATTRIBUTE_TYPES, isAttributeType } from "@/lib/attributes";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Attributes" };

type Props = { searchParams: Promise<{ q?: string; type?: string; status?: string; done?: string }> };

// Admin → Catalog → Attributes (Phase 16): configurable product attributes such as RAM or Screen size.
export default async function AdminAttributes({ searchParams }: Props) {
  const sp = await searchParams;
  const admin = await requireAdminPage("/admin/attributes", "attributes.view");
  const q = (sp.q ?? "").trim().slice(0, 80);
  const type = sp.type && isAttributeType(sp.type) ? sp.type : "";
  const status = sp.status === "active" || sp.status === "disabled" ? sp.status : "";
  const where: Prisma.AttributeWhereInput = {
    ...(q && { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q.toLowerCase() } }] }),
    ...(type && { type }),
    ...(status && { active: status === "active" }),
  };
  const [attrs, total] = await Promise.all([
    db.attribute.findMany({ where, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { options: true } } } }),
    db.attribute.count(),
  ]);
  const mayEdit = can(admin, "attributes.edit");

  return (
    <>
      <CatalogTabs />
      {sp.done && (
        <p role="status" className="mb-4 rounded-12 border border-[#16a34a33] bg-[#16a34a14] px-4 py-3 text-14 text-success">
          {sp.done.slice(0, 200)}
        </p>
      )}
      <form className="mb-4 flex flex-wrap items-center gap-2.5">
        <input name="q" defaultValue={q} placeholder="Search name or code" aria-label="Search attributes" className={`${fieldClass} max-w-[260px] py-2.5`} />
        <select name="type" defaultValue={type} aria-label="Input type" className={select}>
          <option value="">All types</option>
          {Object.entries(ATTRIBUTE_TYPES).map(([k, t]) => (
            <option key={k} value={k}>
              {t.label}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} aria-label="Status" className={select}>
          <option value="">Active and disabled</option>
          <option value="active">Active only</option>
          <option value="disabled">Disabled only</option>
        </select>
        <button type="submit" className="btn cursor-pointer border-0 bg-ink text-14">
          Filter
        </button>
        {can(admin, "attributes.create") && (
          <Link href="/admin/attributes/new" className="btn ml-auto text-14">
            + Add attribute
          </Link>
        )}
      </form>
      <div className={card}>
        <table className={table}>
          <thead>
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Code</th>
              <th className={th}>Input type</th>
              <th className={th}>Required</th>
              <th className={th}>Options</th>
              <th className={th}>Order</th>
              <th className={th}>Active</th>
            </tr>
          </thead>
          <tbody>
            {attrs.length ? (
              attrs.map((a) => (
                <tr key={a.id} className={row}>
                  <td className={td}>
                    <Link href={`/admin/attributes/${a.id}`} className="font-bold text-accent hover:underline">
                      {a.name}
                    </Link>
                    {a.unit && <span className="ml-1 text-12 text-muted">({a.unit})</span>}
                  </td>
                  <td className={`${td} font-mono text-13`}>{a.code}</td>
                  <td className={td}>{ATTRIBUTE_TYPES[a.type].label}</td>
                  <td className={td}>{a.required ? "Yes" : "—"}</td>
                  <td className={td}>{ATTRIBUTE_TYPES[a.type].options ? a._count.options : "—"}</td>
                  <td className={td}>{a.sortOrder}</td>
                  <td className={td}>
                    <SwitchButton readOnly={!mayEdit} on={a.active} action={toggleAttribute.bind(null, a.id, !a.active)} label={`${a.name}: ${a.active ? "active, click to disable" : "disabled, click to enable"}`} />
                  </td>
                </tr>
              ))
            ) : (
              <EmptyRow cols={7}>
                {total ? "No attributes match these filters." : "No attributes yet. Add the product details you want to manage, e.g. Processor, RAM or Screen size."}
              </EmptyRow>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
