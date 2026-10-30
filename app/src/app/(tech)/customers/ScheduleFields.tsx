"use client";

import { useState } from "react";

import { Field } from "@/components/ui";
import { WEEKDAYS } from "@/lib/routing/schedule";
import type { ServiceCadence } from "@/lib/supabase/database.types";

export type ScheduleValues = {
  assigned_tech_id?: string | null;
  service_weekday?: number | null;
  service_cadence?: ServiceCadence;
  service_week_parity?: number | null;
};

export type TechOption = { id: string; display_name: string };

const select =
  "min-h-tap bg-card text-ink ring-line focus:ring-brand w-full rounded-sm px-3 py-2.5 ring-1 focus:ring-2 focus:outline-none";

/**
 * Which tech services this pool, on which day, how often.
 *
 * The parity choice only appears for an every-other-week pool, because for a
 * weekly one it has no meaning — and the database rejects a biweekly pool that
 * has no parity, so it cannot simply be left blank either.
 */
export function ScheduleFields({
  values = {},
  techs,
}: {
  values?: ScheduleValues;
  techs: TechOption[];
}) {
  const [cadence, setCadence] = useState<ServiceCadence>(values.service_cadence ?? "weekly");
  const [weekday, setWeekday] = useState<string>(
    values.service_weekday === null || values.service_weekday === undefined
      ? ""
      : String(values.service_weekday),
  );

  return (
    <div className="mt-4 flex flex-col gap-4">
      <Field
        label="Serviced by"
        hint="Only this tech sees the pool on their day."
        htmlFor="assigned_tech_id"
      >
        <select
          id="assigned_tech_id"
          name="assigned_tech_id"
          defaultValue={values.assigned_tech_id ?? ""}
          className={select}
        >
          <option value="">Nobody yet</option>
          {techs.map((tech) => (
            <option key={tech.id} value={tech.id}>
              {tech.display_name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="Service day"
        hint="Leave unscheduled and the pool stays in your list but never appears on a route."
        htmlFor="service_weekday"
      >
        <select
          id="service_weekday"
          name="service_weekday"
          value={weekday}
          onChange={(e) => setWeekday(e.target.value)}
          className={select}
        >
          <option value="">Not scheduled</option>
          {WEEKDAYS.map((day) => (
            <option key={day.value} value={day.value}>
              {day.name}
            </option>
          ))}
        </select>
      </Field>

      {weekday !== "" ? (
        <>
          <Field label="How often" htmlFor="service_cadence">
            <select
              id="service_cadence"
              name="service_cadence"
              value={cadence}
              onChange={(e) => setCadence(e.target.value as ServiceCadence)}
              className={select}
            >
              <option value="weekly">Every week</option>
              <option value="biweekly">Every other week</option>
            </select>
          </Field>

          {cadence === "biweekly" ? (
            <Field
              label="Which week"
              hint="Pick the week this pool is due. The other week it is skipped."
              htmlFor="service_week_parity"
            >
              <select
                id="service_week_parity"
                name="service_week_parity"
                defaultValue={String(values.service_week_parity ?? 0)}
                className={select}
              >
                <option value="0">Week A</option>
                <option value="1">Week B</option>
              </select>
            </Field>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
