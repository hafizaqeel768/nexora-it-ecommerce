"use client";

import { useState } from "react";
import type { AdminFormState } from "@/app/actions/admin";
import { fieldClass } from "@/components/account/field";
import { ActionForm } from "@/components/admin/action-form";
import { money } from "@/lib/format";

type Action = (state: AdminFormState, form: FormData) => Promise<AdminFormState>;
const cell = `${fieldClass} py-2`;
const removeBtn = "cursor-pointer text-13 text-muted hover:text-accent";
const addBtn = "cursor-pointer justify-self-start text-13 font-bold text-accent hover:underline";

type Option = { key: string; id: string; name: string; delta: string; sku: string };
let seq = 0;
const newKey = () => `new-${++seq}`;

// Product options (one group, like the prototype): name + price change per option.
export function OptionsEditor({ action, attribute, options, basePrice, readOnly = false }: { action: Action; attribute: string; options: Omit<Option, "key">[]; basePrice: number; readOnly?: boolean }) {
  const [rows, setRows] = useState<Option[]>(options.map((o) => ({ ...o, key: o.id })));
  // After a save the page sends the stored options (new ones now have ids): show exactly those.
  const serverKey = JSON.stringify(options);
  const [synced, setSynced] = useState(serverKey);
  if (serverKey !== synced) {
    setSynced(serverKey);
    setRows(options.map((o) => ({ ...o, key: o.id })));
  }
  const set = (key: string, patch: Partial<Option>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  return (
    <ActionForm action={action} submitLabel="Save options" readOnly={readOnly}>
      <label className="grid max-w-[360px] gap-1.5 text-13 text-muted">
        <span>Option group name (shown above the choices)</span>
        <input name="attribute" defaultValue={attribute} placeholder="Memory / Storage" className={cell} />
      </label>
      <div className="grid gap-2">
        {rows.length > 0 && (
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 text-12 text-muted max-sm:hidden">
            <span>Option</span>
            <span>Price change (USD)</span>
            <span>SKU (optional)</span>
            <span />
          </div>
        )}
        {rows.map((o) => (
          <div key={o.key} className="grid grid-cols-[2fr_1fr_1fr_auto] items-center gap-2 max-sm:grid-cols-1">
            <input type="hidden" name="v.id" value={o.id} />
            <input name="v.name" value={o.name} onChange={(e) => set(o.key, { name: e.target.value })} placeholder="32 GB / 1 TB" aria-label="Option" className={cell} />
            <input name="v.delta" value={o.delta} onChange={(e) => set(o.key, { delta: e.target.value })} type="number" step="0.01" placeholder="0" aria-label="Price change" className={cell} />
            <input name="v.sku" value={o.sku} onChange={(e) => set(o.key, { sku: e.target.value })} aria-label="SKU" className={cell} />
            <button type="button" onClick={() => setRows((r) => r.filter((x) => x.key !== o.key))} className={removeBtn}>
              Remove
            </button>
          </div>
        ))}
        <button type="button" onClick={() => setRows((r) => [...r, { key: newKey(), id: "", name: "", delta: "", sku: "" }])} className={addBtn}>
          + Add option
        </button>
        {rows.length > 0 && (
          <p className="text-12 text-muted">
            Customers pick one; the first is preselected. Prices: {rows.filter((o) => o.name).map((o) => `${o.name} ${money(basePrice + (Number(o.delta) || 0))}`).join(" · ")}
          </p>
        )}
      </div>
    </ActionForm>
  );
}

type Tier = { key: string; min: string; max: string; pct: string };

// Bulk pricing tiers: from N units, X % off.
export function TiersEditor({ action, tiers, basePrice, readOnly = false }: { action: Action; tiers: Omit<Tier, "key">[]; basePrice: number; readOnly?: boolean }) {
  const [rows, setRows] = useState<Tier[]>(tiers.map((t) => ({ ...t, key: newKey() })));
  const serverKey = JSON.stringify(tiers);
  const [synced, setSynced] = useState(serverKey);
  if (serverKey !== synced) {
    setSynced(serverKey);
    setRows(tiers.map((t) => ({ ...t, key: newKey() })));
  }
  const set = (key: string, patch: Partial<Tier>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  return (
    <ActionForm action={action} submitLabel="Save bulk pricing" readOnly={readOnly}>
      <div className="grid gap-2">
        {rows.length > 0 && (
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 text-12 text-muted max-sm:hidden">
            <span>From (units)</span>
            <span>To (empty = and up)</span>
            <span>Discount %</span>
            <span>Unit price</span>
            <span />
          </div>
        )}
        {rows.map((t) => {
          const pct = Number(t.pct) || 0;
          return (
            <div key={t.key} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-center gap-2 max-sm:grid-cols-2">
              <input name="t.min" value={t.min} onChange={(e) => set(t.key, { min: e.target.value })} type="number" min="1" step="1" aria-label="From units" className={cell} />
              <input name="t.max" value={t.max} onChange={(e) => set(t.key, { max: e.target.value })} type="number" min="1" step="1" aria-label="To units" className={cell} />
              <input name="t.pct" value={t.pct} onChange={(e) => set(t.key, { pct: e.target.value })} type="number" min="0" max="90" step="0.1" aria-label="Discount percent" className={cell} />
              <span className="text-14">{money(Math.round(basePrice * (1 - pct / 100) * 100) / 100)}</span>
              <button type="button" onClick={() => setRows((r) => r.filter((x) => x.key !== t.key))} className={removeBtn}>
                Remove
              </button>
            </div>
          );
        })}
        <button type="button" onClick={() => setRows((r) => [...r, { key: newKey(), min: "", max: "", pct: "" }])} className={addBtn}>
          + Add tier
        </button>
        <p className="text-12 text-muted">Example: 1–4 units 0 %, 5–9 units 5 %, 10+ units 10 %. Option price changes are added after the discount.</p>
      </div>
    </ActionForm>
  );
}
