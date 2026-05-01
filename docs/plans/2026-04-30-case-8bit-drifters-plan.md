# 8-Bit Drifters Vertical Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a playable end-to-end slice of `nova-games/case-8bit-drifters/`: loading screen → name picker → home shell → 5-lap Tokyo race with drift, lap timing, and best-time persistence.

**Architecture:** Pixi.js v8 + scene-factory pattern (mirrors `case-retro-drifters`). Each screen is a `Scene` factory returning `{ root, update, dispose }` driven by a top-level scene-swap loop. Pure logic (drift, lap detection, name filter, persistence) is unit-tested with Vitest; visual screens are verified manually.

**Tech Stack:** Pixi.js 8, TypeScript 5, Vite 7, Vitest 1.6, pnpm workspace.

**Design doc:** `docs/plans/2026-04-30-case-8bit-drifters-design.md`

---

## How to use this plan

- Run all commands from the *repository root* (`/Users/taylor/dev/tayl0r.github.com-case-8bit-drifters/`) unless stated otherwise.
- The kid's project lives at `nova-games/case-8bit-drifters/`. Source files live at `nova-games/case-8bit-drifters/src/`. **Every file path below is repo-relative.**
- After every task, run `pnpm run test` *at the repo root* (`tsc --noEmit && biome check`). It must pass before you commit.
- For the kid's own Vitest suite (added in Task 1.1), run `pnpm --filter @nova-games/case-8bit-drifters test`.
- Commit at the end of each task with a Conventional-Commits-ish prefix `case-8bit-drifters: ...`. Match the prefix style used in recent `nova-games` commits.
- Use the design doc for context whenever a step says "see Design §X" — don't reinvent decisions that were already made there.
- If a step says "Expected: …" and you see something different, **stop and investigate**. Don't paper over.

---

## Milestone 1 — Bootstrap

Replace the Pixi.js hello-world template with the scene-factory plumbing and a stub loading scene that just says "loading…". Wire up Vitest so later milestones can TDD pure logic.

### Task 1.1: Add Vitest to the kid's package

**Files:**
- Modify: `nova-games/case-8bit-drifters/package.json`

**Step 1: Add Vitest dev dep and a `test` script**

Edit `nova-games/case-8bit-drifters/package.json` to match this shape (preserve the existing `name`, `version`, etc.):

```json
{
  "name": "@nova-games/case-8bit-drifters",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "pixi.js": "^8.6.6"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "vite": "^7.3.1",
    "vitest": "^1.6.0"
  }
}
```

**Step 2: Install**

Run from repo root:
```
pnpm install
```
Expected: pnpm reports `vitest` added to `nova-games/case-8bit-drifters`.

**Step 3: Smoke-test Vitest works (write a trivial test, run, delete)**

Create `nova-games/case-8bit-drifters/src/_smoke.test.ts`:
```ts
import { expect, test } from "vitest";
test("vitest works", () => expect(1 + 1).toBe(2));
```

Run:
```
pnpm --filter @nova-games/case-8bit-drifters test
```
Expected: 1 test passed. Then delete `_smoke.test.ts`.

**Step 4: Verify root checks still pass**

Run from repo root:
```
pnpm run test
```
Expected: passes.

**Step 5: Commit**

```
git add nova-games/case-8bit-drifters/package.json pnpm-lock.yaml
git commit -m "case-8bit-drifters: add vitest dev dep"
```

---

### Task 1.2: Define `Scene`, `SceneFactory`, and `GameContext` types

**Files:**
- Create: `nova-games/case-8bit-drifters/src/context.ts`

**Step 1: Write the file**

```ts
import type { Application, Container } from "pixi.js";

export type Scene = {
	root: Container;
	update(dt: number): void;
	dispose(): void;
};

export type SceneFactory = (ctx: GameContext) => Scene;

export type Settings = Record<string, never>;

export type GameContext = {
	app: Application;
	switchTo(next: SceneFactory): void;
	profile: { name: string } | null;
	bests: Record<string, number>;
	settings: Settings;
};
```

**Step 2: Confirm types compile**

Run from repo root:
```
pnpm run test
```
Expected: passes.

**Step 3: Commit**

```
git add nova-games/case-8bit-drifters/src/context.ts
git commit -m "case-8bit-drifters: add scene + context types"
```

---

### Task 1.3: Add storage helpers (and the `persist` function)

> Note: `persist` lives here, *not* in `main.ts`. Putting it in `main.ts` would create a circular import once `name-picker.ts` needs to call it (`name-picker → main → loading → name-picker`).

**Files:**
- Create: `nova-games/case-8bit-drifters/src/storage.ts`
- Create: `nova-games/case-8bit-drifters/src/storage.test.ts`

**Step 1: Write the failing test**

```ts
import { afterEach, beforeEach, expect, test } from "vitest";
import { loadState, saveState, type StoredState } from "./storage";

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

test("loadState returns defaults when nothing stored", () => {
	const s = loadState();
	expect(s.profile).toBeNull();
	expect(s.bests).toEqual({});
});

test("saveState then loadState round-trips", () => {
	const s: StoredState = { profile: { name: "case" }, bests: { tokyo: 61234 } };
	saveState(s);
	expect(loadState()).toEqual(s);
});

test("loadState returns defaults when JSON is corrupt", () => {
	localStorage.setItem("case-8bit-drifters", "{not json");
	const s = loadState();
	expect(s.profile).toBeNull();
	expect(s.bests).toEqual({});
});
```

**Step 2: Configure Vitest to use jsdom for `localStorage`**

Create `nova-games/case-8bit-drifters/vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
export default defineConfig({ test: { environment: "jsdom" } });
```

Add `jsdom` to dev deps:
```
pnpm --filter @nova-games/case-8bit-drifters add -D jsdom
```

**Step 3: Run test, watch it fail**

```
pnpm --filter @nova-games/case-8bit-drifters test
```
Expected: 3 tests fail (`storage.ts` does not exist).

**Step 4: Implement**

Create `nova-games/case-8bit-drifters/src/storage.ts`:
```ts
const KEY = "case-8bit-drifters";

export type StoredState = {
	profile: { name: string } | null;
	bests: Record<string, number>;
};

export function loadState(): StoredState {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return { profile: null, bests: {} };
		const parsed = JSON.parse(raw) as Partial<StoredState>;
		return {
			profile: parsed.profile ?? null,
			bests: parsed.bests ?? {},
		};
	} catch {
		return { profile: null, bests: {} };
	}
}

export function saveState(state: StoredState): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// quota or disabled — silently ignore; nothing precious here
	}
}

/** Persist whatever's currently in the GameContext. Lives here (not main.ts)
 * to avoid circular imports between scenes and main. */
export function persist(state: { profile: { name: string } | null; bests: Record<string, number> }): void {
	saveState({ profile: state.profile, bests: state.bests });
}
```

**Step 5: Re-run tests, then root checks**

```
pnpm --filter @nova-games/case-8bit-drifters test
pnpm run test
```
Expected: kid tests pass; root passes.

**Step 6: Commit**

```
git add nova-games/case-8bit-drifters/src/storage.ts \
        nova-games/case-8bit-drifters/src/storage.test.ts \
        nova-games/case-8bit-drifters/vitest.config.ts \
        nova-games/case-8bit-drifters/package.json pnpm-lock.yaml
git commit -m "case-8bit-drifters: localStorage helpers (TDD)"
```

---

### Task 1.4: Create stub loading scene

**Files:**
- Create: `nova-games/case-8bit-drifters/src/scenes/loading.ts`

**Step 1: Write the file**

```ts
import { Container, Text } from "pixi.js";
import type { Scene, SceneFactory } from "../context";

export const createLoadingScene: SceneFactory = (ctx) => {
	const root = new Container();
	const label = new Text({
		text: "loading…",
		style: { fill: 0xffffff, fontSize: 32, fontFamily: "monospace" },
	});
	label.anchor.set(0.5);
	const place = (): void => {
		label.position.set(ctx.app.screen.width / 2, ctx.app.screen.height / 2);
	};
	place();
	root.addChild(label);

	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	const scene: Scene = {
		root,
		update: () => {},
		dispose: () => {
			window.removeEventListener("resize", onResize);
			root.destroy({ children: true });
		},
	};
	return scene;
};
```

**Step 2: Type-check**

```
pnpm run test
```
Expected: passes.

**Step 3: Commit**

```
git add nova-games/case-8bit-drifters/src/scenes/loading.ts
git commit -m "case-8bit-drifters: stub loading scene"
```

---

### Task 1.5: Replace `main.ts` with scene loop

**Files:**
- Modify: `nova-games/case-8bit-drifters/src/main.ts` (currently the Pixi hello-world)

**Step 1: Replace contents**

```ts
import { Application } from "pixi.js";
import type { GameContext, Scene, SceneFactory } from "./context";
import { createLoadingScene } from "./scenes/loading";
import { loadState } from "./storage";

const app = new Application();
await app.init({
	background: "#0a0a14",
	resizeTo: window,
	antialias: true,
});
document.body.appendChild(app.canvas);

// Wait for Press Start 2P to load before showing UI; otherwise text reflows
// when the font swaps in. Skip the wait if it doesn't resolve in 1500ms.
await Promise.race([
	document.fonts.ready,
	new Promise((r) => setTimeout(r, 1500)),
]);

const stored = loadState();
let current: Scene | null = null;

const ctx: GameContext = {
	app,
	switchTo(next: SceneFactory) {
		if (current) {
			app.stage.removeChild(current.root);
			current.dispose();
		}
		current = next(ctx);
		app.stage.addChild(current.root);
	},
	profile: stored.profile,
	bests: stored.bests,
	settings: {},
};

ctx.switchTo(createLoadingScene);

app.ticker.add((time) => {
	if (current) current.update(time.deltaMS / 1000);
});
```

> Note: `persist` is imported from `./storage` by any scene that mutates `ctx.profile` / `ctx.bests` (name picker, race scene). `main.ts` no longer re-exports it.

**Step 2: Build and view**

```
cd nova-games/case-8bit-drifters && pnpm run build
```
Expected: build succeeds.

Run dev server (background):
```
pnpm --filter @nova-games/case-8bit-drifters dev
```
Open http://localhost:5173 — you should see "loading…" centered on a dark background. Stop the dev server.

**Step 3: Root checks**

```
pnpm run test
```
Expected: passes.

**Step 4: Commit**

```
git add nova-games/case-8bit-drifters/src/main.ts
git commit -m "case-8bit-drifters: scene-factory main loop + stub loading"
```

---

## Milestone 2 — Loading screen

Animated spinning tire with smoke trailing off the back. White pixel-style "START" button. Click → switch to name picker (or skip to home if a profile already exists).

### Task 2.1: Add Press Start 2P pixel font + UI text helpers

**Files:**
- Modify: `nova-games/case-8bit-drifters/index.html`
- Create: `nova-games/case-8bit-drifters/src/ui/pixel-text.ts`

**Step 1: Link Press Start 2P from Google Fonts and update the page title**

In `nova-games/case-8bit-drifters/index.html`, change the `<title>` to `8-Bit Drifters` and add inside `<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
```

**Step 2: Pixel-text helper**

Create `nova-games/case-8bit-drifters/src/ui/pixel-text.ts`:
```ts
import { type TextStyleOptions, Text } from "pixi.js";

export const PIXEL_FONT = '"Press Start 2P", monospace';

export function pixelText(text: string, opts: Partial<TextStyleOptions> = {}): Text {
	const t = new Text({
		text,
		style: {
			fontFamily: PIXEL_FONT,
			fill: 0xffffff,
			fontSize: 16,
			letterSpacing: 1,
			...opts,
		},
	});
	t.anchor.set(0.5);
	return t;
}
```

**Step 3: Type-check**

```
pnpm run test
```
Expected: passes.

**Step 4: Commit**

```
git add nova-games/case-8bit-drifters/index.html \
        nova-games/case-8bit-drifters/src/ui/pixel-text.ts
git commit -m "case-8bit-drifters: pixel-text helper + Press Start 2P"
```

---

### Task 2.2: Procedural spinning tire

**Files:**
- Create: `nova-games/case-8bit-drifters/src/art/tire.ts`

**Step 1: Write tire**

```ts
import { Container, Graphics } from "pixi.js";

export type Tire = {
	view: Container;
	update(dt: number): void;
};

export function createTire(radius: number): Tire {
	const view = new Container();

	// Black tire base + silver rim + hub
	const base = new Graphics()
		.circle(0, 0, radius).fill(0x111111)
		.circle(0, 0, radius * 0.55).fill(0xc0c4cc)
		.circle(0, 0, radius * 0.18).fill(0x6a6e76);

	// Tread ring (24 ticks around the outside, baked into base — they spin
	// with the tire). Compute each tick's two endpoints with sin/cos rather
	// than relying on per-shape rotation (Graphics has one rotation, not per
	// path).
	for (let i = 0; i < 24; i++) {
		const a = (i / 24) * Math.PI * 2;
		const ca = Math.cos(a), sa = Math.sin(a);
		const r0 = radius * 0.92, r1 = radius * 1.0;
		const w = radius * 0.05;
		// Tangent vector for the tick's "thickness"
		const tx = -sa, ty = ca;
		const x0 = ca * r0, y0 = sa * r0;
		const x1 = ca * r1, y1 = sa * r1;
		base.poly([
			x0 + tx * w, y0 + ty * w,
			x1 + tx * w, y1 + ty * w,
			x1 - tx * w, y1 - ty * w,
			x0 - tx * w, y0 - ty * w,
		], true).fill(0x222222);
	}

	// Five rim spokes — each is a Graphics rotated by its own angle.
	const rim = new Container();
	for (let i = 0; i < 5; i++) {
		const spoke = new Graphics()
			.rect(-radius * 0.05, -radius * 0.5, radius * 0.1, radius * 0.36)
			.fill(0xc0c4cc);
		spoke.rotation = (i / 5) * Math.PI * 2;
		rim.addChild(spoke);
	}
	base.addChild(rim);

	view.addChild(base);

	let spin = 0;
	return {
		view,
		update(dt) {
			spin += dt * Math.PI * 4; // ~2 rev/sec
			base.rotation = spin;
		},
	};
}
```

> Note: each spoke is its own Graphics with its own rotation — Graphics has a single `rotation` so you can't rotate per-path inside one Graphics object. The tread "ticks" are computed from polar coordinates so they don't need per-tick rotation either.

**Step 2: Type-check**

```
pnpm run test
```
Expected: passes.

**Step 3: Commit**

```
git add nova-games/case-8bit-drifters/src/art/tire.ts
git commit -m "case-8bit-drifters: procedural spinning tire art"
```

---

### Task 2.3: Smoke particle pool

**Files:**
- Create: `nova-games/case-8bit-drifters/src/race/particles.ts`
- Create: `nova-games/case-8bit-drifters/src/race/particles.test.ts`

> Note: "race/" because this same module powers race-scene smoke; the loading-screen tire reuses it.

**Step 1: Write the failing test**

```ts
import { expect, test } from "vitest";
import { createParticles } from "./particles";

test("spawn fills pool, update advances age, dead particles invisible", () => {
	const pool = createParticles(8);
	pool.spawn({ x: 0, y: 0, vx: 0, vy: 0, ttl: 1 });
	pool.update(0.5);
	expect(pool.aliveCount()).toBe(1);
	pool.update(0.6); // total 1.1 > ttl
	expect(pool.aliveCount()).toBe(0);
});

test("ring buffer wraps when overspawned", () => {
	const pool = createParticles(4);
	for (let i = 0; i < 10; i++) pool.spawn({ x: i, y: 0, vx: 0, vy: 0, ttl: 5 });
	expect(pool.aliveCount()).toBe(4);
});
```

**Step 2: Run, watch fail**

```
pnpm --filter @nova-games/case-8bit-drifters test
```
Expected: fails (no module).

**Step 3: Implement**

```ts
import { Container, Graphics } from "pixi.js";

export type ParticleSpawn = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	ttl: number;
};

export type Particles = {
	view: Container;
	spawn(p: ParticleSpawn): void;
	update(dt: number): void;
	aliveCount(): number;
};

export function createParticles(size = 256): Particles {
	const x = new Float32Array(size);
	const y = new Float32Array(size);
	const vx = new Float32Array(size);
	const vy = new Float32Array(size);
	const age = new Float32Array(size);
	const ttl = new Float32Array(size).fill(0);
	let head = 0;

	const view = new Container();
	const g = new Graphics();
	view.addChild(g);

	return {
		view,
		spawn(p) {
			x[head] = p.x;
			y[head] = p.y;
			vx[head] = p.vx;
			vy[head] = p.vy;
			age[head] = 0;
			ttl[head] = p.ttl;
			head = (head + 1) % size;
		},
		update(dt) {
			g.clear();
			for (let i = 0; i < size; i++) {
				if (ttl[i] <= 0) continue;
				age[i] += dt;
				if (age[i] >= ttl[i]) {
					ttl[i] = 0;
					continue;
				}
				x[i] += vx[i] * dt;
				y[i] += vy[i] * dt;
				const t = age[i] / ttl[i]; // 0..1
				const r = 4 + t * 12;
				const a = (1 - t) * 0.6;
				g.circle(x[i], y[i], r).fill({ color: 0xcccccc, alpha: a });
			}
		},
		aliveCount() {
			let n = 0;
			for (let i = 0; i < size; i++) if (ttl[i] > 0) n++;
			return n;
		},
	};
}
```

**Step 4: Re-run kid tests + root**

```
pnpm --filter @nova-games/case-8bit-drifters test
pnpm run test
```
Expected: both pass.

**Step 5: Commit**

```
git add nova-games/case-8bit-drifters/src/race/particles.ts \
        nova-games/case-8bit-drifters/src/race/particles.test.ts
git commit -m "case-8bit-drifters: smoke particle pool (TDD)"
```

---

### Task 2.4: Wire tire + smoke + START button into loading scene

**Files:**
- Modify: `nova-games/case-8bit-drifters/src/scenes/loading.ts`
- Create: `nova-games/case-8bit-drifters/src/ui/button.ts`

**Step 1: Pixel button helper**

Create `nova-games/case-8bit-drifters/src/ui/button.ts`:
```ts
import { Container } from "pixi.js";
import { pixelText } from "./pixel-text";

export type PixelButton = {
	view: Container;
	setEnabled(b: boolean): void;
};

export function pixelButton(label: string, onClick: () => void, fontSize = 24): PixelButton {
	const view = new Container();
	const text = pixelText(label, { fontSize });
	view.addChild(text);
	// Don't set view.hitArea explicitly — it would be a snapshot of the
	// initial bounds and would not update on hover-scale or label change.
	// Pixi's default child-based hit test follows the live text bounds.
	view.eventMode = "static";
	view.cursor = "pointer";
	let enabled = true;
	view.on("pointertap", () => {
		if (enabled) onClick();
	});
	view.on("pointerover", () => {
		if (enabled) text.scale.set(1.1);
	});
	view.on("pointerout", () => text.scale.set(1));
	return {
		view,
		setEnabled(b) {
			enabled = b;
			text.alpha = b ? 1 : 0.4;
		},
	};
}
```

**Step 2: Replace loading scene**

Replace `nova-games/case-8bit-drifters/src/scenes/loading.ts`:
```ts
import { Container } from "pixi.js";
import { createTire } from "../art/tire";
import { createParticles } from "../race/particles";
import { pixelButton } from "../ui/button";
import { pixelText } from "../ui/pixel-text";
import type { Scene, SceneFactory } from "../context";
import { createNamePickerScene } from "./name-picker";
import { createHomeScene } from "./home";

export const createLoadingScene: SceneFactory = (ctx) => {
	const root = new Container();
	const tire = createTire(80);
	const particles = createParticles(64);

	const button = pixelButton("START", () => {
		const next = ctx.profile ? createHomeScene : createNamePickerScene;
		ctx.switchTo(next);
	}, 28);

	const title = pixelText("8-BIT DRIFTERS", { fontSize: 36, fill: 0x00d2ff });

	root.addChild(particles.view, tire.view, button.view, title);

	const place = (): void => {
		const cx = ctx.app.screen.width / 2;
		const cy = ctx.app.screen.height / 2;
		title.position.set(cx, cy - 180);
		tire.view.position.set(cx, cy);
		particles.view.position.set(cx, cy);
		button.view.position.set(cx, cy + 160);
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	let smokeTimer = 0;
	const scene: Scene = {
		root,
		update(dt) {
			tire.update(dt);
			smokeTimer += dt;
			while (smokeTimer > 0.04) {
				smokeTimer -= 0.04;
				particles.spawn({
					x: 60 + Math.random() * 10,
					y: 0 + (Math.random() - 0.5) * 12,
					vx: 50 + Math.random() * 30,
					vy: -10 + (Math.random() - 0.5) * 20,
					ttl: 0.9 + Math.random() * 0.4,
				});
			}
			particles.update(dt);
		},
		dispose() {
			window.removeEventListener("resize", onResize);
			root.destroy({ children: true });
		},
	};
	return scene;
};
```

> Note: the `name-picker` and `home` imports will fail until Tasks 3.x and 4.x land. Keep going — TypeScript will tell you exactly when they resolve.

**Step 3: Stub the missing scenes so this compiles**

Create both as empty placeholders:

`nova-games/case-8bit-drifters/src/scenes/name-picker.ts`:
```ts
import { Container } from "pixi.js";
import type { Scene, SceneFactory } from "../context";

export const createNamePickerScene: SceneFactory = () => {
	const root = new Container();
	const scene: Scene = {
		root,
		update: () => {},
		dispose: () => root.destroy({ children: true }),
	};
	return scene;
};
```

`nova-games/case-8bit-drifters/src/scenes/home.ts`:
```ts
import { Container } from "pixi.js";
import type { Scene, SceneFactory } from "../context";

export const createHomeScene: SceneFactory = () => {
	const root = new Container();
	const scene: Scene = {
		root,
		update: () => {},
		dispose: () => root.destroy({ children: true }),
	};
	return scene;
};
```

**Step 4: Build + eyeball**

```
pnpm --filter @nova-games/case-8bit-drifters dev
```
Open http://localhost:5173. Expected: title at top, spinning tire in middle, smoke puffing off to the right, START button below. Click START → screen goes blank (stub scene). Reload → title still loads.

**Step 5: Root checks**

```
pnpm run test
```
Expected: passes.

**Step 6: Commit**

```
git add nova-games/case-8bit-drifters/src/ui/button.ts \
        nova-games/case-8bit-drifters/src/scenes/loading.ts \
        nova-games/case-8bit-drifters/src/scenes/name-picker.ts \
        nova-games/case-8bit-drifters/src/scenes/home.ts
git commit -m "case-8bit-drifters: loading screen with spinning tire and START"
```

---

## Milestone 3 — Name picker

Car preview, editable name tag, school-appropriate filter, persist on continue.

### Task 3.1: Procedural car art (parametric `look`)

**Files:**
- Create: `nova-games/case-8bit-drifters/src/art/car.ts`

**Step 1: Define `CarLook` and renderer**

```ts
import { Graphics } from "pixi.js";

export type CarLook = {
	bodyColor: number;
	windshieldColor: number;
	headlightColor: number;
	taillightColor: number;
};

export const DEFAULT_LOOK: CarLook = {
	bodyColor: 0xe53935,
	windshieldColor: 0x1a1f2e,
	headlightColor: 0xfff7c2,
	taillightColor: 0xff3344,
};

/** Draws a top-down-ish car centered on (0,0) facing right (+x). */
export function renderCar(
	g: Graphics,
	look: CarLook,
	opts: { brake?: boolean } = {},
): void {
	g.clear();
	// Body
	g.roundRect(-22, -12, 44, 24, 4).fill(look.bodyColor);
	// Hood split
	g.rect(-22, -1, 44, 2).fill({ color: 0x000000, alpha: 0.18 });
	// Windshield
	g.roundRect(-2, -10, 14, 20, 3).fill(look.windshieldColor);
	// Headlights (front, +x)
	g.rect(20, -9, 4, 4).fill(look.headlightColor);
	g.rect(20, 5, 4, 4).fill(look.headlightColor);
	// Taillights (rear, -x); brighten when braking
	const tailAlpha = opts.brake ? 1 : 0.7;
	g.rect(-24, -9, 3, 4).fill({ color: look.taillightColor, alpha: tailAlpha });
	g.rect(-24, 5, 3, 4).fill({ color: look.taillightColor, alpha: tailAlpha });
}
```

**Step 2: Type-check**

```
pnpm run test
```
Expected: passes.

**Step 3: Commit**

```
git add nova-games/case-8bit-drifters/src/art/car.ts
git commit -m "case-8bit-drifters: parametric procedural car renderer"
```

---

### Task 3.2: School-appropriate name filter (TDD)

**Files:**
- Create: `nova-games/case-8bit-drifters/src/scenes/name-filter.ts`
- Create: `nova-games/case-8bit-drifters/src/scenes/name-filter.test.ts`

**Step 1: Failing test**

```ts
import { expect, test } from "vitest";
import { validateName } from "./name-filter";

test("empty name rejected", () => expect(validateName("")).toBe("empty"));
test("whitespace-only rejected", () => expect(validateName("   ")).toBe("empty"));
test("too long rejected", () => expect(validateName("a".repeat(13))).toBe("too_long"));
test("profanity rejected (substring)", () => expect(validateName("xxhellfuckerxx")).toBe("profanity"));
test("clean name accepted", () => expect(validateName("Case")).toBe("ok"));
test("trims before checking length", () => expect(validateName("  Bo  ")).toBe("ok"));
```

**Step 2: Run, watch fail**

```
pnpm --filter @nova-games/case-8bit-drifters test
```

**Step 3: Implement**

```ts
const BAD = [
	"fuck", "shit", "bitch", "asshole", "dick", "cock", "pussy",
	"cunt", "fag", "nigger", "nigga", "retard", "rape", "porn",
	"sex", "slut", "whore",
];

export type NameValidation = "ok" | "empty" | "too_long" | "profanity";

export function validateName(raw: string): NameValidation {
	const name = raw.trim();
	if (name.length === 0) return "empty";
	if (name.length > 12) return "too_long";
	const lower = name.toLowerCase();
	for (const bad of BAD) if (lower.includes(bad)) return "profanity";
	return "ok";
}
```

**Step 4: Re-run + root**

```
pnpm --filter @nova-games/case-8bit-drifters test
pnpm run test
```

**Step 5: Commit**

```
git add nova-games/case-8bit-drifters/src/scenes/name-filter.ts \
        nova-games/case-8bit-drifters/src/scenes/name-filter.test.ts
git commit -m "case-8bit-drifters: name filter (TDD)"
```

---

### Task 3.3: Name picker scene (car + tag + DOM input + Continue)

**Files:**
- Modify: `nova-games/case-8bit-drifters/src/scenes/name-picker.ts`
- Modify: `nova-games/case-8bit-drifters/src/main.ts` (export `persist`)

**Step 1: Implement scene**

Replace `nova-games/case-8bit-drifters/src/scenes/name-picker.ts`:
```ts
import { Container, Graphics } from "pixi.js";
import { DEFAULT_LOOK, renderCar } from "../art/car";
import type { Scene, SceneFactory } from "../context";
import { pixelButton } from "../ui/button";
import { pixelText } from "../ui/pixel-text";
import { persist } from "../storage";
import { createHomeScene } from "./home";
import { validateName } from "./name-filter";

export const createNamePickerScene: SceneFactory = (ctx) => {
	const root = new Container();

	const carG = new Graphics();
	renderCar(carG, DEFAULT_LOOK);
	carG.scale.set(2.5);
	const tag = pixelText(ctx.profile?.name ?? "click to name", { fontSize: 22 });
	tag.eventMode = "static";
	tag.cursor = "text";
	const errText = pixelText("", { fontSize: 14, fill: 0xff5577 });
	const cont = pixelButton("CONTINUE", () => {
		if (!ctx.profile) return;
		persist(ctx);
		ctx.switchTo(createHomeScene);
	}, 22);
	cont.setEnabled(!!ctx.profile);

	root.addChild(carG, tag, errText, cont.view);

	const place = (): void => {
		const cx = ctx.app.screen.width / 2;
		const cy = ctx.app.screen.height / 2;
		tag.position.set(cx, cy - 110);
		carG.position.set(cx, cy);
		errText.position.set(cx, cy + 90);
		cont.view.position.set(cx, cy + 150);
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	const beginEdit = (): void => {
		tag.visible = false;
		errText.text = ""; // clear any previous error message before re-edit
		const input = document.createElement("input");
		input.type = "text";
		input.maxLength = 12;
		input.value = ctx.profile?.name ?? "";
		Object.assign(input.style, {
			position: "fixed",
			top: "50%",
			left: "50%",
			transform: "translate(-50%, -160px)",
			fontFamily: '"Press Start 2P", monospace',
			fontSize: "22px",
			background: "#0a0a14",
			color: "white",
			border: "2px solid #00d2ff",
			padding: "8px 12px",
			textAlign: "center",
			zIndex: "10",
		});
		document.body.appendChild(input);
		input.focus();
		input.select();
		const commit = (): void => {
			const v = validateName(input.value);
			if (v !== "ok") {
				errText.text =
					v === "empty" ? "name can't be empty"
					: v === "too_long" ? "max 12 characters"
					: "school-appropriate names please";
				input.remove();
				tag.visible = true;
				return;
			}
			errText.text = "";
			ctx.profile = { name: input.value.trim() };
			tag.text = ctx.profile.name;
			tag.visible = true;
			cont.setEnabled(true);
			input.remove();
		};
		input.addEventListener("blur", commit);
		input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") input.blur();
			if (e.key === "Escape") {
				input.remove();
				tag.visible = true;
			}
		});
	};
	tag.on("pointertap", beginEdit);

	const scene: Scene = {
		root,
		update: () => {},
		dispose: () => {
			window.removeEventListener("resize", onResize);
			root.destroy({ children: true });
		},
	};
	return scene;
};
```

**Step 2: Verify in browser**

```
pnpm --filter @nova-games/case-8bit-drifters dev
```
Boot → click START → name picker shows. Click "click to name" → DOM input appears centered above the car (offset upward). Type "Case" → Enter → tag updates, Continue button brightens. Click Continue → blank home stub. Reload page — Continue is enabled because profile persisted. Test profanity (e.g., "shit") → red error appears.

**Step 3: Root checks**

```
pnpm run test
```

**Step 4: Commit**

```
git add nova-games/case-8bit-drifters/src/scenes/name-picker.ts
git commit -m "case-8bit-drifters: name picker with editable tag and filter"
```

---

## Milestone 4 — Home shell

Tabs (Home active, Locker dim), gear icon → settings modal, map list with Tokyo, mode-toggle button, race button.

### Task 4.1: Tabs component with active-amplification

**Files:**
- Create: `nova-games/case-8bit-drifters/src/ui/tabs.ts`

**Step 1: Implement**

```ts
import { Container } from "pixi.js";
import { pixelText } from "./pixel-text";

export type TabsApi = {
	view: Container;
	width: number;
};

export function createTabs(
	tabs: { id: string; label: string; enabled: boolean }[],
	active: string,
	onClick: (id: string) => void,
): TabsApi {
	const view = new Container();
	let x = 0;
	const SPACING = 32;
	for (const tab of tabs) {
		const isActive = tab.id === active;
		const t = pixelText(tab.label.toUpperCase(), {
			fontSize: isActive ? 22 : 16,
			fill: !tab.enabled ? 0x444a55 : isActive ? 0x00d2ff : 0x8a92a3,
		});
		t.anchor.set(0, 0);
		t.position.set(x, isActive ? 0 : 6);
		t.eventMode = tab.enabled ? "static" : "passive";
		t.cursor = tab.enabled ? "pointer" : "not-allowed";
		t.on("pointertap", () => onClick(tab.id));
		view.addChild(t);
		x += t.width + SPACING;
	}
	return { view, width: x - SPACING };
}
```

**Step 2: Type-check + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/ui/tabs.ts
git commit -m "case-8bit-drifters: tabs component with active-amplification"
```

---

### Task 4.2: Settings modal (Exit + Restart)

**Files:**
- Create: `nova-games/case-8bit-drifters/src/ui/panel.ts`
- Create: `nova-games/case-8bit-drifters/src/scenes/settings-modal.ts`

**Step 1: Reusable rounded panel**

Create `nova-games/case-8bit-drifters/src/ui/panel.ts`:
```ts
import { Container, Graphics } from "pixi.js";

export function panel(width: number, height: number): Container {
	const c = new Container();
	const bg = new Graphics()
		.roundRect(-width / 2, -height / 2, width, height, 16)
		.fill({ color: 0x131726, alpha: 0.96 })
		.stroke({ color: 0x00d2ff, width: 2, alpha: 0.4 });
	c.addChild(bg);
	return c;
}
```

**Step 2: Modal**

Create `nova-games/case-8bit-drifters/src/scenes/settings-modal.ts`:
```ts
import { Container, Graphics } from "pixi.js";
import type { GameContext, SceneFactory } from "../context";
import { panel } from "../ui/panel";
import { pixelButton } from "../ui/button";
import { pixelText } from "../ui/pixel-text";
import { createLoadingScene } from "./loading";

export type SettingsModalArgs = {
	onClose: () => void;
	currentSceneFactory: SceneFactory;
	ctx: GameContext;
};

export function createSettingsModal({
	onClose, currentSceneFactory, ctx,
}: SettingsModalArgs): Container {
	const root = new Container();
	root.eventMode = "static";

	const backdrop = new Graphics()
		.rect(0, 0, ctx.app.screen.width, ctx.app.screen.height)
		.fill({ color: 0x000000, alpha: 0.55 });
	backdrop.eventMode = "static";
	backdrop.on("pointertap", onClose);
	root.addChild(backdrop);

	const p = panel(360, 240);
	p.position.set(ctx.app.screen.width / 2, ctx.app.screen.height / 2);
	const title = pixelText("SETTINGS", { fontSize: 20 });
	title.position.set(0, -80);
	const restart = pixelButton("RESTART", () => ctx.switchTo(currentSceneFactory), 18);
	restart.view.position.set(0, -10);
	const exit = pixelButton("EXIT", () => ctx.switchTo(createLoadingScene), 18);
	exit.view.position.set(0, 40);
	p.addChild(title, restart.view, exit.view);
	root.addChild(p);

	return root;
}
```

**Step 3: Type-check + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/ui/panel.ts \
        nova-games/case-8bit-drifters/src/scenes/settings-modal.ts
git commit -m "case-8bit-drifters: settings modal with exit + restart"
```

---

### Task 4.3: Home scene (tabs, gear, map, mode, race button)

**Files:**
- Modify: `nova-games/case-8bit-drifters/src/scenes/home.ts`

**Step 1: Implement**

```ts
import { Container, Graphics } from "pixi.js";
import { DEFAULT_LOOK, renderCar } from "../art/car";
import type { Scene, SceneFactory } from "../context";
import { pixelButton } from "../ui/button";
import { pixelText } from "../ui/pixel-text";
import { panel } from "../ui/panel";
import { createTabs } from "../ui/tabs";
import { createSettingsModal } from "./settings-modal";
import { createRaceScene } from "./race";

const MODES = ["TIMED RUNS", "FREE PRACTICE", "RANKED"] as const;

export const createHomeScene: SceneFactory = (ctx) => {
	const root = new Container();

	// Top bar: gear, tabs. Declare baseTabsX up front so the click closure
	// below can reference it without TS strict-mode "used before declaration"
	// errors.
	let baseTabsX = 0;
	const gear = pixelText("⚙", { fontSize: 28 });
	gear.eventMode = "static";
	gear.cursor = "pointer";
	const tabs = createTabs(
		[{ id: "home", label: "Home", enabled: true },
		 { id: "locker", label: "Locker", enabled: false }],
		"home",
		(id) => {
			if (id === "locker") {
				// Disabled — small shake
				const t0 = performance.now();
				const animate = (): void => {
					const t = (performance.now() - t0) / 1000;
					tabs.view.x = baseTabsX + (Math.sin(t * 50) * 6) * Math.max(0, 1 - t * 5);
					if (t < 0.2) requestAnimationFrame(animate);
					else tabs.view.x = baseTabsX;
				};
				animate();
			}
		},
	);

	// Map list (left)
	const mapPanel = panel(180, 220);
	const mapTitle = pixelText("MAPS", { fontSize: 14 });
	mapTitle.position.set(0, -90);
	const mapEntry = pixelText("• TOKYO", { fontSize: 16, fill: 0x00d2ff });
	mapEntry.position.set(0, -60);
	mapPanel.addChild(mapTitle, mapEntry);

	// Center: car preview
	const carG = new Graphics();
	renderCar(carG, DEFAULT_LOOK);
	carG.scale.set(3);

	// Mode toggle
	let modeIdx = 0;
	const modeButton = pixelButton(MODES[modeIdx], () => {
		modeIdx = (modeIdx + 1) % MODES.length;
		modeText.text = MODES[modeIdx];
		// Quick rotate animation
		modeWrap.rotation = -Math.PI / 2;
		const t0 = performance.now();
		const tween = (): void => {
			const t = Math.min(1, (performance.now() - t0) / 250);
			modeWrap.rotation = -Math.PI / 2 * (1 - t);
			if (t < 1) requestAnimationFrame(tween);
		};
		tween();
	}, 16);
	const modeWrap = new Container();
	modeWrap.addChild(modeButton.view);
	const modeText = modeButton.view.children[0] as import("pixi.js").Text;

	// Race button
	const raceButton = pixelButton("RACE", () => ctx.switchTo(createRaceScene), 24);

	root.addChild(gear, tabs.view, mapPanel, carG, modeWrap, raceButton.view);

	// Settings modal lives on top, added/removed by gear click
	let modalOpen = false;
	gear.on("pointertap", () => {
		if (modalOpen) return;
		const modal = createSettingsModal({
			ctx,
			currentSceneFactory: createHomeScene,
			onClose: () => {
				root.removeChild(modal);
				modalOpen = false;
			},
		});
		root.addChild(modal);
		modalOpen = true;
	});

	const place = (): void => {
		const w = ctx.app.screen.width;
		const h = ctx.app.screen.height;
		gear.position.set(24, 16);
		baseTabsX = 80;
		tabs.view.position.set(baseTabsX, 18);
		mapPanel.position.set(140, h / 2);
		carG.position.set(w / 2, h / 2);
		modeWrap.position.set(w - 200, h - 130);
		raceButton.view.position.set(w - 200, h - 70);
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	const scene: Scene = {
		root,
		update: () => {},
		dispose: () => {
			window.removeEventListener("resize", onResize);
			root.destroy({ children: true });
		},
	};
	return scene;
};
```

**Step 2: Stub the race scene so this compiles**

Create `nova-games/case-8bit-drifters/src/scenes/race.ts`:
```ts
import { Container } from "pixi.js";
import type { Scene, SceneFactory } from "../context";
import { pixelText } from "../ui/pixel-text";
import { pixelButton } from "../ui/button";
import { createHomeScene } from "./home";

export const createRaceScene: SceneFactory = (ctx) => {
	const root = new Container();
	const t = pixelText("race scene (TODO)", { fontSize: 24 });
	const back = pixelButton("BACK", () => ctx.switchTo(createHomeScene), 16);
	const place = (): void => {
		t.position.set(ctx.app.screen.width / 2, ctx.app.screen.height / 2);
		back.view.position.set(ctx.app.screen.width / 2, ctx.app.screen.height / 2 + 40);
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);
	root.addChild(t, back.view);
	const scene: Scene = {
		root, update: () => {}, dispose: () => {
			window.removeEventListener("resize", onResize);
			root.destroy({ children: true });
		},
	};
	return scene;
};
```

**Step 3: Verify**

```
pnpm --filter @nova-games/case-8bit-drifters dev
```
Boot → START → name picker → Continue → home. Verify: gear top-left, HOME / locker tabs (Locker dim), MAPS panel left, car center, mode button rotates labels through 3 options, RACE button bottom-right, gear opens settings modal with Exit/Restart, clicking backdrop or Exit returns to loading, Restart re-creates home.

**Step 4: Root checks**

```
pnpm run test
```

**Step 5: Commit**

```
git add nova-games/case-8bit-drifters/src/scenes/home.ts \
        nova-games/case-8bit-drifters/src/scenes/race.ts
git commit -m "case-8bit-drifters: home shell with tabs, gear, map, mode, race"
```

---

## Milestone 5 — Tokyo track + camera

Track data, axonometric building art, ground/entity/building layering, camera follow, building occlusion fade. Static car at start position; no driving yet.

### Task 5.1: Tokyo waypoints

**Files:**
- Create: `nova-games/case-8bit-drifters/src/race/track-data.ts`

**Step 1: Hand-author the loop**

```ts
export type Vec2 = { x: number; y: number };

export type BuildingRect = {
	x: number; y: number;          // top-left in world units
	w: number; h: number;          // size
	height: number;                // axonometric "tallness"
	color: number;                 // base facade color
	neon?: number;                 // optional neon trim color
	roofColor?: number;
};

export type TrackData = {
	centerline: Vec2[];            // closed polyline (last → first connects)
	width: number;                 // road width
	startIndex: number;            // segment index where the start line sits
	buildings: BuildingRect[];
	lake?: { cx: number; cy: number; rx: number; ry: number };
};

// Hand-tuned Tokyo loop. Coordinates are arbitrary world units; lap target
// ~60s at the car's cruise speed (~25 units/s when straight). The shape is a
// distorted figure-eight-without-crossing: long start straight at the top,
// hairpin right, sweeping curve through "Shibuya" intersection, second hairpin,
// curve around the lake park, back to start.
export const TOKYO: TrackData = {
	width: 56,
	startIndex: 6, // mid-straight
	centerline: [
		{ x: -800, y: -400 }, // 0  start straight begin (west)
		{ x: -600, y: -400 },
		{ x: -400, y: -400 },
		{ x: -200, y: -400 },
		{ x:    0, y: -400 },
		{ x:  200, y: -400 },
		{ x:  400, y: -400 }, // 6  start/finish line
		{ x:  600, y: -400 },
		{ x:  800, y: -380 }, // 8  approach hairpin 1
		{ x:  900, y: -300 },
		{ x:  920, y: -180 },
		{ x:  900, y:  -60 },
		{ x:  820, y:   40 }, // 12 exit hairpin 1
		{ x:  680, y:  100 }, // shibuya approach
		{ x:  500, y:  140 }, // 14 shibuya crossing center
		{ x:  300, y:  140 },
		{ x:  100, y:  120 },
		{ x:  -80, y:   80 },
		{ x: -240, y:    0 }, // approach hairpin 2
		{ x: -340, y: -100 },
		{ x: -360, y: -240 }, // hairpin 2 inner
		{ x: -300, y: -340 },
		{ x: -180, y: -360 }, // park approach
		{ x:  -40, y: -300 },
		{ x:   40, y: -200 }, // around lake (lake at ~(120, -180))
		{ x:   80, y:  -80 },
		{ x:  -20, y:    0 },
		{ x: -200, y:   60 },
		{ x: -400, y:   80 },
		{ x: -600, y:   60 },
		{ x: -780, y:    0 },
		{ x: -880, y: -120 },
		{ x: -900, y: -260 },
		{ x: -860, y: -380 }, // returns to start straight
	],
	buildings: [
		// Buildings flanking the start straight (north + south of road)
		{ x: -800, y: -540, w: 200, h: 80, height: 90, color: 0x1a2438, neon: 0xff3399 },
		{ x: -560, y: -560, w: 180, h: 100, height: 110, color: 0x1f2c44, neon: 0x00d2ff },
		{ x: -340, y: -540, w: 220, h: 80, height: 80, color: 0x222d44, neon: 0x00ff88 },
		{ x: -100, y: -560, w: 200, h: 100, height: 130, color: 0x1c2640, neon: 0xff77dd },
		{ x:  140, y: -540, w: 200, h: 80, height: 100, color: 0x1a2438, neon: 0x00d2ff },
		{ x:  380, y: -560, w: 240, h: 100, height: 120, color: 0x21304a, neon: 0xffd900 },
		{ x: -780, y: -340, w: 100, h: 60, height: 70, color: 0x182030 },
		{ x:  -40, y: -340, w: 100, h: 60, height: 70, color: 0x182030 },
		{ x:  600, y: -340, w: 120, h: 80, height: 90, color: 0x182030, neon: 0xff3399 },
		// Hairpin 1 enclosure
		{ x:  900, y: -200, w: 120, h: 100, height: 100, color: 0x1c2640, neon: 0x00d2ff },
		// Shibuya block (4 corners around (500, 140))
		{ x:  340, y:   40, w: 120, h: 80, height: 110, color: 0x222d44, neon: 0xff77dd },
		{ x:  540, y:   40, w: 140, h: 80, height: 130, color: 0x1f2c44, neon: 0x00ff88 },
		{ x:  340, y:  200, w: 140, h: 100, height: 100, color: 0x1a2438, neon: 0x00d2ff },
		{ x:  560, y:  200, w: 120, h: 100, height: 120, color: 0x21304a, neon: 0xffd900 },
		// Around hairpin 2
		{ x: -440, y: -140, w: 100, h: 80, height: 90, color: 0x1c2640 },
		{ x: -440, y: -260, w: 100, h: 80, height: 90, color: 0x182030 },
		// Outer ring (variety + occlusion candidates)
		{ x: -1000, y: -500, w: 100, h: 80, height: 60, color: 0x121826 },
		{ x:  -100, y:  140, w: 120, h: 100, height: 80, color: 0x172131 },
	],
	lake: { cx: 120, cy: -180, rx: 110, ry: 70 },
};
```

**Step 2: Type-check**

```
pnpm run test
```

**Step 3: Commit**

```
git add nova-games/case-8bit-drifters/src/race/track-data.ts
git commit -m "case-8bit-drifters: hand-authored Tokyo waypoints + buildings"
```

---

### Task 5.2: Track rendering (asphalt, yellow line, lake, lap line)

**Files:**
- Create: `nova-games/case-8bit-drifters/src/race/track.ts`

**Step 1: Implement**

```ts
import { Container, Graphics } from "pixi.js";
import type { TrackData, Vec2 } from "./track-data";

export type Track = {
	view: Container;
	data: TrackData;
	startPos: Vec2;
	startTangent: Vec2;             // unit vector along the road at start
};

function unit(dx: number, dy: number): Vec2 {
	const m = Math.hypot(dx, dy) || 1;
	return { x: dx / m, y: dy / m };
}

export function buildTrack(data: TrackData): Track {
	const view = new Container();

	const ground = new Graphics();
	// Lake first (under road if they overlap)
	if (data.lake) {
		ground.ellipse(data.lake.cx, data.lake.cy, data.lake.rx, data.lake.ry)
			.fill(0x1a4060).stroke({ color: 0x0a2030, width: 4 });
		// Park grass ring
		ground.ellipse(data.lake.cx, data.lake.cy, data.lake.rx + 40, data.lake.ry + 30)
			.stroke({ color: 0x244c2c, width: 6, alpha: 0.6 });
	}
	// Yellow boundary FIRST as a wider stroke; asphalt drawn on top so only
	// the outer 2px on each side stays visibly yellow. (Drawing asphalt
	// before yellow would let the second pass cover the yellow entirely.)
	ground.poly(closedPath(data.centerline), true)
		.stroke({ color: 0xf2c000, width: data.width + 4, alpha: 0.85, cap: "round", join: "round" });
	ground.poly(closedPath(data.centerline), true)
		.stroke({ color: 0x222a36, width: data.width, cap: "round", join: "round" });
	// Center dashed line (thin, on top of asphalt)
	ground.poly(closedPath(data.centerline), true)
		.stroke({ color: 0xffe680, width: 2, alpha: 0.55 });
	// Shibuya crosswalk (a few white parallel stripes near waypoint 14)
	const cw = data.centerline[14];
	for (let i = -3; i <= 3; i++) {
		ground.rect(cw.x - 60 + i * 14, cw.y - 30, 8, 60).fill({ color: 0xffffff, alpha: 0.7 });
	}
	view.addChild(ground);

	// Start/finish line (a perpendicular stripe)
	const a = data.centerline[data.startIndex];
	const b = data.centerline[(data.startIndex + 1) % data.centerline.length];
	const t = unit(b.x - a.x, b.y - a.y);
	const n = { x: -t.y, y: t.x };
	const sf = new Graphics();
	const half = data.width / 2 + 4;
	sf.moveTo(a.x + n.x * half, a.y + n.y * half)
	  .lineTo(a.x - n.x * half, a.y - n.y * half)
	  .stroke({ color: 0xffffff, width: 6 });
	view.addChild(sf);

	return {
		view,
		data,
		startPos: { x: a.x, y: a.y },
		startTangent: t,
	};
}

function closedPath(points: Vec2[]): number[] {
	const out: number[] = [];
	for (const p of points) out.push(p.x, p.y);
	return out;
}
```

**Step 2: Type-check + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/race/track.ts
git commit -m "case-8bit-drifters: track rendering (asphalt, yellow line, lake, start)"
```

---

### Task 5.3: Axonometric building rendering

**Files:**
- Create: `nova-games/case-8bit-drifters/src/art/buildings.ts`

**Step 1: Render each building as roof + facade**

```ts
import { Container, Graphics } from "pixi.js";
import type { BuildingRect } from "../race/track-data";

export type BuildingSprite = {
	view: Container;
	footprint: { x: number; y: number; w: number; h: number };
	occlusionRect: { x: number; y: number; w: number; h: number };
};

/**
 * "Axonometric" — the camera doesn't tilt, but each building is drawn as a
 * roof polygon plus a south-facing facade extending downward (toward the
 * camera) by `height` pixels. The facade is what occludes the road in front.
 */
export function buildBuilding(rect: BuildingRect): BuildingSprite {
	const view = new Container();
	const g = new Graphics();
	const { x, y, w, h, height, color, neon, roofColor } = rect;

	// Facade (south wall): rectangle from (x, y+h) extending DOWN by `height`,
	// drawn first so the roof is on top.
	g.rect(x, y + h, w, height).fill(color);
	// Subtle facade highlight (right edge "lit" by neon city)
	g.rect(x + w - 4, y + h, 4, height).fill({ color: 0xffffff, alpha: 0.05 });
	// Lit windows pattern
	const cols = Math.max(2, Math.floor(w / 14));
	const rows = Math.max(2, Math.floor(height / 12));
	for (let cx = 0; cx < cols; cx++) {
		for (let cy = 0; cy < rows; cy++) {
			if (Math.random() > 0.55) {
				g.rect(x + 6 + cx * (w / cols), y + h + 4 + cy * (height / rows), 6, 6)
					.fill({ color: 0xffeebb, alpha: 0.35 + Math.random() * 0.4 });
			}
		}
	}
	// Roof
	g.rect(x, y, w, h).fill(roofColor ?? mix(color, 0xffffff, 0.18));
	g.rect(x, y, w, h).stroke({ color: 0x000000, width: 1, alpha: 0.4 });
	// Neon trim along south edge of roof
	if (neon !== undefined) {
		g.rect(x, y + h - 2, w, 2).fill({ color: neon, alpha: 0.85 });
	}

	view.addChild(g);
	return {
		view,
		footprint: { x, y, w, h },
		occlusionRect: { x, y, w, h: h + height },
	};
}

function mix(a: number, b: number, t: number): number {
	const ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
	const br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
	const r = Math.round(ar + (br - ar) * t);
	const g = Math.round(ag + (bg - ag) * t);
	const bl = Math.round(ab + (bb - ab) * t);
	return (r << 16) | (g << 8) | bl;
}
```

**Step 2: Type-check + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/art/buildings.ts
git commit -m "case-8bit-drifters: axonometric building sprite renderer"
```

---

### Task 5.4: World container with three layers + camera + occlusion

**Files:**
- Create: `nova-games/case-8bit-drifters/src/race/world.ts`

**Step 1: Implement**

```ts
import { Container } from "pixi.js";
import { buildBuilding, type BuildingSprite } from "../art/buildings";
import { buildTrack, type Track } from "./track";
import type { TrackData, Vec2 } from "./track-data";

export type World = {
	root: Container;          // add to scene root
	groundLayer: Container;
	entityLayer: Container;   // car, particles
	buildingLayer: Container; // axonometric buildings
	track: Track;
	buildings: BuildingSprite[];
	camera: { target: Vec2; scale: number };
	updateCamera(screenW: number, screenH: number): void;
	updateOcclusion(carWorld: Vec2): void;
};

export function buildWorld(data: TrackData): World {
	const root = new Container();
	root.eventMode = "none";
	const groundLayer = new Container();
	const entityLayer = new Container();
	const buildingLayer = new Container();
	buildingLayer.sortableChildren = true;
	root.addChild(groundLayer, entityLayer, buildingLayer);

	const track = buildTrack(data);
	groundLayer.addChild(track.view);

	const buildings = data.buildings.map(buildBuilding);
	for (const b of buildings) {
		// zIndex by VISUAL bottom (footprint.y + footprint.h + facade height)
		// so a tall building's facade still sorts in front of cars that are
		// north of the visual bottom but south of the roof's south edge.
		b.view.zIndex = b.occlusionRect.y + b.occlusionRect.h;
		buildingLayer.addChild(b.view);
	}

	const camera = { target: { x: track.startPos.x, y: track.startPos.y }, scale: 1.2 };

	return {
		root, groundLayer, entityLayer, buildingLayer,
		track, buildings, camera,
		updateCamera(screenW, screenH) {
			root.x = screenW / 2 - camera.target.x * camera.scale;
			root.y = screenH / 2 - camera.target.y * camera.scale;
			root.scale.set(camera.scale);
		},
		updateOcclusion(carWorld) {
			// World-space comparison: simpler and faster than projecting to
			// screen coordinates and back. The car's world (x,y) is checked
			// against each building's world-space occlusion rect (roof +
			// facade extension).
			for (const b of buildings) {
				const r = b.occlusionRect;
				const inside =
					carWorld.x >= r.x && carWorld.x <= r.x + r.w &&
					carWorld.y >= r.y && carWorld.y <= r.y + r.h;
				const target = inside ? 0.3 : 1.0;
				b.view.alpha += (target - b.view.alpha) * 0.18; // smooth lerp
			}
		},
	};
}
```

**Step 2: Type-check + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/race/world.ts
git commit -m "case-8bit-drifters: world layers + camera + occlusion fade"
```

---

### Task 5.5: Wire world into race scene with static car at start

**Files:**
- Modify: `nova-games/case-8bit-drifters/src/scenes/race.ts`

**Step 1: Replace stub race**

```ts
import { Container, Graphics } from "pixi.js";
import { DEFAULT_LOOK, renderCar } from "../art/car";
import type { Scene, SceneFactory } from "../context";
import { buildWorld } from "../race/world";
import { TOKYO } from "../race/track-data";
import { pixelButton } from "../ui/button";
import { createHomeScene } from "./home";

export const createRaceScene: SceneFactory = (ctx) => {
	const root = new Container();
	const world = buildWorld(TOKYO);
	root.addChild(world.root);

	// Static car at start, facing along start tangent
	const carG = new Graphics();
	renderCar(carG, DEFAULT_LOOK);
	carG.position.set(world.track.startPos.x, world.track.startPos.y);
	carG.rotation = Math.atan2(world.track.startTangent.y, world.track.startTangent.x);
	world.entityLayer.addChild(carG);
	world.entityLayer.sortableChildren = true;
	carG.zIndex = world.track.startPos.y;

	// Temporary back button (top-left in screen space, outside world)
	const ui = new Container();
	const back = pixelButton("BACK", () => ctx.switchTo(createHomeScene), 14);
	back.view.position.set(60, 24);
	ui.addChild(back.view);
	root.addChild(ui);

	const scene: Scene = {
		root,
		update: () => {
			world.updateCamera(ctx.app.screen.width, ctx.app.screen.height);
			world.updateOcclusion({ x: world.track.startPos.x, y: world.track.startPos.y });
		},
		dispose: () => {
			root.destroy({ children: true });
		},
	};
	return scene;
};
```

**Step 2: Verify in browser**

```
pnpm --filter @nova-games/case-8bit-drifters dev
```
Boot → Race button. Expected: Tokyo track visible centered on the start, axonometric buildings flanking it, lake visible on south side, car at start line. No motion yet. Buildings in front (south of car) draw over the entity layer; buildings behind draw under.

**Step 3: Root checks + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/scenes/race.ts
git commit -m "case-8bit-drifters: render Tokyo + static car at start"
```

---

## Milestone 6 — Car + input + camera follow

Keyboard input, basic forward/back/turn movement (no drift yet), camera follows car.

### Task 6.1: Keyboard input class

**Files:**
- Create: `nova-games/case-8bit-drifters/src/race/input.ts`

**Step 1: Implement**

```ts
export type InputState = {
	throttle: -1 | 0 | 1;
	steer: -1 | 0 | 1;
	drift: boolean;
	driftPressed: boolean;     // edge: true the frame Shift is pressed
};

export type Input = {
	read(): InputState;
	dispose(): void;
};

export function createKeyboardInput(): Input {
	const keys = new Set<string>();
	let driftPressedEdge = false;
	const onDown = (e: KeyboardEvent): void => {
		const k = e.key.toLowerCase();
		if (k === "shift" && !keys.has("shift")) driftPressedEdge = true;
		keys.add(k);
	};
	const onUp = (e: KeyboardEvent): void => {
		keys.delete(e.key.toLowerCase());
	};
	window.addEventListener("keydown", onDown);
	window.addEventListener("keyup", onUp);
	return {
		read() {
			const throttle: -1 | 0 | 1 =
				keys.has("w") || keys.has("arrowup") ? 1 :
				keys.has("s") || keys.has("arrowdown") ? -1 : 0;
			const steer: -1 | 0 | 1 =
				keys.has("a") || keys.has("arrowleft") ? -1 :
				keys.has("d") || keys.has("arrowright") ? 1 : 0;
			const drift = keys.has("shift");
			const driftPressed = driftPressedEdge;
			driftPressedEdge = false;
			return { throttle, steer, drift, driftPressed };
		},
		dispose() {
			window.removeEventListener("keydown", onDown);
			window.removeEventListener("keyup", onUp);
		},
	};
}
```

**Step 2: Type-check + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/race/input.ts
git commit -m "case-8bit-drifters: keyboard input"
```

---

### Task 6.2: Car class with grip-only physics

**Files:**
- Create: `nova-games/case-8bit-drifters/src/race/car.ts`

**Step 1: Implement (no drift state yet — just grip)**

```ts
import type { CarLook } from "../art/car";
import { DEFAULT_LOOK } from "../art/car";
import type { InputState } from "./input";

export const CAR_PHYSICS = {
	maxSpeed: 32,
	accel: 18,
	reverseAccel: 10,
	brakeFromForward: 28,
	dragLinear: 0.6,
	steerRate: 2.4,             // rad/sec at speed
	steerSpeedRef: 18,          // speed at which steerRate applies fully
};

export class Car {
	x = 0; y = 0;
	vx = 0; vy = 0;
	facing = 0;            // radians; 0 = facing +x
	look: CarLook = DEFAULT_LOOK;

	get speed(): number {
		return Math.hypot(this.vx, this.vy);
	}

	get braking(): boolean {
		// "braking" if input wants reverse but velocity is forward
		return this._braking;
	}

	private _braking = false;

	update(dt: number, input: InputState): void {
		// Forward unit vector
		const fx = Math.cos(this.facing);
		const fy = Math.sin(this.facing);
		const forwardSpeed = this.vx * fx + this.vy * fy;

		this._braking = false;
		if (input.throttle === 1) {
			this.vx += fx * CAR_PHYSICS.accel * dt;
			this.vy += fy * CAR_PHYSICS.accel * dt;
		} else if (input.throttle === -1) {
			if (forwardSpeed > 1) {
				// brake
				const decel = CAR_PHYSICS.brakeFromForward * dt;
				const decelX = fx * decel;
				const decelY = fy * decel;
				this.vx -= decelX;
				this.vy -= decelY;
				this._braking = true;
			} else {
				this.vx -= fx * CAR_PHYSICS.reverseAccel * dt;
				this.vy -= fy * CAR_PHYSICS.reverseAccel * dt;
			}
		}
		// Linear drag
		this.vx *= 1 - CAR_PHYSICS.dragLinear * dt;
		this.vy *= 1 - CAR_PHYSICS.dragLinear * dt;

		// Cap speed
		const sp = this.speed;
		if (sp > CAR_PHYSICS.maxSpeed) {
			this.vx *= CAR_PHYSICS.maxSpeed / sp;
			this.vy *= CAR_PHYSICS.maxSpeed / sp;
		}

		// Steering — proportional to current speed (no turning when stopped)
		if (input.steer !== 0) {
			const speedFactor = Math.min(1, this.speed / CAR_PHYSICS.steerSpeedRef);
			const sign = forwardSpeed >= 0 ? 1 : -1;
			this.facing += input.steer * CAR_PHYSICS.steerRate * speedFactor * sign * dt;
		}

		// Snap velocity toward facing in GRIP mode (prevents banked-curve weirdness)
		const desiredVx = fx * forwardSpeed;
		const desiredVy = fy * forwardSpeed;
		this.vx += (desiredVx - this.vx) * Math.min(1, 12 * dt);
		this.vy += (desiredVy - this.vy) * Math.min(1, 12 * dt);

		// Integrate position
		this.x += this.vx * dt;
		this.y += this.vy * dt;
	}
}
```

**Step 2: Type-check + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/race/car.ts
git commit -m "case-8bit-drifters: car class with grip-only physics"
```

---

### Task 6.3: Wire car + input + follow-cam into race scene

**Files:**
- Modify: `nova-games/case-8bit-drifters/src/scenes/race.ts`

**Step 1: Update**

Replace race scene with:
```ts
import { Container, Graphics } from "pixi.js";
import { DEFAULT_LOOK, renderCar } from "../art/car";
import type { Scene, SceneFactory } from "../context";
import { Car } from "../race/car";
import { createKeyboardInput } from "../race/input";
import { TOKYO } from "../race/track-data";
import { buildWorld } from "../race/world";
import { pixelButton } from "../ui/button";
import { createHomeScene } from "./home";

export const createRaceScene: SceneFactory = (ctx) => {
	const root = new Container();
	const world = buildWorld(TOKYO);
	world.root.eventMode = "none";
	root.addChild(world.root);

	const car = new Car();
	car.x = world.track.startPos.x;
	car.y = world.track.startPos.y;
	car.facing = Math.atan2(world.track.startTangent.y, world.track.startTangent.x);

	const carG = new Graphics();
	world.entityLayer.addChild(carG);
	world.entityLayer.sortableChildren = true;

	const input = createKeyboardInput();

	const ui = new Container();
	const back = pixelButton("BACK", () => ctx.switchTo(createHomeScene), 14);
	back.view.position.set(60, 24);
	ui.addChild(back.view);
	root.addChild(ui);

	const scene: Scene = {
		root,
		update(dt) {
			const state = input.read();
			car.update(dt, state);
			renderCar(carG, car.look, { brake: car.braking });
			carG.position.set(car.x, car.y);
			carG.rotation = car.facing;
			carG.zIndex = car.y;
			world.camera.target.x = car.x;
			world.camera.target.y = car.y;
			world.updateCamera(ctx.app.screen.width, ctx.app.screen.height);
			world.updateOcclusion({ x: car.x, y: car.y });
		},
		dispose() {
			input.dispose();
			root.destroy({ children: true });
		},
	};
	return scene;
};
```

**Step 2: Drive it**

```
pnpm --filter @nova-games/case-8bit-drifters dev
```
W = forward, S = brake/reverse, A/D = steer. Confirm: car accelerates, turns proportionally to speed, brakes, reverses, camera follows. No drift yet. Buildings fade to ~30% alpha when overlapping the car.

**Step 3: Root checks + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/scenes/race.ts
git commit -m "case-8bit-drifters: drivable car with follow-cam"
```

---

### Task 6.4: Headlight cones

**Files:**
- Modify: `nova-games/case-8bit-drifters/src/scenes/race.ts`
- Create: `nova-games/case-8bit-drifters/src/art/headlights.ts`

**Step 1: Headlight cone graphic**

Create `nova-games/case-8bit-drifters/src/art/headlights.ts`:
```ts
import { Graphics } from "pixi.js";

/** Two overlapping cones extending forward from the car. Drawn additive. */
export function renderHeadlights(g: Graphics, color: number): void {
	g.clear();
	g.blendMode = "add";
	const tip = 70;
	const half = 26;
	g.poly([22, -8, tip, -half, tip, half, 22, 8])
		.fill({ color, alpha: 0.18 });
	g.poly([22, -8, tip + 14, -half - 4, tip + 14, half + 4, 22, 8])
		.fill({ color, alpha: 0.08 });
}
```

**Step 2: Wire into race scene**

In `race.ts`, after creating `carG`, add:
```ts
import { renderHeadlights } from "../art/headlights";
// ...
const headlights = new Graphics();
world.entityLayer.addChildAt(headlights, 0); // below car so the car body sits on top
```

In `update`, after updating `car`:
```ts
renderHeadlights(headlights, car.look.headlightColor);
headlights.position.set(car.x, car.y);
headlights.rotation = car.facing;
headlights.zIndex = car.y - 0.1;
```

**Step 3: Verify**

Drive at night → small glow cone reaches forward of the car. Subtle but present. Adjust alphas to taste.

**Step 4: Root checks + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/art/headlights.ts \
        nova-games/case-8bit-drifters/src/scenes/race.ts
git commit -m "case-8bit-drifters: headlight cones"
```

---

## Milestone 7 — Drift mechanics

Pure drift state machine (TDD), then wire into Car. Add smoke + skid marks.

### Task 7.1: Drift state machine (TDD)

**Files:**
- Create: `nova-games/case-8bit-drifters/src/race/drift.ts`
- Create: `nova-games/case-8bit-drifters/src/race/drift.test.ts`

**Step 1: Failing tests**

```ts
import { expect, test } from "vitest";
import { type DriftConfig, DEFAULT_DRIFT_CONFIG, stepDriftState } from "./drift";

const cfg: DriftConfig = DEFAULT_DRIFT_CONFIG;

test("GRIP → DRIFTING when shift pressed at speed with steering", () => {
	const next = stepDriftState({
		state: "GRIP", slip: 0, yawRate: 0, speed: 10,
		input: { drift: true, driftPressed: true, steer: 1 },
		cfg,
	});
	expect(next).toBe("DRIFTING");
});

test("GRIP stays GRIP when speed below minDriftSpeed", () => {
	const next = stepDriftState({
		state: "GRIP", slip: 0, yawRate: 0, speed: 2,
		input: { drift: true, driftPressed: true, steer: 1 },
		cfg,
	});
	expect(next).toBe("GRIP");
});

test("GRIP stays GRIP when not steering", () => {
	const next = stepDriftState({
		state: "GRIP", slip: 0, yawRate: 0, speed: 10,
		input: { drift: true, driftPressed: true, steer: 0 },
		cfg,
	});
	expect(next).toBe("GRIP");
});

test("DRIFTING → SPINNING when yawRate exceeds maxYawRate", () => {
	const next = stepDriftState({
		state: "DRIFTING", slip: 0.5, yawRate: cfg.maxYawRate + 0.1, speed: 10,
		input: { drift: true, driftPressed: false, steer: 1 },
		cfg,
	});
	expect(next).toBe("SPINNING");
});

test("DRIFTING → GRIP when shift released and slip below exit threshold", () => {
	const next = stepDriftState({
		state: "DRIFTING", slip: cfg.exitSlipThreshold - 0.001, yawRate: 0.1, speed: 10,
		input: { drift: false, driftPressed: false, steer: 0 },
		cfg,
	});
	expect(next).toBe("GRIP");
});

test("SPINNING → GRIP when yawRate falls below spinExitYawRate", () => {
	const next = stepDriftState({
		state: "SPINNING", slip: 0.5, yawRate: cfg.spinExitYawRate - 0.01, speed: 10,
		input: { drift: false, driftPressed: false, steer: 0 },
		cfg,
	});
	expect(next).toBe("GRIP");
});
```

**Step 2: Implement**

```ts
export type DriftState = "GRIP" | "DRIFTING" | "SPINNING";

export type DriftConfig = {
	minDriftSpeed: number;
	entryAngleThreshold: number;
	exitSlipThreshold: number;
	maxYawRate: number;
	spinExitYawRate: number;
	steerAuthorityGrip: number;
	steerAuthorityDrift: number;
	lateralGripGrip: number;
	lateralGripDrift: number;
	longitudinalGripDrift: number;
	gripRecoveryRate: number;
};

export const DEFAULT_DRIFT_CONFIG: DriftConfig = {
	minDriftSpeed: 6,
	entryAngleThreshold: 0.15,
	exitSlipThreshold: 0.05,
	maxYawRate: 4.0,
	spinExitYawRate: 0.5,
	steerAuthorityGrip: 1.0,
	steerAuthorityDrift: 2.5,
	lateralGripGrip: 12.0,
	lateralGripDrift: 2.5,
	longitudinalGripDrift: 0.85,
	gripRecoveryRate: 8.0,
};

export type StepArgs = {
	state: DriftState;
	slip: number;       // |angle between facing and velocity|
	yawRate: number;    // |radians/sec|
	speed: number;
	input: { drift: boolean; driftPressed: boolean; steer: -1 | 0 | 1 };
	cfg: DriftConfig;
};

export function stepDriftState(a: StepArgs): DriftState {
	switch (a.state) {
		case "GRIP":
			if (a.input.driftPressed && a.input.steer !== 0 && a.speed >= a.cfg.minDriftSpeed) {
				return "DRIFTING";
			}
			return "GRIP";
		case "DRIFTING":
			if (Math.abs(a.yawRate) > a.cfg.maxYawRate) return "SPINNING";
			if (!a.input.drift && a.slip < a.cfg.exitSlipThreshold) return "GRIP";
			return "DRIFTING";
		case "SPINNING":
			if (Math.abs(a.yawRate) < a.cfg.spinExitYawRate) return "GRIP";
			return "SPINNING";
	}
}
```

**Step 3: Run + commit**

```
pnpm --filter @nova-games/case-8bit-drifters test
pnpm run test
git add nova-games/case-8bit-drifters/src/race/drift.ts \
        nova-games/case-8bit-drifters/src/race/drift.test.ts
git commit -m "case-8bit-drifters: drift state machine (TDD)"
```

---

### Task 7.2: Wire drift into Car

**Files:**
- Modify: `nova-games/case-8bit-drifters/src/race/car.ts`

**Step 1: Update Car to use drift state and split lateral/longitudinal grip**

Replace `update` with:
```ts
import { type DriftState, DEFAULT_DRIFT_CONFIG, stepDriftState } from "./drift";

// ... inside class Car
state: DriftState = "GRIP";
private prevFacing = 0;

update(dt: number, input: InputState): void {
	const fx = Math.cos(this.facing);
	const fy = Math.sin(this.facing);
	const forwardSpeed = this.vx * fx + this.vy * fy;
	const lateralSpeed = -this.vx * fy + this.vy * fx; // signed

	const slip = Math.atan2(Math.abs(lateralSpeed), Math.max(0.001, Math.abs(forwardSpeed)));
	const yawRate = (this.facing - this.prevFacing) / Math.max(dt, 0.001);
	this.prevFacing = this.facing;

	this.state = stepDriftState({
		state: this.state, slip, yawRate, speed: this.speed,
		input, cfg: DEFAULT_DRIFT_CONFIG,
	});

	const cfg = DEFAULT_DRIFT_CONFIG;

	this._braking = false;
	if (input.throttle === 1) {
		this.vx += fx * CAR_PHYSICS.accel * dt;
		this.vy += fy * CAR_PHYSICS.accel * dt;
	} else if (input.throttle === -1) {
		if (forwardSpeed > 1) {
			this.vx -= fx * CAR_PHYSICS.brakeFromForward * dt;
			this.vy -= fy * CAR_PHYSICS.brakeFromForward * dt;
			this._braking = true;
		} else {
			this.vx -= fx * CAR_PHYSICS.reverseAccel * dt;
			this.vy -= fy * CAR_PHYSICS.reverseAccel * dt;
		}
	}

	// Linear drag
	this.vx *= 1 - CAR_PHYSICS.dragLinear * dt;
	this.vy *= 1 - CAR_PHYSICS.dragLinear * dt;

	if (this.speed > CAR_PHYSICS.maxSpeed) {
		this.vx *= CAR_PHYSICS.maxSpeed / this.speed;
		this.vy *= CAR_PHYSICS.maxSpeed / this.speed;
	}

	// Steering authority depends on state
	const steerAuthority =
		this.state === "DRIFTING" ? cfg.steerAuthorityDrift : cfg.steerAuthorityGrip;
	if (input.steer !== 0) {
		const speedFactor = Math.min(1, this.speed / CAR_PHYSICS.steerSpeedRef);
		const sign = forwardSpeed >= 0 ? 1 : -1;
		this.facing += input.steer * CAR_PHYSICS.steerRate * speedFactor * sign * steerAuthority * dt;
	}
	if (this.state === "SPINNING") {
		// Yaw keeps coasting from inertia; no steering authority
		this.facing += yawRate * dt * 0.6;
	}

	// Lateral grip: how fast lateral velocity bleeds back into the facing direction
	const lateralGrip =
		this.state === "DRIFTING" || this.state === "SPINNING"
			? cfg.lateralGripDrift : cfg.lateralGripGrip;
	const newLateral = lateralSpeed * (1 - Math.min(1, lateralGrip * dt));
	const newForward =
		this.state === "DRIFTING"
			? forwardSpeed * Math.pow(cfg.longitudinalGripDrift, dt)
			: forwardSpeed;
	this.vx = fx * newForward + (-fy) * newLateral;
	this.vy = fy * newForward + ( fx) * newLateral;

	this.x += this.vx * dt;
	this.y += this.vy * dt;
}
```

**Step 2: Drive + tune**

```
pnpm --filter @nova-games/case-8bit-drifters dev
```
Drive at speed > 6, hold turn, tap Shift. Expected: car begins to slide; release Shift and counter-steer to recover. Hold steer hard into the drift → eventually SPINNING (car keeps rotating). Recover when yaw slows.

**Tuning is expected here.** If the feel is off, edit `DEFAULT_DRIFT_CONFIG`. Don't rewrite the model.

**Step 3: Root checks + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/race/car.ts
git commit -m "case-8bit-drifters: wire drift state machine into car physics"
```

---

### Task 7.3: Smoke from rear wheels during drift/spin

**Files:**
- Modify: `nova-games/case-8bit-drifters/src/scenes/race.ts`

**Step 1: Add particles into race scene**

In `race.ts`:
```ts
import { createParticles } from "../race/particles";

// ... after world creation:
const smoke = createParticles(192);
world.entityLayer.addChildAt(smoke.view, 0); // below car
```

In `update`, after `car.update`:
```ts
const drifting = car.state === "DRIFTING" || car.state === "SPINNING";
if (drifting) {
	// Two rear wheels, ~14px behind car center
	const fx = Math.cos(car.facing), fy = Math.sin(car.facing);
	const rx = -fx * 14, ry = -fy * 14;
	for (const off of [-9, 9]) {
		const wx = car.x + rx + (-fy) * off;
		const wy = car.y + ry + ( fx) * off;
		smoke.spawn({
			x: wx, y: wy,
			vx: -fx * 6 + (Math.random() - 0.5) * 8,
			vy: -fy * 6 + (Math.random() - 0.5) * 8,
			ttl: 0.7 + Math.random() * 0.4,
		});
	}
}
smoke.update(dt);
```

**Step 2: Verify**

Drive, drift on a corner — smoke trails the car. Spin out — same smoke continues.

**Step 3: Root checks + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/scenes/race.ts
git commit -m "case-8bit-drifters: smoke particles during drift/spin"
```

---

### Task 7.4: Skid marks (RenderTexture stamps)

**Files:**
- Create: `nova-games/case-8bit-drifters/src/race/skid.ts`
- Modify: `nova-games/case-8bit-drifters/src/scenes/race.ts`

**Step 1: Skid stamp layer**

```ts
import { Application, Graphics, Sprite, RenderTexture } from "pixi.js";

export type Skid = {
	sprite: Sprite;
	stamp(x: number, y: number, facing: number): void;
	dispose(): void;
};

export function createSkid(app: Application, worldW: number, worldH: number, originX: number, originY: number): Skid {
	const tex = RenderTexture.create({ width: worldW, height: worldH });
	const sprite = new Sprite(tex);
	sprite.position.set(originX, originY);

	const stampG = new Graphics();
	const reusableSprite = new Sprite(tex);

	return {
		sprite,
		stamp(x, y, facing) {
			stampG.clear();
			const fx = Math.cos(facing), fy = Math.sin(facing);
			for (const off of [-9, 9]) {
				const wx = x - fx * 14 + (-fy) * off - originX;
				const wy = y - fy * 14 + ( fx) * off - originY;
				stampG.rect(wx - 1.5, wy - 1.5, 3, 3).fill({ color: 0x111111, alpha: 0.5 });
			}
			app.renderer.render({ container: stampG, target: tex, clear: false });
		},
		dispose() {
			tex.destroy(true);
			reusableSprite.destroy();
		},
	};
}
```

**Step 2: Wire into race scene**

```ts
import { createSkid } from "../race/skid";
// ...
// After world build, before car render:
const SKID_W = 2200, SKID_H = 1400;
const skid = createSkid(ctx.app, SKID_W, SKID_H, -SKID_W / 2 + 100, -SKID_H / 2);
world.groundLayer.addChild(skid.sprite);
```

In `update` while drifting:
```ts
if (drifting) skid.stamp(car.x, car.y, car.facing);
```

In `dispose`:
```ts
skid.dispose();
```

**Step 3: Verify**

Drift on a corner — dark tire stamps stay on the asphalt. Race Again resets (because we re-instantiate the scene → new RenderTexture).

**Step 4: Root checks + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/race/skid.ts \
        nova-games/case-8bit-drifters/src/scenes/race.ts
git commit -m "case-8bit-drifters: skid mark stamps during drift"
```

---

## Milestone 8 — Race lifecycle

Start lights → 5 laps with halfway gate → HUD → best-time persistence → end-of-race overlay → Race Again / Back to Menu.

### Task 8.1: Start-light state machine (TDD)

**Files:**
- Create: `nova-games/case-8bit-drifters/src/race/lights.ts`
- Create: `nova-games/case-8bit-drifters/src/race/lights.test.ts`

**Step 1: Failing test**

```ts
import { expect, test } from "vitest";
import { advanceLights, type LightsState } from "./lights";

test("starts at COUNTDOWN_3", () => {
	const s: LightsState = { phase: "COUNTDOWN_3", t: 0 };
	expect(s.phase).toBe("COUNTDOWN_3");
});

test("advances through 3 → 2 → 1 → GO at 1s each", () => {
	let s: LightsState = { phase: "COUNTDOWN_3", t: 0 };
	s = advanceLights(s, 1.01); expect(s.phase).toBe("COUNTDOWN_2");
	s = advanceLights(s, 1.01); expect(s.phase).toBe("COUNTDOWN_1");
	s = advanceLights(s, 1.01); expect(s.phase).toBe("GO");
});

test("GO → HIDDEN after 1.5s", () => {
	let s: LightsState = { phase: "GO", t: 0 };
	s = advanceLights(s, 1.51);
	expect(s.phase).toBe("HIDDEN");
});

test("HIDDEN stays HIDDEN", () => {
	const s = advanceLights({ phase: "HIDDEN", t: 0 }, 5);
	expect(s.phase).toBe("HIDDEN");
});
```

**Step 2: Implement**

```ts
export type LightsPhase = "COUNTDOWN_3" | "COUNTDOWN_2" | "COUNTDOWN_1" | "GO" | "HIDDEN";

export type LightsState = { phase: LightsPhase; t: number };

const COUNTDOWN_DURATION = 1.0;
const GO_DURATION = 1.5;

export function advanceLights(s: LightsState, dt: number): LightsState {
	const t = s.t + dt;
	switch (s.phase) {
		case "COUNTDOWN_3":
			return t >= COUNTDOWN_DURATION
				? { phase: "COUNTDOWN_2", t: t - COUNTDOWN_DURATION }
				: { phase: s.phase, t };
		case "COUNTDOWN_2":
			return t >= COUNTDOWN_DURATION
				? { phase: "COUNTDOWN_1", t: t - COUNTDOWN_DURATION }
				: { phase: s.phase, t };
		case "COUNTDOWN_1":
			return t >= COUNTDOWN_DURATION
				? { phase: "GO", t: t - COUNTDOWN_DURATION }
				: { phase: s.phase, t };
		case "GO":
			return t >= GO_DURATION
				? { phase: "HIDDEN", t: 0 }
				: { phase: s.phase, t };
		case "HIDDEN":
			return s;
	}
}

export function inputsEnabled(s: LightsState): boolean {
	return s.phase === "GO" || s.phase === "HIDDEN";
}
```

**Step 3: Run + commit**

```
pnpm --filter @nova-games/case-8bit-drifters test
pnpm run test
git add nova-games/case-8bit-drifters/src/race/lights.ts \
        nova-games/case-8bit-drifters/src/race/lights.test.ts
git commit -m "case-8bit-drifters: start-light state machine (TDD)"
```

---

### Task 8.2: Lap-line crossing with halfway gate (TDD)

**Files:**
- Create: `nova-games/case-8bit-drifters/src/race/lap.ts`
- Create: `nova-games/case-8bit-drifters/src/race/lap.test.ts`

**Step 1: Failing test**

```ts
import { expect, test } from "vitest";
import { LapTracker } from "./lap";

test("requires halfway flag before counting a lap", () => {
	const lt = new LapTracker({ ax: 0, ay: 0, tx: 1, ty: 0 });
	// Wiggle across the start line without going around
	let crossed = false;
	for (let i = 0; i < 10; i++) {
		const r1 = lt.update({ x: -1 + i * 0.2, y: 0 }, /*distFromStart*/ 5);
		if (r1) crossed = true;
	}
	expect(crossed).toBe(false);
});

test("counts a lap after halfway then forward crossing", () => {
	const lt = new LapTracker({ ax: 0, ay: 0, tx: 1, ty: 0 });
	lt.update({ x: -2, y: 0 }, 0);
	lt.update({ x: -1, y: 0 }, 100); // halfway reached
	const r = lt.update({ x: 1, y: 0 }, 0); // crossed forward
	expect(r).toBe(true);
});

test("does not count reverse crossing", () => {
	const lt = new LapTracker({ ax: 0, ay: 0, tx: 1, ty: 0 });
	lt.update({ x: 2, y: 0 }, 0);
	lt.update({ x: 1, y: 0 }, 100); // halfway-equivalent
	const r = lt.update({ x: -1, y: 0 }, 100); // reverse direction
	expect(r).toBe(false);
});
```

**Step 2: Implement**

```ts
const HALFWAY_DIST = 60;

export type LapLine = {
	ax: number; ay: number;     // a point on the line (start position)
	tx: number; ty: number;     // forward tangent unit vector
};

export class LapTracker {
	private line: LapLine;
	private prevDot: number | null = null;
	private halfwayReached = false;

	constructor(line: LapLine) { this.line = line; }

	/** Returns true when a lap was just completed. */
	update(pos: { x: number; y: number }, distFromStart: number): boolean {
		// Signed distance along the forward tangent from the line's anchor
		const dot = (pos.x - this.line.ax) * this.line.tx + (pos.y - this.line.ay) * this.line.ty;
		if (distFromStart > HALFWAY_DIST) this.halfwayReached = true;

		let crossed = false;
		if (this.prevDot !== null && this.prevDot < 0 && dot >= 0 && this.halfwayReached) {
			crossed = true;
			this.halfwayReached = false;
		}
		this.prevDot = dot;
		return crossed;
	}

	reset(): void {
		this.prevDot = null;
		this.halfwayReached = false;
	}
}
```

**Step 3: Run + commit**

```
pnpm --filter @nova-games/case-8bit-drifters test
pnpm run test
git add nova-games/case-8bit-drifters/src/race/lap.ts \
        nova-games/case-8bit-drifters/src/race/lap.test.ts
git commit -m "case-8bit-drifters: lap tracker with halfway gate (TDD)"
```

---

### Task 8.3: HUD (lap counter, current/best time)

**Files:**
- Create: `nova-games/case-8bit-drifters/src/race/hud.ts`

**Step 1: Implement**

```ts
import { Container } from "pixi.js";
import { pixelText } from "../ui/pixel-text";

export type HudApi = {
	view: Container;
	setLap(n: number, total: number): void;
	setCurrent(ms: number): void;
	setBest(ms: number | null): void;
	place(width: number): void;
};

export function formatTime(ms: number): string {
	const m = Math.floor(ms / 60000);
	const s = Math.floor((ms % 60000) / 1000);
	const mm = ms % 1000;
	return `${m}:${s.toString().padStart(2, "0")}.${mm.toString().padStart(3, "0").slice(0, 2)}`;
}

export function createHud(): HudApi {
	const view = new Container();
	const lap = pixelText("LAP 1 / 5", { fontSize: 16 });
	const cur = pixelText("0:00.00", { fontSize: 16 });
	const best = pixelText("BEST —", { fontSize: 12, fill: 0x8a92a3 });
	lap.anchor.set(0, 0);
	cur.anchor.set(0, 0);
	best.anchor.set(0, 0);
	lap.position.set(0, 0);
	cur.position.set(0, 24);
	best.position.set(0, 48);
	view.addChild(lap, cur, best);
	return {
		view,
		setLap(n, total) { lap.text = `LAP ${n} / ${total}`; },
		setCurrent(ms) { cur.text = formatTime(ms); },
		setBest(ms) { best.text = ms === null ? "BEST —" : `BEST ${formatTime(ms)}`; },
		place(width) { view.position.set(width - 200, 16); },
	};
}
```

**Step 2: Type-check + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/race/hud.ts
git commit -m "case-8bit-drifters: race HUD"
```

---

### Task 8.4: Wire start lights, lap tracking, HUD, persistence into race scene

> **Caveat: this task is bigger than the 2-5-min rubric.** The full file is ~200 lines. Execute it in three commits if convenient: (a) add lights graphics + input gate, (b) add lap tracker + HUD wiring + persistence, (c) add end-of-race overlay. The combined final state is below — split if it helps.

**Files:**
- Modify: `nova-games/case-8bit-drifters/src/scenes/race.ts`

**Step 1: Add lights graphics, lap logic, end overlay to race scene**

This is a substantial replace. Final `race.ts`:
```ts
import { Container, Graphics } from "pixi.js";
import { DEFAULT_LOOK, renderCar } from "../art/car";
import { renderHeadlights } from "../art/headlights";
import type { Scene, SceneFactory } from "../context";
import { Car } from "../race/car";
import { createHud, formatTime } from "../race/hud";
import { createKeyboardInput } from "../race/input";
import { LapTracker } from "../race/lap";
import { advanceLights, inputsEnabled, type LightsState } from "../race/lights";
import { createParticles } from "../race/particles";
import { createSkid } from "../race/skid";
import { TOKYO } from "../race/track-data";
import { buildWorld } from "../race/world";
import { persist } from "../storage";
import { pixelButton } from "../ui/button";
import { panel } from "../ui/panel";
import { pixelText } from "../ui/pixel-text";
import { createHomeScene } from "./home";

const MAP_ID = "tokyo";
const DEFAULT_TOTAL_LAPS = 5;

export const createRaceScene: SceneFactory = (ctx) => {
	const params = new URLSearchParams(window.location.search);
	const TOTAL_LAPS =
		import.meta.env.DEV && params.has("laps")
			? Math.max(1, parseInt(params.get("laps") ?? "5", 10))
			: DEFAULT_TOTAL_LAPS;

	const root = new Container();
	const world = buildWorld(TOKYO);
	world.root.eventMode = "none";
	root.addChild(world.root);

	// Skid first (ground layer), then particles (entity below car), then car
	const SKID_W = 2400, SKID_H = 1600;
	const skid = createSkid(ctx.app, SKID_W, SKID_H, -SKID_W / 2 + 100, -SKID_H / 2);
	world.groundLayer.addChild(skid.sprite);

	const smoke = createParticles(192);
	world.entityLayer.addChildAt(smoke.view, 0);

	const headlights = new Graphics();
	world.entityLayer.addChild(headlights);

	const carG = new Graphics();
	world.entityLayer.addChild(carG);
	world.entityLayer.sortableChildren = true;

	const car = new Car();
	car.x = world.track.startPos.x;
	car.y = world.track.startPos.y;
	car.facing = Math.atan2(world.track.startTangent.y, world.track.startTangent.x);

	const input = createKeyboardInput();

	// Start lights graphics (3 circles near start line, in screen space)
	const lightsView = new Container();
	const lightG: Graphics[] = [];
	for (let i = 0; i < 3; i++) {
		const g = new Graphics();
		g.circle(i * 48 - 48, 0, 18).fill(0x331111);
		lightsView.addChild(g);
		lightG.push(g);
	}
	const goText = pixelText("GO!", { fontSize: 56, fill: 0x00ff88 });
	goText.visible = false;
	lightsView.addChild(goText);
	root.addChild(lightsView);

	let lights: LightsState = { phase: "COUNTDOWN_3", t: 0 };

	// Lap tracking
	const lap = new LapTracker({
		ax: world.track.startPos.x,
		ay: world.track.startPos.y,
		tx: world.track.startTangent.x,
		ty: world.track.startTangent.y,
	});
	let lapNum = 1;
	let lapStartMs = 0;
	let nowMs = 0;
	const lapTimes: number[] = [];

	const hud = createHud();
	root.addChild(hud.view);
	hud.setBest(ctx.bests[MAP_ID] ?? null);

	// End overlay (built lazily when race finishes)
	let endPanel: Container | null = null;
	let finished = false;

	const place = (): void => {
		hud.place(ctx.app.screen.width);
		lightsView.position.set(ctx.app.screen.width / 2, 80);
		goText.position.set(0, 0);
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	function showEnd(): void {
		const p = panel(420, 320);
		p.position.set(ctx.app.screen.width / 2, ctx.app.screen.height / 2);
		const title = pixelText("RACE COMPLETE", { fontSize: 18 });
		title.position.set(0, -120);
		p.addChild(title);

		const best = Math.min(...lapTimes);
		for (let i = 0; i < lapTimes.length; i++) {
			const tx = pixelText(
				`L${i + 1}  ${formatTime(lapTimes[i])}`,
				{ fontSize: 14, fill: lapTimes[i] === best ? 0x00ff88 : 0xffffff },
			);
			tx.position.set(0, -80 + i * 22);
			p.addChild(tx);
		}

		const again = pixelButton("RACE AGAIN", () => ctx.switchTo(createRaceScene), 14);
		again.view.position.set(-90, 110);
		const home = pixelButton("BACK TO MENU", () => ctx.switchTo(createHomeScene), 14);
		home.view.position.set(90, 110);
		p.addChild(again.view, home.view);
		root.addChild(p);
		endPanel = p;
	}

	const scene: Scene = {
		root,
		update(dt) {
			const dtMs = dt * 1000;
			lights = advanceLights(lights, dt);
			// Render lights: red, red, red, then green
			for (let i = 0; i < 3; i++) {
				const lit =
					(lights.phase === "COUNTDOWN_3" && i < 1) ||
					(lights.phase === "COUNTDOWN_2" && i < 2) ||
					(lights.phase === "COUNTDOWN_1" && i < 3);
				const green = lights.phase === "GO";
				lightG[i].clear();
				const color = green ? 0x00ff66 : (lit ? 0xff2222 : 0x331111);
				lightG[i].circle(i * 48 - 48, 0, 18).fill(color);
			}
			goText.visible = lights.phase === "GO";

			const state = input.read();
			const allowInput = inputsEnabled(lights) && !finished;
			car.update(dt, allowInput ? state : { throttle: 0, steer: 0, drift: false, driftPressed: false });

			renderHeadlights(headlights, car.look.headlightColor);
			headlights.position.set(car.x, car.y);
			headlights.rotation = car.facing;
			headlights.zIndex = car.y - 0.1;

			renderCar(carG, car.look, { brake: car.braking });
			carG.position.set(car.x, car.y);
			carG.rotation = car.facing;
			carG.zIndex = car.y;

			const drifting = car.state === "DRIFTING" || car.state === "SPINNING";
			if (drifting && allowInput) {
				const fx = Math.cos(car.facing), fy = Math.sin(car.facing);
				const rx = -fx * 14, ry = -fy * 14;
				for (const off of [-9, 9]) {
					const wx = car.x + rx + (-fy) * off;
					const wy = car.y + ry + ( fx) * off;
					smoke.spawn({
						x: wx, y: wy,
						vx: -fx * 6 + (Math.random() - 0.5) * 8,
						vy: -fy * 6 + (Math.random() - 0.5) * 8,
						ttl: 0.7 + Math.random() * 0.4,
					});
				}
				skid.stamp(car.x, car.y, car.facing);
			}
			smoke.update(dt);

			world.camera.target.x = car.x;
			world.camera.target.y = car.y;
			world.updateCamera(ctx.app.screen.width, ctx.app.screen.height);
			world.updateOcclusion({ x: car.x, y: car.y });

			// Lap timing
			if (lights.phase === "GO" && lapStartMs === 0) {
				lapStartMs = nowMs; // first GO frame starts the timer
			}
			nowMs += dtMs;
			if (lapStartMs > 0 && !finished) {
				const cur = nowMs - lapStartMs;
				hud.setLap(lapNum, TOTAL_LAPS);
				hud.setCurrent(cur);
				const distFromStart = Math.hypot(
					car.x - world.track.startPos.x,
					car.y - world.track.startPos.y,
				);
				if (lap.update({ x: car.x, y: car.y }, distFromStart)) {
					const lapMs = nowMs - lapStartMs;
					lapTimes.push(lapMs);
					lapStartMs = nowMs;
					const best = ctx.bests[MAP_ID];
					if (best === undefined || lapMs < best) {
						ctx.bests[MAP_ID] = lapMs;
						persist(ctx);
						hud.setBest(lapMs);
					}
					if (lapNum >= TOTAL_LAPS) {
						finished = true;
						showEnd();
					} else {
						lapNum++;
					}
				}
			} else {
				hud.setLap(lapNum, TOTAL_LAPS);
				hud.setCurrent(0);
			}
		},
		dispose() {
			input.dispose();
			window.removeEventListener("resize", onResize);
			skid.dispose();
			endPanel = null;
			root.destroy({ children: true });
		},
	};
	return scene;
};
```

**Step 2: Verify end-to-end with `?laps=1`**

```
pnpm --filter @nova-games/case-8bit-drifters dev
```
Open http://localhost:5173/?laps=1. Expected:
- Boot → loading → name picker → home → Race
- 3-2-1-GO start lights, inputs locked until GO
- Drive a clean lap, cross start/finish, end overlay shows
- Best time saved to localStorage
- Back to Menu → home; Race Again → fresh race; reload page → best time persists

Then run a full 5-lap (drop the `?laps=` param) once to confirm end-to-end timing.

**Step 3: Root checks + commit**

```
pnpm run test
git add nova-games/case-8bit-drifters/src/scenes/race.ts
git commit -m "case-8bit-drifters: full race lifecycle (lights, laps, HUD, end, persist)"
```

---

### Task 8.5: Final manual-test pass + landing-card already exists

**Step 1: Walk through the design's manual-test checklist**

Run through every item in the "Testing strategy" section of the design doc (`docs/plans/2026-04-30-case-8bit-drifters-design.md`). For any failure, file a follow-up issue or fix in place.

**Step 2: Sanity-check landing card**

The card was already added to `nova-games/index.html` in an earlier commit (the entry uses Pixi.js engine label). Open http://localhost:4100 (root dev server) → Nova Games → confirm the card links to `/case-8bit-drifters/` and the game boots.

**Step 3: Final root build**

```
pnpm run build
```
Expected: succeeds, including `pnpm run build:games` which builds case-8bit-drifters.

**Step 4: Final commit (if any tweaks)**

If you made small tuning changes during this pass:
```
git add -p ...
git commit -m "case-8bit-drifters: vertical-slice tuning pass"
```

---

## Adversarial review notes

This plan was reviewed by an adversarial pass before execution. Real bugs caught and fixed:

- **Circular import** — `main.ts` was going to re-export `persist`, which would've created a `name-picker → main → loading → name-picker` cycle. `persist` now lives in `storage.ts`.
- **Spinning tire art** — original loops drew the same rect 5×/24× at the same coords because Pixi `Graphics` has one `rotation`, not per-path. Rewritten using polar coordinates for tread ticks and per-spoke `Graphics` containers for spokes.
- **`pixelButton` hitArea** — was set once from initial bounds and would drift on hover-scale or label change. Removed the explicit `hitArea`; default child-based hit test follows live bounds.
- **`baseTabsX` strict-mode use-before-declare** — moved declaration above the `createTabs` call.
- **`updateOcclusion` screen-space → world-space** — original was projecting world coords through the camera transform, then comparing to screen coords. Simpler and correct: compare car's world position against world-space occlusion rect.
- **Building zIndex used roof south edge** — switched to *visual bottom* (footprint south + facade height) so cars don't punch through tall facades.
- **Track stroke ordering** — original drew asphalt → yellow → asphalt; the third pass covered the yellow entirely. Reordered: yellow (wider) → asphalt (narrower on top) → dashed center.
- **`BLEND_MODES` import** — Pixi v8 doesn't export it; the conditional cast was a no-op. Replaced with `g.blendMode = "add"`.
- **`void endPanel`** — replaced with a real `endPanel = null` cleanup statement so Biome doesn't flag the no-op.
- **Duplicate `formatTime`** — race.ts now imports from `hud.ts`.
- **`name-picker` import path** — was importing `persist` from `../main` (which doesn't export it anymore); fixed to `../storage`.
- **`errText` not cleared on re-edit** — added clear at the top of `beginEdit`.
- **Title bar** — `index.html` `<title>` updated from `case-8bit-drifters` to `8-Bit Drifters`.
- **Font-of-text reflow on first paint** — `main.ts` now awaits `document.fonts.ready` (with 1.5s fallback) before instantiating the first scene.
- **Task 8.4 too big** — flagged with a caveat at the top of the task pointing at a 3-way split for execution.

Items left as-is:

- **Lap line is a full plane, not a segment** — same behavior as the sister game (`case-retro-drifters`). For Tokyo's closed loop with a halfway gate, the plane-vs-segment difference is unreachable in practice.
- **Settings modal only reachable from home** — the design didn't strictly require gear-in-race; clipping it to home-only is an acceptable slice scope decision.
- **Random window placement in `buildBuilding`** — windows are stable within a race (built once on scene init); Race Again rebuilds → fresh windows. Acceptable.
- **`Math.random()` in tire/smoke/buildings** — no seeding; not a bug, just noted.

---

## Done

The vertical slice is shipped when:
- All 8 milestones above have been committed
- `pnpm run test` (root) passes
- `pnpm --filter @nova-games/case-8bit-drifters test` passes
- `pnpm run build` succeeds
- The manual-test checklist from the design doc passes end-to-end
- The landing card on `nova-games/index.html` opens the game

The deferred features list at the end of the design doc is the menu of next-up work.
