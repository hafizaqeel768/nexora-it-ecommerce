"use client";

import { useState } from "react";
import type { AdminFormState } from "@/app/actions/admin";
import { Field, fieldClass } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { CheckField, select } from "@/components/admin/ui";

// Product attributes (Phase 16): the attribute form and the options editor.

type TypeInfo = { value: string; label: string; hint: string; options: boolean; unit: boolean };
export type AttributeValues = {
  id?: string;
  code: string;
  name: string;
  type: string;
  required: boolean;
  defaultValue: string;
  unit: string;
  active: boolean;
  sortOrder: string;
  description: string;
  showOnProduct: boolean;
};

const label = "grid gap-1.5 text-13 text-muted";

export function AttributeForm({
  action,
  values,
  types,
  readOnly = false,
}: {
  action: (s: AdminFormState, f: FormData) => Promise<AdminFormState>;
  values: AttributeValues;
  types: TypeInfo[];
  readOnly?: boolean;
}) {
  const editing = !!values.id;
  const [type, setType] = useState(values.type || types[0].value);
  const info = types.find((t) => t.value === type) ?? types[0];
  return (
    <ActionForm action={action} submitLabel={editing ? "Save attribute" : "Create attribute"} readOnly={readOnly}>
      {editing && <input type="hidden" name="id" value={values.id} />}
      <div className="grid grid-cols-2 gap-3.5 max-[700px]:grid-cols-1">
        <Field label="Name (shown to staff and customers)" name="name" defaultValue={values.name} required placeholder="Screen size" />
        {editing ? (
          <label className={label}>
            <span>Attribute code (fixed)</span>
            <input value={values.code} readOnly disabled className={`${fieldClass} font-mono`} />
          </label>
        ) : (
          <Field label="Attribute code (fixed once created)" name="code" defaultValue={values.code} required placeholder="screen_size" className={`${fieldClass} font-mono`} />
        )}
        <label className={label}>
          <span>Input type{editing ? " (fixed)" : " *"}</span>
          <select name="type" value={type} onChange={(e) => setType(e.target.value)} disabled={editing} className={`${select} w-full py-3`}>
            {types.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="text-12">{info.hint}</span>
        </label>
        <Field label="Sort order (lower first)" name="sortOrder" type="number" defaultValue={values.sortOrder} placeholder="0" />
        {!info.options && (
          <Field
            label={type === "BOOLEAN" ? "Default value (yes / no, optional)" : type === "DATE" ? "Default value (YYYY-MM-DD, optional)" : "Default value (optional)"}
            name="defaultValue"
            defaultValue={values.defaultValue}
          />
        )}
        {info.unit && <Field label="Unit (optional, e.g. GB, in, W)" name="unit" defaultValue={values.unit} />}
      </div>
      {info.options && <p className="text-12 text-muted">Options and the default choice are set below, after the attribute is saved.</p>}
      <label className={label}>
        <span>Description (for staff, optional)</span>
        <textarea name="description" rows={2} defaultValue={values.description} className={fieldClass} />
      </label>
      <div className="grid gap-2.5">
        <CheckField name="required" label="Required" hint="Products using this attribute must have a value (checked on the product form, Phase 17)." defaultChecked={values.required} />
        <CheckField name="showOnProduct" label="Show on the product page" hint="Listed in the product's specifications." defaultChecked={values.showOnProduct} />
        <CheckField name="active" label="Active" hint="Disabled attributes can't be added to products; saved values stay." defaultChecked={values.active} />
      </div>
    </ActionForm>
  );
}

type Row = { key: string; id: string; label: string; active: boolean; isDefault: boolean };
let seq = 0;

/** Options of a dropdown / multiple-choice attribute: add, rename, disable, reorder, default, remove. */
export function OptionsEditor({
  action,
  options,
  single,
  readOnly = false,
}: {
  action: (s: AdminFormState, f: FormData) => Promise<AdminFormState>;
  options: Omit<Row, "key">[];
  single: boolean;
  readOnly?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>(options.map((o) => ({ ...o, key: o.id })));
  // After a save the page sends the stored options (new ones now have ids).
  const serverKey = JSON.stringify(options);
  const [synced, setSynced] = useState(serverKey);
  if (serverKey !== synced) {
    setSynced(serverKey);
    setRows(options.map((o) => ({ ...o, key: o.id })));
  }
  const set = (key: string, patch: Partial<Row>) =>
    setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : single && patch.isDefault ? { ...r, isDefault: false } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const small = "cursor-pointer rounded-8 border border-line px-2 py-1 text-12 disabled:cursor-default disabled:opacity-40";

  return (
    <ActionForm action={action} submitLabel="Save options" readOnly={readOnly}>
      {rows.length === 0 && <p className="text-13 text-muted">No options yet. Add the choices customers and staff can pick, e.g. 8 GB, 16 GB, 32 GB.</p>}
      <ol className="grid gap-2">
        {rows.map((r, i) => (
          <li key={r.key} className="flex flex-wrap items-center gap-2">
            <input type="hidden" name="o.id" value={r.id} />
            <input type="hidden" name="o.active" value={r.active ? "1" : "0"} />
            <input type="hidden" name="o.default" value={r.isDefault ? "1" : "0"} />
            <span className="w-7 text-right text-12 text-muted">{i + 1}.</span>
            <input
              name="o.label"
              value={r.label}
              onChange={(e) => set(r.key, { label: e.target.value })}
              aria-label={`Option ${i + 1}`}
              placeholder="16 GB"
              className={`${fieldClass} min-w-[160px] flex-1 py-2 ${r.active ? "" : "text-muted line-through"}`}
            />
            <button type="button" className={small} onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">
              ↑
            </button>
            <button type="button" className={small} onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label="Move down">
              ↓
            </button>
            <label className="flex items-center gap-1.5 text-12">
              <input type="checkbox" checked={r.active} onChange={(e) => set(r.key, { active: e.target.checked, ...(e.target.checked ? {} : { isDefault: false }) })} className="accent-accent" />
              Active
            </label>
            <label className="flex items-center gap-1.5 text-12">
              <input type="checkbox" checked={r.isDefault} disabled={!r.active} onChange={(e) => set(r.key, { isDefault: e.target.checked })} className="accent-accent" />
              Default
            </label>
            <button type="button" className="cursor-pointer text-12 text-muted hover:text-accent" onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}>
              Remove
            </button>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => setRows((list) => [...list, { key: `new-${++seq}`, id: "", label: "", active: true, isDefault: false }])}
        className="cursor-pointer justify-self-start text-13 font-bold text-accent hover:underline"
      >
        + Add option
      </button>
      <p className="text-12 text-muted">
        {single ? "One default at most." : "Several defaults allowed."} Disabled options stay on products that already use them but can&apos;t be chosen any more. Removing an
        option is only possible while no product uses it.
      </p>
    </ActionForm>
  );
}
