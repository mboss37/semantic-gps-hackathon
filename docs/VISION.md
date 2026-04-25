# Vision

> Where Semantic GPS goes after the hackathon.

## TL;DR

Semantic GPS today is a single Next.js app that ships a working wedge: an MCP control plane that governs agentic workflows across Salesforce, Slack, and GitHub with 12 gateway-native policies, real saga rollback, and a side-by-side Playground showing raw-MCP chaos vs governed orchestration.

The architecture this points at is not a single app. It's a split **control plane + data plane** — the same pattern enterprise buyers already recognize from Istio/Envoy, Cloudflare Zero Trust, and every serious service mesh built in the last decade. That split is what turns Semantic GPS from a demo into infrastructure.

## The wedge (what shipped this week)

- 3 real MCP integrations (Salesforce OAuth, Slack Bot API, GitHub PAT) fronting 12 curated tools
- 12 gateway-native policies across 7 governance dimensions (time/state gates, rate limiting, identity, residency, data hygiene, kill switches, idempotency)
- Route orchestration with canonical saga rollback — explicit per-step `rollback_input_mapping` DSL, not result-passthrough guessing
- Playground A/B — same prompt, same Opus 4.7 client, two endpoints (raw MCP vs governed); contrast renders in real time
- Three-tier scoped gateway (org / domain / server) with bearer-token auth and per-scope manifest caching
- Shadow → enforce policy mode swap, demoed live

All of it runs on one Next.js app against Postgres. That's the right shape for a hackathon demo. It is not the right shape for what this needs to become.

## The architecture vision

### Control plane — Next.js, multi-region

Policy authoring, graph authoring, analytics, audit, tenant onboarding. Runs where the customer's admins sit — EU-West for GDPR tenants, US-East for US tenants, customer-self-hosted for air-gapped. The control plane compiles **Navigation Bundles** (signed, encrypted, versioned artifacts bundling the graph + policies + semantic definitions) and publishes them for the data plane to pull.

The control plane is where humans do work. It does not sit in the hot path.

### Data plane — Rust, deploy-anywhere

Every agent → tool call flows through the data plane. A Rust binary + Wasm distribution speaking the same `/api/mcp` wire protocol we ship today, sized to run:

- as a sidecar in customer Kubernetes clusters
- on Cloudflare Workers or Fly.io edge
- inside the customer's VPC, with zero outbound connectivity to us
- air-gapped, loading the latest Navigation Bundle from disk

The data plane is the hot path. It enforces every policy, emits every audit event, executes every saga. Sub-millisecond policy checks. Tool calls never leave the customer's network perimeter.

### Sync layer — Navigation Bundles

Compiled on the control plane, pulled by the data plane. Signed with per-tenant keys, gzipped, versioned. Online mode: the data plane polls for the latest bundle revision. Offline / air-gapped mode: operators ship bundles on a USB stick. Either way, the control plane is never a dependency of a live agent call.

## Why this wins for agents specifically

1. **Data residency is non-negotiable.** EU AI Act tenants, HIPAA tenants, FINRA tenants cannot send tool inputs through a SaaS gateway. A Rust sidecar inside their VPC ends that conversation on day one.
2. **Latency compounds.** Agent loops hit tools dozens of times per task. Sub-ms policy check at the edge beats 80ms round-trip to a SaaS control plane every single time. Multiply by N tool calls per agent turn.
3. **Air-gapped enterprises are real.** Defense, finance, utilities. Bundle-based sync means the data plane runs with zero outbound connectivity and still enforces a policy suite authored in the UI a continent away.
4. **Protocol-agnostic future.** MCP today. A2A (Agent-to-Agent) tomorrow. Custom protocols after that. Routes are the abstraction; transports plug in. The data plane stays stable while the protocol surface grows.

## Roadmap (post-hackathon — explicitly not built this week)

All of these live in `BACKLOG.md § Vision gaps` with full specs.

### Deploy-anywhere data plane
- Rust port of `stateless-server` + policy engine + audit logger
- Wasm + native distribution; same wire protocol
- Navigation Bundle compile + pull (online + offline modes)

### Multi-protocol surface
- A2A bridge — Routes exposed as both MCP and A2A endpoints
- Agent Card Designer — richer semantic rewriting than name aliases; templated presentation of tools to agents

### Semantic layer
- Semantic Definition Store — decouple "what a Lead **is**" from "how Salesforce represents a Lead"; every MCP reference pulls the same canonical definition
- Semantic caching — memoize goal → route on normalized goal strings, invalidate on manifest revision

### Enterprise-grade observability
- OpenTelemetry traces per route step (Honeycomb / Datadog integration)
- Simulation Playground — sandbox agent evaluator that scores route navigation success before production deploy
- First-class Rollback Routes — named, reusable compensation chains (not just per-step `rollback_tool_id`)

## Non-goals (won't build, explicitly)

- Authoring UI for the data plane itself. The data plane pulls; it does not author.
- A proprietary protocol between control and data plane. Standard wire formats only.
- Replacing downstream governance. Salesforce Approval Processes, SAP Workflow, LLM-provider cost dashboards — we do not compete with the systems that have better visibility into the data. Semantic GPS governs the **call**; downstream governs the **data**. That boundary is load-bearing, not a compromise.

## Closing

Semantic GPS 2026 is one app doing two jobs.
Semantic GPS 2027 is two planes doing them at scale.

The wedge is shipped. The vision is mapped. The split is the only way this becomes infrastructure instead of a feature.
