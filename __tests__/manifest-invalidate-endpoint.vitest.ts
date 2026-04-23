import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// WP-12.3 (G.18): internal cache-invalidation endpoint. Replaces the
// __HMR_NONCE__ bump hack that Sprint 10 used to force Next.js dev HMR to
// reload lib/manifest/cache.ts after direct DB seeds.
//
// Coverage:
//   1. Auth required (dev) → 401
//   2. Dev + authed → 200 + invalidateManifest() called
//   3. Prod without opt-in env → 404 (auth never reached)
//   4. Prod with MANIFEST_INTROSPECTION_ENABLED=1 → 200 + invalidateManifest() called

const { requireAuthMock, invalidateManifestMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  invalidateManifestMock: vi.fn(),
}));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return { ...actual, requireAuth: requireAuthMock };
});

vi.mock('@/lib/manifest/cache', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/manifest/cache')>('@/lib/manifest/cache');
  return { ...actual, invalidateManifest: invalidateManifestMock };
});

const { POST } = await import('@/app/api/internal/manifest/invalidate/route');

describe('POST /api/_internal/manifest/invalidate (WP-12.3)', () => {
  beforeEach(() => {
    requireAuthMock.mockReset();
    invalidateManifestMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 in dev when the caller is not authenticated', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('MANIFEST_INTROSPECTION_ENABLED', '');
    const { UnauthorizedError } = await import('@/lib/auth');
    requireAuthMock.mockRejectedValueOnce(new UnauthorizedError());

    const res = await POST();
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('unauthorized');
    expect(invalidateManifestMock).not.toHaveBeenCalled();
  });

  it('clears the manifest cache in dev when authenticated (200 ok)', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('MANIFEST_INTROSPECTION_ENABLED', '');
    requireAuthMock.mockResolvedValueOnce({
      user: { id: 'u1' },
      organization_id: 'org-1',
      role: 'admin',
      supabase: {},
    });

    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(invalidateManifestMock).toHaveBeenCalledTimes(1);
  });

  it('returns 404 in production when the opt-in env flag is unset (auth never reached)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MANIFEST_INTROSPECTION_ENABLED', '');

    const res = await POST();
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('not_found');
    // Env check runs before auth — requireAuth must not even be consulted.
    expect(requireAuthMock).not.toHaveBeenCalled();
    expect(invalidateManifestMock).not.toHaveBeenCalled();
  });

  it('returns 200 in production when MANIFEST_INTROSPECTION_ENABLED=1 and auth succeeds', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('MANIFEST_INTROSPECTION_ENABLED', '1');
    requireAuthMock.mockResolvedValueOnce({
      user: { id: 'u1' },
      organization_id: 'org-1',
      role: 'admin',
      supabase: {},
    });

    const res = await POST();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    expect(requireAuthMock).toHaveBeenCalledTimes(1);
    expect(invalidateManifestMock).toHaveBeenCalledTimes(1);
  });
});
