// GET  /api/servers/[id]/rediscover — dry-run preview (diff without writing)
// POST /api/servers/[id]/rediscover — re-runs tools/list against the origin
// and syncs the `tools` table via name-keyed upsert on (server_id, name).
// Preserves user-set `display_name` / `display_description` overrides (G.6)
// by only upserting `description` + `input_schema`. Stale tools (present in
// DB, absent from discovery) are counted but not deleted — deletion would
// orphan routes/policies; operators can handle explicit cleanup later.

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';
import { discoverTools, type DiscoveredTool, type DiscoverAuth } from '@/lib/mcp/discover-tools';
import { decodeAuthConfig } from '@/lib/servers/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });

type ExistingToolRow = {
  id: string;
  name: string;
  description: string | null;
  input_schema: Record<string, unknown> | null;
  display_name: string | null;
  display_description: string | null;
};

type PreviewTool = { name: string; description: string | null };

type PreviewUpdate = {
  name: string;
  old: { description: string | null };
  new: { description: string | null };
};

type DiffPreview = {
  toAdd: PreviewTool[];
  toUpdate: PreviewUpdate[];
  stale: PreviewTool[];
};

type UpsertRow = {
  server_id: string;
  name: string;
  description: string | null;
  input_schema: Record<string, unknown> | null;
};

type LoadedServer = { id: string; origin_url: string; auth_config: unknown };

type LoadResult =
  | { ok: true; server: LoadedServer }
  | { ok: false; response: Response };

const loadServer = async (
  supabase: SupabaseClient,
  organizationId: string,
  id: string,
): Promise<LoadResult> => {
  const { data, error } = await supabase
    .from('servers')
    .select('id, origin_url, auth_config, organization_id')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    return { ok: false, response: NextResponse.json({ error: 'load failed' }, { status: 500 }) };
  }
  if (!data || data.organization_id !== organizationId) {
    return { ok: false, response: NextResponse.json({ error: 'not found' }, { status: 404 }) };
  }
  if (!data.origin_url) {
    return { ok: false, response: NextResponse.json({ error: 'no_origin' }, { status: 400 }) };
  }
  return {
    ok: true,
    server: { id: data.id, origin_url: data.origin_url, auth_config: data.auth_config },
  };
};

type ComputedDiff = {
  preview: DiffPreview;
  upsertRows: UpsertRow[];
};

const computeDiff = (
  serverId: string,
  existing: ExistingToolRow[],
  discovered: DiscoveredTool[],
): ComputedDiff => {
  const existingByName = new Map<string, ExistingToolRow>();
  for (const row of existing) existingByName.set(row.name, row);

  const toAdd: PreviewTool[] = [];
  const toUpdate: PreviewUpdate[] = [];
  const upsertRows: UpsertRow[] = [];
  const discoveredNames = new Set<string>();

  for (const tool of discovered) {
    discoveredNames.add(tool.name);
    const description = tool.description ?? null;
    const input_schema = (tool.inputSchema as Record<string, unknown> | undefined) ?? null;
    const existingRow = existingByName.get(tool.name);

    upsertRows.push({ server_id: serverId, name: tool.name, description, input_schema });

    if (existingRow) {
      toUpdate.push({
        name: tool.name,
        old: { description: existingRow.description },
        new: { description },
      });
    } else {
      toAdd.push({ name: tool.name, description });
    }
  }

  const stale: PreviewTool[] = existing
    .filter((e) => !discoveredNames.has(e.name))
    .map((e) => ({ name: e.name, description: e.description }));

  return { preview: { toAdd, toUpdate, stale }, upsertRows };
};

type DiscoverContext = {
  supabase: SupabaseClient;
  organizationId: string;
  serverId: string;
};

type DiscoverResult =
  | { ok: true; server: LoadedServer; existing: ExistingToolRow[]; discovered: DiscoveredTool[] }
  | { ok: false; response: Response };

const discover = async (ctx: DiscoverContext): Promise<DiscoverResult> => {
  const loaded = await loadServer(ctx.supabase, ctx.organizationId, ctx.serverId);
  if (!loaded.ok) return loaded;
  const server = loaded.server;

  const fullAuth = decodeAuthConfig(server.auth_config);
  const auth: DiscoverAuth = fullAuth.type === 'bearer' ? fullAuth : { type: 'none' };
  const discovery = await discoverTools(server.origin_url, auth);
  if (!discovery.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'discovery_failed', reason: discovery.error },
        { status: 502 },
      ),
    };
  }

  const { data: existingRows, error: toolsErr } = await ctx.supabase
    .from('tools')
    .select('id, name, description, input_schema, display_name, display_description')
    .eq('server_id', server.id);
  if (toolsErr) {
    return { ok: false, response: NextResponse.json({ error: 'load failed' }, { status: 500 }) };
  }

  return {
    ok: true,
    server,
    existing: (existingRows ?? []) as ExistingToolRow[],
    discovered: discovery.tools,
  };
};

const authenticateAndParseParams = async (
  params: Promise<{ id: string }>,
): Promise<
  | { ok: true; supabase: SupabaseClient; organizationId: string; serverId: string }
  | { ok: false; response: Response }
> => {
  let supabase: SupabaseClient;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return { ok: false, response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
    }
    throw e;
  }

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) {
    return { ok: false, response: NextResponse.json({ error: 'invalid id' }, { status: 400 }) };
  }

  return { ok: true, supabase, organizationId: organization_id, serverId: parsed.data.id };
};

export const GET = async (
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const authResult = await authenticateAndParseParams(ctx.params);
  if (!authResult.ok) return authResult.response;

  const result = await discover(authResult);
  if (!result.ok) return result.response;

  const { preview } = computeDiff(result.server.id, result.existing, result.discovered);
  return NextResponse.json(preview, { status: 200 });
};

export const POST = async (
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> => {
  const authResult = await authenticateAndParseParams(ctx.params);
  if (!authResult.ok) return authResult.response;

  const result = await discover(authResult);
  if (!result.ok) return result.response;

  const { preview, upsertRows } = computeDiff(
    result.server.id,
    result.existing,
    result.discovered,
  );

  if (upsertRows.length > 0) {
    const { error } = await authResult.supabase
      .from('tools')
      .upsert(upsertRows, { onConflict: 'server_id,name', ignoreDuplicates: false });
    if (error) {
      return NextResponse.json({ error: 'upsert failed' }, { status: 500 });
    }
  }

  invalidateManifest();
  return NextResponse.json(
    { added: preview.toAdd.length, updated: preview.toUpdate.length, stale: preview.stale.length },
    { status: 200 },
  );
};
