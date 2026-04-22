# User Stories — Semantic GPS

Every shipped feature on `develop`, mapped to a user story by persona. Updated when work lands. Backlog items (see `BACKLOG.md`) become stories here once they ship.

**Scope note (2026-04-22):** Hackathon MVP is **single-admin per org**. First signup auto-creates the organization; that user is its Admin. Multi-user orgs, invites, role promotion, member removal are **V2** (see `BACKLOG.md`). Sections flagged `[V2]` below are documented for the roadmap but are **not in the hackathon deliverable**.

## Personas

- **Admin** — org owner. Full control of policies, servers, org settings. In the hackathon MVP, every signed-in user is the Admin of their own single-user org. (Multi-user orgs with Members = V2.)
- **Member** — [V2] org member (non-admin). Placeholder role; not shippable in hackathon.
- **Admin or Member** — applies to both in V2; treat as "Admin" for hackathon scope.
- **AI Agent** — external MCP client (Claude, Cursor, a custom agent) calling the gateway. Not a human user, but the primary consumer of the proxy.

---

## Authentication & Account

- As an **Admin**, I want to sign up with email and password so that I can create a new organization and become its first member.
- As an **Admin**, I want to log in with email and password so that I can access my org's dashboard.
- As an **Admin**, I want to log out so that I can protect my session on a shared machine.
- As an **Admin**, I want to request a password reset link so that I can recover access if I forget my password.
- As an **Admin**, I want to set a new password via the reset link so that I can regain access to my account.
- As an **Admin**, I want dashboard routes protected so that unauthenticated users are redirected to login.
- `[V2]` As an Admin or Member, I want to verify my email after signup so that my account is activated. *(Supabase ships this; deferred for demo.)*
- `[V2]` As an Admin or Member, I want rate limits on login, signup, forgot-password so that credential-stuffing fails fast.

## Organization & Team

- As an **Admin**, when I sign up my **organization is auto-created** with me as its Admin so that I can start registering servers immediately, with zero onboarding friction.
- `[V2]` As an Admin, I want to invite team members by email with a role (Admin or Member) so that my team can collaborate.
- `[V2]` As an Admin, I want to see pending invites and revoke them.
- `[V2]` As an Invited user, I want to accept an invite via a unique link.
- `[V2]` As an Admin, I want to change a member's role or remove a member.
- `[V2]` As an Admin, I want a unified Settings > Organization page for team operations.

## Settings & Profile

- As an **Admin**, I want to view and edit my **display name and organization name** in Settings > Profile so that my identity is current.
- `[V2]` As an Admin, I want to update my email (with re-verification).
- `[V2]` As an Admin, I want to configure auth headers for my gateway endpoints (Settings > MCP Endpoint Auth) so MCP clients can authenticate programmatically. *(Gateway auth verification ships in Sprint 4 WP-D.2; the rotation/copy UI is V2.)*
- `[V2]` As an Admin, I want to edit extended org-level metadata beyond name.

## MCP Servers

- As an **Admin or Member**, I want to register a new MCP server by name, transport, and origin URL so that agents can reach it through the gateway.
- As an **Admin or Member**, I want to import an MCP server from an OpenAPI 3.x URL so that every REST backend becomes agent-callable without writing adapter code.
- As an **Admin or Member**, I want the gateway to introspect `tools/list`, `resources/list`, and `prompts/list` automatically so that I don't have to hand-register every capability.
- As an **Admin or Member**, I want to configure per-server auth (Bearer, Basic, API key, custom headers) so that my gateway can authenticate to the origin.
- As an **Admin or Member**, I want stored credentials encrypted at rest (AES-256-GCM via `lib/crypto/`) so that a DB dump does not leak secrets.
- As an **Admin or Member**, I want to add multiple origin URLs per server (primary + fallback) so that traffic can reroute when an origin is unhealthy.
- As an **Admin or Member**, I want automatic health checks against every origin so that failing backends are detected before agents hit them.
- As an **Admin or Member**, I want origin health status surfaced on the dashboard and server detail page so that I can see which backends are live.
- As an **Admin or Member**, I want outbound requests routed through the SSRF guard so that pasting `http://169.254.169.254/` or a private-range URL cannot exfiltrate cloud credentials.
- As a **server owner** (or any **Admin**), I want to edit or delete servers I own so that non-owners cannot mutate my registrations.
- As an **Admin or Member**, I want to view a server's tools, resources, prompts, parameters, and active policies on a single detail page so that I can inspect its full surface.
- As an **Admin or Member**, I want per-server policy violation counts so that I can spot misbehaving backends at a glance.
- As an **Admin or Member**, I want a copy-ready MCP client config block on each server page so that pointing Claude, Cursor, or a custom agent at my gateway is one paste.

## Domains (multi-server endpoints)

- As an **Admin or Member**, I want to create a Domain that groups multiple servers behind one MCP endpoint so that an agent can consume related tools through a single URL.
- As an **Admin or Member**, I want to assign and unassign servers to a Domain so that the tool surface of that endpoint stays curated.
- As an **Admin or Member**, I want to configure Domain-level auth so that the aggregated endpoint has its own auth contract independent of the underlying servers.
- As an **Admin or Member**, I want to filter the dashboard by Domain so that I can inspect stats for just that endpoint.

## Relationships & Graph

**Canonical taxonomy (locked Sprint 4):** 8 semantic-flow relationship types.

| Type | Meaning | Drives |
|---|---|---|
| `produces_input_for` | Output of A is consumed as input by B | Workflow path discovery |
| `requires_before` | B cannot run until A has run successfully | Route pre-conditions |
| `suggests_after` | B is commonly useful after A but not required | Agent suggestions |
| `mutually_exclusive` | A and B cannot both run in the same trace | Policy validation |
| `alternative_to` | B is an equivalent substitute for A | Agent choice |
| `validates` | B checks / confirms the output of A | Pre-execute validation |
| `compensated_by` | If A succeeded but the route fails later, B is the rollback/undo | **Rollback execution (F.3)** |
| `fallback_to` | If A fails, route to B | **Fallback execution (F.2)** |

- As an **Admin**, I want to declare typed relationships between tools using the 8 types above so that agents see a governed graph, not a flat list.
- As an **Admin**, I want to edit and delete relationships so that the graph stays accurate as the tool catalog evolves.
- As an **Admin**, I want to view the full workflow graph on a canvas (React Flow) with pan, zoom, node focus so that I can visually audit connectivity.
- As an **Admin**, I want to toggle domain boundaries on the graph so that I can see tool clustering per endpoint.
- As an **Admin**, I want each server node in the graph to show a policy-count badge so that I can spot ungoverned servers instantly.

## Policies

- As an **Admin**, I want to enable built-in policies (**PII detection, rate limit, allowlist, prompt-injection guard, Basic auth, client-ID enforcement, IP allow/block**) on servers and tools so that business rules are enforced deterministically.
- As an **Admin**, I want to configure per-policy JSON config (e.g. `max_rpm`, PII patterns, allowlisted CIDRs) so that each policy fits the server it guards.
- As an **Admin**, I want to toggle each policy between **shadow** and **enforce** mode so that compliance can audit violations for a week before I flip the switch to block.
- As an **Admin**, during the demo I want to **flip a PII policy from shadow to enforce mid-run**, and have the very next agent call redact the customer's email — with no restart, no prompt edit, no redeploy — so that judges feel the live-policy pitch.
- As an **Admin**, I want every edit to any policy to snapshot a new row into `policy_versions` so that I have a full audit trail of who changed what and when.
- As an **Admin**, I want to assign policies to servers (and optionally individual tools) so that enforcement scope is explicit.
- As an **Admin**, I want to see which policies apply to a server on its detail page so that I understand its enforcement surface.
- As an **Admin**, I want the manifest cache invalidated on every policy mutation so that the next agent call uses the new rules with no restart.
- `[V2]` As an Admin, I want to write custom policies via a policy DSL beyond the built-ins. *(Sprint 4 ships 7 built-ins which cover the hero demo.)*
- `[V2]` As an Admin, I want to translate natural-language intent into a policy config via `/api/policies/translate` so I can draft policies without learning the DSL. *(Depends on DSL → V2.)*

## Workflow Discovery & Playground (hero demo)

### The Playground (A/B governance comparison) — hero demo

- As an **Admin**, I want a **Playground** page with two side-by-side panes running the same Claude Opus 4.7 agent against the same customer-escalation scenario, where:
  - **Left pane ("Direct / ungoverned")** — agent connects directly to raw Salesforce + Slack + GitHub MCP endpoints (no gateway).
  - **Right pane ("Semantic GPS / governed")** — same agent connects through one `/api/mcp/domain/salesops` gateway endpoint.
  Both panes run the same scripted prompt. The difference is the control plane — and I can see the diff in real time (tool calls, latency, policy events, PII leaks, audit events).
- As an **Admin**, mid-run I want to flip the PII-redaction policy from shadow to enforce on the right pane only, and watch the very next tool call redact the customer's email — proving live governance without restart.
- As an **Admin**, I want the Playground to log every tool call from both panes to `mcp_events` (with a `governance_mode` tag) so that the audit log becomes the demo's proof.

### Route discovery

- As an **Admin**, I want each route definition to show the full tool sequence, relationship types along the path, and any policy gates so that I can reason about an agent's workflow before it runs one.
- As an **Admin**, I want to design routes in a visual editor (drag step order, pick tool, wire `fallback_to` + `compensated_by` edges) so that operations authors workflows, not engineers.

### TRel — AI agent surface

- As an **AI Agent**, I want to call `discover_relationships` on the MCP gateway so that I receive the typed tool graph as a JSON-RPC response.
- As an **AI Agent**, I want to call `find_workflow_path({ goal })` so that I get an ordered sequence of tools to achieve a goal.
- As an **AI Agent**, I want to call `validate_workflow({ plan })` so that I can pre-flight my plan against all policies and relationships before execution.
- As an **AI Agent**, I want to call `evaluate_goal({ intent })` so that natural-language intent is mapped to a candidate tool chain.
- As an **AI Agent**, I want to call `execute_route({ route_name, inputs })` so that a governed multi-step workflow runs atomically with fallback and compensating rollback on failure.
- As an **AI Agent**, I want every `tools/list` response to carry `_meta.relationships` so that I can plan multi-step workflows without a separate discovery call.

`[V2]` As an Admin, I want a **Routes explorer** that finds every tool chain reachable from any starting tool, filtered by depth, relationship type, and server. *(Playground covers the demo story; the explorer is a standalone benchmark tool.)*
`[V2]` As an Admin, I want to benchmark keyword / semantic / hybrid goal-matching strategies side by side. *(Moved to BACKLOG — see Workflow Evaluator benchmark harness.)*

## Audit & Monitoring

- As an **Admin or Member**, I want every gateway call (method, tool, server, latency, policy decisions, status) logged to `mcp_events` so that I have a complete interaction history.
- As an **Admin or Member**, I want to filter the Audit Log by server, tool, status (ok / blocked_by_policy / origin_error / fallback_triggered), time range, and free text so that I can find a specific event fast.
- As an **Admin or Member**, I want to expand an audit row to see the redacted payload, all policy decisions, and trace metadata so that I can reconstruct what happened.
- As an **Admin or Member**, I want secrets stripped from every logged payload (via `redactPayload`) so that the audit log itself never leaks credentials.
- As an **Admin**, I want a **Monitoring** dashboard with three core widgets — **call volume over time, policy violations over time, PII detections by pattern** — so that I can spot trends at a glance. *(Lean widget set for Sprint 4; additional widgets = V2.)*
- `[V2]` As an Admin, I want to customize which monitoring widgets are visible and how they're sized.
- As an **Admin or Member**, I want an overview dashboard that summarizes servers, health, recent activity, policy violations, top servers and tools, and PII detections so that my landing page is one pane of glass.
- As an **Admin or Member**, I want to scope the overview to a selected Domain so that I can inspect a single endpoint's health independently.

## MCP Gateway (AI Agent perspective)

- As an **AI Agent**, I want to connect to a per-server MCP endpoint so that I can call only that one server's tools.
- As an **AI Agent**, I want to connect to a per-Domain MCP endpoint so that I can consume a curated group of servers through one URL.
- As an **AI Agent**, I want to connect to an org-level MCP endpoint so that I can see every tool in the org subject to policy.
- As an **AI Agent**, I want the gateway to authenticate every request so that unauthenticated clients are rejected before any tool runs.
- As an **AI Agent**, I want the gateway to enforce (or shadow-log) every applicable policy so that my calls are deterministic under governance.
- As an **AI Agent**, I want the gateway to fall back to a healthy origin when the primary is unhealthy so that my workflow survives origin blips transparently.
- As an **AI Agent**, I want unknown JSON-RPC methods to return `-32601` so that my error handling stays standards-compliant.
- As an **AI Agent**, I want MCP payload arguments validated against each tool's `inputSchema` before proxying so that I get a structured error instead of a downstream crash.

---

## Opus 4.7 showcase (hackathon scoring)

- As an **Admin**, during a Playground run I want to see Claude Opus 4.7's **extended-thinking blocks live-rendered** in the right pane so that I can audit the agent's reasoning in real time.
- As an **Admin**, when a route fails mid-execution I want the rollback cascade **visually animated** (compensating calls lighting up in reverse order) so that I can see governance-native recovery in action.
- `[P1 stretch]` As an Admin, when I import an OpenAPI spec I want Claude Opus 4.7 to read the full spec (1M-context play) and **propose the initial relationship graph**, which I can approve/reject before persistence.
- `[P1 stretch]` As an Admin, I want a **shadow → enforce timeline** on each policy showing the last 7 days of violations that *would have* been blocked, so that I have evidence before flipping the switch.
- `[P1 stretch]` As an Admin, I want the demo agent loop hosted on **Claude Managed Agents** so that long-running escalation workflows survive across sessions (side-prize angle).

---

*Backlog items (multi-user orgs, invites, roles, member removal, email change, MCP endpoint auth UI, custom policy DSL, NL→DSL translation, workflow evaluator benchmark, widget customization, OAuth/SSO, MFA, session management, ClickHouse audit migration) are tracked in `BACKLOG.md` and will land here as stories when they ship.*
