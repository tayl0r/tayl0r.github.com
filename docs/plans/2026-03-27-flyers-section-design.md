# Flyers Section Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Flyers" section to tsteil.com with two index page variants (cosmic + minimal) and a placeholder Oktoberfest flyer.

**Architecture:** Static HTML files in `public/flyers/`, same pattern as existing `public/landing/` pages. No build step, no JS framework. Bottom nav on main landing page gets a new "Flyers" link.

**Tech Stack:** HTML, inline CSS, Google Fonts (Space Grotesk + Inter)

---

### Task 1: Create Oktoberfest placeholder page

**Files:**
- Create: `public/flyers/oktoberfest-sep-2026/index.html`

**Step 1: Create the placeholder flyer page**

Create `public/flyers/oktoberfest-sep-2026/index.html` — a simple dark page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Oktoberfest — Sep 2026</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    min-height: 100vh;
    background: #0a0a1a;
    color: #ffffff;
    font-family: 'Space Grotesk', sans-serif;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 16px;
  }
  h1 { font-size: 2.5rem; font-weight: 700; }
  p {
    font-size: 1.1rem;
    color: rgba(255,255,255,0.5);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  a {
    color: rgba(255,255,255,0.35);
    text-decoration: none;
    font-size: 0.85rem;
    margin-top: 24px;
    transition: color 0.2s;
  }
  a:hover { color: rgba(255,255,255,0.7); }
</style>
</head>
<body>
  <h1>Oktoberfest</h1>
  <p>Sep 2026 — Coming Soon</p>
  <a href="/flyers/">← Back to Flyers</a>
</body>
</html>
```

**Step 2: Verify it loads**

Run: `pnpm run dev` and visit `http://localhost:4100/flyers/oktoberfest-sep-2026/`
Expected: Dark page with "Oktoberfest" heading and "Coming Soon" text.

**Step 3: Commit**

```bash
git add public/flyers/oktoberfest-sep-2026/index.html
git commit -m "feat: add Oktoberfest placeholder flyer page"
```

---

### Task 2: Create cosmic flyers index

**Files:**
- Create: `public/flyers/index.html`

**Step 1: Create the cosmic flyers index page**

Create `public/flyers/index.html`. Use the `frontend-design` skill for this — it should be a visually distinctive page. Key specs:

- **Background:** Midnight navy gradient (`#0a1628` → `#060d18`) with glowing orbs (cyan `rgba(0,210,255,0.12)`, purple `rgba(138,43,226,0.15)`, green `rgba(0,255,136,0.08)`) and subtle grid overlay — same approach as `public/landing/ai-dev-flyer.html`
- **Accent line:** Gradient top bar (`#00d2ff` → `#7b2ff7` → `#00ff88`)
- **Title:** "Flyers" in Space Grotesk, large, with gradient text fill matching the accent colors
- **Flyer entries:** Each is a card/row that is an `<a>` link:
  - Date badge on left (e.g. "Sep 2026") styled as a small pill/badge
  - Title on right (e.g. "Oktoberfest") in larger text
  - Hover: subtle glow border + slight scale transform
  - Link to `/flyers/oktoberfest-sep-2026/`
- **Sorted newest first** (only one entry for now)
- **Footer area:** Subtle "minimal view →" link to `/flyers/minimal/` and a "← Home" link to `/`
- **Fonts:** Space Grotesk (headings) + Inter (body) via Google Fonts import
- **Fully responsive** — works on mobile and desktop
- **Self-contained** — all CSS inline, no external stylesheets beyond fonts

The flyer list data for this page (hardcoded):

| Date | Title | URL |
|------|-------|-----|
| Sep 2026 | Oktoberfest | /flyers/oktoberfest-sep-2026/ |

**Step 2: Verify it loads**

Run: `pnpm run dev` and visit `http://localhost:4100/flyers/`
Expected: Cosmic-themed index page with one flyer entry. Click the entry — navigates to the Oktoberfest placeholder.

**Step 3: Commit**

```bash
git add public/flyers/index.html
git commit -m "feat: add cosmic flyers index page"
```

---

### Task 3: Create minimal flyers index

**Files:**
- Create: `public/flyers/minimal/index.html`

**Step 1: Create the minimal flyers index page**

Create `public/flyers/minimal/index.html`. Use the `frontend-design` skill. Key specs:

- **Background:** Flat dark (`#111111` or similar), NO gradients, NO glowing orbs, NO grid overlay
- **Typography-first:** Clean, editorial magazine feel. Generous whitespace. Sharp type hierarchy.
- **Title:** "Flyers" — large, clean, white text, Space Grotesk
- **Flyer entries:** Clean list rows:
  - Date on left in monospace or small caps
  - Title on right, bold
  - Subtle separator between entries (thin line or whitespace)
  - Hover: understated color change, no glow
  - Link to `/flyers/oktoberfest-sep-2026/`
- **Footer area:** "cosmic view →" link to `/flyers/` and "← Home" link to `/`
- **Fonts:** Space Grotesk + Inter
- **Same flyer data as cosmic version**

**Step 2: Verify it loads**

Run: `pnpm run dev` and visit `http://localhost:4100/flyers/minimal/`
Expected: Clean dark minimal page with one flyer entry. Links work.

**Step 3: Commit**

```bash
git add public/flyers/minimal/index.html
git commit -m "feat: add minimal flyers index page"
```

---

### Task 4: Add Flyers link to main landing page nav

**Files:**
- Modify: `index.html:35-38` (the bottom-links div)

**Step 1: Add the Flyers link**

In `index.html`, change the bottom-links div from:

```html
<div class="bottom-links">
  <a href="https://github.com/tayl0r" target="_blank" rel="noopener">GitHub</a>
  <a href="/3d-bingo-ball-picker/">Bingo</a>
</div>
```

To:

```html
<div class="bottom-links">
  <a href="https://github.com/tayl0r" target="_blank" rel="noopener">GitHub</a>
  <a href="/flyers/">Flyers</a>
  <a href="/3d-bingo-ball-picker/">Bingo</a>
</div>
```

**Step 2: Verify**

Run: `pnpm run dev` and visit `http://localhost:4100/`
Expected: Bottom nav shows "GitHub | Flyers | Bingo". Clicking "Flyers" goes to `/flyers/`.

**Step 3: Run tests**

Run: `pnpm run test`
Expected: All checks pass (tsc + biome).

**Step 4: Commit**

```bash
git add index.html
git commit -m "feat: add Flyers link to main landing page nav"
```
