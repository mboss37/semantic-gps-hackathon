// CI-only service-client stub. On GitHub Actions the test env uses fake
// Supabase values (so createServiceClient boots), but any actual query hangs
// waiting for a connection to a URL that doesn't resolve. This stub makes
// every chained call resolve immediately with empty data, so logMCPEvent
// and loadManifest are no-ops during CI runs.
//
// Local dev (CI unset) keeps the real client — tests that rely on a running
// `pnpm supabase start` stack still talk to it. Integration suites that
// actually need DB state have their own `!process.env.CI` skip guard.
//
// Usage in a test file (must be top-level vi.mock so vitest hoists it):
//
//   import { stubServiceClientFactory } from './_helpers/supabase-stub';
//   vi.mock('@/lib/supabase/service', stubServiceClientFactory);

type Row = Record<string, unknown>;
type QueryResult = { data: Row[]; error: null };

const emptyResult: QueryResult = { data: [], error: null };
const emptyMaybeSingle = { data: null, error: null };

const makeChain = (): unknown =>
  new Proxy(
    {
      then(resolve: (v: QueryResult) => unknown) {
        return Promise.resolve(resolve(emptyResult));
      },
      maybeSingle: (): Promise<typeof emptyMaybeSingle> =>
        Promise.resolve(emptyMaybeSingle),
      single: (): Promise<typeof emptyMaybeSingle> =>
        Promise.resolve(emptyMaybeSingle),
    } as object,
    {
      get(target, prop) {
        const rec = target as Record<string | symbol, unknown>;
        if (prop in rec) return rec[prop];
        return (): unknown => makeChain();
      },
    },
  );

export const stubServiceClientFactory = async (): Promise<
  typeof import('@/lib/supabase/service')
> => {
  if (!process.env.CI) {
    const { vi } = await import('vitest');
    return await vi.importActual<typeof import('@/lib/supabase/service')>(
      '@/lib/supabase/service',
    );
  }
  return {
    createServiceClient: (() => ({ from: () => makeChain() })) as unknown as typeof import(
      '@/lib/supabase/service'
    ).createServiceClient,
  };
};
