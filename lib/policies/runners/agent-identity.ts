// agent_identity_required — layered identity gate (paired with the client_id
// builtin for defense-in-depth). v1 implements header-presence only.
// verify_signature:true returns a not-implemented block so the config surface
// is forward-compatible without premature KMS/JWK plumbing.

import { getHeader } from './shared';

export type AgentIdentityConfig = {
  require_headers: string[];
  verify_signature: boolean;
  trust_chain_id?: string;
};

export type AgentIdentityVerdict =
  | { ok: true }
  | {
      ok: false;
      reason: 'agent_identity_missing' | 'signature_verification_not_implemented';
      detail?: string;
    };

export const runAgentIdentity = (
  headers: Record<string, string> | undefined,
  config: AgentIdentityConfig,
): AgentIdentityVerdict => {
  if (config.verify_signature === true) {
    return {
      ok: false,
      reason: 'signature_verification_not_implemented',
      detail: 'v1 is header-presence only',
    };
  }
  for (const name of config.require_headers) {
    const value = getHeader(headers, name);
    if (!value) {
      return {
        ok: false,
        reason: 'agent_identity_missing',
        detail: `required header ${name} missing`,
      };
    }
  }
  return { ok: true };
};
