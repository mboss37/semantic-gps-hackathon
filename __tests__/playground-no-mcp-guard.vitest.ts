import { describe, expect, it } from 'vitest';
import { computePlaygroundGate } from '@/components/dashboard/playground-workbench';

// WP-17.3: Playground no-MCP guard. When the org has zero registered MCP
// servers the Anthropic mcp_servers connector returns an empty manifest and
// the model responds text-only, which reads as a broken run to first-time
// users. `computePlaygroundGate` is the pure decision function that drives
// both the Execute button's disabled state and the visible CTA card.
//
// Repo deliberately has no jsdom / @testing-library stack (vitest.config.ts
// environment: 'node', include: '__tests__/**/*.vitest.ts'), so per the WP
// spec we cover the gate logic directly instead of spinning up component
// rendering.

describe('computePlaygroundGate', () => {
  it('disables Execute and shows the notice when the org has no servers', () => {
    const gate = computePlaygroundGate({
      hasServers: false,
      busy: false,
      promptText: 'Look up Edge Communications in Salesforce',
    });
    expect(gate.canExecute).toBe(false);
    expect(gate.showMissingServersNotice).toBe(true);
  });

  it('enables Execute and hides the notice when the org has at least one server', () => {
    const gate = computePlaygroundGate({
      hasServers: true,
      busy: false,
      promptText: 'Look up Edge Communications in Salesforce',
    });
    expect(gate.canExecute).toBe(true);
    expect(gate.showMissingServersNotice).toBe(false);
  });

  it('keeps Execute disabled while a run is in-flight, even with servers registered', () => {
    const gate = computePlaygroundGate({
      hasServers: true,
      busy: true,
      promptText: 'Look up Edge Communications in Salesforce',
    });
    expect(gate.canExecute).toBe(false);
    // Busy state does not hide the notice on its own, only server presence does.
    expect(gate.showMissingServersNotice).toBe(false);
  });

  it('keeps Execute disabled on an empty / whitespace-only prompt', () => {
    const emptyGate = computePlaygroundGate({
      hasServers: true,
      busy: false,
      promptText: '',
    });
    expect(emptyGate.canExecute).toBe(false);

    const whitespaceGate = computePlaygroundGate({
      hasServers: true,
      busy: false,
      promptText: '   \n  ',
    });
    expect(whitespaceGate.canExecute).toBe(false);
  });

  it('still shows the notice when busy and no servers, notice tracks server presence only', () => {
    const gate = computePlaygroundGate({
      hasServers: false,
      busy: true,
      promptText: 'anything',
    });
    expect(gate.canExecute).toBe(false);
    expect(gate.showMissingServersNotice).toBe(true);
  });
});
