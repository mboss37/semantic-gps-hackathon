import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PolicyCatalogCard } from '@/components/dashboard/policy-catalog-card';
import { DIMENSION_LABELS, POLICY_CATALOG, type PolicyDimension } from '@/lib/policies/catalog';

// Sprint 20 WP-20.4: catalog content is pure static data — no auth, no DB,
// no cookies. The parent layout still reads cookies via requireAuth() so the
// route ends up dynamic at the envelope, but removing the explicit
// force-dynamic lets Next.js optimize within that envelope and prepares the
// page for PPR (deferred — experimental) which would static-render the
// content while keeping the layout dynamic.

const DIMENSION_ORDER: PolicyDimension[] = [
  'hygiene',
  'identity',
  'rate',
  'time',
  'residency',
  'kill-switch',
  'idempotency',
];

const CatalogPage = () => {
  const byDimension = new Map<PolicyDimension, typeof POLICY_CATALOG>();
  for (const entry of POLICY_CATALOG) {
    const bucket = byDimension.get(entry.dimension) ?? [];
    bucket.push(entry);
    byDimension.set(entry.dimension, bucket);
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/policies">
              <ArrowLeftIcon className="size-4" />
              My policies
            </Link>
          </Button>
        </div>
        <div>
          <h1 className="text-2xl font-semibold">Policy Catalog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Twelve gateway policies across seven governance dimensions. Pick one to create a
            scoped instance for your organization — shadow mode first, then flip to enforce.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {DIMENSION_ORDER.map((dim) => {
          const entries = byDimension.get(dim) ?? [];
          if (entries.length === 0) return null;
          return (
            <section key={dim} className="flex flex-col gap-3">
              <h2 className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                {DIMENSION_LABELS[dim]}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {entries.map((entry) => (
                  <PolicyCatalogCard key={entry.builtin_key} entry={entry} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default CatalogPage;
