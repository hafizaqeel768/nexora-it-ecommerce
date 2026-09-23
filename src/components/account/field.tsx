// Labelled input for the account forms; same look as the checkout fields.
export const fieldClass =
  "w-full rounded-12 border border-line bg-surface px-3.5 py-3 text-14 text-ink outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_#d21f2b22] disabled:opacity-60";

export function Field({
  label,
  error,
  ...input
}: { label: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1.5 text-13 text-muted">
      <span>
        {label}
        {input.required ? " *" : ""}
      </span>
      <input className={fieldClass} aria-invalid={!!error} {...input} />
      {error && <span className="text-accent">{error}</span>}
    </label>
  );
}

export function FormMessage({ state }: { state: { error?: string; ok?: string } }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-12 border border-[#f3c1c6] bg-accent-soft px-4 py-3 text-14 text-[#b3141f]">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p role="status" className="rounded-12 border border-[#16a34a33] bg-[#16a34a14] px-4 py-3 text-14 text-success">
        {state.ok}
      </p>
    );
  }
  return null;
}
