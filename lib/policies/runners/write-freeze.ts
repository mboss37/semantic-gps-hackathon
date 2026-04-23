// write_freeze — kill switch an org can flip during incidents or audits.
// Either freezes a named subset of write tools (tool_names) or the whole
// surface (tool_names omitted). Passes through when disabled.

export type WriteFreezeConfig = {
  enabled: boolean;
  tool_names?: string[];
};

export type WriteFreezeVerdict =
  | { ok: true }
  | { ok: false; reason: 'write_freeze_active'; detail: string };

export const runWriteFreeze = (
  toolName: string,
  config: WriteFreezeConfig,
): WriteFreezeVerdict => {
  if (!config.enabled) return { ok: true };
  const scoped = config.tool_names;
  if (!scoped || scoped.length === 0) {
    return {
      ok: false,
      reason: 'write_freeze_active',
      detail: `write freeze active (all tools); tool "${toolName}" blocked`,
    };
  }
  if (scoped.includes(toolName)) {
    return {
      ok: false,
      reason: 'write_freeze_active',
      detail: `write freeze active; tool "${toolName}" is in frozen list`,
    };
  }
  return { ok: true };
};
