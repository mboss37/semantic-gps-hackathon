import { describe, expect, it } from 'vitest';
import {
  formatToolDescription,
  type FormatToolDescriptionEdge,
  type FormatToolDescriptionInput,
  type FormatToolDescriptionRoute,
} from '@/lib/manifest/format-description';

const baseInput = (
  overrides: Partial<FormatToolDescriptionInput> = {},
): FormatToolDescriptionInput => ({
  tool: { name: 'create_lead', description: 'Creates a new lead in Salesforce.' },
  outgoingEdges: [],
  parentRoutes: [],
  scope: 'org',
  ...overrides,
});

const edge = (
  to: string,
  type: FormatToolDescriptionEdge['type'],
  description: string,
): FormatToolDescriptionEdge => ({ to, type, description });

const route = (
  name: string,
  stepCount: number,
  hasFallback: boolean,
  hasRollback: boolean,
): FormatToolDescriptionRoute => ({ name, stepCount, hasFallback, hasRollback });

describe('formatToolDescription (WP-30.1)', () => {
  it('returns the original description verbatim when graph is empty', () => {
    const out = formatToolDescription(baseInput());
    expect(out).toBe('Creates a new lead in Salesforce.');
    expect(out).not.toContain('Workflow context');
  });

  it('returns original when only the description is present and edges/routes empty', () => {
    const out = formatToolDescription(
      baseInput({ tool: { name: 'noop', description: 'Just here.' } }),
    );
    expect(out).toBe('Just here.');
  });

  it('renders edge groups in stable type-prefixed order', () => {
    const out = formatToolDescription(
      baseInput({
        scope: 'server',
        outgoingEdges: [
          edge('alt_tool', 'alternative_to', 'similar capability'),
          edge('paired_tool', 'suggests_after', 'commonly run after'),
          edge('rollback_tool', 'compensated_by', 'undoes this action'),
          edge('fallback_tool', 'fallback_to', 'used when primary fails'),
          edge('next_tool', 'produces_input_for', 'feeds an id into next_tool'),
          edge('prereq_tool', 'requires_before', 'requires an authenticated session'),
        ],
      }),
    );

    // Header is present
    expect(out).toContain('— Workflow context —');

    // Stable render order: requires_before > produces_input_for >
    // compensated_by > fallback_to > suggests_after > alternative_to.
    const beforeIdx = out.indexOf('Before this tool, ensure');
    const afterIdx = out.indexOf('After this tool, typically call');
    const rollbackIdx = out.indexOf('Rollback:');
    const fallbackIdx = out.indexOf('Fallback:');
    const pairedIdx = out.indexOf('Often paired with');
    const altIdx = out.indexOf('Alternatives:');

    expect(beforeIdx).toBeGreaterThan(-1);
    expect(afterIdx).toBeGreaterThan(beforeIdx);
    expect(rollbackIdx).toBeGreaterThan(afterIdx);
    expect(fallbackIdx).toBeGreaterThan(rollbackIdx);
    expect(pairedIdx).toBeGreaterThan(fallbackIdx);
    expect(altIdx).toBeGreaterThan(pairedIdx);
  });

  it('applies the org scope cap (top 3 outgoing edges)', () => {
    const edges = Array.from({ length: 10 }, (_, i) =>
      edge(`tool_${i}`, 'produces_input_for', `feeds tool_${i}`),
    );
    const out = formatToolDescription(
      baseInput({ scope: 'org', outgoingEdges: edges }),
    );

    // tool_0..tool_2 should appear; tool_3+ should not.
    expect(out).toContain('tool_0');
    expect(out).toContain('tool_1');
    expect(out).toContain('tool_2');
    expect(out).not.toContain('tool_3');
    expect(out).not.toContain('tool_4');
  });

  it('applies the domain scope cap (top 5 outgoing edges)', () => {
    const edges = Array.from({ length: 10 }, (_, i) =>
      edge(`tool_${i}`, 'produces_input_for', `feeds tool_${i}`),
    );
    const out = formatToolDescription(
      baseInput({ scope: 'domain', outgoingEdges: edges }),
    );

    expect(out).toContain('tool_0');
    expect(out).toContain('tool_4');
    expect(out).not.toContain('tool_5');
  });

  it('applies the server scope cap (top 8 outgoing edges)', () => {
    const edges = Array.from({ length: 12 }, (_, i) =>
      edge(`tool_${i}`, 'produces_input_for', `feeds tool_${i}`),
    );
    const out = formatToolDescription(
      baseInput({ scope: 'server', outgoingEdges: edges }),
    );

    expect(out).toContain('tool_0');
    expect(out).toContain('tool_7');
    expect(out).not.toContain('tool_8');
  });

  it('caps route memberships per scope (org=1, domain=2, server=all)', () => {
    const routes = [
      route('Lead Onboarding', 3, false, true),
      route('Lead Outreach', 4, true, true),
      route('Lead Cleanup', 2, false, false),
    ];

    const orgOut = formatToolDescription(
      baseInput({ scope: 'org', parentRoutes: routes }),
    );
    expect(orgOut).toContain('Lead Onboarding');
    expect(orgOut).not.toContain('Lead Outreach');
    expect(orgOut).not.toContain('Lead Cleanup');

    const domainOut = formatToolDescription(
      baseInput({ scope: 'domain', parentRoutes: routes }),
    );
    expect(domainOut).toContain('Lead Onboarding');
    expect(domainOut).toContain('Lead Outreach');
    expect(domainOut).not.toContain('Lead Cleanup');

    const serverOut = formatToolDescription(
      baseInput({ scope: 'server', parentRoutes: routes }),
    );
    expect(serverOut).toContain('Lead Onboarding');
    expect(serverOut).toContain('Lead Outreach');
    expect(serverOut).toContain('Lead Cleanup');
  });

  it('truncates with " …" suffix when total exceeds 1200 chars', () => {
    const longDescription = 'x'.repeat(1500);
    const out = formatToolDescription(
      baseInput({
        tool: { name: 'big_tool', description: longDescription },
        outgoingEdges: [edge('tool_a', 'produces_input_for', 'a description')],
      }),
    );
    expect(out.length).toBeLessThanOrEqual(1200);
    expect(out.endsWith(' …')).toBe(true);
  });

  it('does not append ellipsis when the enriched output fits in 1200 chars', () => {
    const out = formatToolDescription(
      baseInput({
        tool: { name: 'small', description: 'tiny' },
        outgoingEdges: [edge('tool_a', 'produces_input_for', 'feeds tool_a')],
      }),
    );
    expect(out.endsWith(' …')).toBe(false);
    expect(out.length).toBeLessThanOrEqual(1200);
  });

  it('renders Rollback: prefix for compensated_by edges', () => {
    const out = formatToolDescription(
      baseInput({
        scope: 'server',
        outgoingEdges: [
          edge('delete_lead', 'compensated_by', 'reverses the lead creation'),
        ],
      }),
    );
    expect(out).toContain('Rollback: delete_lead — reverses the lead creation.');
  });

  it('renders Fallback: prefix for fallback_to edges', () => {
    const out = formatToolDescription(
      baseInput({
        scope: 'server',
        outgoingEdges: [
          edge('cached_lookup', 'fallback_to', 'used when primary lookup times out'),
        ],
      }),
    );
    expect(out).toContain(
      'Fallback: cached_lookup — used when primary lookup times out.',
    );
  });

  it('renders the route membership badge with rollback/fallback guards', () => {
    const out = formatToolDescription(
      baseInput({
        scope: 'server',
        parentRoutes: [route('Onboard New Lead', 4, true, true)],
      }),
    );
    expect(out).toContain(
      "Part of route: Onboard New Lead (4 steps with rollback + fallback) — prefer execute_route('Onboard New Lead') for the full workflow.",
    );
  });

  it('renders the route badge without guard suffix when route has no fallback or rollback', () => {
    const out = formatToolDescription(
      baseInput({
        scope: 'server',
        parentRoutes: [route('Quick Path', 2, false, false)],
      }),
    );
    expect(out).toContain(
      "Part of route: Quick Path (2 steps) — prefer execute_route('Quick Path') for the full workflow.",
    );
  });

  it('renders only rollback in the suffix when fallback is absent', () => {
    const out = formatToolDescription(
      baseInput({
        scope: 'server',
        parentRoutes: [route('Saga Path', 3, false, true)],
      }),
    );
    expect(out).toContain(
      "Part of route: Saga Path (3 steps with rollback) — prefer execute_route('Saga Path') for the full workflow.",
    );
  });

  it('combines suggests_after edges into a single line', () => {
    const out = formatToolDescription(
      baseInput({
        scope: 'server',
        outgoingEdges: [
          edge('tool_a', 'suggests_after', 'desc a'),
          edge('tool_b', 'suggests_after', 'desc b'),
          edge('tool_c', 'suggests_after', 'desc c'),
        ],
      }),
    );
    const matches = out.match(/Often paired with:/g);
    expect(matches?.length).toBe(1);
    expect(out).toContain('Often paired with: tool_a, tool_b, tool_c.');
  });

  it('combines alternative_to edges into a single line', () => {
    const out = formatToolDescription(
      baseInput({
        scope: 'server',
        outgoingEdges: [
          edge('tool_x', 'alternative_to', 'similar 1'),
          edge('tool_y', 'alternative_to', 'similar 2'),
        ],
      }),
    );
    const matches = out.match(/Alternatives:/g);
    expect(matches?.length).toBe(1);
    expect(out).toContain('Alternatives: tool_x, tool_y.');
  });
});
