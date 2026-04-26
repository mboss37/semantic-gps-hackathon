import type { SupabaseClient } from '@supabase/supabase-js';

// Importable helper, NOT a CLI runner. Invoked from J.3 and demo-setup flows
// to register the Salesforce vendor MCP. After Sprint 15 WP-C.6 the SF proxy
// lives as a Next.js route under `app/api/mcps/salesforce/route.ts`; this
// helper registers it into the gateway via the standard http-streamable
// transport path. Credentials live in env vars on the same deployment, so
// `auth_config` stays null.

type Args = {
  organization_id: string;
  // Optional domain binding so the server shows up under the right scoped
  // gateway (e.g. SalesOps). J.3 resolves the domain_id before calling.
  domain_id?: string | null;
  // Absolute URL of the vendor MCP route. Defaults to the co-deployed route.
  // Override for tests or a future standalone extraction.
  origin_url?: string;
  // Display name, defaults to "Demo Salesforce" so the dashboard row stays
  // recognizable at a glance.
  name?: string;
};

type ToolSeed = {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

const TOOL_SEEDS: ToolSeed[] = [
  {
    name: 'find_account',
    description: 'Search Salesforce Accounts by name substring (max 5 results).',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, description: 'Account name substring to search for' },
      },
      required: ['query'],
    },
  },
  {
    name: 'find_contact',
    description: 'Look up a Salesforce Contact by exact email.',
    input_schema: {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email', description: 'Contact email (exact match)' },
      },
      required: ['email'],
    },
  },
  {
    name: 'get_opportunity',
    description: 'Fetch a Salesforce Opportunity by 15- or 18-char Id.',
    input_schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          pattern: '^[a-zA-Z0-9]{15,18}$',
          description: 'Salesforce Opportunity Id',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_opportunity_stage',
    description: 'Update the StageName on a Salesforce Opportunity.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Salesforce Opportunity Id' },
        stage: { type: 'string', description: 'New stage name (e.g. "Prospecting", "Closed Won")' },
      },
      required: ['id', 'stage'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a Salesforce Task with status "Not Started" linked to a WhatId.',
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Task subject line' },
        whatId: { type: 'string', description: 'Related Salesforce record Id (Account, Opportunity, etc.)' },
      },
      required: ['subject', 'whatId'],
    },
  },
  {
    name: 'delete_task',
    description: 'Delete a Salesforce Task by Id. Compensator for create_task on saga rollback.',
    input_schema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          pattern: '^[a-zA-Z0-9]{15,18}$',
          description: 'Salesforce Task Id',
        },
      },
      required: ['id'],
    },
  },
];

const DEFAULT_ORIGIN_URL = 'http://localhost:3000/api/mcps/salesforce';

export const registerSalesforceServer = async (
  supabase: SupabaseClient,
  {
    organization_id,
    domain_id = null,
    origin_url = DEFAULT_ORIGIN_URL,
    name = 'Demo Salesforce',
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
    throw new Error(`register salesforce server failed: ${serverErr?.message ?? 'no row returned'}`);
  }

  const rows = TOOL_SEEDS.map((t) => ({
    server_id: server.id,
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  const { error: toolsErr } = await supabase.from('tools').insert(rows);
  if (toolsErr) {
    throw new Error(`register salesforce tools failed: ${toolsErr.message}`);
  }

  return server.id as string;
};
