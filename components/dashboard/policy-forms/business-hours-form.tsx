'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type BusinessHoursDay, DAY_LABELS, clampHour } from './shared';

// WP-13.4: canonical shape is `{timezone, windows[]}`. Legacy single-window
// rows coming out of the DB still parse at the runner layer (Zod transform),
// but the form only edits the new shape. `toCanonicalConfig` normalizes any
// legacy input on mount so the reducer stays on the new branch from there.

export type BusinessHoursWindow = {
  timezone?: string;
  days: BusinessHoursDay[];
  start_hour: number;
  end_hour: number;
};

export type BusinessHoursConfig = {
  timezone?: string;
  windows?: BusinessHoursWindow[];
  // Legacy fields — accepted on input, stripped on first onChange.
  days?: BusinessHoursDay[];
  start_hour?: number;
  end_hour?: number;
};

type CanonicalConfig = {
  timezone: string;
  windows: BusinessHoursWindow[];
};

const DEFAULT_TIMEZONE = 'Europe/Vienna';
const DEFAULT_WINDOW: BusinessHoursWindow = {
  days: ['mon', 'tue', 'wed', 'thu', 'fri'],
  start_hour: 9,
  end_hour: 17,
};

const toCanonicalConfig = (input: BusinessHoursConfig): CanonicalConfig => {
  const timezone = input.timezone ?? DEFAULT_TIMEZONE;
  if (input.windows && input.windows.length > 0) {
    return { timezone, windows: input.windows };
  }
  // Legacy single-window row — fold into the canonical shape.
  if (input.days && input.start_hour !== undefined && input.end_hour !== undefined) {
    return {
      timezone,
      windows: [
        {
          days: input.days,
          start_hour: input.start_hour,
          end_hour: input.end_hour,
        },
      ],
    };
  }
  return { timezone, windows: [DEFAULT_WINDOW] };
};

const orderDays = (selected: Set<BusinessHoursDay>): BusinessHoursDay[] =>
  DAY_LABELS.map((d) => d.code).filter((c) => selected.has(c));

const WindowRow = ({
  index,
  window,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  window: BusinessHoursWindow;
  canRemove: boolean;
  onChange: (next: BusinessHoursWindow) => void;
  onRemove: () => void;
}) => {
  const toggleDay = (code: BusinessHoursDay, checked: boolean) => {
    const next = new Set(window.days);
    if (checked) next.add(code);
    else next.delete(code);
    onChange({ ...window, days: orderDays(next) });
  };

  return (
    <div className="grid gap-3 rounded-md border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">Window {index + 1}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          disabled={!canRemove}
        >
          Remove
        </Button>
      </div>
      <div className="grid gap-2">
        <Label htmlFor={`bh-win-${index}-tz`} className="text-xs text-muted-foreground">
          Timezone override (blank = use default)
        </Label>
        <Input
          id={`bh-win-${index}-tz`}
          placeholder="e.g. America/New_York"
          value={window.timezone ?? ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            const next: BusinessHoursWindow = { ...window };
            if (raw.length === 0) delete next.timezone;
            else next.timezone = raw;
            onChange(next);
          }}
        />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Allowed days</Label>
        <div className="flex flex-wrap gap-3">
          {DAY_LABELS.map((d) => {
            const checked = window.days.includes(d.code);
            return (
              <label key={d.code} className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggleDay(d.code, v === true)}
                />
                {d.label}
              </label>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor={`bh-win-${index}-start`} className="text-xs text-muted-foreground">
            Start hour (0-23)
          </Label>
          <Input
            id={`bh-win-${index}-start`}
            type="number"
            min={0}
            max={23}
            value={window.start_hour}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onChange({ ...window, start_hour: clampHour(next) });
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor={`bh-win-${index}-end`} className="text-xs text-muted-foreground">
            End hour (0-23, exclusive)
          </Label>
          <Input
            id={`bh-win-${index}-end`}
            type="number"
            min={0}
            max={23}
            value={window.end_hour}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onChange({ ...window, end_hour: clampHour(next) });
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        If end &lt; start, window wraps midnight (e.g. 22-04 = 10pm through 4am next day).
      </p>
    </div>
  );
};

export const BusinessHoursForm = ({
  config,
  onChange,
}: {
  config: BusinessHoursConfig;
  onChange: (cfg: BusinessHoursConfig) => void;
}) => {
  const canonical = toCanonicalConfig(config);
  const { timezone, windows } = canonical;

  const emit = (next: CanonicalConfig) => {
    onChange({ timezone: next.timezone, windows: next.windows });
  };

  const updateWindow = (idx: number, next: BusinessHoursWindow) => {
    const copy = windows.slice();
    copy[idx] = next;
    emit({ timezone, windows: copy });
  };

  const addWindow = () => {
    emit({ timezone, windows: [...windows, { ...DEFAULT_WINDOW }] });
  };

  const removeWindow = (idx: number) => {
    if (windows.length <= 1) return;
    emit({ timezone, windows: windows.filter((_, i) => i !== idx) });
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="bh-timezone" className="text-xs text-muted-foreground">
          Default timezone (IANA, e.g. Europe/Vienna)
        </Label>
        <Input
          id="bh-timezone"
          placeholder="Europe/Vienna"
          value={timezone}
          onChange={(e) => emit({ timezone: e.target.value, windows })}
        />
      </div>
      <div className="grid gap-2">
        {windows.map((win, idx) => (
          <WindowRow
            key={idx}
            index={idx}
            window={win}
            canRemove={windows.length > 1}
            onChange={(next) => updateWindow(idx, next)}
            onRemove={() => removeWindow(idx)}
          />
        ))}
      </div>
      <Button type="button" variant="outline" size="sm" onClick={addWindow}>
        Add window
      </Button>
      <p className="text-xs text-muted-foreground">
        Any window matching the current time passes. DST handled by the runtime.
      </p>
    </div>
  );
};
