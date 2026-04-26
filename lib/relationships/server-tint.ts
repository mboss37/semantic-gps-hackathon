// Sprint 27: deterministic per-server tint for the monogram chip on the
// relationships page. Stable color across renders so the eye learns "blue =
// Salesforce, purple = Slack, etc." Color comes from POLICY_PALETTE (already
// the unrelated-axis palette in this codebase), no new color additions.
//
// Hash on `server_id` so two orgs with different server names but the same
// alphabetical order don't accidentally share colors. POLICY_PALETTE has
// 6 colors today, so collisions begin past 6 servers, acceptable for
// hackathon scope. Future: workspace admins pin a color per server.

import { POLICY_PALETTE } from '@/lib/charts/palette';

const fnv1a = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash;
};

export const serverHex = (serverId: string): string => {
  const idx = fnv1a(serverId) % POLICY_PALETTE.length;
  return POLICY_PALETTE[idx];
};

/** 2-letter monogram from a server name. Uses the FIRST 2 LETTERS OF THE
 *  LAST WORD because real-world names like "Demo Salesforce", "Demo Slack",
 *  "Demo GitHub" share leading words and would collide on initials. The last
 *  word is the distinctive part. Falls back to first 2 letters of the only
 *  word if there's just one. Always uppercase. */
export const monogramFor = (name: string): string => {
  const words = name
    .replace(/[^a-zA-Z\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return '??';
  const last = words[words.length - 1];
  return last.slice(0, 2).toUpperCase();
};
