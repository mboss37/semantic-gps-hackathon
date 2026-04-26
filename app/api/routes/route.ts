import { NextResponse } from 'next/server';

import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';
import { importRoute } from '@/lib/routes/import';
import { RouteImportSchema } from '@/lib/schemas/route-import';

// Sprint 28 WP-28.1: JSON-import endpoint for routes + steps. Visual editor
// is v2 (WP-28.6 in BACKLOG). All real work happens in lib/routes/import.ts
// so the handler stays thin and the business logic stays unit-testable.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = async (request: Request): Promise<Response> => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw e;
  }

  const body = (await request.json().catch(() => null)) as unknown;
  const parsed = RouteImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await importRoute(supabase, organization_id, parsed.data);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, details: result.details },
      { status: result.status },
    );
  }

  invalidateManifest();
  return NextResponse.json(
    { route_id: result.route_id, name: parsed.data.name, step_count: result.step_count },
    { status: 201 },
  );
};
