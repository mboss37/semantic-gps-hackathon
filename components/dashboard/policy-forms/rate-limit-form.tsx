'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type RateLimitConfig = { max_rpm?: number };

export const RateLimitForm = ({
  config,
  onChange,
}: {
  config: RateLimitConfig;
  onChange: (cfg: RateLimitConfig) => void;
}) => {
  const current = config.max_rpm ?? 60;
  return (
    <div className="grid gap-2">
      <Label htmlFor="rate-limit-rpm" className="text-xs text-muted-foreground">
        Requests per minute
      </Label>
      <Input
        id="rate-limit-rpm"
        type="number"
        min={1}
        max={10000}
        value={current}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (!Number.isFinite(next)) return;
          onChange({ max_rpm: Math.max(1, Math.min(10000, Math.floor(next))) });
        }}
      />
      <p className="text-xs text-muted-foreground">
        Rolling 60s window, per caller identity (x-org-id header, falling back to client IP).
      </p>
    </div>
  );
};
