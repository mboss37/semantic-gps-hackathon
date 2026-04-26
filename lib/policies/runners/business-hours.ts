// business_hours, block tool calls outside configured weekly windows. Pure
// time check; identity and tool name are irrelevant. Uses
// Intl.DateTimeFormat(..., {timeZone}) so DST transitions are handled by the
// runtime instead of any hand-rolled offset math.
//
// Multi-window + overnight-wrap semantics (WP-13.4):
// - `windows` is an allow-list: any match → pass.
// - Each window may override `config.timezone` via `window.timezone`.
// - `start_hour <= end_hour` → same-day window, `hour in [start, end)`.
// - `start_hour  > end_hour` → overnight wrap, e.g. 22-04 covers 22:00 on a
//   `days` member through 04:00 the following day.

export type BusinessHoursDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type BusinessHoursWindow = {
  timezone?: string;
  days: BusinessHoursDay[];
  start_hour: number;
  end_hour: number;
};

export type BusinessHoursConfig = {
  timezone: string;
  windows: BusinessHoursWindow[];
};

const DAY_CODES: Record<string, BusinessHoursDay> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun',
};

const DAY_ORDER: BusinessHoursDay[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const dayBefore = (day: BusinessHoursDay): BusinessHoursDay => {
  const idx = DAY_ORDER.indexOf(day);
  // Caller always passes a valid BusinessHoursDay; idx is never -1.
  const prev = (idx - 1 + DAY_ORDER.length) % DAY_ORDER.length;
  return DAY_ORDER[prev] ?? 'sun';
};

// Extract day-of-week code + hour-of-day (0-23) in the target timezone for
// the given instant. formatToParts returns stable { type, value } pairs, which
// avoids the locale-specific ordering quirks of toLocaleString.
const getZonedDayAndHour = (
  now: Date,
  timezone: string,
): { day: BusinessHoursDay; hour: number } => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '';
  const hourNum = Number(hourStr);
  // `en-US` + `hour12: false` can emit "24" for midnight on some ICU versions;
  // normalise to 0 so the 0-23 invariant holds.
  const hour = hourNum === 24 ? 0 : hourNum;
  const day = DAY_CODES[weekday] ?? 'mon';
  return { day, hour };
};

export type BusinessHoursVerdict =
  | { ok: true }
  | { ok: false; reason: 'outside_business_hours'; detail: string };

const windowMatches = (
  window: BusinessHoursWindow,
  day: BusinessHoursDay,
  hour: number,
): boolean => {
  if (window.start_hour <= window.end_hour) {
    // Same-day window.
    return window.days.includes(day) && hour >= window.start_hour && hour < window.end_hour;
  }
  // Overnight wrap. Evening portion: today is a start day, hour >= start.
  if (window.days.includes(day) && hour >= window.start_hour) return true;
  // Morning portion: yesterday was a start day, hour < end.
  const prev = dayBefore(day);
  if (window.days.includes(prev) && hour < window.end_hour) return true;
  return false;
};

export const runBusinessHours = (
  now: Date,
  config: BusinessHoursConfig,
): BusinessHoursVerdict => {
  for (const window of config.windows) {
    const tz = window.timezone ?? config.timezone;
    const { day, hour } = getZonedDayAndHour(now, tz);
    if (windowMatches(window, day, hour)) return { ok: true };
  }
  const { day, hour } = getZonedDayAndHour(now, config.timezone);
  return {
    ok: false,
    reason: 'outside_business_hours',
    detail: `no matching window (tz=${config.timezone}, now=${day} ${hour}, windows=${config.windows.length})`,
  };
};
