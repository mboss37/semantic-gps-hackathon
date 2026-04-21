# Hackathon — Built with Opus 4.7

Full reference for the Cerebral Valley × Anthropic hackathon. Decision-shaping highlights live in the root `CLAUDE.md`; everything else is here.

---

## Submission

- **Deadline:** Sunday, April 26 2026, **8:00 PM EST**
- **Deliverables:**
  1. **3-minute demo video** (YouTube / Loom)
  2. **GitHub repo** (fully open source, approved license)
  3. **Written summary** (100–200 words)
- Submit via CV platform.
- Must be built **entirely during the hackathon** — no pre-existing work.

---

## Judging

### Criteria (weights)
| Weight | Criterion | What it means |
|---|---|---|
| 30% | **Impact** | Real-world potential. Who benefits, how much it matters, could this ship. Does it fit a problem statement. |
| 25% | **Demo** | Working, impressive, holds up live. Genuinely cool to watch. |
| 25% | **Opus 4.7 Use** | Creative — not a basic integration. Surfaces capabilities that surprise even the judges. |
| 20% | **Depth & Execution** | Past the first idea, engineering is sound, real craft. |

### Stages
- **Apr 26–27:** Async judging — judges review video + repo + summary, aggregate to a Top 6.
- **Apr 28, 12:00 PM EST:** Final round — pre-recorded 3-min demos, then deliberation.
- **Apr 28, 12:45 PM EST:** Top 3 + side prize winners announced.

### Prizes
| Prize | Award |
|---|---|
| 1st | $50K Claude API credits |
| 2nd | $30K Claude API credits |
| 3rd | $10K Claude API credits |
| Most Creative Opus 4.7 Exploration | $5K — expressive, playful, "made us feel something" |
| "Keep Thinking" | $5K — didn't stop at the first idea; real-world problem nobody pointed Claude at |
| Best use of Claude Managed Agents | $5K — meaningful long-running task handoff, not just a demo |

---

## Problem Statements

1. **Build From What You Know** — domain expertise beats credentials. A process that takes weeks and should take hours. The thing someone you know still does by hand.
2. **Build For What's Next** — a new way to work/learn/make that only makes sense now. An interface without a name. A workflow from a few years out.

**Semantic GPS fits #2** — the MCP control plane is a workflow that doesn't exist yet and only makes sense because agents are newly real. Potential secondary fit with #1 (enterprise compliance pain for MCP pilots).

---

## Rules

- **Open source:** every component (backend, frontend, models, assets) under an approved OSS license.
- **New work only:** from scratch during the hackathon.
- **Team size:** up to 2.
- **Disqualifying:** legal/ethical violations, use of code/data/assets without rights.

---

## Schedule (EST)

| Day | Event |
|---|---|
| Tue Apr 21 | **12:00 PM** Virtual kickoff · **12:30 PM** Hacking begins · **5–6 PM** Office hours |
| Wed Apr 22 | **12–1 PM** Live Session 1: AMA with Thariq Shihipar (Claude Code) · **5–6 PM** Office hours |
| Thu Apr 23 | **11–12 PM** Live Session 2: Managed Agents overview with Michael Cohen · **5–6 PM** Office hours |
| Fri Apr 24 | **12–1 PM** Live Session 3: Mike Brown (Opus 4.6 1st place) · **5–6 PM** Office hours |
| Sat Apr 25 | **5–6 PM** Office hours |
| Sun Apr 26 | **12–1 PM** Live Session 4: Michal Nedoszytko (Opus 4.6 3rd place) · **5–6 PM** Office hours · **8:00 PM SUBMISSION DUE** |
| Mon Apr 27 | Async first-round judging |
| Tue Apr 28 | **12:00 PM** Final round · **12:45 PM** Winners announced |

Discord: https://anthropic.com/discord — ping `#questions` for help, `#office-hours` daily 5–6 PM EST.

---

## Key Resources

### Claude Code
- [Docs](https://code.claude.com/docs) · [Best Practices](https://code.claude.com/docs/en/best-practices) · [Hooks guide](https://claude.com/blog/how-to-configure-hooks)

### MCP
- [MCP Docs](https://modelcontextprotocol.io/docs/getting-started/intro)

### Claude Managed Agents (relevant for the $5K side prize)
- [Docs](https://platform.claude.com/docs/en/managed-agents/overview)
- [Overview video](https://www.youtube.com/watch?v=NLWiIj47IdI)
- [Blog: get to production 10x faster](https://claude.com/blog/claude-managed-agents)
- [Blog: Decoupling the brain from the hands](https://www.anthropic.com/engineering/managed-agents)

### Claude API / Agent SDK
- [Claude API Quickstart](https://platform.claude.com/docs/en/get-started)
- [Building Effective Agents](https://www.anthropic.com/engineering/building-effective-agents)
- [Building Agents with the Claude Agent SDK](https://claude.com/blog/building-agents-with-the-claude-agent-sdk)
- [Multi-agent systems: when and how](https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them)

### Agent Skills
- [Docs](https://agentskills.io/home) · [GitHub](https://github.com/anthropics/skills) · [Complete Guide eBook](https://claude.com/blog/complete-guide-to-building-skills-for-claude)

---

## Submission Checklist (for Day 5)

Don't open this until Saturday; it's here so nothing gets missed.

- [ ] All code committed + pushed to public GitHub repo
- [ ] LICENSE file added (MIT / Apache-2.0 recommended)
- [ ] README with setup steps, env var list, demo link
- [ ] 3-min demo video recorded, uploaded to YouTube/Loom, link captured
- [ ] Written summary drafted (100–200 words)
- [ ] Vercel deployment live + URL in README
- [ ] Demo agent scripts tested end-to-end against deployed gateway
- [ ] Fallback: recorded clip of each demo scenario in case live fails on stage
- [ ] Submitted via CV platform before **Apr 26, 8:00 PM EST**
