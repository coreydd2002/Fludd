"use client";

import { READINGS, statusOf, type ReadingKey } from "@/lib/readings";

const TONE = {
  ok: "ring-ok/40 bg-ok-tint",
  low: "ring-warn/40 bg-warn-tint",
  high: "ring-warn/40 bg-warn-tint",
  empty: "ring-line bg-card",
} as const;

const LABEL = {
  ok: "In range",
  low: "Low",
  high: "High",
  empty: "Not recorded",
} as const;

export function ReadingsPanel({
  values,
  onChange,
}: {
  values: Record<ReadingKey, number | null>;
  onChange: (key: ReadingKey, value: number | null) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {READINGS.map((spec) => {
        const value = values[spec.key];
        const status = statusOf(spec, value);
        return (
          <div
            key={spec.key}
            className={`rounded-card p-3 ring-1 ${TONE[status]}`}
          >
            <label
              htmlFor={spec.key}
              className="block text-[11px] font-bold uppercase tracking-wider text-ink-soft"
            >
              {spec.short}
            </label>
            <input
              id={spec.key}
              type="number"
              inputMode="decimal"
              step={spec.step}
              min={0}
              max={spec.hardMax}
              value={value ?? ""}
              placeholder="—"
              onChange={(e) => {
                const raw = e.target.value;
                onChange(spec.key, raw === "" ? null : Number(raw));
              }}
              className="mt-1 w-full bg-transparent text-2xl font-extrabold tracking-tight text-ink placeholder:text-ink-faint focus:outline-none"
            />
            <p className="text-[11px] text-ink-faint">
              {status === "empty"
                ? `${spec.min}–${spec.max}${spec.unit ? ` ${spec.unit}` : ""}`
                : LABEL[status]}
            </p>
            <span className="sr-only">
              {spec.label}: {LABEL[status]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
