'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type BasicAuthConfig = { realm?: string };

export const BasicAuthForm = ({
  config,
  onChange,
}: {
  config: BasicAuthConfig;
  onChange: (cfg: BasicAuthConfig) => void;
}) => (
  <div className="grid gap-2">
    <Label htmlFor="basic-auth-realm" className="text-xs text-muted-foreground">
      Realm (optional)
    </Label>
    <Input
      id="basic-auth-realm"
      placeholder="mcp-gateway"
      value={config.realm ?? ''}
      onChange={(e) => onChange({ realm: e.target.value || undefined })}
    />
    <p className="text-xs text-muted-foreground">
      Requires an Authorization: Basic header on every call. Realm is advisory for now.
    </p>
  </div>
);
