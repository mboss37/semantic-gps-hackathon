// geo_fence — network / data residency gate. v1 reads a single header;
// `source: 'org_setting'` is reserved in the config shape but not implemented
// (runner rejects with config_invalid). Fail-closed on missing header so orgs
// opt out by NOT assigning the policy, never by omitting the header.

import { getHeader } from './shared';

export type GeoFenceConfig = {
  allowed_regions: string[];
  source: 'header';
};

export type GeoFenceVerdict =
  | { ok: true }
  | { ok: false; reason: 'geo_fence_config_invalid' | 'region_missing' | 'region_not_allowed'; detail?: string };

export const runGeoFence = (
  headers: Record<string, string> | undefined,
  config: GeoFenceConfig,
): GeoFenceVerdict => {
  if (config.source !== 'header') {
    return { ok: false, reason: 'geo_fence_config_invalid' };
  }
  const region = getHeader(headers, 'x-agent-region');
  if (!region) {
    return {
      ok: false,
      reason: 'region_missing',
      detail: 'x-agent-region header required',
    };
  }
  if (!config.allowed_regions.includes(region)) {
    return {
      ok: false,
      reason: 'region_not_allowed',
      detail: `agent region ${region} not in allowlist`,
    };
  }
  return { ok: true };
};
