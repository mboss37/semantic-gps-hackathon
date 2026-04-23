import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';

// Sprint 9 WP-G.9: tool-level assignments. Body still accepts {server_id?,
// tool_id?} but we now enforce that every referenced id resolves to the
// caller's org (same pattern as app/api/relationships/route.ts). A tool_id
// whose parent server lives in another org is rejected with 403 — otherwise
// an attacker could enumerate policies against cross-org tools.

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });

const CreateBody = z
  .object({
    server_id: z.string().uuid().optional(),
    tool_id: z.string().uuid().optional(),
  })
  .refine((v) => v.server_id !== undefined || v.tool_id !== undefined, {
    message: 'either server_id or tool_id is required',
  });

const unauthorized = (): Response =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 });

type ToolRow = {
  id: string;
  server_id: string;
  servers: { organization_id: string } | null;
};

type ServerRow = { id: string; organization_id: string };

export const POST = async (
  request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const parsedParams = ParamsSchema.safeParse(await ctx.params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'invalid policy id' }, { status: 400 });
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsedBody = CreateBody.safeParse(json);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'invalid body', details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const { server_id, tool_id } = parsedBody.data;

  // Org-scope check for tool_id: walk tool -> server -> organization_id.
  if (tool_id) {
    const { data: toolData, error: toolErr } = await supabase
      .from('tools')
      .select('id, server_id, servers!inner(organization_id)')
      .eq('id', tool_id)
      .maybeSingle();
    if (toolErr) {
      return NextResponse.json(
        { error: 'load failed', details: toolErr.message },
        { status: 500 },
      );
    }
    const tool = toolData as unknown as ToolRow | null;
    if (!tool || tool.servers?.organization_id !== organization_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    // If a server_id was also provided, it must match the tool's parent.
    if (server_id && server_id !== tool.server_id) {
      return NextResponse.json(
        { error: 'invalid body', details: 'server_id does not own tool_id' },
        { status: 400 },
      );
    }
  } else if (server_id) {
    // Org-scope check for pure server scope.
    const { data: srvData, error: srvErr } = await supabase
      .from('servers')
      .select('id, organization_id')
      .eq('id', server_id)
      .maybeSingle();
    if (srvErr) {
      return NextResponse.json(
        { error: 'load failed', details: srvErr.message },
        { status: 500 },
      );
    }
    const srv = srvData as ServerRow | null;
    if (!srv || srv.organization_id !== organization_id) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  }

  const { data, error } = await supabase
    .from('policy_assignments')
    .insert({
      policy_id: parsedParams.data.id,
      server_id: server_id ?? null,
      tool_id: tool_id ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'assign failed', details: error?.message },
      { status: 500 },
    );
  }

  invalidateManifest();
  return NextResponse.json({ assignment: data }, { status: 201 });
};
