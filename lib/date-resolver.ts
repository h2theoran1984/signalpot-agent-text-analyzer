/**
 * Date pre-processor — resolves relative day references in meeting transcripts
 * to absolute ISO dates BEFORE sending to the LLM.
 *
 * This eliminates date arithmetic from the model entirely.
 * Haiku just copies the pre-computed dates from the cheat sheet.
 */

const MONTH_MAP: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

/**
 * Extract the meeting date from transcript text.
 * Handles formats like "March 9, 2026", "March 09, 2026", "2026-03-09", "09 March 2026".
 */
export function parseMeetingDate(text: string): Date | null {
  // "Month DD, YYYY" or "Month DD YYYY"
  const monthFirst = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(\d{4})\b/i
  );
  if (monthFirst) {
    const month = MONTH_MAP[monthFirst[1].toLowerCase()];
    const day = parseInt(monthFirst[2], 10);
    const year = parseInt(monthFirst[3], 10);
    return new Date(year, month, day);
  }

  // "DD Month YYYY"
  const dayFirst = text.match(
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/i
  );
  if (dayFirst) {
    const day = parseInt(dayFirst[1], 10);
    const month = MONTH_MAP[dayFirst[2].toLowerCase()];
    const year = parseInt(dayFirst[3], 10);
    return new Date(year, month, day);
  }

  // "YYYY-MM-DD"
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    return new Date(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
  }

  return null;
}

/** Format a Date as YYYY-MM-DD */
function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Add N days to a date (returns new Date) */
function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

/**
 * Scan the transcript for relative day references and build a date cheat sheet.
 * Returns the original text with the cheat sheet appended.
 */
export function resolveRelativeDates(text: string): string {
  const meetingDate = parseMeetingDate(text);
  if (!meetingDate) return text; // Can't resolve without a date anchor

  const meetingDow = meetingDate.getDay(); // 0=Sun, 1=Mon, ...
  const lowerText = text.toLowerCase();
  const entries: string[] = [];
  const seen = new Set<string>();

  // Helper to add a unique entry
  const add = (label: string, date: Date) => {
    const iso = toISO(date);
    const key = `${label}=${iso}`;
    if (!seen.has(key)) {
      seen.add(key);
      entries.push(`- "${label}" = ${iso}`);
    }
  };

  // Always include "today" and "tomorrow"
  if (/\btoday\b|\bend of day\b|\bby eod\b|\beod\b/i.test(text)) {
    add("today / end of day / EOD", meetingDate);
  }
  if (/\btomorrow\b/i.test(text)) {
    add("tomorrow", addDays(meetingDate, 1));
  }

  // Named days (Monday through Sunday)
  for (let i = 0; i < 7; i++) {
    const dayName = DAY_NAMES[i];
    // Match the day name as a standalone word (not part of the meeting date line header)
    const regex = new RegExp(`\\b${dayName}\\b`, "i");
    if (regex.test(lowerText)) {
      // Calculate offset: next occurrence from meeting date (same day = 0, otherwise forward)
      let offset = (i - meetingDow + 7) % 7;
      // If offset is 0, it means same day as meeting — only include if it's explicitly referenced
      // as a future day (not "today"). For safety, keep offset 0 = same day.
      const resolved = addDays(meetingDate, offset);
      // Don't duplicate "today" entry for the meeting's own day name
      if (offset > 0) {
        add(dayName.charAt(0).toUpperCase() + dayName.slice(1), resolved);
      }
    }
  }

  // "next week" / "next Monday" etc.
  if (/\bnext week\b/i.test(text)) {
    add("next week (Monday)", addDays(meetingDate, 7 - meetingDow + 1));
  }

  if (entries.length === 0) return text;

  const cheatSheet = `\n\n---\nDATE REFERENCE (copy these resolved dates for the "due" field):\n${entries.join("\n")}\n---`;
  return text + cheatSheet;
}
