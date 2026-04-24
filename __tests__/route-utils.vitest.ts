import { describe, expect, it } from 'vitest';
import { unwrapMcpEnvelope } from '@/lib/mcp/route-utils';

// Sprint 19: pins the envelope-unwrap behaviour used in execute-route.ts
// capture bag. In-process HTTP-Streamable MCPs (SF/Slack/GitHub) wrap results
// as {content:[{type:"text", text:"<JSON>"}]}. The unwrap happens at capture
// time so input_mapping / rollback_input_mapping path traversal sees the
// logical object, not the envelope.

describe('unwrapMcpEnvelope', () => {
  it('unwraps bare content array (proxy-http strips outer wrapper) and JSON-parses text', () => {
    const bareArray = [{ type: 'text', text: '{"records":[{"Id":"001"}],"totalSize":1}' }];
    expect(unwrapMcpEnvelope(bareArray)).toEqual({
      records: [{ Id: '001' }],
      totalSize: 1,
    });
  });

  it('unwraps wrapped {content:[...]} envelope and JSON-parses text (defensive path)', () => {
    const wrapped = {
      content: [{ type: 'text', text: '{"records":[{"Id":"001"}],"totalSize":1}' }],
    };
    expect(unwrapMcpEnvelope(wrapped)).toEqual({
      records: [{ Id: '001' }],
      totalSize: 1,
    });
  });

  it('returns raw text when envelope text is not valid JSON', () => {
    expect(unwrapMcpEnvelope([{ type: 'text', text: 'plain string' }])).toBe('plain string');
  });

  it('passes through OpenAPI-style unwrapped bodies untouched', () => {
    const body = { records: [{ Id: '001' }], totalSize: 1 };
    expect(unwrapMcpEnvelope(body)).toEqual(body);
  });

  it('passes through primitives and null', () => {
    expect(unwrapMcpEnvelope(null)).toBeNull();
    expect(unwrapMcpEnvelope(42)).toBe(42);
    expect(unwrapMcpEnvelope('hello')).toBe('hello');
  });

  it('leaves non-text content parts as-is', () => {
    const bareArray = [{ type: 'image', data: 'base64' }];
    expect(unwrapMcpEnvelope(bareArray)).toBe(bareArray);
  });

  it('leaves empty arrays and empty content as-is', () => {
    expect(unwrapMcpEnvelope([])).toEqual([]);
    const wrapped = { content: [] };
    expect(unwrapMcpEnvelope(wrapped)).toBe(wrapped);
  });
});
