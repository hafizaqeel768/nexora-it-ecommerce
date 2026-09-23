import Link from "next/link";

// Admin building blocks (the prototype's .ad-card, .ad-tb, .ad-ch, .ad-ed, .ad-k).

export const card = "overflow-auto rounded-16 border border-line bg-white p-[18px]";
export const cardTitle = "mb-3.5 text-16 font-bold";
export const table = "w-full border-collapse text-ui";
export const th =
  "border-b border-line px-3 py-2.5 text-left text-12 font-semibold tracking-[.06em] whitespace-nowrap text-muted uppercase";
export const td = "border-b border-[#f0f1f3] px-3 py-3 align-middle";
export const row = "transition-colors hover:bg-[#fafafa] [&:last-child>td]:border-b-0";
export const textButton = "cursor-pointer text-13 font-bold text-accent hover:underline disabled:cursor-default disabled:opacity-50";
export const primaryButton = "btn cursor-pointer border-0 text-14 disabled:opacity-60";
export const select =
  "rounded-12 border border-line bg-surface px-3.5 py-2.5 text-14 text-ink outline-none focus:border-accent focus:shadow-[0_0_0_3px_#d21f2b22]";

export function Kpi({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="rounded-16 border border-line bg-white p-[18px]">
      <span className="text-13 text-muted">{label}</span>
      <b className="mt-1.5 mb-0.5 block text-26 tracking-[-.5px]">{value}</b>
      <em className="text-12 text-success not-italic">{note}</em>
    </div>
  );
}

/** Filter pills that are links, so filters live in the URL (the prototype's .ad-ch). */
export function FilterChips({ items }: { items: { label: string; href: string; active: boolean }[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          aria-current={i.active ? "page" : undefined}
          className={`rounded-pill border px-[15px] py-[7px] text-13 transition-colors ${
            i.active ? "border-accent bg-accent text-white" : "border-line bg-white text-ink hover:border-accent"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}

export function EmptyRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={cols} className={`${td} text-muted`}>
        {children}
      </td>
    </tr>
  );
}

/** "⭳ Export CSV" link to an admin export route. */
export function ExportLink({ href }: { href: string }) {
  return (
    <a href={href} className={textButton} download>
      ⭳ Export CSV
    </a>
  );
}

/** Checkbox with a label and optional hint (settings forms). */
export function CheckField({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked?: boolean }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-14">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 size-4 accent-accent" />
      <span>
        {label}
        {hint && <small className="block text-12 text-muted">{hint}</small>}
      </span>
    </label>
  );
}

export function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-16 font-bold">{children}</h3>
      {hint && <p className="mt-0.5 text-13 text-muted">{hint}</p>}
    </div>
  );
}
