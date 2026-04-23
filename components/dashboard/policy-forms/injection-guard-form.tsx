'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type InjectionPatternEntry = { name: string; regex: string };
export type InjectionGuardConfig = { patterns?: InjectionPatternEntry[] };

export const InjectionGuardForm = ({
  config,
  onChange,
}: {
  config: InjectionGuardConfig;
  onChange: (cfg: InjectionGuardConfig) => void;
}) => {
  const value = JSON.stringify(config.patterns ?? [], null, 2);

  const handleChange = (next: string) => {
    if (next.trim().length === 0) {
      onChange({});
      return;
    }
    try {
      const parsed = JSON.parse(next) as unknown;
      if (Array.isArray(parsed)) {
        onChange({ patterns: parsed as InjectionPatternEntry[] });
      }
    } catch {
      // Ignore bad JSON mid-type.
    }
  };

  return (
    <div className="grid gap-2">
      <Label className="text-xs text-muted-foreground">Extra patterns (JSON array)</Label>
      <Textarea
        rows={5}
        spellCheck={false}
        className="font-mono text-xs"
        placeholder='[]  // empty runs only the 5 built-in patterns'
        defaultValue={value}
        onChange={(e) => handleChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Built-ins always run first: ignore_prior / role_override / im_start / sql_drop / sql_comment_inject.
      </p>
    </div>
  );
};
