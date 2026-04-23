# Submission summary

> 100-200 word summary for the CV hackathon platform. Copy-paste target.

---

## Short summary (~150 words)

**Semantic GPS** is an MCP control plane that turns flat `tools/list` arrays into governed, typed workflow graphs — so compliance teams can ship agents into regulated environments without rewriting prompts or redeploying code.

The demo gateway fronts real Salesforce, Slack, and GitHub integrations across 12 curated tools. Twelve gateway-native policies span seven governance dimensions (time gates, rate limiting, identity, data residency, PII redaction, kill switches, idempotency) and hot-swap between shadow and enforce modes live. Routes execute as sagas with canonical per-step rollback mapping, not result-passthrough guessing. A side-by-side Playground runs the same Opus 4.7 client against raw MCP vs the governed gateway, so the contrast is visible, honest, and reproducible.

Opus 4.7 drives the product loop: `evaluate_goal` ranking, Playground agent orchestration, and the 1M-context review cycles that let one builder ship this in five days.

The architecture points at a split control/data plane — Rust data plane deploy-anywhere, Next.js control plane multi-region — covered in `VISION.md`.

---

## Shortest pitch (≤25 words)

Governed MCP control plane for enterprise agents. Live policies, saga rollback, shadow-to-enforce swap, real Salesforce + Slack + GitHub. Opus 4.7 throughout. Wedge for a Rust/Next.js platform split.

---

## Links

- **Repo:** https://github.com/mboss37/semantic-gps-hackathon
- **Live:** https://semantic-gps-hackathon.vercel.app/
- **Vision:** [`VISION.md`](../VISION.md)
- **Architecture:** [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Demo playbook:** [`docs/DEMO.md`](./DEMO.md)

## Demo video

_(YouTube unlisted + Loom + Drive mirrors — paste URLs here after Sunday recording.)_
