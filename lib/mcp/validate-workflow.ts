import type { Manifest, RelationshipRow, ToolRow } from '@/lib/manifest/cache';
import type {
  ValidateWorkflowIssue,
  ValidateWorkflowParams,
  ValidateWorkflowResult,
} from '@/lib/mcp/trel-schemas';

// Planning-time workflow linter. Pure function against the scoped manifest -
// no LLM, no DB. Returns a structured issue list + graph coverage metric so
// an agent can decide whether to keep planning or just execute.

const COVERAGE_EDGE_TYPES = new Set<RelationshipRow['relationship_type']>([
  'produces_input_for',
  'suggests_after',
  'requires_before',
]);

// Accept tool NAME or UUID; names win when both exist because upstream
// contracts expose names, not ids.
const resolveTool = (ref: string, manifest: Manifest): ToolRow | null => {
  const byName = manifest.tools.find((t) => t.name === ref);
  if (byName) return byName;
  const byId = manifest.tools.find((t) => t.id === ref);
  return byId ?? null;
};

type ResolvedStep = {
  ref: string;
  tool: ToolRow | null;
};

const resolveAllSteps = (
  params: ValidateWorkflowParams,
  manifest: Manifest,
): ResolvedStep[] =>
  params.steps.map((s) => ({ ref: s.tool, tool: resolveTool(s.tool, manifest) }));

const collectUnknownTools = (steps: ResolvedStep[]): ValidateWorkflowIssue[] => {
  const out: ValidateWorkflowIssue[] = [];
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (!step || step.tool) continue;
    out.push({
      step_index: i,
      severity: 'error',
      code: 'unknown_tool',
      message: `step ${i}: tool "${step.ref}" not found in this scope's manifest`,
      tool: step.ref,
    });
  }
  return out;
};

const collectMissingPrerequisites = (
  steps: ResolvedStep[],
  manifest: Manifest,
): ValidateWorkflowIssue[] => {
  const out: ValidateWorkflowIssue[] = [];
  for (let i = 1; i < steps.length; i += 1) {
    const current = steps[i];
    if (!current?.tool) continue;
    const incomingRequires = manifest.relationships.filter(
      (r) =>
        r.relationship_type === 'requires_before' && r.to_tool_id === current.tool?.id,
    );
    for (const edge of incomingRequires) {
      const satisfied = steps.slice(0, i).some((s) => s.tool?.id === edge.from_tool_id);
      if (satisfied) continue;
      const expected = manifest.tools.find((t) => t.id === edge.from_tool_id);
      out.push({
        step_index: i,
        severity: 'warning',
        code: 'missing_prerequisite',
        message: `step ${i} (${current.tool.name}) requires "${expected?.name ?? edge.from_tool_id}" earlier in the sequence`,
        tool: current.tool.name,
        expected_preceding_tool: expected?.name,
      });
    }
  }
  return out;
};

const collectMutuallyExclusive = (
  steps: ResolvedStep[],
  manifest: Manifest,
): ValidateWorkflowIssue[] => {
  const out: ValidateWorkflowIssue[] = [];
  const stepIds = steps
    .map((s, i) => ({ id: s.tool?.id, index: i, name: s.tool?.name }))
    .filter((s): s is { id: string; index: number; name: string } => !!s.id && !!s.name);
  const mxEdges = manifest.relationships.filter(
    (r) => r.relationship_type === 'mutually_exclusive',
  );
  for (const edge of mxEdges) {
    const a = stepIds.find((s) => s.id === edge.from_tool_id);
    const b = stepIds.find((s) => s.id === edge.to_tool_id);
    if (!a || !b) continue;
    // Flag on the later step so the error sits at the point of conflict.
    const laterIndex = Math.max(a.index, b.index);
    const laterName = a.index > b.index ? a.name : b.name;
    const earlierName = a.index > b.index ? b.name : a.name;
    out.push({
      step_index: laterIndex,
      severity: 'error',
      code: 'mutually_exclusive',
      message: `step ${laterIndex} (${laterName}) is mutually_exclusive with step ${Math.min(a.index, b.index)} (${earlierName})`,
      tool: laterName,
      expected_preceding_tool: earlierName,
    });
  }
  return out;
};

const collectPolicyBlocks = (
  steps: ResolvedStep[],
  manifest: Manifest,
): ValidateWorkflowIssue[] => {
  const out: ValidateWorkflowIssue[] = [];
  // Runtime-arg-dependent policies (injection_guard, rate_limit, basic_auth,
  // client_id, ip_allowlist) are flagged as warnings here, we can't evaluate
  // them without real headers / args. Static-config allowlist we CAN check.
  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    if (!step?.tool) continue;
    const applicable = new Set<string>();
    for (const a of manifest.assignments) {
      const toolMatch = !a.tool_id || a.tool_id === step.tool.id;
      const serverMatch = !a.server_id || a.server_id === step.tool.server_id;
      if (toolMatch && serverMatch) applicable.add(a.policy_id);
    }
    for (const policy of manifest.policies) {
      if (!applicable.has(policy.id)) continue;
      if (policy.enforcement_mode !== 'enforce') continue;
      if (policy.builtin_key === 'allowlist') {
        const cfg = policy.config as { tool_names?: string[] };
        const allowed = cfg.tool_names ?? [];
        if (allowed.length > 0 && !allowed.includes(step.tool.name)) {
          out.push({
            step_index: i,
            severity: 'error',
            code: 'policy_blocks',
            message: `step ${i} (${step.tool.name}) blocked by enforce-mode allowlist policy "${policy.name}"`,
            tool: step.tool.name,
          });
        }
        continue;
      }
      // All other enforce-mode policies need runtime signals, warn, don't block.
      out.push({
        step_index: i,
        severity: 'warning',
        code: 'policy_blocks',
        message: `step ${i} (${step.tool.name}) policy "${policy.name}" (${policy.builtin_key}) may block at execution`,
        tool: step.tool.name,
      });
    }
  }
  return out;
};

const computeGraphCoverage = (steps: ResolvedStep[], manifest: Manifest): number => {
  if (steps.length < 2) return 1;
  let covered = 0;
  for (let i = 0; i < steps.length - 1; i += 1) {
    const a = steps[i]?.tool?.id;
    const b = steps[i + 1]?.tool?.id;
    if (!a || !b) continue;
    const hasEdge = manifest.relationships.some(
      (r) =>
        COVERAGE_EDGE_TYPES.has(r.relationship_type) &&
        ((r.from_tool_id === a && r.to_tool_id === b) ||
          (r.from_tool_id === b && r.to_tool_id === a)),
    );
    if (hasEdge) covered += 1;
  }
  return covered / (steps.length - 1);
};

export const validateWorkflow = async (
  params: ValidateWorkflowParams,
  manifest: Manifest,
): Promise<ValidateWorkflowResult> => {
  const resolved = resolveAllSteps(params, manifest);
  const issues: ValidateWorkflowIssue[] = [
    ...collectUnknownTools(resolved),
    ...collectMissingPrerequisites(resolved, manifest),
    ...collectMutuallyExclusive(resolved, manifest),
    ...collectPolicyBlocks(resolved, manifest),
  ];
  issues.sort((a, b) => a.step_index - b.step_index);
  const valid = !issues.some((i) => i.severity === 'error');
  return {
    valid,
    issues,
    graph_coverage: computeGraphCoverage(resolved, manifest),
  };
};
