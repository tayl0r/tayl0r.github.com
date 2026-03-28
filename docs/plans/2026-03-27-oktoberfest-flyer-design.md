# Oktoberfest Flyer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Oktoberfest placeholder with two themed flyer versions (Bavarian + Vintage) and update the flyers index to show alternate links.

**Architecture:** Two self-contained HTML pages with inline CSS. Flyers index pages get alternate-link UI beneath the Oktoberfest entry. Vite config gets new rollup inputs.

**Tech Stack:** HTML, inline CSS, Google Fonts, inline SVG/emoji for clip art

---

### Task 1: Create Bavarian blue & white flyer (default)

**Files:**
- Replace: `flyers/oktoberfest-sep-2026/index.html`

**Step 1: Create the Bavarian flyer**

Replace the placeholder at `flyers/oktoberfest-sep-2026/index.html` with a full Oktoberfest flyer. Use the `frontend-design` skill for this.

**Design specs:**

- Self-contained HTML with inline CSS, Google Fonts, responsive (mobile + desktop 1080p), no print optimization, no JavaScript
- Traditional Munich Oktoberfest blue (#0066b3) and white color scheme
- CSS Bavarian diamond/checkered pattern (background or border decoration)
- Pennant/bunting banner decoration at top (CSS triangles or inline SVG)
- Beer stein clip art — use inline SVG beer steins (two steins clinking, similar to the previous flyer's imagery) or large emoji
- Wheat/grain decorative elements if possible (inline SVG)

**Content hierarchy (top to bottom):**

1. Pennant banner decoration
2. "Steil Family 7th Annual Potluck" — small caps, upper
3. "OKTOBERFEST" — huge, bold, festive display font
4. Beer stein clip art (two steins clinking)
5. "Saturday, September 12 - 3:30 PM" — on a blue ribbon/banner
6. "FOOD - MUSIC - BEER - KARAOKE" — bold, prominent
7. Events section: "Steinholding Competition" and "Hammerschlagen" — displayed as featured events with brief descriptions or icons
8. "Don't want to drive home? Camp out here!" — friendly callout
9. "RSVP Taylor or Katrin" — bold
10. "For the Potluck - German food is encouraged but not required!" — lighter text
11. Link to vintage version: "View vintage version →" linking to `/flyers/oktoberfest-sep-2026/vintage/`
12. Link back to flyers index: "← Back to Flyers" linking to `/flyers/`

**Responsive:** Desktop gets generous spacing and full layout. Mobile stacks content, scales typography, maintains readability. Use clamp() and media queries.

**Reference:** Read the previous flyer image description — Bavarian blue, white background, blue border/frame, checkered pennant banner at top, beer steins in center, blue ribbon for date, bold activity text below.

**Step 2: Verify**

Run: `pnpm run dev` and visit `http://localhost:4100/flyers/oktoberfest-sep-2026/`
Expected: Full Bavarian-themed Oktoberfest flyer, responsive on mobile and desktop.

**Step 3: Commit**

```bash
git add flyers/oktoberfest-sep-2026/index.html
git commit -m "feat: replace Oktoberfest placeholder with Bavarian blue flyer"
```

---

### Task 2: Create vintage beer hall flyer

**Files:**
- Create: `flyers/oktoberfest-sep-2026/vintage/index.html`

**Step 1: Create the vintage flyer**

Create `flyers/oktoberfest-sep-2026/vintage/index.html`. Use the `frontend-design` skill.

**Design specs:**

- Self-contained HTML with inline CSS, Google Fonts, responsive (mobile + desktop 1080p), no print optimization, no JavaScript
- Warm color palette: cream/parchment background (#f5e6c8 or similar), dark brown text (#3a2a1a), amber/gold accents (#c68a2e)
- Old-world German typography — use a blackletter/fraktur-style Google Font for the title (e.g., "UnifrakturMaguntia" or "MedievalSharp"), serif for body text
- Textured feel via CSS (subtle noise pattern, aged paper look using gradients/box-shadows)
- Decorative borders — ornate frame or ruled lines with flourishes
- Beer stein clip art in a more vintage/woodcut style (inline SVG)
- Wheat/hop decorative elements

**Content hierarchy (same content as Bavarian version):**

1. Ornate border/frame
2. "Steil Family 7th Annual Potluck" — small, refined
3. "OKTOBERFEST" — huge blackletter font
4. Beer stein clip art
5. "Saturday, September 12 - 3:30 PM" — on a warm banner/ribbon
6. "FOOD - MUSIC - BEER - KARAOKE" — bold
7. Events: "Steinholding Competition" and "Hammerschlagen"
8. "Don't want to drive home? Camp out here!"
9. "RSVP Taylor or Katrin"
10. "For the Potluck - German food is encouraged but not required!"
11. Link to Bavarian version: "View bavarian version →" linking to `/flyers/oktoberfest-sep-2026/`
12. Link back to flyers index: "← Back to Flyers" linking to `/flyers/`

**Step 2: Verify**

Run: `pnpm run dev` and visit `http://localhost:4100/flyers/oktoberfest-sep-2026/vintage/`
Expected: Vintage beer hall themed flyer, responsive.

**Step 3: Commit**

```bash
git add flyers/oktoberfest-sep-2026/vintage/index.html
git commit -m "feat: add vintage beer hall Oktoberfest flyer"
```

---

### Task 3: Update vite.config.ts with new rollup input

**Files:**
- Modify: `vite.config.ts`

**Step 1: Add vintage flyer rollup input**

Add the vintage flyer to the rollup inputs in `vite.config.ts`. The Bavarian version already has an entry as `"flyers-oktoberfest"`. Add:

```typescript
"flyers-oktoberfest-vintage": resolve(__dirname, "flyers/oktoberfest-sep-2026/vintage/index.html"),
```

**Step 2: Run tests**

Run: `pnpm run test`
Expected: All checks pass.

**Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "chore: add vintage Oktoberfest flyer to vite rollup inputs"
```

---

### Task 4: Update flyers index pages with alternate links

**Files:**
- Modify: `flyers/index.html` (cosmic index — the flyer card HTML around lines 392-400)
- Modify: `flyers/minimal/index.html` (minimal index — the entry HTML around lines 313-318)

**Step 1: Update cosmic index**

In `flyers/index.html`, update the Oktoberfest flyer card to include alternate links below. The main card link still goes to `/flyers/oktoberfest-sep-2026/`. Add small alternate links beneath the card (outside the `<a>` tag) showing "bavarian · vintage".

Add CSS for `.flyer-alternates` — small, muted text beneath the card with styled links.

**Step 2: Update minimal index**

In `flyers/minimal/index.html`, update the Oktoberfest entry similarly. Add small alternate links beneath the entry row. Style them to match the minimal editorial aesthetic (understated, monochrome).

**Step 3: Run tests**

Run: `pnpm run test`
Expected: All checks pass.

**Step 4: Commit**

```bash
git add flyers/index.html flyers/minimal/index.html
git commit -m "feat: add alternate theme links to Oktoberfest flyer entries"
```
