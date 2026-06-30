// Timezone-aware scheduling for alerts.
// All alerts anchor to 9 AM local time so we never email users at 3 AM.
// Computation works from both client and server.

const ANCHOR_HOUR = 9;

// Returns the next Date (UTC) when an alert with this cadence should fire in
// the given IANA timezone, starting from `base`. Defaults to next 9 AM local.
// cadenceHours determines how many days out to land: 24 -> next 9 AM (today
// or tomorrow), 168 (weekly) -> 9 AM, 7 days from today's tz-local date.
export function nextAnchoredRunAt(
  timezone: string,
  cadenceHours: number,
  base: Date = new Date(),
): Date {
  const daySpan = Math.max(1, Math.round(cadenceHours / 24));

  // Extract the current calendar parts as seen in the target timezone.
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  }).formatToParts(base);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  const year = Number(get('year'));
  const month = Number(get('month'));
  const day = Number(get('day'));
  const hour = Number(get('hour'));

  let targetYear = year;
  let targetMonth = month;
  let targetDay = day;
  let targetHour: number;

  if (daySpan === 1) {
    // Daily: next 9 AM strictly in the future — today if still ahead, else tomorrow.
    if (hour < ANCHOR_HOUR) {
      targetHour = ANCHOR_HOUR;
    } else {
      targetHour = ANCHOR_HOUR;
      const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
      targetYear = tomorrow.getUTCFullYear();
      targetMonth = tomorrow.getUTCMonth() + 1;
      targetDay = tomorrow.getUTCDate();
    }
  } else {
    // Multi-day cadence (e.g. weekly): always advance daySpan days, then 9 AM.
    targetHour = ANCHOR_HOUR;
    const future = new Date(Date.UTC(year, month - 1, day + daySpan));
    targetYear = future.getUTCFullYear();
    targetMonth = future.getUTCMonth() + 1;
    targetDay = future.getUTCDate();
  }

  // Now convert that wall-clock-in-tz to a UTC Date.
  return zonedTimeToUtc(targetYear, targetMonth, targetDay, targetHour, 0, timezone);
}

// Human-readable cadence name, e.g. "Daily" / "Weekly".
export function cadenceLabel(hours: number): string {
  return hours === 168 ? 'Weekly' : 'Daily';
}

// e.g. "Daily at 9 AM" / "Weekly at 9 AM".
export function cadenceScheduleLabel(hours: number): string {
  return `${cadenceLabel(hours)} at 9 AM`;
}

// Convert a wall-clock time in the given IANA tz to a UTC Date.
function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  // First guess: treat the wall-clock as if it were UTC.
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  // Compute the offset at that moment in the target tz.
  const offsetMs = getOffsetMs(timezone, new Date(utcGuess));
  // Adjust: actual UTC time = guess - offset
  return new Date(utcGuess - offsetMs);
}

// Returns the timezone's offset (in ms) from UTC at the given instant.
// Positive for tzs ahead of UTC.
function getOffsetMs(timezone: string, atUtc: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(atUtc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second'),
  );
  return asUtc - atUtc.getTime();
}

// Format a date for display in the user's timezone, e.g. "9:00 AM PST".
export function formatTimeInTz(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  }).format(date);
}

// Format like "Tomorrow at 9:00 AM PST" or "Today at 9:00 PM PST".
export function formatNextRun(date: Date, timezone: string): string {
  const time = formatTimeInTz(date, timezone);
  // Compare dates in the target tz
  const now = new Date();
  const dayFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const nowDay = dayFmt.format(now);
  const targetDay = dayFmt.format(date);
  if (nowDay === targetDay) return `Today at ${time}`;
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (dayFmt.format(tomorrow) === targetDay) return `Tomorrow at ${time}`;
  // Further out — show date
  const dateLabel = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, weekday: 'short', month: 'short', day: 'numeric',
  }).format(date);
  return `${dateLabel} at ${time}`;
}
