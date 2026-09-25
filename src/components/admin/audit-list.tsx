import { AUDIT_ACTIONS } from "@/lib/audit";

// Security activity entries (Phase 14), newest first. Details are turned into short readable lines.

type Entry = { id: string; actorEmail: string; action: string; targetLabel: string | null; details: unknown; createdAt: Date };

const when = (d: Date) => d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

const show = (v: unknown) => (v == null || v === "" ? "—" : Array.isArray(v) ? v.join(", ") || "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

/** { name: { from, to } } → "name: A → B"; { added: [...] } → "added: a, b"; other values as "key: value". */
export function detailLines(details: unknown): string[] {
  if (!details || typeof details !== "object" || Array.isArray(details)) return [];
  return Object.entries(details as Record<string, unknown>).flatMap(([key, value]) => {
    if (Array.isArray(value) && value.length === 0) return [];
    if (value && typeof value === "object" && !Array.isArray(value) && "from" in value && "to" in value) {
      const v = value as { from: unknown; to: unknown };
      return [`${key}: ${show(v.from)} → ${show(v.to)}`];
    }
    return [`${key}: ${show(value)}`];
  });
}

export function AuditList({ entries, showTarget = false }: { entries: Entry[]; showTarget?: boolean }) {
  if (!entries.length) return <p className="text-13 text-muted">Nothing recorded yet.</p>;
  return (
    <ol className="grid gap-2.5">
      {entries.map((e) => (
        <li key={e.id} className="rounded-10 bg-[#f4f6f9] px-3 py-2 text-13">
          <span className="text-12 text-muted">
            {when(e.createdAt)} · {e.actorEmail}
          </span>
          <p>
            <b>{AUDIT_ACTIONS[e.action as keyof typeof AUDIT_ACTIONS] ?? e.action}</b>
            {showTarget && e.targetLabel && <> · {e.targetLabel}</>}
          </p>
          {detailLines(e.details).map((l) => (
            <p key={l} className="text-12 break-words text-muted">
              {l}
            </p>
          ))}
        </li>
      ))}
    </ol>
  );
}
