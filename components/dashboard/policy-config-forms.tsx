'use client';

// Sprint 6 WP-G.4: typed config forms per builtin_key. Parent components
// (PolicyRow, PolicyCreateDialog) own the config object state and hand each
// form a typed slice. Replaces the raw JSON textareas we had until now.
//
// Contract: every form takes `{ config, onChange }` where `onChange` receives
// a fully-formed config object. No defaultValue in the form — parent decides
// what to seed (e.g. BUILTIN_DEFAULTS in the create dialog).

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Shared helpers -----------------------------------------------------------

const parseLines = (value: string): string[] =>
  value
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

const joinLines = (arr: string[] | undefined): string =>
  (arr ?? []).join('\n');

// ---------------------------------------------------------------------------
// pii_redaction

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
      // Keep parent config intact on bad JSON; the parent can re-validate on
      // save if it wants. Don't clobber valid state mid-type.
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

// ---------------------------------------------------------------------------
// rate_limit

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

// ---------------------------------------------------------------------------
// injection_guard

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

// ---------------------------------------------------------------------------
// allowlist

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

// ---------------------------------------------------------------------------
// basic_auth

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

// ---------------------------------------------------------------------------
// client_id

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
        onChange={(e) =>
          onChange({ ...config, allowed_ids: parseLines(e.target.value) })
        }
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
        onChange={(e) =>
          onChange({ ...config, header_name: e.target.value || undefined })
        }
      />
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// ip_allowlist

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

// ---------------------------------------------------------------------------
// Dispatcher

export type AnyPolicyConfig =
  | PiiConfig
  | RateLimitConfig
  | InjectionGuardConfig
  | AllowlistConfig
  | BasicAuthConfig
  | ClientIdConfig
  | IpAllowlistConfig
  | Record<string, unknown>;

export const PolicyConfigForm = ({
  builtinKey,
  config,
  onChange,
}: {
  builtinKey: string;
  config: Record<string, unknown>;
  onChange: (cfg: Record<string, unknown>) => void;
}) => {
  switch (builtinKey) {
    case 'pii_redaction':
      return (
        <PiiRedactionForm
          config={config as PiiConfig}
          onChange={(c) => onChange(c as Record<string, unknown>)}
        />
      );
    case 'rate_limit':
      return (
        <RateLimitForm
          config={config as RateLimitConfig}
          onChange={(c) => onChange(c as Record<string, unknown>)}
        />
      );
    case 'injection_guard':
      return (
        <InjectionGuardForm
          config={config as InjectionGuardConfig}
          onChange={(c) => onChange(c as Record<string, unknown>)}
        />
      );
    case 'allowlist':
      return (
        <AllowlistForm
          config={config as AllowlistConfig}
          onChange={(c) => onChange(c as Record<string, unknown>)}
        />
      );
    case 'basic_auth':
      return (
        <BasicAuthForm
          config={config as BasicAuthConfig}
          onChange={(c) => onChange(c as Record<string, unknown>)}
        />
      );
    case 'client_id':
      return (
        <ClientIdForm
          config={config as ClientIdConfig}
          onChange={(c) => onChange(c as Record<string, unknown>)}
        />
      );
    case 'ip_allowlist':
      return (
        <IpAllowlistForm
          config={config as IpAllowlistConfig}
          onChange={(c) => onChange(c as Record<string, unknown>)}
        />
      );
    default:
      return null;
  }
};
