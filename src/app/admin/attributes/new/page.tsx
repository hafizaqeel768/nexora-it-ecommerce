import type { Metadata } from "next";
import Link from "next/link";
import { saveAttribute } from "@/app/actions/attributes";
import { AttributeForm } from "@/components/admin/attribute-forms";
import { card } from "@/components/admin/ui";
import { requireAdminPage } from "@/lib/admin";
import { attributeTypeList } from "@/lib/attributes";

export const metadata: Metadata = { title: "Add attribute" };

export default async function NewAttribute() {
  await requireAdminPage("/admin/attributes/new", "attributes.create");
  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-4 text-13 text-muted">
        <Link href="/admin/attributes" className="text-accent">
          Attributes
        </Link>{" "}
        / New
      </nav>
      <div className={`${card} max-w-[860px]`}>
        <AttributeForm
          action={saveAttribute}
          types={attributeTypeList()}
          values={{ code: "", name: "", type: "", required: false, defaultValue: "", unit: "", active: true, sortOrder: "", description: "", showOnProduct: true }}
        />
      </div>
    </>
  );
}
