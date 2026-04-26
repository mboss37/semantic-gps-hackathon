import type { SupabaseClient } from '@supabase/supabase-js';

// Importable helper, NOT a CLI runner. Invoked from J.3 and demo-setup flows
// to register the GitHub vendor MCP. After Sprint 15 WP-C.6 the GitHub proxy
// lives as a Next.js route under `app/api/mcps/github/route.ts`; this helper
// registers it into the gateway via the standard http-streamable transport
// path. Credentials live in env vars on the same deployment, so `auth_config`
// stays null.

type Args = {
  organization_id: string;
  // Optional domain binding so the server shows up under the right scoped
  // gateway. J.3 resolves the domain_id before calling.
  domain_id?: string | null;
  // Absolute URL of the vendor MCP route. Defaults to the co-deployed route.
  // Override for tests or a future standalone extraction.
  origin_url?: string;
  // Display name, defaults to "Demo GitHub".
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

const DEFAULT_ORIGIN_URL = 'http://localhost:3000/api/mcps/github';

export const registerGithubServer = async (
  supabase: SupabaseClient,
  {
    organization_id,
    domain_id = null,
    origin_url = DEFAULT_ORIGIN_URL,
    name = 'Demo GitHub',
  }: Args,
): Promise<string> => {
  const { data: server, error: serverErr } = await supabase
    .from('servers')
    .insert({
      organization_id,
      domain_id,
      name,
      origin_url,
      transport: 'http-streamable',
      auth_config: null,
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
