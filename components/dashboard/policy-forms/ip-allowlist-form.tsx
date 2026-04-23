'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { joinLines, parseLines } from './shared';

export type IpAllowlistConfig = { allowed_cidrs?: string[] };

export const IpAllowlistForm = ({
  config,
  onChange,
}: {
  config: IpAllowlistConfig;
  onChange: (cfg: IpAllowlistConfig) => void;
}) => (
  <div className="grid gap-2">
    <Label className="text-xs text-muted-foreground">Allowed CIDR blocks (one per line)</Label>
    <Textarea
      rows={5}
      spellCheck={false}
      className="font-mono text-xs"
      placeholder="10.0.0.0/8&#10;192.168.1.0/24&#10;203.0.113.7/32"
      defaultValue={joinLines(config.allowed_cidrs)}
      onChange={(e) => onChange({ allowed_cidrs: parseLines(e.target.value) })}
    />
    <p className="text-xs text-muted-foreground">IPv4 only. Empty = deny all (fail-closed).</p>
  </div>
);
