/**
 * Date helpers for values exchanged with the API.
 *
 * The backend stores calendar days as `Y-m-d`. Never build these with
 * `toISOString()` — that converts to UTC first, and in Kigali (UTC+2) local
 * midnight becomes the *previous* day.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** Local calendar day of `d` as `YYYY-MM-DD`. */
export function toYmd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Parse `YYYY-MM-DD` (optionally followed by a time part) as a local date at midnight. */
export function parseYmd(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Human label for a stored date. `Y-m-d` values are formatted for the given
 * locale; anything else (legacy free-text labels) is returned unchanged.
 */
export function formatYmd(
  s: string | null | undefined,
  locale?: string,
  opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", year: "numeric" },
): string {
  const d = parseYmd(s);
  if (!d) return s ?? "";
  try {
    return d.toLocaleDateString(locale, opts);
  } catch {
    return toYmd(d);
  }
}
