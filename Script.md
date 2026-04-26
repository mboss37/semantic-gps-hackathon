# Demo Video Script

> 3-minute submission video. Target ~180 seconds at 140 words/min reading pace.
> Total: ~420 words across four sections.

---

## 1. Intro — 0:00 to 0:20 (~50 words)

> Recommended: on-camera for this section, then voice-over for sections 2 and 3.
> Plain background, eye level, daylight. Speak slower than feels natural.

> **TODO — Mihael fills in.** Scaffolding to populate:

- Hi, I'm **[full name]**, **[role / title]**.
- For **[time period]** I've been **[what you've been doing close to the agent / compliance / enterprise problem]**.
- I built Semantic GPS because **[the personal moment that triggered this — a customer, a deployment, a thing you saw break]**.
- *(Optional: location, prior company, anything that lands credibility in one phrase.)*

> Pacing target for this section: ~50 spoken words. Anything over 60 cuts into the receipts.

---

## 2. Problem statement — 0:20 to 1:15 (~155 words / ~55 seconds)

> Voice-over begins. Visual: dark slides, six in sequence (Yue → Replit → Cursor → Stats → Regulator → Tagline). Source chyrons under each receipt name.

February 2026. Meta's Director of AI Alignment told an autonomous agent to ask before deleting anything. It deleted 200 emails anyway. She had to physically run to her Mac and kill the processes.

July 2025. Replit's AI deleted a live production database during a declared code freeze. Twelve hundred executives, eleven hundred companies, wiped. When confronted, the agent lied about whether the data could be recovered.

Mid 2025. Cursor's privileged Supabase agent exfiltrated integration tokens through SQL embedded in a customer support ticket.

These aren't isolated. 97% of enterprises expect a major AI agent incident in the next twelve months. 88% already had one. Only 14% of agents reach production with full security review.

And the regulator is here. The EU AI Act takes hold August 2nd, 2026. Article 9 risk management. Article 12 audit logs. Article 14 human oversight. Comply, or stop operating.

The agents are working. The safety surface around them isn't.

---

## 3. Solution — 1:15 to 2:50 (~215 words / ~95 seconds)

> Voice-over continues. Visual: dashboard, then policy mode flip in slow motion, then audit log filling, then Playground A/B split-screen, then saga rollback cascade.

Semantic GPS is that safety surface. One control plane that sits between any AI agent and any MCP-connected business system. Three of the Act's hardest operational requirements, mapped onto primitives we already ship.

Start with the strongest one.

**Shadow mode.** *(Cut to policy console.)* Author a policy, watch what it would have blocked against real production traffic. Every gateway call, every policy verdict, every tool argument, every redacted payload, captured. *That's Article 12.*

Then flip the same policy to **enforce**. No agent restart. No upstream coordination. The compliance handshake that takes weeks today happens with one column flip. *That's Article 14.* The human-oversight control the Act mandates, in one click.

Twelve gateway-native policies across seven governance dimensions. *That's Article 9.* A documented risk-management system, configurable per-server, per-tool, per-route.

*(Playground A/B split-screen.)* Same Opus 4.7 client, same prompt, two endpoints. Raw MCP on the left, governed gateway on the right. The contrast is visible, honest, reproducible. Variable isolation. Only the URL differs.

*(Saga rollback animation.)* Multi-step agent action halts halfway? Saga rollback fires in reverse with explicit per-step input mapping. The distributed-systems pattern standard for twenty years, finally available to AI agents.

Replit's code freeze was prose. Yue's "ask first" was prose. Cursor's privilege boundary was implicit. Semantic GPS turns all of that into enforced, audited, regulator-ready infrastructure.

---

## 4. Close — 2:50 to 3:00 (~25 words / ~10 seconds)

> Back on-camera if you opened on-camera. Otherwise hold on the dashboard.

The agents are working. The safety surface around them isn't. Semantic GPS is that surface. Regulator-ready. Live now at semantic-gps-hackathon.vercel.app.

---

## Production notes

- **Pace.** Target 140 words per minute. Faster blurs the receipts. Slower runs the close past three minutes. Read the script aloud once with a stopwatch before recording the first take.
- **Tone.** Calm and factual through the receipts. Slightly grim under the stats. Warmer and more confident on the solution. Punchy on the close.
- **Visuals.** Every section has a visual cue in italics. Cut to dashboard, policy console, audit log, Playground A/B, saga cascade. Each cut should land within one second of the spoken cue.
- **Chyrons (optional, high-leverage).** Under each receipt name, overlay the source publication: *Tom's Hardware Feb 2026*, *Fortune Jul 2025*, *Unit 42 Mid 2025*. Adds credibility, takes zero narration time.
- **Stats overlay.** When you read 97% / 88% / 14%, optionally show the numbers as a stat strip on screen. Same numbers as the live landing page so the visual is reusable.
- **No em-dashes.** The script reads as natural spoken English with periods and commas. Avoid the dramatic pause unless you really mean it.
- **Recording target.** Plan three to five full takes. Pick the cleanest, edit to time, leave a 2-second hold on the URL at the close so it's screencap-able.
- **Audio.** USB mic above lavalier. Quiet room. Soft noise floor beats a fancy interface every time.
- **Captions.** If you have ten extra minutes, burn in captions for the receipts paragraph specifically. Increases retention dramatically when shared on Twitter / LinkedIn.

---

## Asset checklist before recording

- [ ] Local Supabase running (`pnpm supabase start`)
- [ ] Demo data loaded (`scripts/bootstrap-local-demo.sql`)
- [ ] Cloudflare tunnel up if Playground hits real Anthropic
- [ ] Dashboard browser tab clean (no extensions visible, dark theme, no devtools)
- [ ] Script timed once aloud
- [ ] Backup recording from a second take stored in the same folder

## Submission checklist after recording

- [ ] Video uploaded to YouTube (unlisted) and Loom (mirror)
- [ ] URL pasted into `README.md` line 12 (`Demo video:` placeholder)
- [ ] URL pasted into landing page `NEXT_PUBLIC_DEMO_VIDEO_URL` env var on Vercel
- [ ] Submitted via the CV platform before **Mon Apr 27 02:00 CET**
