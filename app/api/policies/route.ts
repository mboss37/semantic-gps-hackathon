import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BUILTIN_KEYS = [
  'pii_redaction',
  'rate_limit',
  'allowlist',
  'injection_guard',
  'basic_auth',
  'client_id',
  'ip_allowlist',
  'business_hours',
  'write_freeze',
  'geo_fence',
  'agent_identity_required',
  'idempotency_required',
] as const;
const MODES = ['shadow', 'enforce'] as const;

const CreateBody = z.object({
  name: z.string().min(1).max(200),
  builtin_key: z.enum(BUILTIN_KEYS),
  config: z.record(z.string(), z.unknown()).optional(),
  enforcement_mode: z.enum(MODES).default('shadow'),
});

const unauthorized = (): Response =>
  NextResponse.json({ error: 'unauthorized' }, { status: 401 });

export const GET = async (): Promise<Response> => {
  let supabase;
  let organization_id: string;
  try {
    ({ supabase, organization_id } = await requireAuth());
  } catch (e) {
    if (e instanceof UnauthorizedError) return unauthorized();
    throw e;
  }

  const [policiesRes, assignmentsRes] = await Promise.all([
    supabase
      .from('policies')
      .select('*')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false }),
    supabase
      .from('policy_assignments')
      .select('*')
      .eq('organization_id', organization_id),
  ]);
  if (policiesRes.error || assignmentsRes.error) {
    return NextResponse.json(
      { error: 'load failed', details: policiesRes.error?.message ?? assignmentsRes.error?.message },
      { status: 500 },
    );
  }

  const assignmentsByPolicy = new Map<string, Array<{ id: string; server_id: string | null; tool_id: string | null }>>();
  for (const a of assignmentsRes.data ?? []) {
    const bucket = assignmentsByPolicy.get(a.policy_id) ?? [];
    bucket.push({ id: a.id, server_id: a.server_id, tool_id: a.tool_id });
    assignmentsByPolicy.set(a.policy_id, bucket);
  }

  return NextResponse.json({
    policies: (policiesRes.data ?? []).map((p) => ({
      ...p,
      assignments: assignmentsByPolicy.get(p.id) ?? [],
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

  const { data, error } = await supabase
    .from('policies')
    .insert({
      organization_id,
      name: parsed.data.name,
      builtin_key: parsed.data.builtin_key,
      config: parsed.data.config ?? {},
      enforcement_mode: parsed.data.enforcement_mode,
    })
    .select('*')
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: 'create failed', details: error?.message },
      { status: 500 },
    );
  }

  invalidateManifest();
  return NextResponse.json({ policy: data }, { status: 201 });
};
