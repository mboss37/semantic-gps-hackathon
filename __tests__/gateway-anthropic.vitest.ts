import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

// Live verification: Claude Opus 4.7 calls the deployed MCP gateway via the
// Anthropic Messages `mcp_servers` connector. Opt-in — default `pnpm test`
// skips this because it costs real tokens and needs a deployed URL.
//
//   VERIFY_ANTHROPIC=1 \
//   ANTHROPIC_API_KEY=sk-ant-... \
//   VERIFY_GATEWAY_URL=https://semantic-gps-hackathon.vercel.app/api/mcp \
//   pnpm test __tests__/gateway-anthropic.vitest.ts

const shouldRun =
  process.env.VERIFY_ANTHROPIC === '1' && !!process.env.ANTHROPIC_API_KEY;

const GATEWAY_URL =
  process.env.VERIFY_GATEWAY_URL ??
  'https://semantic-gps-hackathon.vercel.app/api/mcp';

describe.skipIf(!shouldRun)('gateway × anthropic mcp connector', () => {
  it('lets Claude call the echo tool through the deployed gateway', async () => {
    const client = new Anthropic();
    const response = await client.beta.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 512,
      betas: ['mcp-client-2025-11-20'],
      mcp_servers: [{ name: 'semantic-gps', type: 'url', url: GATEWAY_URL }],
      tools: [{ type: 'mcp_toolset', mcp_server_name: 'semantic-gps' }],
      messages: [
        {
          role: 'user',
          content:
            'Use the echo tool from the semantic-gps server to echo the exact string "gateway verified". Return only what the tool returned.',
        },
      ],
    });

    const blocks = response.content;
    const toolUses = blocks.filter((b) => b.type === 'mcp_tool_use');
    const toolResults = blocks.filter((b) => b.type === 'mcp_tool_result');

    expect(toolUses.length).toBeGreaterThan(0);
    const echoCall = toolUses.find((b) => 'name' in b && b.name === 'echo');
    expect(echoCall, 'expected Claude to invoke echo').toBeDefined();

    const echoResult = toolResults.find(
      (b) => 'tool_use_id' in b && b.tool_use_id === echoCall?.id,
    );
    expect(echoResult, 'expected an mcp_tool_result for the echo call').toBeDefined();

    const resultText = JSON.stringify(echoResult);
    expect(resultText).toContain('gateway verified');
  }, 60_000);
});
