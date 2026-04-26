import { describe, expect, it, vi } from 'vitest';
import { cache } from 'react';

// Sprint 20 WP-20.2: pin the React cache() wrap on requireAuth.
//
// React's cache() only dedupes inside an RSC render request, outside that
// context (vitest, route handlers without a render scope) it falls through
// and re-executes. We can't unit-test the per-request dedup itself.
//
// What we CAN lock:
//   1. cache() is importable + callable in this env (no peer-dep regression)
//   2. lib/auth.ts exports `requireAuth` as a cache-wrapped function, a
//      contract test that fails if a future refactor strips the wrap.
//
// Production verification = manual: dev tools network panel, observe a
// single getUser() per dashboard navigation instead of three.

describe('React cache() availability', () => {
  it('imports cleanly and returns a callable wrapper', () => {
    const wrapped = cache((x: number) => x + 1);
    expect(typeof wrapped).toBe('function');
    expect(wrapped(1)).toBe(2);
  });
});

describe('requireAuth cache wrap (Sprint 20 WP-20.2)', () => {
  it('exports a function whose source references the React cache wrapper', async () => {
    // Read the module source via dynamic import + introspection of the file.
    // We assert the cache() call site is in place, fails if a refactor
    // removes the wrap and drops requireAuth back to a bare async function.
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const source = await fs.readFile(
      path.join(process.cwd(), 'lib/auth.ts'),
      'utf8',
    );
    expect(source).toMatch(/import\s+\{\s*cache\s*\}\s+from\s+['"]react['"]/);
    expect(source).toMatch(/export\s+const\s+requireAuth\s*=\s*cache\(/);
  });

  it('exported requireAuth is invocable (no immediate breakage from the wrap)', async () => {
    // Import the module behind a mocked supabase client and confirm the
    // wrapped function still calls through. Don't assert dedup, that's an
    // RSC-render contract, not a vitest one.
    vi.resetModules();
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn().mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'no session' },
          }),
          getSession: vi.fn(),
        },
        from: vi.fn(),
      }),
    }));
    const { requireAuth, UnauthorizedError } = await import('@/lib/auth');
    await expect(requireAuth()).rejects.toBeInstanceOf(UnauthorizedError);
    vi.doUnmock('@/lib/supabase/server');
  });
});
