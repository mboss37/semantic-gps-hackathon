'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { joinLines, parseLines } from './shared';

export type ClientIdConfig = { allowed_ids?: string[]; header_name?: string };

export const ClientIdForm = ({
  config,
  onChange,
}: {
  config: ClientIdConfig;
  onChange: (cfg: ClientIdConfig) => void;
}) => (
  <div className="grid gap-3">
    <div className="grid gap-2">
      <Label className="text-xs text-muted-foreground">Allowed client IDs (one per line)</Label>
      <Textarea
        rows={4}
        spellCheck={false}
        className="font-mono text-xs"
        placeholder="agent-a&#10;agent-b"
        defaultValue={joinLines(config.allowed_ids)}
        onChange={(e) => onChange({ ...config, allowed_ids: parseLines(e.target.value) })}
      />
    </div>
    <div className="grid gap-2">
      <Label htmlFor="client-id-header" className="text-xs text-muted-foreground">
        Header name (defaults to x-client-id)
      </Label>
      <Input
        id="client-id-header"
        placeholder="x-client-id"
        value={config.header_name ?? ''}
        onChange={(e) => onChange({ ...config, header_name: e.target.value || undefined })}
      />
    </div>
  </div>
);
