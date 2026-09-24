"use client";

import { useActionState, useState } from "react";

import { submitFeedback, type FeedbackState } from "./actions";

export function FeedbackForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(
    submitFeedback,
    {},
  );
  const [rating, setRating] = useState<number | null>(null);

  if (state.done) {
    return (
      <div
        role="status"
        className="rounded-card bg-ok-tint p-5 text-center ring-1 ring-ok/30"
      >
        <p className="text-lg font-extrabold text-ok-deep">Thank you</p>
        <p className="mt-1 text-sm text-ok-deep/80">
          Your pool service has this now. Anything you flagged for next visit
          will be waiting for them when they arrive.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="rating" value={rating ?? ""} />

      <fieldset>
        <legend className="text-sm font-bold">How did this service go?</legend>
        <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Rating out of 5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}`}
              onClick={() => setRating(rating === n ? null : n)}
              className={`grid size-tap flex-1 place-items-center rounded-sm text-2xl ring-1 transition-colors ${
                rating !== null && n <= rating
                  ? "bg-brand-tint text-brand ring-brand/30"
                  : "bg-card text-ink-faint ring-line"
              }`}
            >
              {rating !== null && n <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="review" className="text-sm font-bold">
          Anything you&apos;d like to say?
        </label>
        <p className="-mt-1 text-xs text-ink-faint">
          Goes to your pool service privately — this is not published anywhere.
        </p>
        <textarea
          id="review"
          name="review"
          maxLength={2000}
          className="min-h-24 w-full rounded-sm bg-card px-3 py-2.5 text-ink ring-1 ring-line placeholder:text-ink-faint focus:ring-2 focus:ring-brand focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="next_visit_notes" className="text-sm font-bold">
          Anything for next visit?
        </label>
        <p className="-mt-1 text-xs text-ink-faint">
          Shown to your tech when they arrive next time.
        </p>
        <textarea
          id="next_visit_notes"
          name="next_visit_notes"
          maxLength={2000}
          placeholder="e.g. the gate latch sticks, please check the skimmer lid"
          className="min-h-24 w-full rounded-sm bg-card px-3 py-2.5 text-ink ring-1 ring-line placeholder:text-ink-faint focus:ring-2 focus:ring-brand focus:outline-none"
        />
      </div>

      <label className="flex min-h-tap items-start gap-3 rounded-sm bg-warn-tint px-3 py-3">
        <input
          type="checkbox"
          name="is_urgent"
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-warn)]"
        />
        <span className="text-sm">
          <span className="font-bold">This is urgent</span>
          <span className="block text-ink-soft">
            Green water, a leak, broken equipment. Sends an alert straight away
            rather than waiting for the next visit.
          </span>
        </span>
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-sm bg-err/10 px-3 py-2 text-sm font-medium text-err"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-tap w-full rounded-pill bg-brand px-5 py-3.5 text-lg font-bold text-white hover:bg-brand-dark active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send to my pool service"}
      </button>
    </form>
  );
}
