'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { joinLines, parseLines } from './shared';

export type AllowlistConfig = { tool_names?: string[] };

export const AllowlistForm = ({
  config,
  onChange,
}: {
  config: AllowlistConfig;
  onChange: (cfg: AllowlistConfig) => void;
}) => (
  <div className="grid gap-2">
    <Label className="text-xs text-muted-foreground">Allowed tool names (one per line)</Label>
    <Textarea
      rows={5}
      spellCheck={false}
      className="font-mono text-xs"
      placeholder="getCustomer&#10;searchCustomers"
      defaultValue={joinLines(config.tool_names)}
      onChange={(e) => onChange({ tool_names: parseLines(e.target.value) })}
    />
    <p className="text-xs text-muted-foreground">
      Empty list means all tools are allowed (no-op policy).
    </p>
  </div>
);
