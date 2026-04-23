'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { joinLines, parseLines } from './shared';

export type AgentIdentityConfig = {
  require_headers?: string[];
  verify_signature?: boolean;
  trust_chain_id?: string;
};

export const AgentIdentityForm = ({
  config,
  onChange,
}: {
  config: AgentIdentityConfig;
  onChange: (cfg: AgentIdentityConfig) => void;
}) => {
  const verifySignature = config.verify_signature ?? false;
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">
          Required headers (one per line — presence check only)
        </Label>
        <Textarea
          rows={4}
          spellCheck={false}
          className="font-mono text-xs"
          placeholder="x-agent-id&#10;x-agent-signature"
          defaultValue={joinLines(config.require_headers)}
          onChange={(e) =>
            onChange({ ...config, require_headers: parseLines(e.target.value) })
          }
        />
      </div>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={verifySignature}
          onCheckedChange={(v) => onChange({ ...config, verify_signature: v === true })}
        />
        <span className="text-muted-foreground">
          Verify signature (not yet implemented — will block every call)
        </span>
      </label>
      <div className="grid gap-2">
        <Label htmlFor="agent-identity-trust" className="text-xs text-muted-foreground">
          Trust chain ID (optional, reserved)
        </Label>
        <Input
          id="agent-identity-trust"
          placeholder="e.g. org-roots-2026"
          value={config.trust_chain_id ?? ''}
          onChange={(e) =>
            onChange({ ...config, trust_chain_id: e.target.value || undefined })
          }
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Empty required-headers list + signature disabled = no-op (allows everything).
      </p>
    </div>
  );
};
