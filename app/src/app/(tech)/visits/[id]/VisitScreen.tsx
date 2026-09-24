"use client";

import { useCallback, useRef, useState } from "react";

import { Card } from "@/components/ui";
import { useSaveQueue } from "@/hooks/useSaveQueue";
import { type ReadingKey } from "@/lib/readings";
import { createClient } from "@/lib/supabase/client";

import { PhotoStrip, type PhotoItem } from "./PhotoStrip";
import { ReadingsPanel } from "./ReadingsPanel";

export type VisitItemRow = { id: string; label: string; completed: boolean };

/**
 * Everything a tech touches at the pool. Writes go straight from the browser to
 * Supabase (row-level security still applies) rather than through Server
 * Actions, because only a client-side queue can retry when signal drops.
 */
export function VisitScreen({
  visitId,
  companyId,
  initialItems,
  initialNotes,
  initialReadings,
  initialPhotos,
}: {
  visitId: string;
  companyId: string;
  initialItems: VisitItemRow[];
  initialNotes: string;
  initialReadings: Record<ReadingKey, number | null>;
  initialPhotos: PhotoItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [notes, setNotes] = useState(initialNotes);
  const [readings, setReadings] = useState(initialReadings);
  const { enqueue, status } = useSaveQueue();
  const supabaseRef = useRef(createClient());

  const markStarted = useCallback(() => {
    // First real interaction promotes on_the_way -> in_progress. Fire-and-forget:
    // it is cosmetic, and the checklist write it accompanies is the one that matters.
    const supabase = supabaseRef.current;
    void supabase
      .from("visits")
      .update({ status: "in_progress" })
      .eq("id", visitId)
      .eq("status", "on_the_way");
  }, [visitId]);

  const toggle = (item: VisitItemRow) => {
    const completed = !item.completed;
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, completed } : i)),
    );
    markStarted();
    enqueue(`item:${item.id}`, async () => {
      const { error } = await supabaseRef.current
        .from("visit_items")
        .update({ completed })
        .eq("id", item.id);
      if (error) throw error;
    });
  };

  const changeReading = (key: ReadingKey, value: number | null) => {
    const next = { ...readings, [key]: value };
    setReadings(next);
    markStarted();
    // All three go in one write under a single key. A computed key like
    // { [key]: value } cannot type-check against the Update type, and sending
    // the whole set means a retry after a failure restores every reading
    // rather than whichever one happened to be queued.
    enqueue("readings", async () => {
      const { error } = await supabaseRef.current
        .from("visits")
        .update({
          chlorine_ppm: next.chlorine_ppm,
          ph: next.ph,
          alkalinity_ppm: next.alkalinity_ppm,
        })
        .eq("id", visitId);
      if (error) throw error;
    });
  };

  const changeNotes = (value: string) => {
    setNotes(value);
    enqueue("notes", async () => {
      const { error } = await supabaseRef.current
        .from("visits")
        .update({ tech_notes: value.trim() || null })
        .eq("id", visitId);
      if (error) throw error;
    });
  };

  const done = items.filter((i) => i.completed).length;

  return (
    <div className="flex flex-col gap-5">
      <SaveIndicator status={status} />

      <Card>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg">Services</h2>
          <p className="text-sm font-bold text-ink-soft">
            {done} of {items.length}
          </p>
        </div>

        {items.length === 0 ? (
          <p className="mt-3 text-sm text-ink-faint">
            This pool has no checklist. You can still add readings, photos and
            notes.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item.id}>
                <label
                  className={`flex min-h-tap cursor-pointer items-center gap-3 rounded-sm px-3 py-2 ring-1 transition-colors ${
                    item.completed
                      ? "bg-ok-tint ring-ok/30"
                      : "bg-card ring-line"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={item.completed}
                    onChange={() => toggle(item)}
                    className="size-6 shrink-0 accent-[var(--color-ok)]"
                  />
                  <span
                    className={`font-medium ${item.completed ? "text-ok-deep" : "text-ink"}`}
                  >
                    {item.label}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h2 className="text-lg">Readings</h2>
        <p className="mt-1 mb-3 text-sm text-ink-soft">
          Shown to the owner on their report. Leave blank if you didn&apos;t test.
        </p>
        <ReadingsPanel values={readings} onChange={changeReading} />
      </Card>

      <Card>
        <h2 className="text-lg">Photos</h2>
        <p className="mt-1 mb-3 text-sm text-ink-soft">
          Resized on your phone before upload, so this works on a weak signal.
        </p>
        <PhotoStrip companyId={companyId} visitId={visitId} initial={initialPhotos} />
      </Card>

      <Card>
        <label htmlFor="tech_notes" className="text-lg font-extrabold">
          Notes for the owner
        </label>
        <textarea
          id="tech_notes"
          value={notes}
          onChange={(e) => changeNotes(e.target.value)}
          placeholder="Anything they should know — equipment, water level, what you'd watch next time."
          className="mt-3 min-h-24 w-full rounded-sm bg-card px-3 py-2.5 text-ink ring-1 ring-line placeholder:text-ink-faint focus:ring-2 focus:ring-brand focus:outline-none"
        />
      </Card>
    </div>
  );
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "pending" }) {
  if (status === "idle") {
    return (
      <p role="status" className="text-sm text-ok-deep">
        All changes saved
      </p>
    );
  }
  if (status === "saving") {
    return (
      <p role="status" className="text-sm text-ink-soft">
        Saving…
      </p>
    );
  }
  return (
    <p
      role="status"
      className="rounded-sm bg-warn-tint px-3 py-2 text-sm font-medium text-warn"
    >
      No connection — your changes are saved on this phone and will upload
      automatically. Keep this page open.
    </p>
  );
}
