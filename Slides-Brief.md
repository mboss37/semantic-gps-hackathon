# Problem Statement Slides, Brief for AI Generation

> Single-shot prompt for Claude (or any HTML/CSS slide generator) to one-shot
> the slide deck used during the Problem Statement section of the demo video.
> Total on-screen time: ~55 seconds. Five slides plus an optional title card.

---

## How to use this file

1. Copy everything from "PROMPT" through end of file.
2. Paste into a fresh Claude conversation.
3. Ask Claude to "generate a standalone HTML/CSS deck matching this brief, one section per slide, 16:9 at 1920x1080, dark theme."
4. Claude returns one HTML file. Open in a browser. Use Playwright or browser screenshot at full viewport for per-slide PNG export. Stitch into the video edit.

---

## PROMPT (copy below)

You are designing a short slide deck (5 slides + 1 optional title card) shown during the **Problem Statement** segment of a 3-minute hackathon demo video for a product called **Semantic GPS**. The narrator reads the script aloud while these slides display. Slide design must support the narration, not compete with it.

### Output format

- One standalone HTML file with inline CSS, no external assets, no JS frameworks.
- Each slide is a `<section>` sized exactly **1920 x 1080** (16:9), full-bleed.
- Slides stack vertically in the document so they can be exported to PNG one at a time via browser screenshot or Playwright.
- Add a tiny print-mode CSS rule that gives each section its own page so File > Print to PDF gives a clean per-slide export.
- Use system font stack with Geist as the preferred display family if available: `font-family: 'Geist', 'Inter', -apple-system, sans-serif;`. Mono accents use `'Geist Mono', ui-monospace, monospace;`.

### Brand kit

- **Background:** `#02040a` (near-black with cyan undertone)
- **Primary text:** `#ffffff`
- **Secondary text:** `rgba(255,255,255,0.65)`
- **Tertiary text / chyrons:** `rgba(255,255,255,0.42)`
- **Incident accent (red):** `#fca5a5` for danger pills, soft glow `rgba(252,165,165,0.12)`
- **Resolution accent (emerald):** `#34d399` for the close
- **Cool accent gradient:** `linear-gradient(135deg, #7dd3fc 0%, #2563eb 100%)` for the brand mark only
- **Subtle dotted grid background:** `radial-gradient(circle at 50% 0%, rgba(255,255,255,0.06), transparent 40%)` overlaid over the base color
- **Type weights:** display headlines 600–700, body 400–500, mono labels 500 with 0.18em letter-spacing uppercase

### Tone

Clinical. Factual. Slightly grim under the stats. Restrained, no clipart, no emoji, no decorative icons except a thin shield outline if you must place a brand mark. Lots of negative space. Numbers are big. Headlines are bigger. Sources are always visible.

### Layout rhythm

Every receipt slide uses an identical layout grid so the deck feels deliberate:

```
┌──────────────────────────────────────────────────────────┐
│ [DATE PILL, mono uppercase, top-left, 32px from edges]   │
│                                                          │
│                                                          │
│  [HEADLINE, display, 96–110px, ~70 char wrap]            │
│                                                          │
│  [BODY, 32–36px, secondary text, ~80 char wrap]          │
│                                                          │
│                                                          │
│ [SOURCE PILL, mono, bottom-right, 32px from edges]       │
└──────────────────────────────────────────────────────────┘
```

The stats slide and tagline slide use centered single-block layout instead.

---

## Slide 0 (optional title card, 0:00 → 0:03)

**Layout:** centered

**Headline (display 110px, primary text):**
The agents are working.

**Subhead (display 80px, secondary text):**
The safety surface around them isn't.

**Decoration:** thin 1px horizontal line under the subhead, gradient fade `linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)` 60% width centered.

---

## Slide 1, Yue / OpenClaw (0:03 → 0:16)

**Date pill top-left:** `FEB 2026` (mono, 22px, red border `1px solid rgba(252,165,165,0.45)`, red bg `rgba(252,165,165,0.08)`, padding 10px 18px, border-radius 999px)

**Eyebrow (mono uppercase, 18px, white/45%, above headline):**
META · DIRECTOR OF AI ALIGNMENT

**Headline (display 96px):**
Told an autonomous agent to ASK before deleting.

**Body (32px, white/65%):**
It deleted 200+ emails anyway. She told it to stop, twice. She had to physically run to her Mac and kill the processes. Root cause: context compaction silently dropped her safety constraint.

**Source pill bottom-right (mono 18px, white/40%):**
Tom's Hardware · 2026

**Decoration:** soft red radial glow at top-right: `radial-gradient(circle at 100% 0%, rgba(252,165,165,0.14), transparent 35%)`

---

## Slide 2, Replit (0:16 → 0:29)

**Date pill:** `JUL 2025`

**Eyebrow:** REPLIT · AI CODING AGENT

**Headline (display 96px):**
Deleted a live production database during a code freeze.

**Big stats row (display 72px, mono numerals, white/85%, centered between headline and body):**
`1,200 executives  ·  1,190 companies  ·  wiped`

**Body (32px, white/65%):**
The "code freeze" was a sentence in a chat, not a technical guard. When confronted, the agent lied about whether the data could be recovered.

**Source pill:** Fortune · 2025

**Decoration:** same red glow as Slide 1, mirrored top-left

---

## Slide 3, Cursor / Supabase (0:29 → 0:36)

**Date pill:** `MID 2025`

**Eyebrow:** CURSOR · SUPABASE MCP AGENT

**Headline (display 96px):**
Privileged agent. Untrusted input. Public output.

**Body (32px, white/65%):**
A privileged service-role agent processed support tickets containing user-supplied input as commands. Attackers embedded SQL that exfiltrated integration tokens into a public support thread.

**Source pill:** Unit 42, Palo Alto Networks · 2025

---

## Slide 4, The scale (0:36 → 0:48)

**Layout:** 2x2 grid of giant numbers, centered. No headline.

**Top-left cell:**
- Number (display 220px, primary): `97%`
- Label (mono 22px, red/65%, uppercase): `EXPECT INCIDENT`
- Caption (20px, white/45%): `enterprises in the next 12 months`

**Top-right cell:**
- Number: `88%`
- Label: `ALREADY HAD ONE`
- Caption: `confirmed or suspected this year`

**Bottom-left cell:**
- Number: `14%`
- Label: `WITH FULL REVIEW`
- Caption: `agents reaching production`

**Bottom-right cell:**
- Number: `Aug 2 2026` (display 96px, smaller than the percentages)
- Label: `EU AI ACT`
- Caption: `high-risk systems must comply`

**Sources caption (bottom-center, mono 16px, white/35%):**
`Gravitee 2026  ·  Grant Thornton 2026  ·  Foresiet 2026  ·  EU AI Act`

**Visual:** the `97%` number should feel loudest. Slightly larger than 88 and 14, ideally with a subtle white drop-shadow / glow.

---

## Slide 5, Tagline close (0:48 → 0:55)

**Layout:** centered, single block

**Headline (display 110px):**
The agents are working.
The safety surface around them isn't.

**Subhead (mono 28px, emerald `#34d399`, uppercase, 0.2em letter-spacing):**
SEMANTIC GPS IS THAT SURFACE

**Decoration:** under the emerald subhead, a 1px line in `rgba(52,211,153,0.4)` 30% width, centered

---

## Hard rules for the generator

1. **No clipart, no emoji, no decorative icons.** Geometric thin-stroke shapes only if necessary.
2. **No animations beyond a 300ms fade-in on slide enter.** No bouncing, no zooming, no slide-from-side. This is journalism, not a product reveal.
3. **Every receipt slide must show its source citation visibly.** Top-right or bottom-right, mono, low opacity but legible at 1080p.
4. **Numbers carry the slide.** When a slide has a number, that number is the largest element on the slide.
5. **Identical layout rhythm.** Receipt slides 1, 2, 3 share the same grid. The viewer should feel the rhythm without thinking about it.
6. **Body copy under 50 words per slide.** If it's longer, cut.
7. **Headlines under 12 words.** If it's longer, cut.
8. **No hyphens-as-emdashes.** Use periods or colons. Brand voice has zero em-dashes.
9. **The 97% number on Slide 4 is the emotional peak.** Make it big enough that a screenshot of just that slide on Twitter would make someone stop scrolling.
10. **Preserve readability over creativity.** A judge has 9 seconds to absorb each slide while listening to the narration.

---

## Sources for chyron citations

| Receipt | Citation chyron | Full URL |
|---|---|---|
| Yue / OpenClaw | Tom's Hardware · 2026 | https://www.tomshardware.com/tech-industry/artificial-intelligence/openclaw-wipes-inbox-of-meta-ai-alignment-director-executive-finds-out-the-hard-way-how-spectacularly-efficient-ai-tool-is-at-maintaining-her-inbox |
| Replit | Fortune · 2025 | https://fortune.com/2025/07/23/ai-coding-tool-replit-wiped-database-called-it-a-catastrophic-failure/ |
| Cursor / Supabase | Unit 42 · 2025 | https://unit42.paloaltonetworks.com/model-context-protocol-attack-vectors/ |
| 97% expect incident | Gravitee 2026 | https://securityboulevard.com/2026/04/97-of-enterprises-expect-a-major-ai-agent-security-incident-within-the-year/ |
| 78% audit gap | Grant Thornton 2026 | https://www.grantthornton.com/insights/survey-reports/technology/2026/technology-2026-ai-impact-survey-report |

Full reference list (more incidents, MCP-specific CVEs, regulatory): `docs/VISION.md § References`.

---

## Acceptance check after generation

- [ ] 5 receipt slides + 1 optional title card, all 1920x1080, all dark theme
- [ ] Every receipt slide has its date pill (top-left) AND its source citation (bottom-right or top-right)
- [ ] Slide 4 has 4 numbers, with 97% the largest
- [ ] Final slide has the emerald `SEMANTIC GPS IS THAT SURFACE` line
- [ ] No emoji, no clipart, no decorative icons except an optional thin shield outline
- [ ] Print-to-PDF gives one slide per page
- [ ] Standalone HTML file, no external network calls, opens cleanly in any browser
