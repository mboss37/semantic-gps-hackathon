import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';

// Sprint 6 WP-G.2: per-relationship PATCH + DELETE. Cross-org edges surface
// as 404 (never leak that they exist). Sprint 27: PATCH now accepts
// `relationship_type` in addition to `description` — at least one of the
// two must be present.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RELATIONSHIP_TYPES = [
  'produces_input_for',
  'requires_before',
  'suggests_after',
  'mutually_exclusive',
  'alternative_to',
  'validates',
  'compensated_by',
  'fallback_to',
] as const;

const PatchBody = z
  .object({
    description: z.string().min(5).max(500).optional(),
    relationship_type: z.enum(RELATIONSHIP_TYPES).optional(),
  })
  .refine(
    (v) => v.description !== undefined || v.relationship_type !== undefined,
    { message: 'at least one of description or relationship_type required' },
  );

const unauthorized = (): Response =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 });

const notFound = (): Response =>
  NextResponse.json({ error: 'not_found' }, { status: 404 });

type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>;

const verifyOrgOwnership = async (
  supabase: SupabaseClient,
  organizationId: string,
  relationshipId: string,
): Promise<boolean> => {
  const { data: rel } = await supabase
    .from('relationships')
    .select('id, from_tool_id, to_tool_id')
    .eq('id', relationshipId)
    .maybeSingle();
  if (!rel) return false;

  const { data: tools, error } = await supabase
    .from('tools')
    .select('id, servers!inner(organization_id)')
    .in('id', [rel.from_tool_id, rel.to_tool_id]);
  if (error || !tools || tools.length !== 2) return false;

  type ToolWithServer = { id: string; servers: { organization_id: string } | null };
  const list = tools as unknown as ToolWithServer[];
  return list.every((t) => t.servers?.organization_id === organizationId);
};

export const PATCH = async (
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await params;
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const allowed = await verifyOrgOwnership(supabase, organization_id, id);
  if (!allowed) return notFound();

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = PatchBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const update: Record<string, string> = {};
  if (parsed.data.description !== undefined) update.description = parsed.data.description;
  if (parsed.data.relationship_type !== undefined)
    update.relationship_type = parsed.data.relationship_type;

  const { data, error } = await supabase
    .from('relationships')
    .update(update)
    .eq('id', id)
    .select('id, from_tool_id, to_tool_id, relationship_type, description')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'update failed', details: error?.message },
      { status: 500 },
    );
  }

  invalidateManifest();
  return NextResponse.json({ relationship: data });
};

export const DELETE = async (
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const { id } = await params;
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const allowed = await verifyOrgOwnership(supabase, organization_id, id);
  if (!allowed) return notFound();

  const { error } = await supabase.from('relationships').delete().eq('id', id);
  if (error) {
    return NextResponse.json(
      { error: 'delete failed', details: error.message },
      { status: 500 },
    );
  }

  invalidateManifest();
  return NextResponse.json({ ok: true });
};
