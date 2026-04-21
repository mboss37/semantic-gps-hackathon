# Semantic GPS

**The control plane for MCP agents: live policy enforcement, typed workflow discovery, and audit — all through one gateway.**

Built for the Anthropic Hackathon. 5-day scope. MCP-native.

---

## The Problem

Every enterprise MCP pilot dies in compliance review. Not because the agents can't do the work — because agents today are **blind to relationships** and the business rules are nowhere the compliance team can see them. `tools/list` returns a flat array. Every business rule is either:

1. Stuffed into the system prompt (stale the moment it ships)
2. Hardcoded in agent logic (requires a redeploy to change)
3. Not enforced at all (compliance says no)

Enterprises want agents that touch Salesforce, SAP, Slack, and internal APIs. Their compliance team wants deterministic audit trails and live policy control. Those two requirements kill most agent pilots before they reach production.

## The Solution

One MCP endpoint sits between the agent and every backend tool. It returns:

- **A typed workflow graph** — tools aren't listed, they're *connected*. `create_lead` depends_on `authenticate_crm`. `send_email` composes_into `onboard_customer`.
- **Live policies** — PII redaction, rate limits, allowlists, approval gates. Change them at runtime; every agent picks up new rules on the next call.
- **Fallback routes** — when an origin is unhealthy, traffic reroutes automatically. The agent never sees the failure.
- **Full audit** — every call, every policy decision, every tool invocation logged with trace IDs. Replay any session.

The agent ships once. The business keeps editing the rules.

---

## Key Features (5-Day Build)

### 1. MCP Gateway with TRel Protocol
Single streamable HTTP endpoint every agent connects to. JSON-RPC 2.0 compliant, full MCP spec. Adds four extension methods that agents can call like any other MCP method:

- `discover_relationships` — returns the typed graph. 8 relationship types: `depends_on`, `composes_into`, `alternative_to`, `prerequisite`, `conflicts_with`, `enables`, `requires_auth`, `deprecated_by`.
- `find_workflow_path({ goal })` — "how do I get from lead-capture to invoice?" Returns the ordered tool sequence.
- `validate_workflow({ plan })` — pre-flight check: does this plan satisfy all policies and dependencies? Catches broken agent flows before execution.
- `evaluate_goal({ intent })` — maps a natural-language intent to a candidate tool chain.

### 2. OpenAPI → MCP Auto-Import
Point at a Swagger/OpenAPI 3.x URL, get a running MCP server in seconds. Every enterprise already has OpenAPI docs — Semantic GPS turns them into agent-callable tools with zero adapter code.

### 3. Policy Engine
- 4 built-in policies: PII redaction, rate limit, allowlist, prompt-injection guard. JSON config per policy — no custom DSL, no YAML of your own, no parser to write.
- **Shadow mode** — log violations without blocking. Compliance teams audit for a week, then flip to enforce. Killer feature for regulated industries.
- Live reload — edit a policy, next agent call uses it. No restart, no redeploy.

### 4. Observability Dashboard
- Live workflow graph visualization (React Flow).
- Audit event stream with policy decisions, latency, fallback triggers.
- Filter by `trace_id` to reconstruct any run.

### 5. Demo Agent
Claude agent pre-wired to the gateway endpoint with scripted scenarios that show live policy change, fallback routing, and workflow discovery in under 3 minutes.

---

## Why It's Unique

- **MCP-native.** Not a REST gateway bolted onto agents. Built on Anthropic's protocol, speaks its dialect, extends it with TRel.
- **Typed relationships, not flat lists.** First control plane to treat agent tools as a graph, not an array.
- **Live rules, zero redeploys.** Every competitor either hardcodes rules in prompts or requires restart. Semantic GPS changes policies at runtime and every agent picks them up on the next call.
- **OpenAPI → MCP in one step.** Brings every legacy backend into the agent world without writing adapters.
- **Shadow mode for policies.** Lets compliance audit before enforcing — every other gateway forces you to block or allow from day one.

---

## Demo Scenarios

**1. The Live Policy Swap (60s) — the money shot**
Claude is answering customer emails via an agent. Mid-demo, a new compliance rule: *"never send attachments larger than 5MB to external addresses."* Update the policy in the UI. The **very next** agent call respects the new rule. No restart. No prompt edit. The judges feel it.

**2. OpenAPI Import to Running Agent (30s)**
Paste a Swagger URL into the dashboard. Gateway auto-generates MCP tools. Demo agent connects. Agent uses the new tools in the same session. Zero code written on stage.

**3. The Workflow Discovery (45s)**
Agent asked: *"onboard this new customer."* It calls `find_workflow_path({ goal: "onboard_customer" })`. Gateway returns: `create_account → send_welcome_email → provision_resources → notify_ops`. Agent executes in order. `provision_resources` fails — gateway triggers fallback. Full audit trail shows the retry path.

---

## Technical Approach

- **Framework:** Next.js App Router (App Router, Server Components default, Turbopack)
- **Database:** Supabase (Postgres + Auth) for audit events, manifests, policies
- **MCP:** `@modelcontextprotocol/sdk` — HTTP streamable transport, stateless server factory (fresh `McpServer` per request)
- **Frontend:** Radix UI + Tailwind + React Flow for graph visualization
- **AI:** Anthropic Claude for the demo agent; embeddings optional for semantic tool matching
- **Hosting:** Vercel (zero-config Next.js deploy)

---

## Out of Scope (Explicitly Deferred)

To keep the 5-day ship clean, the following are V2:

- Multi-tenant RLS (single-org demo only)
- SSO / OAuth / MFA
- Org-level security settings, device management
- Production hardening (SOC 2, multi-region, billing)
- Full semantic enrichment (display-name overlays, alias search)
- Rust data plane / edge distribution
- Full integration test suite

The hackathon version demonstrates the **wedge**, not the full enterprise surface. The vision pitch covers the rest.

---

## Build Plan — Day by Day

**Day 1 — Skeleton**
Next.js + Supabase scaffolding. MCP gateway stateless server factory. Manifest schema (servers, tools, relationships, policies). One hardcoded demo MCP server to prove the transport works end-to-end.

**Day 2 — TRel + OpenAPI Import**
Relationship schema and storage. Implement `discover_relationships`, `find_workflow_path`, `validate_workflow`. OpenAPI 3.x → MCP tool conversion pipeline. Dashboard UI to list servers and visualize the graph.

**Day 3 — Policy Engine**
4 built-in policies with JSON config. Shadow vs enforce modes. Manifest cache invalidation on policy edit so live reload works. No custom DSL — the built-ins cover every demo scenario.

**Day 4 — Observability**
Audit event logging to Postgres. Monitoring dashboard: call volume, policy violations, latency, fallback triggers. Filter events by `trace_id` to reconstruct a run. (Graph viz landed on Day 2; full session replay is V2.)

**Day 5 — Polish + Demo**
Seed data. Pre-scripted demo Claude agent with 3 scenarios. README. 2-minute walkthrough video. Deploy to Vercel.

---

## Success Criteria

At the end of day 5, a live demo should show:

1. An OpenAPI URL pasted, an MCP server created, and an agent using it within 30 seconds.
2. A Claude agent completing a multi-step workflow using `find_workflow_path`, with full audit trail.
3. A policy edited in the UI, with the **next** agent call reflecting the change — no restart.
4. A dashboard showing the live workflow graph, policy decisions, and fallback routing in real time.

If all four work on stage, we ship. If any one breaks, we fall back to a recorded demo for that step and ship anyway. Hackathon rules: demos beat perfect code.
