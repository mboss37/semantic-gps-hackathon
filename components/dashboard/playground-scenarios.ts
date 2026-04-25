export type Scenario = {
  id: string;
  label: string;
  prompt: string;
  hint: string;
};

// Generic, vendor-agnostic scenarios. They work against any MCP tool set —
// the user's own connected servers, not our demo Salesforce/Slack/GitHub.
// Each prompt is a guide that helps a new user see governance in motion
// without prescribing specific tool names.
export const SCENARIOS: Scenario[] = [
  {
    id: 'tools-sanity',
    label: 'Tools sanity check',
    prompt:
      'List the MCP tools available to you. Pick one that looks like a read-only lookup, call it with any sensible test value, and explain what you got back.',
    hint: 'Verifies the gateway is reachable and the model can introspect your manifest. Works against any tool set — no specific MCP required.',
  },
  {
    id: 'read-then-write',
    label: 'Read-then-write',
    prompt:
      'Find any record using a read-only tool — an account, user, ticket, file, or message — whatever your MCPs expose. Summarize the key fields, then create a follow-up using a write tool: a comment, task, message, or note that references what you learned.',
    hint: 'Multi-step orchestration. The Gateway pane will surface policy events if you have allowlists, rate limits, or write-freeze attached.',
  },
  {
    id: 'sensitive-write',
    label: 'Sensitive write test',
    prompt:
      'Attempt a write operation with a placeholder identifier — a task, message, comment, or record creation. Note the request you sent and the result you got back.',
    hint: 'Compares Raw vs Gateway when write-freeze, allowlist, or PII redaction policies are attached. Watch the policy events panel in the gateway pane.',
  },
];
