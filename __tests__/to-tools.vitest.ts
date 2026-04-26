import { describe, expect, it } from 'vitest';
import { openApiToTools, type OpenApiSpec } from '@/lib/openapi/to-tools';

describe('openApiToTools', () => {
  it('prefers operationId over method+path fallback and keeps summary', () => {
    const spec: OpenApiSpec = {
      paths: {
        '/customers/search': {
          get: {
            operationId: 'searchCustomers',
            summary: 'Search customers.',
          },
        },
        '/widgets/{id}': {
          // No operationId, must fall back.
          delete: {
            summary: 'Remove a widget.',
            parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
          },
        },
      },
    };

    const tools = openApiToTools(spec);
    expect(tools).toHaveLength(2);
    const search = tools.find((t) => t.meta.path === '/customers/search');
    expect(search?.name).toBe('searchCustomers');
    expect(search?.description).toBe('Search customers.');
    const del = tools.find((t) => t.meta.path === '/widgets/{id}');
    expect(del?.name).toBe('delete_widgets_id');
    expect(del?.meta.operation_id).toBeUndefined();
  });

  it('maps path + query parameters to input properties and tracks required', () => {
    const spec: OpenApiSpec = {
      paths: {
        '/customers/{customerId}/orders': {
          get: {
            operationId: 'listOrders',
            parameters: [
              { name: 'customerId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
              { name: 'since', in: 'query', required: false, description: 'ISO timestamp', schema: { type: 'string', format: 'date-time' } },
              { name: 'x-trace', in: 'header', required: true, schema: { type: 'string' } },
            ],
          },
        },
      },
    };

    const [tool] = openApiToTools(spec);
    expect(Object.keys(tool.input_schema.properties)).toEqual(['customerId', 'since']);
    expect(tool.input_schema.required).toEqual(['customerId']);
    expect(tool.input_schema.properties.since).toMatchObject({
      type: 'string',
      format: 'date-time',
      description: 'ISO timestamp',
    });
    expect(tool.input_schema.properties).not.toHaveProperty('x-trace');
  });

  it('nests application/json requestBody under `body` and marks it required', () => {
    const spec: OpenApiSpec = {
      paths: {
        '/tickets': {
          post: {
            operationId: 'createTicket',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['subject'],
                    properties: {
                      subject: { type: 'string' },
                      priority: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    const [tool] = openApiToTools(spec);
    expect(tool.input_schema.properties.body).toMatchObject({
      type: 'object',
      properties: { subject: { type: 'string' }, priority: { type: 'string' } },
    });
    expect(tool.input_schema.required).toContain('body');
  });
});
