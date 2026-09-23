"use client";

import { useState, useTransition } from "react";
import { importProducts, type ImportState } from "@/app/actions/catalog";
import { FormMessage } from "@/components/account/field";
import { primaryButton } from "@/components/admin/ui";

const tag = { create: "bg-[#16a34a1a] text-success", update: "bg-[#2563eb1a] text-[#2563eb]", error: "bg-accent-soft text-accent" } as const;

// Two steps: Preview shows what would happen (nothing is written), Apply writes it.
export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<ImportState>({});
  const [pending, start] = useTransition();

  const run = (mode: "preview" | "apply") => {
    if (!file) return setState({ error: "Choose a CSV file." });
    const data = new FormData();
    data.append("file", file);
    data.append("mode", mode);
    start(async () => setState(await importProducts(state, data)));
  };
  const c = state.counts;
  const writable = c ? c.create + c.update : 0;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setState({});
          }}
          className="text-13 text-ink file:mr-3 file:cursor-pointer file:rounded-pill file:border-0 file:bg-ink file:px-4 file:py-2 file:text-white"
        />
        <button type="button" disabled={pending || !file} onClick={() => run("preview")} className={primaryButton}>
          {pending ? "Checking…" : "Preview"}
        </button>
      </div>

      {c && !state.applied && (
        <div className="rounded-12 border border-line bg-[#fafafa] p-4 text-14">
          <p>
            <b>{c.create}</b> new · <b>{c.update}</b> changed · <b>{c.unchanged}</b> unchanged · <b className={c.error ? "text-accent" : ""}>{c.error}</b> with errors
          </p>
          {state.unknown && state.unknown.length > 0 && <p className="mt-1 text-13 text-muted">Ignored columns: {state.unknown.join(", ")}</p>}
          {writable > 0 && (
            <button type="button" disabled={pending} onClick={() => run("apply")} className={`${primaryButton} mt-3`}>
              {pending ? "Importing…" : `Apply: create ${c.create}, update ${c.update}${c.error ? ` (skip ${c.error} with errors)` : ""}`}
            </button>
          )}
        </div>
      )}
      <FormMessage state={state} />

      {state.rows && state.rows.length > 0 && (
        <div className="overflow-auto rounded-12 border border-line bg-white">
          <table className="w-full border-collapse text-13">
            <thead>
              <tr className="text-left text-12 text-muted uppercase">
                <th className="px-3 py-2">Row</th>
                <th className="px-3 py-2">Result</th>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {state.rows.map((r) => (
                <tr key={r.line} className="border-t border-[#f0f1f3] align-top">
                  <td className="px-3 py-2 text-muted">{r.line}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-pill px-2 py-0.5 text-12 font-bold ${tag[r.action as keyof typeof tag] ?? ""}`}>
                      {r.action === "create" ? "New" : r.action === "update" ? "Change" : "Error"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {r.name || r.key}
                    <small className="block text-muted">{r.key}</small>
                  </td>
                  <td className={`px-3 py-2 ${r.errors.length ? "text-accent" : "text-muted"}`}>{r.errors.length ? r.errors.join(" ") : r.changes.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
