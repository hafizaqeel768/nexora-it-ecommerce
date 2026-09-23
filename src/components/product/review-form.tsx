"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/account";
import { submitReview } from "@/app/actions/reviews";
import { FormMessage, fieldClass } from "@/components/account/field";

export type OwnReview = { rating: number; title: string; body: string; approved: boolean };

// "Write a review" (the prototype's #revf) for signed-in customers; editing replaces their earlier review.
export function ReviewForm({ productId, own }: { productId: string; own: OwnReview | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(submitReview.bind(null, productId), {});
  const [rating, setRating] = useState(own?.rating ?? 5);
  const f = state.fields ?? {};
  return (
    <form action={action} className="grid gap-3 rounded-14 border border-line bg-white p-5" noValidate>
      <h3 className="text-16 font-bold">{own ? "Edit your review" : "Write a review"}</h3>
      {own && !own.approved && !state.ok && <p className="text-13 text-warning">Your review is waiting for approval.</p>}
      <input type="hidden" name="rating" value={rating} />
      <div role="radiogroup" aria-label="Rating" className="flex gap-1 text-[26px] leading-none">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setRating(n)}
            className={`cursor-pointer transition hover:scale-110 ${n <= rating ? "text-star" : "text-[#d1d5db]"}`}
          >
            ★
          </button>
        ))}
      </div>
      {f.rating && <span className="text-13 text-accent">{f.rating}</span>}
      <input name="title" placeholder="Headline (optional)" maxLength={100} defaultValue={state.values?.title ?? own?.title} aria-label="Headline" className={fieldClass} />
      <textarea
        name="body"
        rows={4}
        placeholder="What did you like or dislike? How do you use it?"
        maxLength={2000}
        defaultValue={state.values?.body ?? own?.body}
        aria-label="Your review"
        aria-invalid={!!f.body}
        className={fieldClass}
      />
      {f.body && <span className="text-13 text-accent">{f.body}</span>}
      <FormMessage state={state} />
      <button type="submit" disabled={pending} className="btn cursor-pointer justify-self-start border-0 text-14 disabled:opacity-60">
        {pending ? "Sending…" : own ? "Update review" : "Submit review"}
      </button>
    </form>
  );
}
