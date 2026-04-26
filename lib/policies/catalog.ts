// Single source of truth for the policy catalog gallery
// (`/dashboard/policies/catalog`). Mirrors the 12 builtin runners in
// `lib/policies/runners/*.ts` across the 7 governance dimensions Semantic GPS
// polices at the gateway layer. Zero auto-seeding, users always create
// instances explicitly via the "Apply to my org" CTA, which deep-links into
// the existing create-policy dialog with the builtin pre-selected.

export type PolicyDimension =
  | 'time'
  | 'rate'
  | 'identity'
  | 'residency'
  | 'hygiene'
  | 'kill-switch'
  | 'idempotency';

export type CatalogEntry = {
  builtin_key: string;
  title: string;
  description: string;
  dimension: PolicyDimension;
  config_keys: string[];
};

export const POLICY_CATALOG: CatalogEntry[] = [
  {
    builtin_key: 'pii_redaction',
    title: 'PII Redaction',
    description:
      'Scrub emails, phone numbers, credit cards, and SSNs from tool responses before the agent sees them. International phone numbers via libphonenumber validation.',
    dimension: 'hygiene',
    config_keys: ['patterns[]'],
  },
  {
    builtin_key: 'injection_guard',
    title: 'Prompt Injection Guard',
    description:
      'Block prompt-injection attempts and suspicious control strings in tool arguments before the call reaches the origin.',
    dimension: 'hygiene',
    config_keys: ['patterns[]', 'mode'],
  },
  {
    builtin_key: 'rate_limit',
    title: 'Rate Limit',
    description:
      'Cap calls per minute to protect downstream systems. Scope per tool, per client, or per org.',
    dimension: 'rate',
    config_keys: ['max_rpm', 'window_seconds'],
  },
  {
    builtin_key: 'allowlist',
    title: 'Tool Allowlist',
    description:
      'Restrict the agent to an explicit set of tool names. Everything outside the list is rejected at the gateway.',
    dimension: 'identity',
    config_keys: ['tool_names[]'],
  },
  {
    builtin_key: 'business_hours',
    title: 'Business Hours',
    description:
      'Only allow calls during business windows. Supports multiple windows, per-window timezones, overnight wraps, and DST.',
    dimension: 'time',
    config_keys: ['timezone', 'windows[]'],
  },
  {
    builtin_key: 'write_freeze',
    title: 'Write Freeze',
    description:
      'Kill switch: block all writes (POST/PUT/PATCH/DELETE) with a single flag. Scope per server or org-wide.',
    dimension: 'kill-switch',
    config_keys: ['enabled'],
  },
  {
    builtin_key: 'basic_auth',
    title: 'Basic Auth',
    description:
      'Require HTTP Basic credentials on inbound gateway calls. Fails closed when the header is missing or malformed.',
    dimension: 'identity',
    config_keys: ['realm', 'users_hash'],
  },
  {
    builtin_key: 'client_id',
    title: 'Client ID Allowlist',
    description:
      'Require an `x-client-id` (or custom header) and allowlist specific values. Fails closed on missing header.',
    dimension: 'identity',
    config_keys: ['allowed_ids[]', 'header_name'],
  },
  {
    builtin_key: 'ip_allowlist',
    title: 'IP Allowlist',
    description:
      'Accept gateway calls only from specific IPv4 CIDR blocks. Useful for VPN-only or on-prem agent deployments.',
    dimension: 'identity',
    config_keys: ['allowed_cidrs[]'],
  },
  {
    builtin_key: 'geo_fence',
    title: 'Geo Fence',
    description:
      'Restrict tool calls to allowed regions. EU AI Act data-residency hook, block US routing from EU agents.',
    dimension: 'residency',
    config_keys: ['allowed_regions[]', 'source'],
  },
  {
    builtin_key: 'agent_identity_required',
    title: 'Agent Identity Required',
    description:
      'Require verifiable agent-identity headers on every call. Closes the Meta confused-deputy attack class.',
    dimension: 'identity',
    config_keys: ['require_headers[]', 'verify_signature'],
  },
  {
    builtin_key: 'idempotency_required',
    title: 'Idempotency Required',
    description:
      'Require an idempotency key on write calls and dedupe replays within the TTL window.',
    dimension: 'idempotency',
    config_keys: ['ttl_seconds', 'key_source'],
  },
];

export const DIMENSION_LABELS: Record<PolicyDimension, string> = {
  time: 'Time & State',
  rate: 'Rate',
  identity: 'Identity',
  residency: 'Residency',
  hygiene: 'Hygiene',
  'kill-switch': 'Kill Switch',
  idempotency: 'Idempotency',
};
