import type { SupabaseClient } from '@supabase/supabase-js';
import { encrypt } from '@/lib/crypto/encrypt';
import type { GithubAuthConfig } from '@/lib/mcp/proxy-github';

// Importable helper — NOT a CLI runner. Invoked from J.3 (and the dev
// console during demo setup) to register the hero GitHub server + its 4
// curated tools. Credentials are encrypted via the same AES-GCM envelope used
// by `/api/servers` so the manifest cache decode path is identical.

type Args = {
  organization_id: string;
  credentials: GithubAuthConfig;
  // Optional domain binding so the server shows up under the right scoped
  // gateway (e.g. EngOps). J.3 resolves the domain_id before calling.
  domain_id?: string | null;
  // Optional name override — defaults to "Demo GitHub" so the dashboard
  // row is recognizable at a glance.
  name?: string;
};

type ToolSeed = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

const TOOL_SEEDS: ToolSeed[] = [
  {
    name: 'search_issues',
    description:
      'Search GitHub issues + PRs via the REST /search/issues endpoint. Accepts the full GitHub search qualifier syntax (e.g. "repo:owner/name is:issue is:open").',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          minLength: 1,
          maxLength: 500,
          description: 'GitHub search query (qualifiers allowed, e.g. "repo:owner/name is:issue is:open")',
        },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 100,
          description: 'Max results to return (default 10)',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'create_issue',
    description: 'Open a new issue on a GitHub repository.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (username or org)' },
        repo: { type: 'string', description: 'Repository name' },
        title: {
          type: 'string',
          minLength: 1,
          maxLength: 256,
          description: 'Issue title',
        },
        body: {
          type: 'string',
          maxLength: 65536,
          description: 'Issue body (GitHub-flavored markdown)',
        },
        labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Labels to apply on creation',
        },
      },
      required: ['owner', 'repo', 'title'],
    },
  },
  {
    name: 'add_comment',
    description: 'Add a comment to an existing GitHub issue or pull request.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (username or org)' },
        repo: { type: 'string', description: 'Repository name' },
        issue_number: {
          type: 'integer',
          minimum: 1,
          description: 'Issue or PR number',
        },
        body: {
          type: 'string',
          minLength: 1,
          maxLength: 65536,
          description: 'Comment body (GitHub-flavored markdown)',
        },
      },
      required: ['owner', 'repo', 'issue_number', 'body'],
    },
  },
  {
    name: 'close_issue',
    description: 'Close an existing GitHub issue by setting state=closed.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string', description: 'Repository owner (username or org)' },
        repo: { type: 'string', description: 'Repository name' },
        issue_number: {
          type: 'integer',
          minimum: 1,
          description: 'Issue number to close',
        },
      },
      required: ['owner', 'repo', 'issue_number'],
    },
  },
];

export const registerGithubServer = async (
  supabase: SupabaseClient,
  { organization_id, credentials, domain_id = null, name = 'Demo GitHub' }: Args,
): Promise<string> => {
  const auth_config = { ciphertext: encrypt(JSON.stringify(credentials)) };

  const { data: server, error: serverErr } = await supabase
    .from('servers')
    .insert({
      organization_id,
      domain_id,
      name,
      origin_url: 'https://api.github.com',
      transport: 'github',
      auth_config,
    })
    .select('id')
    .single();

  if (serverErr || !server) {
    throw new Error(`register github server failed: ${serverErr?.message ?? 'no row returned'}`);
  }

  const rows = TOOL_SEEDS.map((t) => ({
    server_id: server.id,
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  const { error: toolsErr } = await supabase.from('tools').insert(rows);
  if (toolsErr) {
    throw new Error(`register github tools failed: ${toolsErr.message}`);
  }

  return server.id as string;
};
