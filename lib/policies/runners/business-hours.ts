// business_hours — block tool calls outside a configured weekly window. Pure
// time check; identity and tool name are irrelevant. Uses
// Intl.DateTimeFormat(..., {timeZone}) so DST transitions are handled by the
// runtime instead of any hand-rolled offset math.

export type BusinessHoursDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type BusinessHoursConfig = {
  timezone: string;
  days: BusinessHoursDay[];
  start_hour: number;
  end_hour: number;
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

export const runBusinessHours = (
  now: Date,
  config: BusinessHoursConfig,
): BusinessHoursVerdict => {
  const { day, hour } = getZonedDayAndHour(now, config.timezone);
  if (!config.days.includes(day)) {
    return {
      ok: false,
      reason: 'outside_business_hours',
      detail: `day ${day} not in allowed days [${config.days.join(', ')}] (tz=${config.timezone})`,
    };
  }
  if (hour < config.start_hour || hour >= config.end_hour) {
    return {
      ok: false,
      reason: 'outside_business_hours',
      detail: `hour ${hour} outside window ${config.start_hour}-${config.end_hour} (tz=${config.timezone}, day=${day})`,
    };
  }
  return { ok: true };
};
