// Shared helpers used by multiple policy runners. Keep this surface tiny -
// if a helper is only used by one runner, keep it local to that runner file.

export type PreCallVerdict = { ok: true } | { ok: false; reason: string };

export const getHeader = (
  headers: Record<string, string> | undefined,
  name: string,
): string | undefined => {
  if (!headers) return undefined;
  const target = name.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === target) return v;
  }
  return undefined;
};
