'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type BusinessHoursDay, DAY_LABELS, clampHour } from './shared';

export type BusinessHoursConfig = {
  timezone?: string;
  days?: BusinessHoursDay[];
  start_hour?: number;
  end_hour?: number;
};

export const BusinessHoursForm = ({
  config,
  onChange,
}: {
  config: BusinessHoursConfig;
  onChange: (cfg: BusinessHoursConfig) => void;
}) => {
  const timezone = config.timezone ?? 'Europe/Vienna';
  const days = config.days ?? ['mon', 'tue', 'wed', 'thu', 'fri'];
  const startHour = config.start_hour ?? 9;
  const endHour = config.end_hour ?? 17;

  const toggleDay = (code: BusinessHoursDay, checked: boolean) => {
    const next = new Set(days);
    if (checked) next.add(code);
    else next.delete(code);
    const ordered = DAY_LABELS.map((d) => d.code).filter((c) => next.has(c));
    onChange({ ...config, timezone, days: ordered, start_hour: startHour, end_hour: endHour });
  };

  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="bh-timezone" className="text-xs text-muted-foreground">
          Timezone (IANA, e.g. Europe/Vienna)
        </Label>
        <Input
          id="bh-timezone"
          placeholder="Europe/Vienna"
          value={timezone}
          onChange={(e) =>
            onChange({
              ...config,
              timezone: e.target.value,
              days,
              start_hour: startHour,
              end_hour: endHour,
            })
          }
        />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Allowed days</Label>
        <div className="flex flex-wrap gap-3">
          {DAY_LABELS.map((d) => {
            const checked = days.includes(d.code);
            return (
              <label key={d.code} className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={checked} onCheckedChange={(v) => toggleDay(d.code, v === true)} />
                {d.label}
              </label>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="bh-start" className="text-xs text-muted-foreground">
            Start hour (0-23)
          </Label>
          <Input
            id="bh-start"
            type="number"
            min={0}
            max={23}
            value={startHour}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onChange({
                ...config,
                timezone,
                days,
                start_hour: clampHour(next),
                end_hour: endHour,
              });
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="bh-end" className="text-xs text-muted-foreground">
            End hour (0-23, exclusive)
          </Label>
          <Input
            id="bh-end"
            type="number"
            min={0}
            max={23}
            value={endHour}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (!Number.isFinite(next)) return;
              onChange({
                ...config,
                timezone,
                days,
                start_hour: startHour,
                end_hour: clampHour(next),
              });
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Blocks tool calls outside the window in the chosen timezone. DST handled by the runtime.
      </p>
    </div>
  );
};
