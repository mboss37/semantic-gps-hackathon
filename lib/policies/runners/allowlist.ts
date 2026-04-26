// allowlist, gate tool invocations by tool name. Empty/missing allowlist is
// treated as "no restriction" so policies can be attached before the tool set
// is finalised without silently breaking existing calls.

export type AllowlistConfig = {
  tool_names?: string[];
};

export type AllowlistVerdict =
  | { ok: true }
  | { ok: false; reason: string };

export const runAllowlist = (toolName: string, config?: AllowlistConfig): AllowlistVerdict => {
  const allowed = config?.tool_names ?? [];
  if (allowed.length === 0) return { ok: true };
  if (allowed.includes(toolName)) return { ok: true };
  return { ok: false, reason: `tool "${toolName}" is not in the allowlist` };
};
