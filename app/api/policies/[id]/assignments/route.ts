import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, UnauthorizedError } from '@/lib/auth';
import { invalidateManifest } from '@/lib/manifest/cache';
import {
  verifyAssignmentTarget,
  verifyPolicyOrg,
  verifyResultToResponse,
} from '@/lib/policies/assignments';

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

  const body = (await request.json().catch(() => null)) as unknown;
  const parsedBody = CreateBody.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'invalid body', details: parsedBody.error.flatten() },
      { status: 400 },
    );
  }

  const { server_id, tool_id } = parsedBody.data;

  const targetErr = verifyResultToResponse(
    await verifyAssignmentTarget(supabase, organization_id, { server_id, tool_id }),
  );
  if (targetErr) return targetErr;

  const policyErr = verifyResultToResponse(
    await verifyPolicyOrg(supabase, parsedParams.data.id, organization_id),
  );
  if (policyErr) return policyErr;

  const { data, error } = await supabase
    .from('policy_assignments')
    .insert({
      organization_id,
      policy_id: parsedParams.data.id,
      server_id: server_id ?? null,
      tool_id: tool_id ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    const msg = error instanceof Error ? error.message : 'unknown error';
    return NextResponse.json({ error: 'assign failed', details: msg }, { status: 500 });
  }

  invalidateManifest();
  return NextResponse.json({ assignment: data }, { status: 201 });
};
