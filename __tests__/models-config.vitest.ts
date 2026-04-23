import { afterEach, describe, expect, it, vi } from 'vitest';

// WP-G.16: env-driven Anthropic model IDs. The helper MUST throw loudly on
// missing env so a prod deploy never silently falls back to a hardcoded model.
// Uses vi.stubEnv so the process-level env stays untouched across tests.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('lib/config/models', () => {
  describe('modelPlayground()', () => {
    it('returns the PLAYGROUND_MODEL env value when set', async () => {
      vi.stubEnv('PLAYGROUND_MODEL', 'claude-opus-4-7');
      const { modelPlayground } = await import('@/lib/config/models');
      expect(modelPlayground()).toBe('claude-opus-4-7');
    });

    it('throws with a clear message naming the env var when unset', async () => {
      vi.stubEnv('PLAYGROUND_MODEL', '');
      const { modelPlayground } = await import('@/lib/config/models');
      expect(() => modelPlayground()).toThrow(/PLAYGROUND_MODEL/);
    });
  });

  describe('modelEvaluateGoal()', () => {
    it('returns the EVALUATE_GOAL_MODEL env value when set', async () => {
      vi.stubEnv('EVALUATE_GOAL_MODEL', 'claude-opus-4-7');
      const { modelEvaluateGoal } = await import('@/lib/config/models');
      expect(modelEvaluateGoal()).toBe('claude-opus-4-7');
    });

    it('throws with a clear message naming the env var when unset', async () => {
      vi.stubEnv('EVALUATE_GOAL_MODEL', '');
      const { modelEvaluateGoal } = await import('@/lib/config/models');
      expect(() => modelEvaluateGoal()).toThrow(/EVALUATE_GOAL_MODEL/);
    });
  });
});
