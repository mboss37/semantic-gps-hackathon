# Security policy

Semantic GPS is the governance gateway between AI agents and the business systems they call. Security reports are taken seriously and processed under the policy below.

## Scope

This policy covers the Semantic GPS reference implementation in this repository:

- The MCP gateway routes (`app/api/mcp/*`)
- The control-plane dashboard (`app/dashboard/*`, `app/api/*`)
- Shared libraries (`lib/*`)
- Database migrations (`supabase/migrations/*`)
- Documented architecture, audit, and policy machinery

Out of scope:

- Issues affecting third-party MCP servers or upstream APIs the customer registers
- Credentials provided by users (rotate on your side)
- Vulnerabilities in dependencies — please report those upstream

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports.** Instead:

1. Email a description of the issue, reproduction steps, and any proof-of-concept to **`security@bosnjak.io`** (or DM the maintainer directly if you have a private channel established).
2. Mark the subject line `SECURITY: <short summary>`.
3. If you do not receive an acknowledgement within 5 business days, please follow up — mail is occasionally lost.

Reports may include:

- Authentication or authorization bypass
- Cross-organization data leakage (RLS, app-layer scoping, view-as-other-org)
- Server-side request forgery (SSRF) in any outbound fetch
- Credential exfiltration (encrypted-at-rest secrets, gateway tokens, OAuth flows)
- Prompt-injection paths that bypass policy enforcement
- Denial-of-service vectors on the gateway, audit log, or policy evaluator
- Replay attacks on saga state, rollback, or audit emission
- Anything that lets an agent take an action a configured policy was supposed to prevent

## Disclosure timeline

- **Day 0:** Report received.
- **Day 0–2:** Acknowledgement sent. Severity assessed.
- **Day 2–14:** Investigation, fix, regression test.
- **Day 14–60:** Patch landed on `main`, hosted deploy verified, internal-only validation.
- **Day 60–90:** Coordinated public disclosure if the issue affects deployed users beyond the maintainer's own stack. Reporter is credited unless they request anonymity.

For severe issues (credential exfiltration, cross-org leakage on hosted), the timeline compresses to days, not weeks.

## What you can expect

- Acknowledgement within 5 business days.
- Honest severity assessment back to you, not corporate-speak.
- Credit on disclosure (public CHANGELOG entry + commit message reference) unless you opt out.
- No legal action against good-faith research.

## What we ask in return

- Do not exploit beyond what is needed to demonstrate the issue.
- Do not access, modify, or destroy data that is not your own.
- Do not run automated scanners against the hosted instance without prior coordination.
- Hold the issue confidential until coordinated disclosure lands.

## Threat model

The full attack-surface taxonomy and mitigation matrix lives at [`docs/THREAT-MODEL.md`](./docs/THREAT-MODEL.md). Both documents are intentionally lean for the hackathon-day cut and deepen as the project matures.

## Hall of fame

Reporters credited for accepted reports will be listed here. Empty for now — be the first.
