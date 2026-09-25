// Data Transfer entities (Phase 15). Adding an entity = one adapter file + one line here.
import { can, type AdminAccess } from "@/lib/acl";
import { categoryExport, categoryImport } from "@/lib/data-transfer/entities/categories";
import { customerExport, customerImport } from "@/lib/data-transfer/entities/customers";
import { orderExport } from "@/lib/data-transfer/entities/orders";
import { productExport, productImport } from "@/lib/data-transfer/entities/products";
import type { EntityKey, ExportAdapter, ImportAdapter } from "@/lib/data-transfer/types";

export const IMPORTERS: Partial<Record<EntityKey, ImportAdapter>> = {
  products: productImport as ImportAdapter,
  categories: categoryImport as ImportAdapter,
  customers: customerImport as ImportAdapter,
};

export const EXPORTERS: Record<EntityKey, ExportAdapter> = {
  products: productExport as ExportAdapter,
  categories: categoryExport as ExportAdapter,
  customers: customerExport as ExportAdapter,
  orders: orderExport as ExportAdapter,
};

export const importer = (entity: string) => (Object.hasOwn(IMPORTERS, entity) ? IMPORTERS[entity as EntityKey]! : null);
export const exporter = (entity: string) => (Object.hasOwn(EXPORTERS, entity) ? EXPORTERS[entity as EntityKey] : null);

/** Importers this admin may use (Data Transfer access + the entity's import permission). */
export const allowedImporters = (a: AdminAccess) => (can(a, "import.access") ? Object.values(IMPORTERS).filter((x) => can(a, x.permission)) : []);
export const allowedExporters = (a: AdminAccess) => (can(a, "export.access") ? Object.values(EXPORTERS).filter((x) => can(a, x.permission)) : []);

/** Header row + example rows for the "Download sample CSV" link. */
export const sampleRows = (a: ImportAdapter) => {
  const cols = a.columns.filter((c) => !c.exportOnly);
  return [cols.map((c) => c.header), ...a.sample.map((row) => cols.map((c) => row[c.key] ?? ""))];
};
