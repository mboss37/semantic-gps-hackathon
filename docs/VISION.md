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

One control plane that sits between agents and any MCP-connected business system, with five primitives. The most powerful one first.

### 1. Shadow → enforce live policy mode swap (with audit feedback)

The canonical observe-before-acting pattern that none of those incidents had. Author a policy in shadow mode. Watch the audit page light up with would-have-blocked entries against real production traffic. Flip to enforce when compliance is comfortable. Hot-swap on a DB column, no agent redeploy, no upstream restart.

This is the production-readiness lever: compliance teams ship policy changes without an engineering handshake. Every gateway-native policy inherits the same observe→enforce lifecycle. Each new policy generates evidence that informs the next one. The flywheel is the unlock.

### 2. Audit trail on every call

Every gateway call (allowed, blocked, errored, fallback-triggered, rollback-executed) lands in `mcp_events` with policy verdicts, latency, redacted payload, and a `trace_id` that groups multi-step runs. Compliance teams have the receipt they need. Security teams can reconstruct the full chain after an incident — the receipt Yue would have had after her inbox went dark.

### 3. Twelve gateway-native policies across seven governance dimensions

Time gates (`business_hours`, `write_freeze` — the kill-switch Replit lacked), rate limiting, identity (`client_id`, `agent_identity_required`), residency (`ip_allowlist`, `geo_fence`), data hygiene (`pii_redaction` with libphonenumber-js, `injection_guard` — the surface Cursor's agent missed), kill switches, idempotency. Each one a real production guard, configurable per-server, per-tool, per-route.

### 4. Saga rollback as a first-class primitive

Per-step explicit `rollback_input_mapping` DSL. When a multi-step route halts, the gateway compensates in reverse with mapped args, not result-passthrough guessing. The standard distributed-systems pattern, finally available to agents. The thing Replit's agent claimed couldn't be done.

### 5. Tool Relationship (TRel) extension

A new MCP method set on top of `tools/list`: `discover_relationships`, `find_workflow_path`, `validate_workflow`, `evaluate_goal`. Agents stop guessing which tools chain; they query.

Plus a side-by-side Playground (same Opus 4.7 client, same prompt, two endpoints: raw MCP vs the governed gateway) that proves the contrast under controlled, reproducible conditions.

## Where it goes

The current build is one Next.js app doing two jobs: the control plane (UI, policy authoring, audit, manifest cache) AND the data plane (the gateway proxying live tool calls to whatever MCP servers a customer registers).

That's the right wedge. It's not the right shape at scale. The architecture this points at:

- **Rust data plane, deploy-anywhere.** Cloudflare Workers, Kubernetes sidecar, customer VPC, air-gapped. Tool calls never leave the customer's network. Latency stays low; compliance stays happy.
- **Multi-region Next.js control plane.** Where the customer's admins sit. Compiles signed Navigation Bundles for the data plane to pull. One control plane, many data planes.
- **Protocol-agnostic surface.** MCP today, A2A tomorrow. Routes are the abstraction; transports plug in.
- **Semantic Definition Store.** Decouple "what a Lead is" from "how Salesforce represents a Lead." Agents reason in the customer's domain language; the gateway translates.

Today's wedge is a working slice. Tomorrow's surface is the deploy-anywhere governance plane every enterprise agent platform will need.
