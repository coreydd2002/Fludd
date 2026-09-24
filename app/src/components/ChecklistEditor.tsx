"use client";

import { useId, useState } from "react";

import { Button, Input } from "./ui";

type Item = { key: string; label: string };

let counter = 0;
const nextKey = () => `item-${counter++}`;

/**
 * Edits an ordered list of checklist labels and serializes it into one hidden
 * input as JSON, so the surrounding <form> can stay a plain Server Action form.
 *
 * Reordering is by up/down buttons rather than drag-and-drop: this is used on a
 * phone, where dragging inside a scrolling page is unreliable and inaccessible.
 */
export function ChecklistEditor({
  name = "checklist",
  initial,
}: {
  name?: string;
  initial: string[];
}) {
  const id = useId();
  const [items, setItems] = useState<Item[]>(() =>
    initial.map((label) => ({ key: nextKey(), label })),
  );

  const update = (key: string, label: string) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, label } : i)));

  const remove = (key: string) =>
    setItems((prev) => prev.filter((i) => i.key !== key));

  const move = (index: number, delta: number) =>
    setItems((prev) => {
      const to = index + delta;
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  const add = () => setItems((prev) => [...prev, { key: nextKey(), label: "" }]);

  // Blank rows are dropped rather than rejected — an empty box the tech never
  // filled in is not an error worth blocking a save for.
  const payload = JSON.stringify(
    items.map((i) => i.label.trim()).filter(Boolean),
  );

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name={name} value={payload} />

      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <li key={item.key} className="flex items-center gap-1.5">
            <Input
              id={`${id}-${item.key}`}
              value={item.label}
              onChange={(e) => update(item.key, e.target.value)}
              placeholder="e.g. Brush walls"
              aria-label={`Checklist item ${index + 1}`}
              className="flex-1"
            />
            <div className="flex shrink-0 flex-col">
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                aria-label={`Move ${item.label || `item ${index + 1}`} up`}
                className="px-2 text-ink-faint hover:text-brand disabled:opacity-30"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === items.length - 1}
                aria-label={`Move ${item.label || `item ${index + 1}`} down`}
                className="px-2 text-ink-faint hover:text-brand disabled:opacity-30"
              >
                ↓
              </button>
            </div>
            <button
              type="button"
              onClick={() => remove(item.key)}
              aria-label={`Remove ${item.label || `item ${index + 1}`}`}
              className="shrink-0 px-2 text-lg text-ink-faint hover:text-err"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {items.length === 0 ? (
        <p className="text-sm text-ink-faint">
          No items yet — a visit with an empty checklist is allowed, but the
          owner&apos;s report will not list any services.
        </p>
      ) : null}

      <Button type="button" variant="secondary" onClick={add} className="self-start">
        Add item
      </Button>
    </div>
  );
}
