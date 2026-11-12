"use client";

import { useEffect, useRef } from "react";

import { recordTodayViewed } from "./routes/actions";

/**
 * Logs one `today_viewed` event per visit to the route screen.
 *
 * Renders nothing. It exists because counting a page view is a side effect, and
 * the only place in React where a side effect belongs is an effect — doing it
 * in the Server Component body would double-count every re-render.
 *
 * The ref guards the double invocation React makes in development StrictMode,
 * so local use does not inflate the numbers it is meant to measure.
 */
export function TrackTodayView() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    // Deliberately not awaited and never surfaced: a missed count must not
    // cost the tech anything, and there is nothing useful to tell them.
    void recordTodayViewed();
  }, []);

  return null;
}
