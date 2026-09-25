"use client";

import { useActionState, useState } from "react";
import type { AdminFormState } from "@/app/actions/admin";
import { validateImport } from "@/app/actions/data-transfer";
import { FormMessage } from "@/components/account/field";
import { primaryButton, select, textButton } from "@/components/admin/ui";

export type ImportGuide = {
  entity: string;
  label: string;
  behaviors: { value: string; label: string; hint: string }[];
  notes: string[];
  columns: { header: string; required: string; description: string; example: string; values?: string[] }[];
};

const requiredLabel: Record<string, string> = { key: "Key", create: "Required for new", "": "Optional" };

// Data Transfer → Import, step 1 (Phase 15): entity, behavior, what to do with bad rows, file → Validate & Preview.
export function DataImportForm({ guides, initial, maxMb, maxRows }: { guides: ImportGuide[]; initial: string; maxMb: number; maxRows: number }) {
  const [entity, setEntity] = useState(guides.some((g) => g.entity === initial) ? initial : guides[0].entity);
  const [state, action, pending] = useActionState<AdminFormState, FormData>(validateImport, {});
  const guide = guides.find((g) => g.entity === entity)!;

  return (
    <div className="grid gap-5">
      <form action={action} className="grid gap-4" noValidate>
        <div className="grid grid-cols-2 gap-4 max-[700px]:grid-cols-1">
          <label className="grid gap-1.5 text-13 text-muted">
            <span>Entity *</span>
            <select name="entity" value={entity} onChange={(e) => setEntity(e.target.value)} className={`${select} w-full py-3`}>
              {guides.map((g) => (
                <option key={g.entity} value={g.entity}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-13 text-muted">
            <span>File (.csv, UTF-8, up to {maxMb} MB / {maxRows.toLocaleString("en-US")} rows) *</span>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              aria-invalid={!!state.fields?.file}
              className="text-13 text-ink file:mr-3 file:cursor-pointer file:rounded-pill file:border-0 file:bg-ink file:px-4 file:py-2 file:text-white"
            />
          </label>
        </div>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-13 text-muted">Import behavior *</legend>
          {guide.behaviors.map((b, i) => (
            <label key={`${entity}-${b.value}`} className="flex cursor-pointer items-start gap-2.5 text-14">
              <input type="radio" name="behavior" value={b.value} defaultChecked={i === guide.behaviors.length - 1} className="mt-1 accent-accent" />
              <span>
                <b>{b.label}</b> <small className="block text-12 text-muted">{b.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="grid gap-2">
          <legend className="mb-1 text-13 text-muted">When some rows have errors</legend>
          <label className="flex cursor-pointer items-start gap-2.5 text-14">
            <input type="radio" name="onError" value="skip" defaultChecked className="mt-1 accent-accent" />
            <span>
              <b>Skip those rows</b> <small className="block text-12 text-muted">Import the valid rows; download the error report to fix the rest.</small>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2.5 text-14">
            <input type="radio" name="onError" value="stop" className="mt-1 accent-accent" />
            <span>
              <b>Stop: import nothing</b> <small className="block text-12 text-muted">All rows must be valid, otherwise nothing changes.</small>
            </span>
          </label>
        </fieldset>

        <FormMessage state={state} />
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={pending} className={primaryButton}>
            {pending ? "Checking every row…" : "Validate & preview"}
          </button>
          <span className="text-12 text-muted">Nothing is imported until you confirm the preview.</span>
        </div>
      </form>

      <div className="rounded-12 border border-line bg-[#fafafa] p-4">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h3 className="text-15 font-bold">{guide.label}: file format</h3>
          <a href={`/admin/data-transfer/sample/${guide.entity}`} download className={`${textButton} ml-auto`}>
            ⭳ Download sample CSV
          </a>
        </div>
        <ul className="mb-3 grid list-disc gap-1 pl-5 text-13 text-muted">
          {guide.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
        <div className="overflow-auto">
          <table className="w-full border-collapse text-13">
            <thead>
              <tr className="text-left text-12 text-muted uppercase">
                <th className="px-2 py-1.5">Column</th>
                <th className="px-2 py-1.5">Required</th>
                <th className="px-2 py-1.5">Format</th>
                <th className="px-2 py-1.5">Example</th>
              </tr>
            </thead>
            <tbody>
              {guide.columns.map((c) => (
                <tr key={c.header} className="border-t border-line align-top">
                  <td className="px-2 py-1.5 font-semibold whitespace-nowrap">{c.header}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{requiredLabel[c.required] ?? "Optional"}</td>
                  <td className="px-2 py-1.5 text-muted">
                    {c.description}
                    {c.values && <span className="block">Values: {c.values.join(", ")}</span>}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-12 break-all">{c.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
