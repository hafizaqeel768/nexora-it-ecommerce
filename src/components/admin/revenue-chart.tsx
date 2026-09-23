"use client";

import { useState } from "react";
import { money } from "@/lib/format";

type Day = { key: string; day: string; label: string; value: number };

// Revenue per day (the prototype's .ad-bars). One series, so no legend: the card title names it.
// Each column is the hover/focus target and shows date + revenue; a table view sits underneath.
export function RevenueChart({ days }: { days: Day[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.value));

  return (
    <>
      <div className="relative flex h-[210px] items-stretch gap-2 pt-7" onPointerLeave={() => setActive(null)}>
        {days.map((d, i) => (
          <div
            key={d.key}
            tabIndex={0}
            aria-label={`${d.label}: ${money(d.value)}`}
            onPointerEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            className="relative flex flex-1 cursor-default flex-col items-center justify-end gap-1.5 rounded-6 outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {active === i && (
              <div className={`pointer-events-none absolute bottom-full z-10 mb-1 ${i < 2 ? "left-0" : i >= days.length - 2 ? "right-0" : "left-1/2 -translate-x-1/2"} rounded-8 border border-line bg-white px-2.5 py-1.5 text-center text-12 whitespace-nowrap text-ink shadow-[0_8px_24px_#0000001f]`}>
                <span className="block text-muted">{d.label}</span>
                <b>{money(d.value)}</b>
              </div>
            )}
            <span className="flex w-full flex-1 items-end justify-center">
              <i
                className={`block w-full max-w-6 rounded-t-[4px] transition-opacity ${d.value ? "bg-accent" : "bg-line"} ${
                  active === i ? "opacity-80" : ""
                }`}
                style={{ height: d.value ? `${Math.max(2, Math.round((d.value / max) * 100))}%` : "2px" }}
              />
            </span>
            <span className="text-[10.5px] text-muted">{d.day}</span>
          </div>
        ))}
      </div>
      <details className="mt-3 text-13 text-muted">
        <summary className="cursor-pointer">Show as table</summary>
        <table className="mt-2 w-full text-13">
          <tbody>
            {days.map((d) => (
              <tr key={d.key} className="border-b border-[#f0f1f3] last:border-0">
                <td className="py-1.5">{d.label}</td>
                <td className="py-1.5 text-right text-ink">{money(d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
