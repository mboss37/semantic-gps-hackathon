import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';

// Sprint 6 WP-G.2: relationship CRUD. `relationships` has no org column, so
// scope is enforced by joining through `tools -> servers -> organization_id`
// on both endpoints. Cross-org tool IDs are rejected with 403 on POST; PATCH
// / DELETE treat missing + cross-org as 404 to avoid leaking existence.

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

const CreateBody = z.object({
  from_tool_id: z.string().uuid(),
  to_tool_id: z.string().uuid(),
  relationship_type: z.enum(RELATIONSHIP_TYPES),
  description: z.string().min(5).max(500),
});

const unauthorized = (): Response =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 });

type ToolRow = {
  id: string;
  server_id: string;
  name: string;
  servers: { organization_id: string } | null;
};

export const GET = async (): Promise<Response> => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  // Pull org-scoped tools first so we can intersect edges to only those with
  // BOTH endpoints inside the caller's org. A single query with two joins
  // would work but Supabase's nested join filter syntax gets hairy, two
  // round trips is simpler and still O(n).
  const { data: toolsData, error: toolsErr } = await supabase
    .from('tools')
    .select('id, server_id, name, servers!inner(organization_id)')
    .eq('servers.organization_id', organization_id);

  if (toolsErr) {
    return NextResponse.json(
      { error: 'load failed', details: toolsErr.message },
      { status: 500 },
    );
  }

  const tools = (toolsData ?? []) as unknown as ToolRow[];
  const toolIds = tools.map((t) => t.id);
  const toolNameById = new Map(tools.map((t) => [t.id, t.name]));

  if (toolIds.length === 0) {
    return NextResponse.json({ relationships: [] });
  }

  const { data: rels, error: relsErr } = await supabase
    .from('relationships')
    .select('id, from_tool_id, to_tool_id, relationship_type, description')
    .in('from_tool_id', toolIds)
    .in('to_tool_id', toolIds);

  if (relsErr) {
    return NextResponse.json(
      { error: 'load failed', details: relsErr.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    relationships: (rels ?? []).map((r) => ({
      ...r,
      from_tool_name: toolNameById.get(r.from_tool_id) ?? null,
      to_tool_name: toolNameById.get(r.to_tool_id) ?? null,
    })),
  });
};

export const POST = async (request: Request): Promise<Response> => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = CreateBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { from_tool_id, to_tool_id, relationship_type, description } = parsed.data;

  if (from_tool_id === to_tool_id) {
    return NextResponse.json(
      { error: 'self_loop', details: 'from_tool_id and to_tool_id must differ' },
      { status: 400 },
    );
  }

  // Org-scope check: both tools must resolve to servers in the caller's org.
  const { data: tools, error: toolsErr } = await supabase
    .from('tools')
    .select('id, server_id, servers!inner(organization_id)')
    .in('id', [from_tool_id, to_tool_id]);

  if (toolsErr) {
    return NextResponse.json(
      { error: 'load failed', details: toolsErr.message },
      { status: 500 },
    );
  }

  const toolList = (tools ?? []) as unknown as ToolRow[];
  const allInOrg =
    toolList.length === 2 &&
    toolList.every((t) => t.servers?.organization_id === organization_id);
  if (!allInOrg) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data, error } = await supabase
    .from('relationships')
    .insert({ from_tool_id, to_tool_id, relationship_type, description })
    .select('id, from_tool_id, to_tool_id, relationship_type, description')
    .single();

  if (error || !data) {
    // 23505 = unique_violation (from_tool, to_tool, type) already exists.
    if (error?.code === '23505') {
      return NextResponse.json(
        { error: 'duplicate', details: 'this relationship already exists' },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: 'create failed', details: error?.message },
      { status: 500 },
    );
  }

  invalidateManifest();
  return NextResponse.json({ relationship: data }, { status: 201 });
};
