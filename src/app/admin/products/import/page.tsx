import { redirect } from "next/navigation";

// The product CSV import moved to Data Transfer → Import in Phase 15 (same columns, plus sample files,
// behaviors and an error report). Old bookmarks land there.
export default function ImportProducts() {
  redirect("/admin/data-transfer/import?entity=products");
}
