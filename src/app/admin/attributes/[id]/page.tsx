import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAttribute, saveAttribute, saveAttributeOptions } from "@/app/actions/attributes";
import { AttributeForm, OptionsEditor } from "@/components/admin/attribute-forms";
import { StaffActionButton } from "@/components/admin/staff-forms";
import { card, cardTitle, SectionTitle } from "@/components/admin/ui";
import { can } from "@/lib/acl";
import { requireAdminPage } from "@/lib/admin";
import { ATTRIBUTE_TYPES, attributeTypeList, attributeUsage } from "@/lib/attributes";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Attribute" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

// One attribute (Phase 16): settings, options (for dropdown / multiple choice), delete while unused.
export default async function AttributePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { created } = await searchParams;
  const admin = await requireAdminPage(`/admin/attributes/${id}`, "attributes.view");
  const a = await db.attribute.findUnique({ where: { id }, include: { options: { orderBy: { sortOrder: "asc" } } } });
  if (!a) notFound();
  const type = ATTRIBUTE_TYPES[a.type];
  const usage = await attributeUsage(a.id);
  const mayEdit = can(admin, "attributes.edit");

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-13 text-muted">
        <Link href="/admin/attributes" className="text-accent">
          Attributes
        </Link>{" "}
        / {a.name}
      </nav>
      {created && (
        <p role="status" className="mb-4 max-w-[860px] rounded-12 border border-[#16a34a33] bg-[#16a34a14] px-4 py-3 text-14 text-success">
          Attribute created.{type.options ? " Now add its options below." : ""}
        </p>
      )}
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <h2 className="text-22 font-bold">{a.name}</h2>
        <code className="rounded-8 bg-[#f3f4f6] px-2 py-0.5 text-13">{a.code}</code>
        <span className="text-13 text-muted">{type.label}</span>
        {!a.active && <span className="rounded-pill bg-[#6b72801f] px-2.5 py-0.5 text-12 font-bold text-[#6b7280]">Disabled</span>}
      </div>

      <div className="grid max-w-[860px] gap-4">
        <div className={card}>
          <AttributeForm
            action={saveAttribute}
            types={attributeTypeList()}
            readOnly={!mayEdit}
            values={{
              id: a.id,
              code: a.code,
              name: a.name,
              type: a.type,
              required: a.required,
              defaultValue: a.defaultValue ?? "",
              unit: a.unit ?? "",
              active: a.active,
              sortOrder: String(a.sortOrder),
              description: a.description ?? "",
              showOnProduct: a.showOnProduct,
            }}
          />
        </div>

        {type.options && (
          <div className={card}>
            <SectionTitle hint={a.type === "SELECT" ? "Staff pick one of these for each product." : "Staff can pick several of these for each product."}>
              Options ({a.options.length})
            </SectionTitle>
            <OptionsEditor
              action={saveAttributeOptions.bind(null, a.id)}
              single={a.type === "SELECT"}
              readOnly={!mayEdit}
              options={a.options.map((o) => ({ id: o.id, label: o.label, active: o.active, isDefault: o.isDefault }))}
            />
          </div>
        )}

        {can(admin, "attributes.delete") && (
          <div className={card}>
            <h3 className={cardTitle}>Delete attribute</h3>
            {usage.products || usage.sets ? (
              <p className="text-13 text-muted">
                Used by {usage.products} product(s) and {usage.sets} attribute set(s), so it can&apos;t be deleted. Disable it instead.
              </p>
            ) : (
              <>
                <p className="mb-3 text-13 text-muted">Not used by any product or attribute set, so it can be deleted together with its options.</p>
                <StaffActionButton action={deleteAttribute.bind(null, a.id)} label="Delete attribute" confirmText={`Delete the attribute “${a.name}” and its options?`} danger />
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
