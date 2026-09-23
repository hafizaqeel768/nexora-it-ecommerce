"use client";

import { useState } from "react";
import { fieldClass } from "@/components/account/field";
import { COUNTRIES } from "@/lib/countries";

// Searchable country checklist for shipping zones; submits one "countries" value per ticked country.
export function CountryPicker({ name = "countries", initial }: { name?: string; initial: string[] }) {
  const [selected, setSelected] = useState<string[]>(initial);
  const [q, setQ] = useState("");
  const shown = COUNTRIES.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.code === q.toUpperCase());
  const toggle = (code: string) => setSelected((s) => (s.includes(code) ? s.filter((x) => x !== code) : [...s, code]));
  return (
    <div className="grid gap-2">
      {selected.map((code) => (
        <input key={code} type="hidden" name={name} value={code} />
      ))}
      <div className="flex flex-wrap gap-1.5">
        {selected.length ? (
          selected.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              className="cursor-pointer rounded-pill bg-accent-soft px-2.5 py-1 text-12 font-bold text-accent"
              title="Remove"
            >
              {COUNTRIES.find((c) => c.code === code)?.name ?? code} ✕
            </button>
          ))
        ) : (
          <span className="text-12 text-muted">No countries ticked: this zone covers every country not in another zone (“rest of the world”).</span>
        )}
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search countries…" aria-label="Search countries" className={`${fieldClass} py-2`} />
      <div className="max-h-44 overflow-y-auto rounded-12 border border-line bg-white p-2">
        {shown.map((c) => (
          <label key={c.code} className="flex cursor-pointer items-center gap-2 rounded-8 px-2 py-1 text-13 hover:bg-[#f3f4f6]">
            <input type="checkbox" className="accent-accent" checked={selected.includes(c.code)} onChange={() => toggle(c.code)} />
            {c.name} <span className="text-muted">{c.code}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
