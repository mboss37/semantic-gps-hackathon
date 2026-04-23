export const parseLines = (value: string): string[] =>
  value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

export const joinLines = (arr: string[] | undefined): string => (arr ?? []).join('\n');

export const clampHour = (n: number): number => Math.max(0, Math.min(23, Math.floor(n)));

export type BusinessHoursDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const DAY_LABELS: ReadonlyArray<{ code: BusinessHoursDay; label: string }> = [
  { code: 'mon', label: 'Mon' },
  { code: 'tue', label: 'Tue' },
  { code: 'wed', label: 'Wed' },
  { code: 'thu', label: 'Thu' },
  { code: 'fri', label: 'Fri' },
  { code: 'sat', label: 'Sat' },
  { code: 'sun', label: 'Sun' },
];
