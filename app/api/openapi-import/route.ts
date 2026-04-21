import { NextResponse } from 'next/server';
import { z } from 'zod';
import { encrypt } from '@/lib/crypto/encrypt';
import { invalidateManifest } from '@/lib/manifest/cache';
import { openApiToTools, type OpenApiSpec } from '@/lib/openapi/to-tools';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { safeFetch, SsrfBlockedError } from '@/lib/security/ssrf-guard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    url: z.string().url().optional(),
    spec: z.unknown().optional(),
    name: z.string().min(1).max(200).optional(),
    auth_config: z.record(z.string(), z.string()).optional(),
  })
  .refine((v) => v.url !== undefined || v.spec !== undefined, {
    message: 'either `url` or `spec` is required',
  });

export const POST = async (request: Request): Promise<Response> => {
  let user;
  let supabase;
  try {
    ({ user, supabase } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    throw e;
  }

  const json = (await request.json().catch(() => null)) as unknown;
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  let spec: OpenApiSpec;
  if (parsed.data.spec !== undefined) {
    spec = parsed.data.spec as OpenApiSpec;
  } else if (parsed.data.url) {
    try {
      const res = await safeFetch(parsed.data.url, { timeoutMs: 15_000 });
      if (!res.ok) {
        return NextResponse.json(
          { error: 'origin fetch failed', status: res.status },
          { status: 502 },
        );
      }
      spec = (await res.json()) as OpenApiSpec;
    } catch (e) {
      if (e instanceof SsrfBlockedError) {
        return NextResponse.json({ error: 'ssrf_blocked', reason: e.code }, { status: 400 });
      }
      return NextResponse.json(
        { error: e instanceof Error ? e.message : 'fetch failed' },
        { status: 502 },
      );
    }
  } else {
    return NextResponse.json({ error: 'no spec source' }, { status: 400 });
  }

  const tools = openApiToTools(spec);
  if (tools.length === 0) {
    return NextResponse.json({ error: 'spec has no operations' }, { status: 422 });
  }

  const name = parsed.data.name ?? spec.info?.title ?? 'Imported OpenAPI server';
  const originUrl = parsed.data.url ?? null;
  const encryptedAuth = parsed.data.auth_config
    ? { ciphertext: encrypt(JSON.stringify(parsed.data.auth_config)) }
    : null;

  const { data: inserted, error: serverErr } = await supabase
    .from('servers')
    .insert({
      user_id: user.id,
      name,
      origin_url: originUrl,
      transport: 'openapi',
      openapi_spec: spec,
      auth_config: encryptedAuth,
    })
    .select('id')
    .single();

  if (serverErr || !inserted) {
    return NextResponse.json(
      { error: 'failed to create server', details: serverErr?.message },
      { status: 500 },
    );
  }

  const toolRows = tools.map((t) => ({
    server_id: inserted.id,
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
  const { error: toolsErr } = await supabase.from('tools').insert(toolRows);
  if (toolsErr) {
    await supabase.from('servers').delete().eq('id', inserted.id);
    return NextResponse.json(
      { error: 'failed to insert tools', details: toolsErr.message },
      { status: 500 },
    );
  }

  invalidateManifest();
  return NextResponse.json(
    { server_id: inserted.id, name, tool_count: tools.length },
    { status: 201 },
  );
};
