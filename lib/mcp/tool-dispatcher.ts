import type { Manifest, ToolRow } from '@/lib/manifest/cache';

// Hackathon shortcut: tools imported from OpenAPI don't proxy to a real
// origin yet — the dispatcher returns PII-rich canned data keyed by the
// tool's name. Gives the policy demo concrete output to redact without
// standing up an upstream service.

const DEMO_CUSTOMER = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'Jane Doe',
  email: 'jane.doe@acme.example',
  phone: '555-867-5309',
  ssn: '123-45-6789',
  address: '42 Example St, Oakland CA 94607',
} as const;

export const mockExecuteTool = (toolName: string, args: Record<string, unknown>): unknown => {
  const lowered = toolName.toLowerCase();

  if (lowered.includes('searchcustomer')) {
    return {
      customers: [
        DEMO_CUSTOMER,
        {
          id: '22222222-2222-2222-2222-222222222222',
          name: 'John Smith',
          email: 'john.smith@acme.example',
          phone: '555-111-2222',
        },
      ],
    };
  }

  if (lowered.includes('customer') && (lowered.includes('order') || lowered.includes('listcustomer'))) {
    return {
      customerId: args.customerId ?? DEMO_CUSTOMER.id,
      orders: [
        { id: 'ord_001', placed_at: '2026-04-15T14:22:00Z', total_usd: 42.0 },
        { id: 'ord_002', placed_at: '2026-04-19T09:05:00Z', total_usd: 128.5 },
      ],
    };
  }

  if (lowered.includes('customer')) {
    return DEMO_CUSTOMER;
  }

  if (lowered.includes('ticket')) {
    return {
      ticket_id: 'tkt_abc123',
      status: 'open',
      customerId: args.customerId ?? DEMO_CUSTOMER.id,
      opened_by: 'demo@semantic-gps.dev',
    };
  }

  if (lowered.includes('email') || lowered.includes('send')) {
    return {
      sent: true,
      message_id: 'msg_abc123',
      to: args.to ?? DEMO_CUSTOMER.email,
      preview: 'Your order has been confirmed…',
    };
  }

  return { ok: true, tool: toolName, args };
};

export type ToolCatalogEntry = {
  source: 'builtin' | 'manifest';
  tool_id: string;
  server_id: string;
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
};

export const ECHO_ENTRY: ToolCatalogEntry = {
  source: 'builtin',
  tool_id: 'builtin:echo',
  server_id: 'builtin',
  name: 'echo',
  description: 'Echoes the provided message back. Used to verify the gateway is alive.',
  input_schema: {
    type: 'object',
    properties: { message: { type: 'string', minLength: 1, description: 'Text to echo back' } },
    required: ['message'],
  },
};

export const buildCatalog = (manifest: Manifest): ToolCatalogEntry[] => {
  const fromManifest: ToolCatalogEntry[] = manifest.tools.map((t: ToolRow) => ({
    source: 'manifest',
    tool_id: t.id,
    server_id: t.server_id,
    name: t.name,
    description: t.description ?? '',
    input_schema: (t.input_schema as Record<string, unknown>) ?? { type: 'object' },
  }));
  return [ECHO_ENTRY, ...fromManifest];
};
