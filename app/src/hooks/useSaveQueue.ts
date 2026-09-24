"use client";

import { useEffect, useState } from "react";

export type SaveStatus = "idle" | "saving" | "pending";

type Task = () => Promise<void>;

const MAX_BACKOFF_MS = 30_000;

/**
 * A keyed write queue with retry, for a screen used where there is no signal.
 *
 * Each write is stored under a key, so tapping the same checklist item four
 * times collapses to one pending write rather than four queued ones — and the
 * last tap is the one that lands.
 *
 * Failures stay queued and retry with exponential backoff instead of surfacing
 * an error the tech can do nothing about while standing at a pool. The one
 * unacceptable outcome is a tap that looks saved and isn't, so `status` always
 * reflects reality.
 *
 * Written as a plain closure rather than a tree of useCallbacks because it is
 * entirely ref-based: there is nothing for React to memoize, and expressing it
 * as hooks only invites stale-closure bugs around the self-scheduling retry.
 */
function createSaveQueue(onStatus: (status: SaveStatus) => void) {
  const queue = new Map<string, Task>();
  let running = false;
  let attempt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  async function flush(): Promise<void> {
    if (running) return;
    running = true;

    try {
      // Keep draining until a pass empties the queue or fails, so a write
      // enqueued mid-flight isn't left sitting until the next backoff.
      for (;;) {
        if (queue.size === 0) {
          attempt = 0;
          onStatus("idle");
          return;
        }

        onStatus("saving");
        let failed = false;

        for (const [key, task] of [...queue.entries()]) {
          try {
            await task();
            // Only clear it if a newer edit hasn't replaced this task while it
            // was in flight; otherwise that edit would be silently dropped.
            if (queue.get(key) === task) queue.delete(key);
          } catch {
            failed = true;
          }
        }

        if (failed) {
          attempt += 1;
          onStatus("pending");
          const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** (attempt - 1));
          timer = setTimeout(() => void flush(), delay);
          return;
        }
      }
    } finally {
      running = false;
    }
  }

  return {
    enqueue(key: string, task: Task) {
      queue.set(key, task);
      onStatus("saving");
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      attempt = 0;
      void flush();
    },
    retryNow() {
      if (queue.size > 0) {
        attempt = 0;
        void flush();
      }
    },
    hasPending() {
      return queue.size > 0;
    },
    dispose() {
      if (timer) clearTimeout(timer);
    },
  };
}

export function useSaveQueue() {
  const [status, setStatus] = useState<SaveStatus>("idle");

  // A lazy useState initializer, not a ref: the queue must be created exactly
  // once and never replaced, and unlike a ref this can be read during render.
  // setStatus is stable, so the initializer never needs to re-run.
  const [queue] = useState(() => createSaveQueue(setStatus));

  useEffect(() => {
    // Coming back into coverage should retry immediately rather than waiting
    // out a backoff that may have grown to 30 seconds.
    const retry = () => queue.retryNow();
    window.addEventListener("online", retry);

    // Last line of defence: don't let the tab close on unsaved checklist taps.
    const warn = (e: BeforeUnloadEvent) => {
      if (queue.hasPending()) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);

    return () => {
      window.removeEventListener("online", retry);
      window.removeEventListener("beforeunload", warn);
      queue.dispose();
    };
  }, [queue]);

  return { enqueue: queue.enqueue, status, hasPending: queue.hasPending };
}
