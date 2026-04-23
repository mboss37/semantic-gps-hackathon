'use client';

// Dispatcher: routes each policy `builtin_key` to its typed form component.
// Individual form modules live under `./policy-forms/` (one per builtin) so
// each stays under the file-size budget and independently diffable.

import {
  AgentIdentityForm,
  type AgentIdentityConfig,
} from './policy-forms/agent-identity-form';
import { AllowlistForm, type AllowlistConfig } from './policy-forms/allowlist-form';
import { BasicAuthForm, type BasicAuthConfig } from './policy-forms/basic-auth-form';
import {
  BusinessHoursForm,
  type BusinessHoursConfig,
} from './policy-forms/business-hours-form';
import { ClientIdForm, type ClientIdConfig } from './policy-forms/client-id-form';
import { GeoFenceForm, type GeoFenceConfig } from './policy-forms/geo-fence-form';
import {
  IdempotencyForm,
  type IdempotencyConfig,
} from './policy-forms/idempotency-form';
import {
  InjectionGuardForm,
  type InjectionGuardConfig,
  type InjectionPatternEntry,
} from './policy-forms/injection-guard-form';
import { IpAllowlistForm, type IpAllowlistConfig } from './policy-forms/ip-allowlist-form';
import {
  PiiRedactionForm,
  type PiiConfig,
  type PiiPatternEntry,
} from './policy-forms/pii-redaction-form';
import { RateLimitForm, type RateLimitConfig } from './policy-forms/rate-limit-form';
import { WriteFreezeForm, type WriteFreezeConfig } from './policy-forms/write-freeze-form';

export type {
  AgentIdentityConfig,
  AllowlistConfig,
  BasicAuthConfig,
  BusinessHoursConfig,
  ClientIdConfig,
  GeoFenceConfig,
  IdempotencyConfig,
  InjectionGuardConfig,
  InjectionPatternEntry,
  IpAllowlistConfig,
  PiiConfig,
  PiiPatternEntry,
  RateLimitConfig,
  WriteFreezeConfig,
};

export {
  AgentIdentityForm,
  AllowlistForm,
  BasicAuthForm,
  BusinessHoursForm,
  ClientIdForm,
  GeoFenceForm,
  IdempotencyForm,
  InjectionGuardForm,
  IpAllowlistForm,
  PiiRedactionForm,
  RateLimitForm,
  WriteFreezeForm,
};

export type AnyPolicyConfig =
  | PiiConfig
  | RateLimitConfig
  | InjectionGuardConfig
  | AllowlistConfig
  | BasicAuthConfig
  | ClientIdConfig
  | IpAllowlistConfig
  | BusinessHoursConfig
  | WriteFreezeConfig
  | GeoFenceConfig
  | AgentIdentityConfig
  | IdempotencyConfig
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
    case 'business_hours':
      return (
        <BusinessHoursForm
          config={config as BusinessHoursConfig}
          onChange={(c) => onChange(c as Record<string, unknown>)}
        />
      );
    case 'write_freeze':
      return (
        <WriteFreezeForm
          config={config as WriteFreezeConfig}
          onChange={(c) => onChange(c as Record<string, unknown>)}
        />
      );
    case 'geo_fence':
      return (
        <GeoFenceForm
          config={config as GeoFenceConfig}
          onChange={(c) => onChange(c as Record<string, unknown>)}
        />
      );
    case 'agent_identity_required':
      return (
        <AgentIdentityForm
          config={config as AgentIdentityConfig}
          onChange={(c) => onChange(c as Record<string, unknown>)}
        />
      );
    case 'idempotency_required':
      return (
        <IdempotencyForm
          config={config as IdempotencyConfig}
          onChange={(c) => onChange(c as Record<string, unknown>)}
        />
      );
    default:
      return null;
  }
};
