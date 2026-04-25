// Sprint 24 WP-24.1 — client snippet templates for /dashboard/connect.
// Every template uses a `tools/list` call as the canonical "did this work?"
// probe — universal across MCP clients, no per-tool customization needed.
// `<TOKEN>` placeholder is intentional: plaintext only exists in the user's
// clipboard at mint time, never server-side. We never auto-fill secrets.

export type SnippetInput = {
  endpoint: string;
  token: string;
  serverSlug: string;
};

export const TOKEN_PLACEHOLDER = '<YOUR_GATEWAY_TOKEN — mint at /dashboard/tokens>';

export const curlSnippet = ({ endpoint, token }: SnippetInput): string =>
  `curl -X POST '${endpoint}' \\
  -H 'Authorization: Bearer ${token}' \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

export const claudeDesktopSnippet = ({ endpoint, token, serverSlug }: SnippetInput): string => {
  const config = {
    mcpServers: {
      [serverSlug]: {
        transport: 'http-streamable',
        url: endpoint,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    },
  };
  return JSON.stringify(config, null, 2);
};

export const inspectorSnippet = ({ endpoint, token }: SnippetInput): string =>
  `npx @modelcontextprotocol/inspector \\
  --cli \\
  --transport http \\
  --server-url '${endpoint}' \\
  --header 'Authorization: Bearer ${token}' \\
  --method tools/list`;

// Mirrors the canonical pattern from app/api/playground/run/route.ts —
// `mcp_servers` lives on the beta API, requires the `mcp-client-2025-11-20`
// beta header, and the paired `mcp_toolset` tool entry to actually expose
// the upstream tools to the model.
export const anthropicSdkSnippet = ({ endpoint, token, serverSlug }: SnippetInput): string =>
  `import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();

const response = await client.beta.messages.create({
  model: 'claude-opus-4-7',
  max_tokens: 1024,
  betas: ['mcp-client-2025-11-20'],
  mcp_servers: [
    {
      name: '${serverSlug}',
      type: 'url',
      url: '${endpoint}',
      authorization_token: '${token}',
    },
  ],
  tools: [
    {
      type: 'mcp_toolset',
      mcp_server_name: '${serverSlug}',
    },
  ],
  messages: [{ role: 'user', content: 'List the tools available.' }],
});`;
