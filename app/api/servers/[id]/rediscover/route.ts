// POST /api/servers/[id]/rediscover — re-runs tools/list against the origin
// and syncs the `tools` table via name-keyed diff. Preserves user-set
// `display_name` / `display_description` overrides (G.6) by only updating
// `description` + `input_schema` on existing rows. Stale tools (present in
// DB, absent from discovery) are counted but not deleted — deletion would
// orphan routes/policies; operators can handle explicit cleanup later.

import type { SupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';
import { discoverTools, type DiscoveredTool } from '@/lib/mcp/discover-tools';
import { decodeAuthConfig } from '@/lib/servers/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });

type ExistingToolRow = {
  id: string;
  name: string;
  display_name: string | null;
  display_description: string | null;
};

type InsertRow = {
  server_id: string;
  name: string;
  description: string | null;
  input_schema: Record<string, unknown> | null;
};

type UpdateRow = {
  id: string;
  description: string | null;
  input_schema: Record<string, unknown> | null;
};

type DiffBuckets = {
  toInsert: InsertRow[];
  toUpdate: UpdateRow[];
  stale: number;
};

type LoadedServer = { id: string; origin_url: string; auth_config: unknown };

type LoadResult =
  | { ok: true; server: LoadedServer }
  | { ok: false; response: Response };

type ApplyResult = { ok: true } | { ok: false; response: Response };

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

const diffTools = (
  serverId: string,
  existing: ExistingToolRow[],
  discovered: DiscoveredTool[],
): DiffBuckets => {
  const existingByName = new Map<string, ExistingToolRow>();
  for (const row of existing) existingByName.set(row.name, row);

  const toInsert: InsertRow[] = [];
  const toUpdate: UpdateRow[] = [];
  const discoveredNames = new Set<string>();

  for (const tool of discovered) {
    discoveredNames.add(tool.name);
    const existingRow = existingByName.get(tool.name);
    const description = tool.description ?? null;
    const input_schema = tool.inputSchema ?? null;
    if (existingRow) {
      toUpdate.push({ id: existingRow.id, description, input_schema });
    } else {
      toInsert.push({ server_id: serverId, name: tool.name, description, input_schema });
    }
  }

  const stale = existing.filter((e) => !discoveredNames.has(e.name)).length;
  return { toInsert, toUpdate, stale };
};

const applyDiff = async (
  supabase: SupabaseClient,
  toInsert: InsertRow[],
  toUpdate: UpdateRow[],
): Promise<ApplyResult> => {
  if (toInsert.length > 0) {
    const { error } = await supabase.from('tools').insert(toInsert);
    if (error) {
      return { ok: false, response: NextResponse.json({ error: 'insert failed' }, { status: 500 }) };
    }
  }
  const updateResults = await Promise.all(
    toUpdate.map((row) =>
      supabase
        .from('tools')
        .update({ description: row.description, input_schema: row.input_schema })
        .eq('id', row.id),
    ),
  );
  for (const r of updateResults) {
    if (r.error) {
      return { ok: false, response: NextResponse.json({ error: 'update failed' }, { status: 500 }) };
    }
  }
  return { ok: true };
};

export const POST = async (
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<Response> => {
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

  const parsed = ParamsSchema.safeParse(await ctx.params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid id' }, { status: 400 });
  }

  const loaded = await loadServer(supabase, organization_id, parsed.data.id);
  if (!loaded.ok) return loaded.response;
  const server = loaded.server;

  const auth = decodeAuthConfig(server.auth_config);
  const discovery = await discoverTools(server.origin_url, auth);
  if (!discovery.ok) {
    return NextResponse.json(
      { error: 'discovery_failed', reason: discovery.error },
      { status: 502 },
    );
  }

  const { data: existingRows, error: toolsErr } = await supabase
    .from('tools')
    .select('id, name, display_name, display_description')
    .eq('server_id', server.id);
  if (toolsErr) {
    return NextResponse.json({ error: 'load failed' }, { status: 500 });
  }

  const { toInsert, toUpdate, stale } = diffTools(
    server.id,
    (existingRows ?? []) as ExistingToolRow[],
    discovery.tools,
  );

  const applied = await applyDiff(supabase, toInsert, toUpdate);
  if (!applied.ok) return applied.response;

  invalidateManifest();
  return NextResponse.json(
    { added: toInsert.length, updated: toUpdate.length, stale },
    { status: 200 },
  );
};
