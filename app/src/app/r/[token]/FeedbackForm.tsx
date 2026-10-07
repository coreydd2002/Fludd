"use client";

import { useActionState, useState } from "react";

import { submitFeedback, type FeedbackState } from "./actions";

export function FeedbackForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState<FeedbackState, FormData>(submitFeedback, {});
  const [rating, setRating] = useState<number | null>(null);

  if (state.done) {
    return (
      <div role="status" className="rounded-card bg-ok-tint ring-ok/30 p-5 text-center ring-1">
        <p className="text-ok-deep text-lg font-extrabold">Thank you</p>
        <p className="text-ok-deep/80 mt-1 text-sm">
          Your pool service has this now. Anything you flagged for next visit will be waiting for
          them when they arrive.
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
              className={`size-tap grid flex-1 place-items-center rounded-sm text-2xl ring-1 transition-colors ${
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
        <p className="text-ink-faint -mt-1 text-xs">
          Goes to your pool service privately — this is not published anywhere.
        </p>
        <textarea
          id="review"
          name="review"
          maxLength={2000}
          className="bg-card text-ink ring-line placeholder:text-ink-faint focus:ring-brand min-h-24 w-full rounded-sm px-3 py-2.5 ring-1 focus:ring-2 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="next_visit_notes" className="text-sm font-bold">
          Anything for next visit?
        </label>
        <p className="text-ink-faint -mt-1 text-xs">
          Shown to your tech when they arrive next time.
        </p>
        <textarea
          id="next_visit_notes"
          name="next_visit_notes"
          maxLength={2000}
          placeholder="e.g. the gate latch sticks, please check the skimmer lid"
          className="bg-card text-ink ring-line placeholder:text-ink-faint focus:ring-brand min-h-24 w-full rounded-sm px-3 py-2.5 ring-1 focus:ring-2 focus:outline-none"
        />
      </div>

      <label className="min-h-tap bg-warn-tint flex items-start gap-3 rounded-sm px-3 py-3">
        <input
          type="checkbox"
          name="is_urgent"
          className="mt-0.5 size-5 shrink-0 accent-[var(--color-warn)]"
        />
        <span className="text-sm">
          <span className="font-bold">This is urgent</span>
          <span className="text-ink-soft block">
            Green water, a leak, broken equipment. Sends an alert straight away rather than waiting
            for the next visit.
          </span>
        </span>
      </label>

      {state.error ? (
        <p role="alert" className="bg-err/10 text-err rounded-sm px-3 py-2 text-sm font-medium">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-tap rounded-pill bg-brand hover:bg-brand-dark w-full px-5 py-3.5 text-lg font-bold text-white active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send to my pool service"}
      </button>
    </form>
  );
}
