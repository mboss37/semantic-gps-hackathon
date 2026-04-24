import { randomBytes } from 'node:crypto';
import { hashToken } from '@/lib/mcp/auth-token';

const PLAYGROUND_SYSTEM_TOKEN_NAME = 'playground-internal';

export const mintPlaygroundToken = async (
  organization_id: string,
): Promise<{ plaintext: string; id: string } | null> => {
  const { createServiceClient } = await import('@/lib/supabase/service');
  const supabase = createServiceClient();

  const { data: existing, error: selectError } = await supabase
    .from('gateway_tokens')
    .select('id, token_plaintext')
    .eq('organization_id', organization_id)
    .eq('kind', 'system')
    .eq('name', PLAYGROUND_SYSTEM_TOKEN_NAME)
    .maybeSingle();
  if (selectError) return null;
  if (existing && typeof existing.token_plaintext === 'string') {
    return { plaintext: existing.token_plaintext, id: existing.id as string };
  }

  const plaintext = `sgps_${randomBytes(32).toString('hex')}`;
  const token_hash = hashToken(plaintext);
  const { data, error } = await supabase
    .from('gateway_tokens')
    .insert({
      organization_id,
      token_hash,
      token_plaintext: plaintext,
      name: PLAYGROUND_SYSTEM_TOKEN_NAME,
      kind: 'system',
    })
    .select('id')
    .single();
  if (error || !data) return null;
  return { plaintext, id: data.id as string };
};
