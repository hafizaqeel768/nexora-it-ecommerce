import { STATUS_COLOR, statusLabel } from "@/lib/format";

// Coloured status pill (the prototype's a_bg / .ad-bg).
export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status] ?? "#6b7280";
  return (
    <span className="inline-block rounded-pill px-2.5 py-1 text-12 font-bold whitespace-nowrap" style={{ color, background: `${color}1f` }}>
      {statusLabel(status)}
    </span>
  );
}
