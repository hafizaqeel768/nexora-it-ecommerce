// Staff account badges (Phase 14): status and role / super admin.

export const pill = "inline-block rounded-pill px-2.5 py-0.5 text-12 font-bold whitespace-nowrap";

export function StaffStatus({ disabled }: { disabled: boolean }) {
  return disabled ? <span className={`${pill} bg-[#6b72801f] text-[#6b7280]`}>Disabled</span> : <span className={`${pill} bg-[#16a34a1a] text-success`}>Active</span>;
}

export function StaffRole({ isSuperAdmin, role }: { isSuperAdmin: boolean; role: string | null }) {
  if (isSuperAdmin) return <span className={`${pill} bg-accent text-white`}>Super Admin</span>;
  return role ? <span>{role}</span> : <span className="text-muted">No role</span>;
}

export const lastLogin = (d: Date | null) => (d ? d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never");
