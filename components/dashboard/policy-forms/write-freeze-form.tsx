'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { joinLines, parseLines } from './shared';

export type WriteFreezeConfig = { enabled?: boolean; tool_names?: string[] };

export const WriteFreezeForm = ({
  config,
  onChange,
}: {
  config: WriteFreezeConfig;
  onChange: (cfg: WriteFreezeConfig) => void;
}) => {
  const enabled = config.enabled ?? false;
  return (
    <div className="grid gap-3">
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={enabled}
          onCheckedChange={(v) => onChange({ ...config, enabled: v === true })}
        />
        <span className="text-muted-foreground">
          Enable write freeze (read-only mode kill-switch)
        </span>
      </label>
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">
          Frozen tool names (one per line — leave empty to block ALL tools)
        </Label>
        <Textarea
          rows={4}
          spellCheck={false}
          className="font-mono text-xs"
          placeholder="create_task&#10;delete_record"
          defaultValue={joinLines(config.tool_names)}
          onChange={(e) => {
            const names = parseLines(e.target.value);
            onChange({
              ...config,
              enabled,
              tool_names: names.length === 0 ? undefined : names,
            });
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        When enabled with no names, every tool is frozen. Useful as an incident kill-switch.
      </p>
    </div>
  );
};
