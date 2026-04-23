'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type IdempotencyConfig = {
  ttl_seconds?: number;
  key_source?: 'header' | 'args_hash';
};

const clampTtl = (n: number): number => Math.max(1, Math.min(86400, Math.floor(n)));

export const IdempotencyForm = ({
  config,
  onChange,
}: {
  config: IdempotencyConfig;
  onChange: (cfg: IdempotencyConfig) => void;
}) => {
  const ttlSeconds = config.ttl_seconds ?? 300;
  const keySource = config.key_source ?? 'header';
  return (
    <div className="grid gap-3">
      <div className="grid gap-2">
        <Label htmlFor="idempotency-ttl" className="text-xs text-muted-foreground">
          TTL (seconds, 1-86400)
        </Label>
        <Input
          id="idempotency-ttl"
          type="number"
          min={1}
          max={86400}
          value={ttlSeconds}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (!Number.isFinite(next)) return;
            onChange({ ...config, ttl_seconds: clampTtl(next), key_source: keySource });
          }}
        />
      </div>
      <div className="grid gap-2">
        <Label className="text-xs text-muted-foreground">Key source</Label>
        <Select
          value={keySource}
          onValueChange={(v) => {
            if (v !== 'header' && v !== 'args_hash') return;
            onChange({ ...config, key_source: v, ttl_seconds: ttlSeconds });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="header">Header: x-idempotency-key</SelectItem>
            <SelectItem value="args_hash">Args hash (sha256 of tool + args)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        Duplicate calls inside the TTL window are blocked. In-memory store (single process) —
        Redis-backed dedupe is V2.
      </p>
    </div>
  );
};
