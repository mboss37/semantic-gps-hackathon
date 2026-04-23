import type Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/service';
import { proxySalesforce } from '@/lib/mcp/proxy-salesforce';
import { proxySlack } from '@/lib/mcp/proxy-slack';
import { proxyGithub } from '@/lib/mcp/proxy-github';
import type { ToolRow } from '@/lib/manifest/cache';

// Raw MCP dispatch for the left Playground pane. Same real upstreams as the
// gateway (SF / Slack / GitHub — encrypted auth_config, safeFetch, the works),
// but WITHOUT the control plane wrapped around them:
//   - no pre-call policies (no PII redaction, no allowlist, no injection-guard)
//   - no relationship graph hinting in the tool descriptions
//   - no rollback on failure
//   - no mcp_events audit
//   - no shadow/enforce mode toggle
//
// The contrast is the pitch. Both panes burn the same API quota and land real
// side effects — duplicate issues, duplicate Slack posts — because that IS
// what happens when agents touch raw MCPs without a gateway in front.

// Curated subset (3 of 12). Descriptions are deliberately bare: no mention of
// Account.Id flowing into find_contact, no hint that PII lives in responses,
// no suggestion to close an issue if the route halts. Opus has to figure out
// the workflow on its own with no graph to lean on.
export const RAW_TOOL_DEFS: Anthropic.Messages.Tool[] = [
  {
    name: 'find_contact',
    description: 'Look up a customer contact by email address.',
    input_schema: {
      type: 'object',
      properties: { email: { type: 'string' } },
      required: ['email'],
    },
  },
  {
    name: 'create_issue',
    description: 'Create a GitHub issue.',
    input_schema: {
      type: 'object',
      properties: {
        owner: { type: 'string' },
        repo: { type: 'string' },
        title: { type: 'string' },
        body: { type: 'string' },
      },
      required: ['owner', 'repo', 'title'],
    },
  },
  {
    name: 'chat_post_message',
    description: 'Post a message to a Slack channel.',
    input_schema: {
      type: 'object',
      properties: {
        channel: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['channel', 'text'],
    },
  },
];

type DispatchResult = { content: string; is_error: boolean };

export const dispatchRawTool = async (
  organizationId: string,
  toolName: string,
  args: Record<string, unknown>,
  traceId: string,
): Promise<DispatchResult> => {
  const supabase = createServiceClient();
  const { data: toolRow, error: toolErr } = await supabase
    .from('tools')
    .select('id, server_id, name, description, input_schema, display_name, display_description, servers!inner(id, organization_id, transport)')
    .eq('name', toolName)
    .eq('servers.organization_id', organizationId)
    .maybeSingle();

  if (toolErr || !toolRow) {
    return {
      content: JSON.stringify({ error: 'tool_not_found', tool: toolName }),
      is_error: true,
    };
  }

  const joined = toolRow as unknown as ToolRow & {
    servers: { id: string; organization_id: string; transport: string };
  };
  const tool: ToolRow = {
    id: joined.id,
    server_id: joined.server_id,
    name: joined.name,
    description: joined.description,
    input_schema: joined.input_schema,
    display_name: joined.display_name,
    display_description: joined.display_description,
  };
  const ctx = { serverId: joined.server_id, traceId };

  const transport = joined.servers.transport;
  let result;
  if (transport === 'salesforce') {
    result = await proxySalesforce(tool, args, ctx);
  } else if (transport === 'slack') {
    result = await proxySlack(tool, args, ctx);
  } else if (transport === 'github') {
    result = await proxyGithub(tool, args, ctx);
  } else {
    return {
      content: JSON.stringify({ error: 'unsupported_transport', transport }),
      is_error: true,
    };
  }

  if (result.ok) {
    return { content: JSON.stringify(result.result), is_error: false };
  }
  return {
    content: JSON.stringify({ error: result.error, status: result.status }),
    is_error: true,
  };
};
