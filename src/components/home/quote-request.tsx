"use client";

import { useActionState } from "react";
import { requestQuote, type QuoteState } from "@/app/actions/quote";

const field =
  "w-full rounded-12 border border-line bg-surface px-3.5 py-3 text-14 text-ink outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:shadow-[0_0_0_3px_#d21f2b22]";
const label = "grid gap-1.5 text-13 text-muted";
const row = "grid grid-cols-2 gap-3.5 max-sm:grid-cols-1";

type Props = {
  categories: { slug: string; name: string }[];
  initialCategory?: string;
  initialMessage?: string;
};

// "Request a quote" (the prototype's #contact): saves a Quote and shows the confirmation in place.
export function QuoteRequest({ categories, initialCategory, initialMessage }: Props) {
  const [state, action, pending] = useActionState<QuoteState, FormData>(requestQuote, { status: "idle" });
  const err = state.status === "error" ? state.fields : {};
  const v: Record<string, string> = state.status === "error" ? state.values : {};

  return (
    <section id="contact" className="section-grey">
      <div className="wrap grid grid-cols-[1fr_1.3fr] items-start gap-12 max-lg:grid-cols-1">
        <div>
          <h2 className="section-title">Request a quote</h2>
          <p className="section-sub">Tell us what you need. Our team replies with a tailored quote within 24 hours.</p>
          <ul className="grid gap-3 text-muted">
            <li>📧 sales@example.com</li>
            <li>📞 +1 (555) 010-2030</li>
            <li>📍 100 Tech Avenue, Austin, TX</li>
            <li>⏱️ Mon–Fri, 9am–6pm CT</li>
          </ul>
        </div>

        {state.status === "ok" ? (
          <div className="mx-auto grid max-w-[560px] gap-3.5 text-center" role="status">
            <div className="mx-auto mb-5 grid size-[84px] animate-pop place-items-center rounded-full bg-accent text-[44px] text-white">
              ✓
            </div>
            <h3 className="mt-3.5 text-18 font-bold">Thanks, {state.firstName}!</h3>
            <p className="section-sub mx-auto">
              Your quote request <b>{state.number}</b> was received. We will reply within 24 hours.
            </p>
          </div>
        ) : (
          <form action={action} className="grid gap-3.5" noValidate>
            <div className={row}>
              <label className={label}>
                <span>Full name *</span>
                <input className={field} name="name" required autoComplete="name" defaultValue={v.name} aria-invalid={!!err.name} />
                {err.name && <span className="text-accent">{err.name}</span>}
              </label>
              <label className={label}>
                <span>Company</span>
                <input className={field} name="company" autoComplete="organization" defaultValue={v.company} />
              </label>
            </div>
            <div className={row}>
              <label className={label}>
                <span>Email *</span>
                <input className={field} type="email" name="email" required autoComplete="email" defaultValue={v.email} aria-invalid={!!err.email} />
                {err.email && <span className="text-accent">{err.email}</span>}
              </label>
              <label className={label}>
                <span>Phone</span>
                <input className={field} type="tel" name="phone" autoComplete="tel" defaultValue={v.phone} />
              </label>
            </div>
            <div className={row}>
              <label className={label}>
                <span>Category</span>
                <select className={field} name="category" defaultValue={v.category ?? initialCategory ?? categories[0]?.slug}>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.name}
                    </option>
                  ))}
                  <option value="">Other</option>
                </select>
              </label>
              <label className={label}>
                <span>Quantity</span>
                <input className={field} type="number" min={1} defaultValue={v.quantity || 1} name="quantity" aria-invalid={!!err.quantity} />
                {err.quantity && <span className="text-accent">{err.quantity}</span>}
              </label>
            </div>
            <label className={label}>
              <span>Requirements</span>
              <textarea className={field} name="message" rows={4} placeholder="Models, specs, delivery date..." defaultValue={v.message ?? initialMessage} />
            </label>
            {state.status === "error" && (
              <p className="text-14 text-accent" role="alert">
                {state.message}
              </p>
            )}
            <button type="submit" disabled={pending} className="btn cursor-pointer border-0 text-15 disabled:opacity-60">
              {pending ? "Sending…" : "Send quote request"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
