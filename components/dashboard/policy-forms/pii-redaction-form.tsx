'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type PiiPatternEntry = { name: string; regex: string; replacement?: string };
export type PiiConfig = { patterns?: PiiPatternEntry[] };

export const PiiRedactionForm = ({
  config,
  onChange,
}: {
  config: PiiConfig;
  onChange: (cfg: PiiConfig) => void;
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
        onChange({ patterns: parsed as PiiPatternEntry[] });
      }
    } catch {
      // Keep parent config intact on bad JSON; parent re-validates on save.
    }
  };

  return (
    <div className="grid gap-2">
      <Label className="text-xs text-muted-foreground">Custom patterns (JSON array)</Label>
      <Textarea
        rows={5}
        spellCheck={false}
        className="font-mono text-xs"
        placeholder='[]  // empty uses the 4 defaults: email / phone_us / ssn_us / credit_card'
        defaultValue={value}
        onChange={(e) => handleChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">
        Leave empty (or {'[]'}) to use the built-in patterns. Each entry: {`{ name, regex, replacement? }`}.
      </p>
    </div>
  );
};
