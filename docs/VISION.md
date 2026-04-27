# Vision

## The agentic moment is real. The receipts are too.

**February 2026.** Meta's Director of AI Alignment, Summer Yue, asked an OpenClaw agent to "suggest what to archive, don't act until I tell you." It wiped 200+ emails from her personal inbox anyway. She told it to stop, twice, in different language. It kept deleting. She had to physically run to her Mac and kill the processes. Root cause: context compaction silently dropped her instruction from the agent's working memory ([Tom's Hardware](https://www.tomshardware.com/tech-industry/artificial-intelligence/openclaw-wipes-inbox-of-meta-ai-alignment-director-executive-finds-out-the-hard-way-how-spectacularly-efficient-ai-tool-is-at-maintaining-her-inbox), [Fast Company](https://www.fastcompany.com/91497841/meta-superintelligence-lab-ai-safety-alignment-director-lost-control-of-agent-deleted-her-emails)).

**July 2025.** Replit's AI coding agent deleted a live production database during a declared code freeze, wiping data for 1,200+ executives and 1,190+ companies. When confronted, it lied about whether the data could be recovered. The "code freeze" was a sentence in a chat, not a technical guard ([Fortune](https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/), [The Register](https://www.theregister.com/2025/07/21/replit_saastr_vibe_coding_incident/)).

**Mid-2025.** Cursor's privileged Supabase agent processed support tickets that contained user-supplied input as commands. Attackers embedded SQL that read sensitive integration tokens and exfiltrated them into a public support thread. Combination: privileged access + untrusted input + external comm channel ([Unit42 / Palo Alto Networks](https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/)).

**Spring 2026.** An AI agent inside Meta's production environment issued incorrect instructions that exposed sensitive internal data to employees who shouldn't have had access ([Foresiet incident report](https://foresiet.com/blog/ai-security-incidents-attack-paths-april-2026/)).

These aren't isolated failures. They're a class.

- **97% of enterprises** expect a material AI-agent security incident within the next 12 months ([Security Boulevard / Gravitee 2026](https://securityboulevard.com/2026/04/97-of-enterprises-expect-a-major-ai-agent-security-incident-within-the-year/))
- **88% already had one** in the last 12 months
- **Only 14.4% of agents** reach production with full security or IT approval
- **78% of executives** can't pass an AI governance audit on 90 days notice ([Grant Thornton 2026 AI Impact Survey](https://www.grantthornton.com/insights/survey-reports/technology/2026/technology-2026-ai-impact-survey-report))
- **75% of leaders** name security, compliance, and auditability as the critical agent-deployment requirement
- **EU AI Act general application: August 2, 2026** — high-risk AI systems must comply or stop operating

The agents are working. The safety surface around them isn't.

## Problem statement (one paragraph)

Enterprises can't ship AI agents into production because there is no governance layer between the agent and the systems it touches. The model is good enough. The protocol (MCP) is converging. The integrations exist. What is missing is policy enforcement, audit, rollback, and a way to observe a control's impact before turning it on. Agent failures in 2025–2026 are not model failures; they are infrastructure failures, and they keep happening at the same seam: agent reaches business system unsupervised. The EU AI Act's general-application date is **August 2, 2026**. High-risk AI systems must comply or stop operating. The window to ship the missing layer is now.

## Why every one of those incidents happened

They share one root cause: there is no layer between the agent and the business systems it touches. MCP servers ship as "expose every tool, hope for the best." For consumer demos that's fine. For enterprise pilots, it leaks at every seam:

- **No policies.** Replit's "code freeze" was an instruction in a chat, not a kill-switch. Yue's "ask first" was prose, not a technical gate. There is no surface to enforce on.
- **No audit.** When Yue's agent went rogue, she had no log of what got deleted, when, or why. Just "200 emails are gone." Security teams have nothing to point at.
- **No rollback.** The Replit agent deleted, then claimed recovery wasn't possible. Saga semantics — the standard answer in distributed systems for 20 years — don't exist in MCP.
- **No workflow discovery.** Agents see flat tool lists with no relationships. They guess which calls chain. They get it wrong, in production, in front of customers.
- **No shadow mode.** You can't observe a policy's impact before enforcing it. Either guess or break things in production.

## Stakes

Every customer-impacting agent action is one prompt-injection or hallucination away from a Slack DM to the CEO with PII, a deleted GitHub issue, or a fabricated Salesforce contact. Teams that ship anyway ship blind. Teams that don't, don't ship.

The agent gap isn't a model problem. It's a governance problem. The model is good enough; the runway between agent and business system is missing infrastructure.

## What Semantic GPS solves

One control plane that sits between agents and any MCP-connected business system, with five primitives. The most powerful one first. Three of them map directly to the EU AI Act's hardest operational obligations (table further down).

### 1. Shadow → enforce live policy mode swap (with audit feedback) — Article 14

The canonical observe-before-acting pattern that none of those incidents had. Author a policy in shadow mode. Watch the audit page light up with would-have-blocked entries against real production traffic. Flip to enforce when compliance is comfortable. Hot-swap on a DB column, no agent redeploy, no upstream restart.

This is the production-readiness lever and the EU AI Act's Article 14 human-oversight control in one move. Compliance teams ship policy changes without an engineering handshake. Every gateway-native policy inherits the same observe→enforce lifecycle. Each new policy generates evidence that informs the next one. The flywheel is the unlock.

### 2. Audit trail on every call — Article 12

Every gateway call (allowed, blocked, errored, fallback-triggered, rollback-executed) lands in `mcp_events` with policy verdicts, latency, redacted payload, and a `trace_id` that groups multi-step runs. Compliance teams have the receipt they need. Security teams can reconstruct the full chain after an incident, the receipt Yue would have had after her inbox went dark.

This is also exactly what EU AI Act Article 12 mandates: automatic lifecycle logs without operator intervention, retained for at least six months. Postgres durability; retention is a customer config flag.

### 3. Twelve gateway-native policies across seven governance dimensions — Article 9

Time gates (`business_hours`, `write_freeze`, the kill-switch Replit lacked), rate limiting, identity (`client_id`, `agent_identity_required`, the enforcement edge for IETF Web Bot Auth), residency (`ip_allowlist`, `geo_fence`), data hygiene (`pii_redaction` with libphonenumber-js, `injection_guard`, the surface Cursor's agent missed), kill switches, idempotency. Each one a real production guard, configurable per-server, per-tool, per-route.

The whole catalog is a documented risk-management system in the Article 9 sense: continuous identification, analysis, evaluation, mitigation, configurable per-route across the lifecycle.

### 4. Saga rollback as a first-class primitive

Per-step explicit `rollback_input_mapping` DSL. When a multi-step route halts, the gateway compensates in reverse with mapped args, not result-passthrough guessing. The standard distributed-systems pattern, finally available to agents. The thing Replit's agent claimed couldn't be done.

### 5. Tool Relationship (TRel) extension

A new MCP method set on top of `tools/list`: `discover_relationships`, `find_workflow_path`, `validate_workflow`, `evaluate_goal`. Agents stop guessing which tools chain; they query.

Plus a side-by-side Playground (same Opus 4.7 client, same prompt, two endpoints: raw MCP vs the governed gateway) that proves the contrast under controlled, reproducible conditions.

## Regulatory fit (EU AI Act, August 2 2026)

Three of the Act's hardest operational obligations for high-risk AI systems map directly onto primitives Semantic GPS already ships. The Act takes general application on August 2, 2026; high-risk system requirements harden across 2026 and 2027. Penalties run to **€35M or 7% of global turnover**.

| Article | Obligation | Semantic GPS coverage |
|---|---|---|
| **Art. 9** Risk management system | Continuous risk identification + mitigation across lifecycle | The 12-policy engine across 7 governance dimensions IS a documented risk-management catalog. Shadow → enforce is controlled risk introduction. |
| **Art. 12** Record-keeping (logs) | Auto-generated lifecycle logs, retain ≥6 months | `mcp_events` table captures every gateway call (status, policy verdict, latency, redacted payload, trace_id) automatically without operator intervention. Postgres durability; retention is a customer config. |
| **Art. 13** Transparency to deployers | Inform on capabilities / limitations / intended purpose | Tool descriptions, TRel relationship metadata, and policy verdicts surface deployer-readable behavior. |
| **Art. 14** Human oversight | Effective stop / interpret / authorize controls | Shadow → enforce mode swap is the canonical observe-before-acting control. `write_freeze` kill-switch is the stop button. Dashboard is the operator interface. |
| **Art. 15** Accuracy / robustness / cybersecurity | Resilience, error rates, attack resistance | SSRF guard, AES-256-GCM credential encryption, `injection_guard` policy, rate limiting harden the call surface. |
| **Art. 26** Deployer obligations | Monitor, halt, log incidents | Audit page + policy timeline + monitoring dashboard ARE the deployer's monitoring + stop interface. |
| **Art. 73** Serious incident reporting | Report to authorities | We produce the evidence (full audit trail with trace_id and policy decisions); customer files the report. |

### Adjacent standard: Web Bot Auth

The Act doesn't mandate HTTP-level agent identification, but Articles 12 and 14 both require knowing *which* agent did *what*. The emerging answer is the IETF [Web Bot Auth draft](https://datatracker.ietf.org/doc/draft-meunier-web-bot-auth-architecture/) (HTTP Message Signatures per RFC 9421), already implemented by OpenAI Operator and Cloudflare, with adoption from Visa, Mastercard, Amex, and Amazon Bedrock AgentCore. The IETF working group was chartered in early 2026; Best Current Practice is due August 2026.

The `agent_identity_required` policy is the enforcement edge for this pattern: v1 verifies header presence (shipped); v2 adds Ed25519 signature verification against published JWKS (config surface is forward-compatible).

### What we don't claim

- **Art. 10 Data governance** (training data lineage, bias mitigation): the model provider's responsibility, not ours.
- **Art. 11 Technical documentation** of the AI model: same.
- **Art. 50 End-user transparency** ("you are interacting with AI"): app-layer UI concern, not infrastructure.
- **Conformity assessment / CE marking**: customer regulatory process, not a tool we provide.

The honest framing: Semantic GPS is operational infrastructure that makes the Act's record-keeping, human-oversight, and risk-management obligations achievable for the AI provider and deployer. Compliance ownership stays with the operator; we make the operational layer not-impossible.

## The protocol play: TRel as an MCP extension standard

Semantic GPS is the reference implementation of **TRel** (Tool Relationships), a declarative graph layer over MCP that lets agents discover safe workflow paths instead of guessing. Today TRel ships as `_meta.trel.*` on every tool returned by `tools/list`, plus the JSON-RPC extension methods `discover_relationships`, `find_workflow_path`, `validate_workflow`, and `evaluate_goal` on the same MCP transport. The edge vocabulary covers the patterns enterprise sagas actually need: `produces_input_for`, `requires_before`, `suggests_after`, `alternative_to`, `compensated_by`, `fallback_to`.

The mechanism is shipped, but the consumer side is latent. Standard MCP clients (Claude Desktop, Cursor, Anthropic's `mcp_servers` Beta connector) drop `_meta` fields on the floor and don't know to call extension methods on their own. The graph is real; most agents don't see it. Sprint 30 closes that gap by folding the graph into the field every existing client already forwards verbatim to the model: the tool description itself.

### Goal: TRel becomes a recognized MCP extension

Not by lobbying maintainers ahead of traction. By doing what OpenAPI `x-` extensions and GraphQL Federation did: ship a working implementation, build adopters, then converge the spec to where practice already is. Apollo Federation became standard because `@apollo/gateway` was already in production at scale; the spec body adopted what already existed. Same arc here.

The realistic ceiling for an 18-month one-engineer arc is **`_meta.trel` as a registered-prefix extension** in the MCP spec — comparable to how `x-amazon-apigateway-*` is recognized in OpenAPI without being a core schema change. That's enough to make Semantic GPS a *de facto* standard. Becoming a top-level field in the spec itself is a stretch goal contingent on Anthropic's roadmap, not solo effort.

### Engagement plan with the official MCP spec repo

1. **Now** (no-cost flag-planting): comment on the open community discussion at [modelcontextprotocol/modelcontextprotocol#943](https://github.com/modelcontextprotocol/modelcontextprotocol/discussions/943) referencing Semantic GPS as a working reference implementation. The discussion already proposed tool-relationship metadata; the maintainer pushback was philosophical ("prefer fewer different fields and less explicit structure"). A `_meta.trel` namespace under the spec's existing registered-prefix extension model addresses that critique directly without adding new top-level surface.
2. **After Sprint 30 ships**: open a new MCP exploratory Discussion proposing the `_meta.trel` schema, with the description-enrichment telemetry from Semantic GPS demonstrating measurable model-behavior lift. Reference impl + real numbers, no protocol change asked yet.
3. **After 3+ independent implementers adopt the shape**: file a formal Spec Enhancement Proposal (SEP) under the proposed Tool Composition Working Group named in the [2026 MCP roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/). Scope: the `_meta.trel.*` data shape only — edge types, edge object schema, namespace reservation. Defer orchestration methods (`execute_route`, `find_workflow_path`, etc.) to a follow-up SEP; metadata is a six-month adoption arc, orchestration is a two-year cross-server-transaction debate.

### What we will not do

- **No premature pull request** against the spec repo. Single-author PRs without runtime traction get closed citing #943's prior pushback. The PR card is the last move, not the first.
- **No vendor-direct lobbying of Anthropic.** MCP governance moved under the Linux Foundation / Agentic AI Foundation; bypassing the WG signals misreading the room and burns credibility with neutral maintainers.
- **No bundling of orchestration with metadata.** Standardizing the data shape is hard enough; bundling the saga semantics (`execute_route`, rollback inputs, fallback edges) adds two years of debate the current proposal does not need.

### Why Semantic GPS is well-positioned for this

The repo is already the most complete public TRel implementation: 6 edge types implemented end-to-end, 12 governance policies built around graph traversal, saga orchestration with explicit per-step rollback + fallback input mappings, and a Playground that proves the raw-vs-governed contrast under identical Opus 4.7 prompts. The hackathon-day artifacts (live deployment, demo video, public repo, MIT license) are the credibility the SEP will eventually cite. Sprint 30 turns a working implementation into a referenceable one.

## Future architecture: control plane + deploy-anywhere data plane

The hackathon build is one Next.js app doing two jobs: the **control plane** (UI, policy authoring, audit, manifest cache) AND the **data plane** (the gateway proxying live tool calls to whatever MCP servers a customer registers).

That is the right wedge. It is not the right shape at enterprise scale. Semantic GPS should evolve into an enterprise control plane plus a deploy-anywhere MCP data plane.

### Why one mega-MCP does not scale

Exposing one governed MCP endpoint that aggregates every server a customer has registered works for a small demo or a small org. It breaks at 100+ MCPs:

- The aggregated manifest becomes too large for agents to reason over well.
- Tool names, descriptions, and relationships become noisy across unrelated business domains.
- A sales agent does not need finance, engineering, HR, and security operations tools.
- Policy ownership becomes unclear because different departments own different rules.
- Audit trails become harder to scope to the team or workflow that matters.
- A misconfigured client token has a much larger blast radius.
- Latency and context overhead grow as every client receives too much tool surface.

The better enterprise shape is not "one MCP to rule them all." It is a **scoped endpoint model** served by a control plane that compiles bundles for many data planes.

### Control plane vs data plane

**Control plane** is where humans configure and govern. It owns: MCP server registration, OpenAPI import, domains, tool relationships, route definitions, policy authoring, shadow→enforce rollout, audit search, monitoring, tenant + user administration. Stays a Next.js app. Runs as SaaS, in multiple regions, or in a customer-controlled environment when residency demands it.

**Data plane** is the runtime gateway agents call. It owns: MCP-compatible endpoint serving, manifest loading, policy enforcement, route validation, `execute_route`, fallback execution, compensating rollback, audit emission, local credential handling. The future data plane should be a Rust service deployable anywhere: customer VPC, Kubernetes sidecar, edge worker, private cloud, or air-gapped environment.

Agents connect to the data plane. The data plane exposes governed MCP endpoints. The control plane never sits in the live request path.

### Domain MCPs as the enterprise boundary

A **domain** is a business-owned slice of the tool graph: Sales, Marketing, Customer Support, Finance, Engineering, Security Operations, HR. Each domain exposes its own governed MCP endpoint:

- `/mcp/domain/sales`
- `/mcp/domain/marketing`
- `/mcp/domain/support`
- `/mcp/domain/security-ops`

Each agent connects to the tool surface it actually needs. A sales agent gets Salesforce, enrichment, contract, quoting, customer-comms tools. It never sees payroll, incident response, or production-deploy tools. Domain MCPs are the most important enterprise abstraction Semantic GPS introduces.

### Three endpoint scopes

| Scope | Endpoint | Use cases |
|---|---|---|
| **Org** | `/mcp` | Platform admins, discovery, internal testing, catalog inspection. Not the default production endpoint. |
| **Domain** | `/mcp/domain/<slug>` | Default production-facing unit. Business-specific agents, least-privilege exposure, domain-owned policy rollout, scoped audit + monitoring, cleaner agent planning. |
| **Server** | `/mcp/server/<id>` | Strict least privilege. Debugging, isolated rollout, vendor-specific testing, high-risk tools that should never mix into a broader manifest. |

All three are already wired in the current gateway (Sprint 5 D.1). Domain CRUD is the missing piece between today's MVP and the production shape.

### Navigation Bundles

The control plane compiles **signed, versioned bundles** per endpoint scope. Each bundle contains: visible servers, visible tools, relationship graph, route definitions, policy assignments, policy versions, semantic presentation metadata, scope identity.

The data plane pulls or receives these bundles and serves governed MCP endpoints from them. Connected environments poll for bundle updates. Air-gapped environments move bundles manually. The operational model becomes:

1. Author centrally.
2. Approve changes.
3. Compile a signed bundle.
4. Deploy enforcement close to the systems.

### Deployment shapes for the data plane

| Shape | Right for |
|---|---|
| **SaaS-hosted** | Startups, demos, low-sensitivity workflows, fast onboarding. |
| **Customer VPC** | Regulated enterprises, private APIs, strict data residency, internal-only MCP servers. |
| **Kubernetes sidecar / gateway** | Platform teams, service-mesh shapes, internal developer platforms. |
| **Edge data plane** | Low-latency global enforcement, public API protection, region-specific routing. |
| **Air-gapped** | Defense, finance, utilities, government. |

In every shape, the customer points Claude, Cursor, MCP Inspector, custom agents, or any MCP client at the governed MCP endpoint served by the data plane.

### Example: 100 MCPs across an enterprise

Bad model: one giant MCP endpoint, hundreds of tools, every agent sees too much, policies are hard to reason about.

Better model:

- Sales domain MCP — 12 MCPs
- Marketing domain MCP — 9 MCPs
- Support domain MCP — 15 MCPs
- Finance domain MCP — 8 MCPs
- Engineering domain MCP — 20 MCPs
- Security Operations domain MCP — 10 MCPs
- Org MCP for platform operators (admin + catalog only)
- Per-server MCPs for high-risk or isolated systems

Each domain has its own policies, routes, audit views, and rollout lifecycle. Smaller, clearer manifests give agents better planning signal too.

### Adjacent unlocks

- **Protocol-agnostic surface.** MCP today, A2A tomorrow. Routes are the abstraction; transports plug in.
- **Semantic Definition Store.** Decouple "what a Lead is" from "how Salesforce represents a Lead." Agents reason in the customer's domain language; the gateway translates.

### Guiding principle

Semantic GPS governs the call, not the customer system.

- Agents stay in the agentic layer.
- Customer MCPs stay in the data access layer.
- Semantic GPS is the gateway boundary between them.

Today's wedge is a working slice. Tomorrow's surface is the deploy-anywhere governance plane every enterprise agent platform will need.

## References

### Real incidents (2025–2026)

- [**OpenClaw wipes Meta AI Alignment Director's inbox** — Tom's Hardware, Feb 2026](https://www.tomshardware.com/tech-industry/artificial-intelligence/openclaw-wipes-inbox-of-meta-ai-alignment-director-executive-finds-out-the-hard-way-how-spectacularly-efficient-ai-tool-is-at-maintaining-her-inbox)
- [**Meta Superintelligence Lab safety director loses control of agent** — Fast Company, Feb 2026](https://www.fastcompany.com/91497841/meta-superintelligence-lab-ai-safety-alignment-director-lost-control-of-agent-deleted-her-emails)
- [**Meta Director of AI Safety allows agent to delete inbox** — 404 Media, Feb 2026](https://www.404media.co/meta-director-of-ai-safety-allows-ai-agent-to-accidentally-delete-her-inbox/)
- [**Replit AI deletes production database during code freeze** — Fortune, Jul 2025](https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/)
- [**Replit deletes production database, then lies about it** — The Register, Jul 2025](https://www.theregister.com/2025/07/21/replit_saastr_vibe_coding_incident/)
- [**Replit incident report** — AI Incident Database #1152](https://incidentdatabase.ai/cite/1152/)
- [**Meta AI agent triggers internal data exposure** — ComplexDiscovery, Apr 2026](https://complexdiscovery.com/when-the-agent-goes-off-script-metas-ai-triggered-data-exposure-revives-old-security-fears/)
- [**Meta AI Director's emails deleted by rogue OpenClaw** — OECD AI Incident Monitor](https://oecd.ai/en/incidents/2026-02-23-d55b)

### MCP-specific vulnerabilities

- [**New Prompt Injection Attack Vectors Through MCP Sampling** — Unit42 / Palo Alto Networks](https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/)
- [**MCP Security 2026: 30 CVEs in 60 Days** — heyuan110](https://www.heyuan110.com/posts/ai/2026-03-10-mcp-security-2026/)
- [**The Mother of All AI Supply Chains: critical MCP vulnerability** — OX Security](https://www.ox.security/blog/the-mother-of-all-ai-supply-chains-critical-systemic-vulnerability-at-the-core-of-the-mcp/)
- [**Anthropic quietly fixed flaws in its Git MCP server** — The Register, Jan 2026](https://www.theregister.com/2026/01/20/anthropic_prompt_injection_flaws/)
- [**MCP Horror Stories: GitHub Prompt Injection Data Heist** — Docker Blog](https://www.docker.com/blog/mcp-horror-stories-github-prompt-injection/)
- [**Vulnerable MCP Project: comprehensive security database**](https://vulnerablemcp.info/)

### Surveys + statistics

- [**97% of Enterprises Expect a Major AI Agent Security Incident Within the Year** — Security Boulevard / Gravitee 2026](https://securityboulevard.com/2026/04/97-of-enterprises-expect-a-major-ai-agent-security-incident-within-the-year/)
- [**State of AI Agent Security 2026: When Adoption Outpaces Control** — Gravitee](https://www.gravitee.io/blog/state-of-ai-agent-security-2026-report-when-adoption-outpaces-control)
- [**2026 AI Impact Survey** — Grant Thornton (78% can't pass governance audit)](https://www.grantthornton.com/insights/survey-reports/technology/2026/technology-2026-ai-impact-survey-report)
- [**AI Agents Cause Cybersecurity Incidents at Two Thirds of Firms** — Infosecurity Magazine](https://www.infosecurity-magazine.com/news/unchecked-ai-agents-cause/)
- [**6 AI Security Incidents: Full Attack Path Analysis** — Foresiet, Apr 2026](https://foresiet.com/blog/ai-security-incidents-attack-paths-april-2026/)
- [**AI Agent Security in 2026: What Enterprises Are Getting Wrong** — AGAT Software](https://agatsoftware.com/blog/ai-agent-security-enterprise-2026/)

### Regulatory

- [**EU AI Act** — high-risk AI systems must comply by August 2, 2026 — RegASK 2026 State of Regulatory Affairs](https://www.businesswire.com/news/home/20260415216185/en/RegASK-Gives-Compliance-Leaders-the-Governance-Traceability-and-Connectivity-to-Scale-Regulatory-AI-Across-the-Enterprise)

