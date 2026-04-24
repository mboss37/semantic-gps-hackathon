import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

type ToolRow = {
  id: string;
  server_id: string;
  servers: { organization_id: string } | null;
};

type ServerRow = { id: string; organization_id: string };

export type VerifyResult =
  | { ok: true }
  | { ok: false; status: number; error: string; details?: string };

export const verifyResultToResponse = (r: VerifyResult): Response | null => {
  if (r.ok) return null;
  const body: Record<string, unknown> = { error: r.error };
  if (r.details) body.details = r.details;
  return NextResponse.json(body, { status: r.status });
};

const verifyToolTarget = async (
  supabase: SupabaseClient,
  orgId: string,
  toolId: string,
  serverId?: string,
): Promise<VerifyResult> => {
  const { data: toolData, error: toolErr } = await supabase
    .from('tools')
    .select('id, server_id, servers!inner(organization_id)')
    .eq('id', toolId)
    .maybeSingle();
  if (toolErr) {
    return { ok: false, status: 500, error: 'load failed', details: toolErr.message };
  }
  const tool = toolData as unknown as ToolRow | null;
  if (!tool || tool.servers?.organization_id !== orgId) {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  if (serverId && serverId !== tool.server_id) {
    return { ok: false, status: 400, error: 'invalid body', details: 'server_id does not own tool_id' };
  }
  return { ok: true };
};

const verifyServerTarget = async (
  supabase: SupabaseClient,
  orgId: string,
  serverId: string,
): Promise<VerifyResult> => {
  const { data: srvData, error: srvErr } = await supabase
    .from('servers')
    .select('id, organization_id')
    .eq('id', serverId)
    .maybeSingle();
  if (srvErr) {
    return { ok: false, status: 500, error: 'load failed', details: srvErr.message };
  }
  const srv = srvData as ServerRow | null;
  if (!srv || srv.organization_id !== orgId) {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  return { ok: true };
};

export const verifyAssignmentTarget = async (
  supabase: SupabaseClient,
  orgId: string,
  target: { server_id?: string; tool_id?: string },
): Promise<VerifyResult> => {
  if (target.tool_id) return verifyToolTarget(supabase, orgId, target.tool_id, target.server_id);
  if (target.server_id) return verifyServerTarget(supabase, orgId, target.server_id);
  return { ok: true };
};

export const verifyPolicyOrg = async (
  supabase: SupabaseClient,
  policyId: string,
  orgId: string,
): Promise<VerifyResult> => {
  const { data: policyRow, error: policyErr } = await supabase
    .from('policies')
    .select('id, organization_id')
    .eq('id', policyId)
    .maybeSingle();
  if (policyErr) {
    return {
      ok: false,
      status: 500,
      error: 'load failed',
      details: policyErr.message,
    };
  }
  if (!policyRow || policyRow.organization_id !== orgId) {
    return { ok: false, status: 403, error: 'forbidden' };
  }
  return { ok: true };
};
