/**
 * Parses the hidden JSON field that ChecklistEditor submits.
 *
 * Lives here rather than beside the actions that use it because a "use server"
 * module may only export async functions.
 */
export function parseChecklist(raw: FormDataEntryValue | null): string[] {
  if (typeof raw !== "string" || !raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 50);
  } catch {
    // The field is machine-written, so malformed JSON means a tampered or
    // truncated post, not something the tech can fix. Treat it as empty.
    return [];
  }
}
