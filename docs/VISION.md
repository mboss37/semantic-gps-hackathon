# Vision

## The agentic moment is real. The safety surface isn't.

AI agents are calling tools in production this year. The Model Context Protocol (MCP) is becoming the standard for how they reach business systems: CRMs, communication platforms, source control, internal databases, every API a customer cares about. The protocol works. The market understands it. The agents are getting good.

What's missing is the layer that makes them safe to ship into regulated environments.

## What's broken today

MCP servers were designed as "expose every tool, hope for the best." For consumer demos that's fine. For enterprise pilots, it leaks at every seam:

- **No policies.** An agent can call any registered tool, anytime, with any arguments. No business-hours gate, no rate limit, no PII redaction, no kill-switch. Compliance teams have no surface to enforce on.
- **No audit.** Every tool call is a black box. Security teams have nothing to point at after an incident.
- **No rollback.** A multi-step agent action that halts halfway through leaves the world inconsistent. Manual cleanup, every time. Saga semantics, the standard answer in distributed systems for 20 years, don't exist in MCP.
- **No workflow discovery.** Agents see flat tool lists with no relationships. They guess which calls chain. They get it wrong, in production, in front of customers.
- **No shadow mode.** You can't observe a policy's impact before enforcing it. Either guess or break things.

The result: compliance won't let agents touch production. Pilots stay pilots.

## Stakes

Every customer-impacting agent action is one prompt-injection or hallucination away from a Slack DM to the CEO with PII, a deleted GitHub issue, or a fabricated Salesforce contact. Teams that ship anyway ship blind. Teams that don't, don't ship.

The agent gap isn't a model problem. It's a governance problem. The model is good enough; the runway between agent and business system is missing infrastructure.

## What Semantic GPS solves

One control plane that sits between agents and any MCP-connected business system, with five primitives:

1. **Live policies.** Twelve gateway-native policies across seven governance dimensions: time gates, rate limiting, identity, residency, data hygiene (PII redaction with libphonenumber-js), kill switches, idempotency. Each hot-swaps shadow ↔ enforce from the dashboard without redeploying agents or restarting upstreams.

2. **Tool Relationship (TRel) extension.** A new MCP method set on top of `tools/list`: `discover_relationships`, `find_workflow_path`, `validate_workflow`, `evaluate_goal`. Agents stop guessing which tools chain; they query.

3. **Saga rollback as a first-class primitive.** Per-step explicit `rollback_input_mapping` DSL. When a multi-step route halts, the gateway compensates in reverse with mapped args, not result-passthrough guessing. The standard distributed-systems pattern, finally available to agents.

4. **Audit trail on every call.** Every tool call (allowed, blocked, errored, fallback-triggered, rollback-executed) lands in `mcp_events` with policy verdicts, latency, redacted payload, and a `trace_id` that groups multi-step runs. Compliance teams have the receipt they need.

5. **Side-by-side Playground.** Same Opus 4.7 client, same prompt, two endpoints: raw MCP vs the governed gateway. The contrast is visible, honest, reproducible. Variable isolation: only the URL differs.

## Where it goes

The current build is one Next.js app doing two jobs: the control plane (UI, policy authoring, audit, manifest cache) AND the data plane (the gateway proxying live tool calls to whatever MCP servers a customer registers).

That's the right wedge. It's not the right shape at scale. The architecture this points at:

- **Rust data plane, deploy-anywhere.** Cloudflare Workers, Kubernetes sidecar, customer VPC, air-gapped. Tool calls never leave the customer's network. Latency stays low; compliance stays happy.
- **Multi-region Next.js control plane.** Where the customer's admins sit. Compiles signed Navigation Bundles for the data plane to pull. One control plane, many data planes.
- **Protocol-agnostic surface.** MCP today, A2A tomorrow. Routes are the abstraction; transports plug in.
- **Semantic Definition Store.** Decouple "what a Lead is" from "how Salesforce represents a Lead." Agents reason in the customer's domain language; the gateway translates.

Today's wedge is a working slice. Tomorrow's surface is the deploy-anywhere governance plane every enterprise agent platform will need.
