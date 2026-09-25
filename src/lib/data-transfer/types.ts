// Data Transfer framework (Phase 15): what an entity provides so the shared engines can import and export it.
// Import: src/lib/data-transfer/import-engine.ts · Export: export-engine.ts · Entities: entities/*.ts
import type { Prisma } from "@/generated/prisma/client";
import type { Permission } from "@/lib/acl";

export type EntityKey = "products" | "categories" | "customers" | "orders";

export type Behavior = "add" | "update" | "add_update";
export const BEHAVIORS: Record<Behavior, { label: string; hint: string }> = {
  add: { label: "Add", hint: "Only create new records; rows that match an existing record are skipped." },
  update: { label: "Update", hint: "Only change existing records; rows that match nothing are skipped." },
  add_update: { label: "Add / Update", hint: "Create new records and change existing ones." },
};

export type OnError = "skip" | "stop";

export type ColumnType = "text" | "money" | "integer" | "boolean" | "choice" | "email" | "reference";

export type ColumnSpec = {
  /** Internal name; the file may use the header, the key or an alias (case, spaces, _ and - don't matter) */
  key: string;
  header: string;
  aliases?: string[];
  /** "key": identifies the record. "create": needed for new records. false: optional */
  required: "key" | "create" | false;
  type: ColumnType;
  description: string;
  example: string;
  /** Allowed values for "choice" and "boolean" columns, shown in the column guide */
  values?: string[];
  /** Written by the export for information but ignored by the import */
  exportOnly?: boolean;
};

/** One data row of the file. `get` returns undefined when the file has no such column, "" when the cell is empty. */
export type RowInput = { line: number; get: (key: string) => string | undefined; cells: string[] };

export type RowAction = "create" | "update" | "skip";

/** What the import would do with a row. `write` is only set when there are no errors and something changes. */
export type PlannedRow<W> = { line: number; key: string; action: RowAction; errors: string[]; warnings: string[]; changes: string[]; write?: W };

export interface ImportAdapter<Ctx = unknown, W = unknown> {
  entity: EntityKey;
  label: string;
  permission: Permission;
  behaviors: Behavior[];
  columns: ColumnSpec[];
  /** Short rules shown above the column guide */
  notes: string[];
  /** Example rows (values by column key) for the sample CSV */
  sample: Record<string, string>[];
  /** Everything the rows are checked against (existing records, lookups). Called once per validation. */
  load(): Promise<Ctx>;
  /** Checks one row. Rows are planned in file order; the adapter keeps track of duplicates in `ctx`. */
  plan(row: RowInput, ctx: Ctx, behavior: Behavior): PlannedRow<W>;
  /** Optional write order (e.g. parent categories before their subcategories). */
  sortForWrite?(rows: PlannedRow<W>[]): PlannedRow<W>[];
  /** Writes one planned row inside a transaction. Throw to fail the row. */
  write(tx: Prisma.TransactionClient, write: W, action: "create" | "update"): Promise<void>;
}

export type FilterSpec =
  | { key: string; label: string; type: "text"; placeholder?: string }
  | { key: string; label: string; type: "choice"; options: { value: string; label: string }[] }
  | { key: string; label: string; type: "number"; min?: number; step?: string }
  | { key: string; label: string; type: "date" };

export interface ExportAdapter<F = unknown> {
  entity: EntityKey;
  label: string;
  permission: Permission;
  filters: FilterSpec[];
  /** Validated filters from the query string; bad values are reported, not silently ignored. */
  parseFilters(params: URLSearchParams): Promise<{ filters: F; errors: string[] }>;
  count(filters: F): Promise<number>;
  headers: string[];
  /** One page of rows after `cursor` (the last id of the previous page), in a stable order. */
  page(filters: F, cursor: string | null, take: number): Promise<{ rows: unknown[][]; last: string | null }>;
}
