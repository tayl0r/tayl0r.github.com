# Centipede Run! Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a playable Pixi.js prototype of "Centipede Run!" — a side-scrolling infinite runner with menu, 4-segment centipede, ground + flying hazards, segment-loss mechanic, and persistent high score.

**Architecture:** Single-file `src/main.ts` Pixi v8 app with a tiny state machine (`menu` / `playing` / `gameover`). Pure `Graphics` rendering, chunk-based procedural spawning, `localStorage` for high score.

**Tech Stack:** Pixi.js v8, TypeScript, Vite, pnpm workspace under `nova-games/`.

**Design doc:** `docs/plans/2026-04-16-centipede-run-design.md`

---

## Working directory

All tasks run in `nova-games/grant-centipede-run/`. To test:

```bash
cd nova-games/grant-centipede-run
pnpm dev    # http://localhost:5173
```

Root-level lint/type-check (run from repo root):

```bash
pnpm test   # tsc --noEmit && biome check .
```

Every commit message should be scoped so it's clear it's this kid's project, e.g. `feat(grant-centipede-run): ...`.

---

## Task 1: Reset template + game constants

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts` (full rewrite of the template placeholder)
- Modify: `nova-games/grant-centipede-run/index.html` (already set by scaffold, but verify title)

**Step 1: Rewrite `src/main.ts` to a minimal app + constants block**

Replace the entire file contents with:

```ts
import { Application, Container } from "pixi.js";

const app = new Application();
await app.init({
	background: "#6ec6ff",
	resizeTo: window,
	antialias: true,
});
document.body.appendChild(app.canvas);

// --- Constants ----------------------------------------------------------

const GROUND_Y_FROM_BOTTOM = 120;
const CENTIPEDE_SEG_COUNT = 4;
const CENTIPEDE_SEG_SPACING = 34;
const CENTIPEDE_RADIUS = 22;
const BASE_SPEED = 180; // px/s
const SPEED_ACCEL = 6; // px/s per second
const MAX_SPEED = 520; // px/s
const GRAVITY = 1800; // px/s^2
const JUMP_IMPULSE = 720; // px/s upward
const CHUNK_WIDTH = 400;
const INVINCIBILITY_SECONDS = 1;
const HIGH_SCORE_KEY = "centipede-run:highscore";

// --- World layers -------------------------------------------------------

const world = new Container(); // scrolls with camera
const ui = new Container(); // fixed on screen
app.stage.addChild(world);
app.stage.addChild(ui);

function groundY(): number {
	return app.screen.height - GROUND_Y_FROM_BOTTOM;
}

// Placeholder so we can verify the page boots
const { Graphics } = await import("pixi.js");
const ground = new Graphics()
	.rect(-10000, 0, 20000, GROUND_Y_FROM_BOTTOM)
	.fill(0x3a7d2c);
ground.position.set(0, groundY());
world.addChild(ground);

window.addEventListener("resize", () => {
	ground.position.set(0, groundY());
});
```

**Step 2: Verify it boots**

Run (from the game folder):

```bash
cd nova-games/grant-centipede-run && pnpm dev
```

Open http://localhost:5173 — expected: sky-blue background with a green ground strip along the bottom. Stop the dev server with Ctrl-C.

**Step 3: Lint + typecheck**

From repo root:

```bash
pnpm test
```

Expected: passes.

**Step 4: Commit**

```bash
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "feat(grant-centipede-run): scaffold stage with sky + ground"
```

---

## Task 2: State machine scaffolding

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`

**Step 1: Add state machine + empty scene containers**

After the `world` / `ui` layer setup, add:

```ts
type State = "menu" | "playing" | "gameover";
let state: State = "menu";

const menuScene = new Container();
const gameScene = new Container();
const gameoverScene = new Container();
ui.addChild(menuScene, gameoverScene);
world.addChild(gameScene);

function setState(next: State): void {
	state = next;
	menuScene.visible = next === "menu";
	gameScene.visible = next === "playing";
	gameoverScene.visible = next === "gameover";
}

setState("menu");
```

**Step 2: Confirm no regressions**

Run `pnpm dev`, page still shows sky + ground (scenes are empty). Run `pnpm test` from repo root — passes.

**Step 3: Commit**

```bash
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "feat(grant-centipede-run): add state machine scaffolding"
```

---

## Task 3: High score storage helpers

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`

**Step 1: Add load/save helpers**

Add below the constants block:

```ts
function loadHighScore(): number {
	try {
		const raw = localStorage.getItem(HIGH_SCORE_KEY);
		const n = raw == null ? 0 : Number.parseInt(raw, 10);
		return Number.isFinite(n) && n >= 0 ? n : 0;
	} catch {
		return 0;
	}
}

function saveHighScore(score: number): void {
	try {
		localStorage.setItem(HIGH_SCORE_KEY, String(Math.max(0, Math.floor(score))));
	} catch {
		// localStorage may be unavailable (private mode); ignore.
	}
}
```

**Step 2: Smoke test in the browser console**

With `pnpm dev` running, open devtools console:

```
localStorage.setItem("centipede-run:highscore", "42")
```

Reload the page. We'll wire this into the UI in Task 4; for now just verify no errors and `pnpm test` still passes.

**Step 3: Commit**

```bash
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "feat(grant-centipede-run): add high score localStorage helpers"
```

---

## Task 4: Menu screen (title + buttons + toggleable high score)

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`

**Step 1: Add a `makeButton` helper**

Add near the top of the file (after the layer setup):

```ts
import { FederatedPointerEvent, Graphics, Text } from "pixi.js";

function makeButton(
	label: string,
	width: number,
	height: number,
	onClick: () => void,
): Container {
	const c = new Container();
	const bg = new Graphics()
		.roundRect(-width / 2, -height / 2, width, height, 12)
		.fill(0xffffff)
		.stroke({ color: 0x222222, width: 3 });
	const text = new Text({
		text: label,
		style: { fill: 0x222222, fontSize: 28, fontFamily: "sans-serif", fontWeight: "bold" },
	});
	text.anchor.set(0.5);
	c.addChild(bg, text);
	c.eventMode = "static";
	c.cursor = "pointer";
	c.on("pointertap", (_e: FederatedPointerEvent) => onClick());
	c.on("pointerover", () => bg.tint = 0xdddddd);
	c.on("pointerout", () => bg.tint = 0xffffff);
	return c;
}
```

Remove the earlier dynamic `await import("pixi.js")` for `Graphics` since it's now imported statically at the top.

**Step 2: Build the menu**

Add a menu-build function and call it:

```ts
const title = new Text({
	text: "Centipede Run!",
	style: { fill: 0xffffff, fontSize: 72, fontFamily: "sans-serif", fontWeight: "bold", stroke: { color: 0x222222, width: 6 } },
});
title.anchor.set(0.5);
menuScene.addChild(title);

const newRunBtn = makeButton("New Run", 220, 64, () => startRun());
menuScene.addChild(newRunBtn);

const highScoreBtn = makeButton("High Score", 220, 64, () => toggleHighScorePanel());
menuScene.addChild(highScoreBtn);

const highScorePanel = new Container();
const highScoreBg = new Graphics()
	.roundRect(-140, -30, 280, 60, 10)
	.fill(0xffffff)
	.stroke({ color: 0x222222, width: 3 });
const highScoreText = new Text({
	text: "High Score: 0",
	style: { fill: 0x222222, fontSize: 24, fontFamily: "sans-serif", fontWeight: "bold" },
});
highScoreText.anchor.set(0.5);
highScorePanel.addChild(highScoreBg, highScoreText);
highScorePanel.visible = false;
menuScene.addChild(highScorePanel);

function layoutMenu(): void {
	const cx = app.screen.width / 2;
	const cy = app.screen.height / 2;
	title.position.set(cx, cy - 140);
	newRunBtn.position.set(cx, cy - 20);
	highScoreBtn.position.set(cx, cy + 60);
	highScorePanel.position.set(cx, cy + 140);
}
layoutMenu();
window.addEventListener("resize", layoutMenu);

function toggleHighScorePanel(): void {
	highScoreText.text = `High Score: ${loadHighScore()}`;
	highScorePanel.visible = !highScorePanel.visible;
}

function startRun(): void {
	// Implemented in a later task.
	console.log("startRun (stub)");
}
```

**Step 3: Verify**

Run `pnpm dev`. Expected:
- Title "Centipede Run!" at top center.
- "New Run" and "High Score" buttons stacked below.
- Hovering a button tints it grey, clicking "High Score" shows `High Score: N` (whatever localStorage holds), clicking again hides it.
- Clicking "New Run" logs `startRun (stub)` to console.

`pnpm test` from repo root must pass.

**Step 4: Commit**

```bash
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "feat(grant-centipede-run): menu screen with toggleable high score"
```

---

## Task 5: Centipede + camera + forward motion

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`

**Step 1: Model the centipede**

Add below the menu code:

```ts
interface Segment {
	g: Graphics;
	x: number;
	y: number;
}

const centipede: { segments: Segment[]; vy: number; onGround: boolean } = {
	segments: [],
	vy: 0,
	onGround: true,
};

function drawSegment(isHead: boolean): Graphics {
	const g = new Graphics();
	// Shell (brown) on top half
	g.ellipse(0, 0, CENTIPEDE_RADIUS, CENTIPEDE_RADIUS * 0.7).fill(0xffd64a); // yellow body
	g.arc(0, 0, CENTIPEDE_RADIUS, Math.PI, 0).fill(0x7a4a1e); // brown shell dome
	if (isHead) {
		g.circle(CENTIPEDE_RADIUS * 0.55, -4, 4).fill(0xffffff);
		g.circle(CENTIPEDE_RADIUS * 0.55, -4, 2).fill(0x000000);
		g.circle(CENTIPEDE_RADIUS * 0.3, -10, 4).fill(0xffffff);
		g.circle(CENTIPEDE_RADIUS * 0.3, -10, 2).fill(0x000000);
	}
	return g;
}

function spawnCentipede(): void {
	for (const s of centipede.segments) s.g.destroy();
	centipede.segments = [];
	const startX = 120;
	const y = groundY() - CENTIPEDE_RADIUS;
	for (let i = 0; i < CENTIPEDE_SEG_COUNT; i++) {
		const g = drawSegment(i === 0);
		const x = startX - i * CENTIPEDE_SEG_SPACING;
		g.position.set(x, y);
		gameScene.addChild(g);
		centipede.segments.push({ g, x, y });
	}
	centipede.vy = 0;
	centipede.onGround = true;
}
```

**Step 2: Implement `startRun` and per-frame update**

Replace the stub:

```ts
let speed = BASE_SPEED;
let cameraX = 0;

function startRun(): void {
	speed = BASE_SPEED;
	cameraX = 0;
	spawnCentipede();
	setState("playing");
}

app.ticker.add((time) => {
	const dt = time.deltaMS / 1000;
	if (state !== "playing") return;

	// Move head forward
	const head = centipede.segments[0];
	head.x += speed * dt;

	// Trailing segments follow with fixed spacing behind the head.
	for (let i = 1; i < centipede.segments.length; i++) {
		const prev = centipede.segments[i - 1];
		const seg = centipede.segments[i];
		seg.x = prev.x - CENTIPEDE_SEG_SPACING;
		seg.y = prev.y;
	}

	// Render: draw back-to-front so the head is on top.
	for (let i = centipede.segments.length - 1; i >= 0; i--) {
		const s = centipede.segments[i];
		s.g.position.set(s.x, s.y);
		gameScene.setChildIndex(s.g, centipede.segments.length - 1 - i);
	}

	// Camera tracks the head at ~1/3 screen width.
	cameraX = head.x - app.screen.width / 3;
	world.position.x = -cameraX;
});
```

**Step 3: Verify**

Run `pnpm dev`. Click "New Run". Expected:
- 4-segment centipede appears at the left, yellow body + brown shell, head has eyes.
- It moves forward, camera scrolls with it, ground extends far enough that you don't run off.
- The centipede stays at its ~1/3 screen position as the world scrolls left.

`pnpm test` — passes.

**Step 4: Commit**

```bash
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "feat(grant-centipede-run): centipede, camera, forward motion"
```

---

## Task 6: Legs + step counter HUD

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`

**Step 1: Draw legs that swing with travel distance**

In `drawSegment`, add legs as two `Graphics` children that we can re-draw each frame. Simpler: add a separate legs `Graphics` per segment and redraw based on a shared phase.

Refactor `Segment`:

```ts
interface Segment {
	g: Graphics;
	legs: Graphics;
	x: number;
	y: number;
}
```

In `spawnCentipede`, after creating `g`, also make a legs graphic:

```ts
const legs = new Graphics();
gameScene.addChild(legs);
centipede.segments.push({ g, legs, x, y });
```

Add a helper:

```ts
function drawLegs(legs: Graphics, phase: number): void {
	const swing = Math.sin(phase) * 10;
	legs
		.clear()
		.moveTo(-8, 0).lineTo(-8 - swing, 18).stroke({ color: 0x222222, width: 3 })
		.moveTo(8, 0).lineTo(8 + swing, 18).stroke({ color: 0x222222, width: 3 });
}
```

**Step 2: Track distance and step counter**

Add module-level state:

```ts
let distance = 0; // px traveled this run
let stepCount = 0;
let lastStepPhase = 0;
const STEP_PHASE = Math.PI * 2; // one full leg cycle per 120px of travel
const PHASE_PER_PX = STEP_PHASE / 120;
```

In `startRun`, reset these to 0.

In the ticker, after moving the head:

```ts
const moved = speed * dt;
distance += moved;
const phase = distance * PHASE_PER_PX;
const fullCycles = Math.floor(phase / STEP_PHASE);
if (fullCycles > lastStepPhase) {
	stepCount += fullCycles - lastStepPhase;
	lastStepPhase = fullCycles;
}
// Draw legs for every segment, with a small per-segment phase offset.
for (let i = 0; i < centipede.segments.length; i++) {
	const s = centipede.segments[i];
	s.legs.position.set(s.x, s.y + CENTIPEDE_RADIUS * 0.4);
	drawLegs(s.legs, phase + i * 0.8);
}
```

Reset `lastStepPhase = 0` in `startRun`.

**Step 3: Add the step counter HUD**

Add to the UI layer (outside scenes, because it should show during `playing`):

```ts
const stepCounterText = new Text({
	text: "0",
	style: { fill: 0xffffff, fontSize: 48, fontFamily: "sans-serif", fontWeight: "bold", stroke: { color: 0x222222, width: 5 } },
});
stepCounterText.anchor.set(1, 0);
ui.addChild(stepCounterText);

function layoutHUD(): void {
	stepCounterText.position.set(app.screen.width - 24, 16);
}
layoutHUD();
window.addEventListener("resize", layoutHUD);

stepCounterText.visible = false;
```

In `startRun`, set `stepCounterText.visible = true;` and reset the text.

In the ticker (when `state === "playing"`), update `stepCounterText.text = String(stepCount);`.

**Step 4: Verify**

Click New Run — expected:
- Visible legs below each segment, swinging in a wave pattern as the centipede runs.
- Top-right number starts at 0 and ticks up steadily, locked to screen (doesn't scroll).

`pnpm test` — passes.

**Step 5: Commit**

```bash
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "feat(grant-centipede-run): animated legs + step counter HUD"
```

---

## Task 7: Jump physics

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`

**Step 1: Wire space-to-jump**

Add (once, at module scope):

```ts
window.addEventListener("keydown", (e) => {
	if (e.code === "Space" && state === "playing" && centipede.onGround) {
		centipede.vy = -JUMP_IMPULSE;
		centipede.onGround = false;
		e.preventDefault();
	}
});
```

**Step 2: Apply gravity in the ticker**

In the ticker, after moving the head forward, before trailing:

```ts
centipede.vy += GRAVITY * dt;
const newY = head.y + centipede.vy * dt;
const floorY = groundY() - CENTIPEDE_RADIUS;
if (newY >= floorY) {
	head.y = floorY;
	centipede.vy = 0;
	centipede.onGround = true;
} else {
	head.y = newY;
}
```

Trailing segments already copy `prev.y` so they lag behind the head's y — this gives a nice "wave" as the body follows up and down.

**Step 3: Verify**

Click New Run, press space — centipede jumps up, arcs back down. Running continues uninterrupted. Trail visually undulates when jumping.

`pnpm test` — passes.

**Step 4: Commit**

```bash
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "feat(grant-centipede-run): space-to-jump with gravity"
```

---

## Task 8: Chunk-based spawning (empty chunks first)

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`

**Step 1: Add chunk bookkeeping**

```ts
interface Hazard {
	kind: "spike" | "bug";
	g: Graphics;
	x: number;
	y: number;
	width: number;
	height: number;
}

interface Chunk {
	index: number;
	hazards: Hazard[];
}

const chunks = new Map<number, Chunk>();
```

**Step 2: Generate + despawn chunks each frame**

Add helpers:

```ts
function generateChunk(index: number): Chunk {
	// Empty for now; hazards added in later tasks.
	return { index, hazards: [] };
}

function destroyChunk(chunk: Chunk): void {
	for (const h of chunk.hazards) h.g.destroy();
}

function ensureChunks(): void {
	const leftEdgeWorldX = cameraX - CHUNK_WIDTH;
	const rightEdgeWorldX = cameraX + app.screen.width + CHUNK_WIDTH;
	const firstIdx = Math.floor(leftEdgeWorldX / CHUNK_WIDTH);
	const lastIdx = Math.floor(rightEdgeWorldX / CHUNK_WIDTH);
	for (let i = firstIdx; i <= lastIdx; i++) {
		if (!chunks.has(i)) chunks.set(i, generateChunk(i));
	}
	for (const [i, chunk] of chunks) {
		if (i < firstIdx - 1) {
			destroyChunk(chunk);
			chunks.delete(i);
		}
	}
}
```

In `startRun`, clear existing chunks:

```ts
for (const c of chunks.values()) destroyChunk(c);
chunks.clear();
```

In the ticker, after updating `cameraX`, call `ensureChunks()`.

**Step 3: Verify**

Nothing visually changes, but add `console.log("chunks:", chunks.size)` inside `ensureChunks` temporarily. Click New Run — chunk count should stay small (4-6) and not grow unboundedly as the centipede runs. Remove the log after verifying.

`pnpm test` — passes.

**Step 4: Commit**

```bash
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "feat(grant-centipede-run): chunk-based spawn/despawn system"
```

---

## Task 9: Ground spike obstacle + collision + segment loss

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`

**Step 1: Generate spikes in chunks**

Replace `generateChunk`:

```ts
function generateChunk(index: number): Chunk {
	const chunk: Chunk = { index, hazards: [] };
	if (index <= 2) return chunk; // first few chunks are safe
	const count = Math.random() < 0.5 ? 1 : Math.random() < 0.85 ? 2 : 0;
	let cursor = 60;
	for (let i = 0; i < count; i++) {
		const gap = 120 + Math.floor(Math.random() * 180);
		cursor += gap;
		if (cursor > CHUNK_WIDTH - 40) break;
		const worldX = index * CHUNK_WIDTH + cursor;
		chunk.hazards.push(makeSpike(worldX));
	}
	return chunk;
}

function makeSpike(worldX: number): Hazard {
	const w = 30;
	const h = 36;
	const g = new Graphics()
		.moveTo(-w / 2, 0)
		.lineTo(w / 2, 0)
		.lineTo(0, -h)
		.closePath()
		.fill(0x333333)
		.stroke({ color: 0x111111, width: 2 });
	const y = groundY();
	g.position.set(worldX, y);
	gameScene.addChild(g);
	return { kind: "spike", g, x: worldX, y: y - h / 2, width: w, height: h };
}
```

**Step 2: Collision + segment loss**

Add module state:

```ts
let invincibleUntil = 0; // seconds elapsed
let runTime = 0;
```

Reset both in `startRun`.

Add helpers:

```ts
function segmentsCollideHazard(segX: number, segY: number, h: Hazard): boolean {
	const dx = Math.abs(segX - h.x);
	const dy = Math.abs(segY - h.y);
	return dx < (h.width / 2 + CENTIPEDE_RADIUS * 0.7)
		&& dy < (h.height / 2 + CENTIPEDE_RADIUS * 0.7);
}

function loseSegment(): void {
	const tail = centipede.segments.pop();
	if (tail) {
		tail.g.destroy();
		tail.legs.destroy();
	}
	invincibleUntil = runTime + INVINCIBILITY_SECONDS;
	if (centipede.segments.length === 0) {
		endRun();
	}
}

function endRun(): void {
	// Implemented in Task 11.
	setState("menu");
	stepCounterText.visible = false;
}
```

In the ticker, at the top while `state === "playing"`:

```ts
runTime += dt;
const invincible = runTime < invincibleUntil;
// Flash during invincibility
for (const s of centipede.segments) {
	s.g.alpha = invincible ? 0.4 + 0.3 * Math.sin(runTime * 30) : 1;
}
```

After chunks are ensured, check collisions:

```ts
if (!invincible) {
	const head = centipede.segments[0];
	outer: for (const chunk of chunks.values()) {
		for (const h of chunk.hazards) {
			if (segmentsCollideHazard(head.x, head.y, h)) {
				loseSegment();
				break outer;
			}
		}
	}
}
```

Guard for `state !== "playing"` or no segments left after `loseSegment`.

**Step 3: Verify**

- Spikes appear on the ground at varying intervals.
- Running into a spike: tail segment disappears, the rest flashes for ~1 second, during which you pass through other spikes safely.
- Jumping over a spike clears it cleanly.
- After 4 hits: run ends (returns to menu — game over screen comes next task).

`pnpm test` — passes.

**Step 4: Commit**

```bash
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "feat(grant-centipede-run): ground spikes + segment-loss collision"
```

---

## Task 10: Flying enemy

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`

**Step 1: Sometimes spawn a flying bug instead of (or in addition to) a spike**

In `generateChunk`, when placing each hazard, 40% of the time make it a bug:

```ts
const isBug = Math.random() < 0.4;
if (isBug) {
	chunk.hazards.push(makeBug(worldX));
} else {
	chunk.hazards.push(makeSpike(worldX));
}
```

Add:

```ts
function makeBug(worldX: number): Hazard {
	const w = 34;
	const h = 24;
	const g = new Graphics()
		.ellipse(0, 0, w / 2, h / 2)
		.fill(0x9b30ff)
		.stroke({ color: 0x111111, width: 2 });
	// Little wings
	g.ellipse(-8, -10, 10, 5).fill(0xd8b4fe);
	g.ellipse(8, -10, 10, 5).fill(0xd8b4fe);
	// Fly at the peak of the jump arc — catches you only if you jump.
	const jumpPeakY = groundY() - CENTIPEDE_RADIUS - 140;
	g.position.set(worldX, jumpPeakY);
	gameScene.addChild(g);
	return { kind: "bug", g, x: worldX, y: jumpPeakY, width: w, height: h };
}
```

**Step 2: Verify**

- Purple flying bugs appear at about head-jump height.
- Running underneath without jumping → no hit.
- Jumping into one → tail segment lost + flash.

`pnpm test` — passes.

**Step 3: Commit**

```bash
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "feat(grant-centipede-run): flying bug enemy at jump-peak height"
```

---

## Task 11: Game over screen + high score commit

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`

**Step 1: Build the game-over scene**

Inside the `gameoverScene` build section (add near menu setup):

```ts
const gameoverTitle = new Text({
	text: "Game Over",
	style: { fill: 0xffffff, fontSize: 64, fontFamily: "sans-serif", fontWeight: "bold", stroke: { color: 0x222222, width: 6 } },
});
gameoverTitle.anchor.set(0.5);
const gameoverScore = new Text({
	text: "",
	style: { fill: 0xffffff, fontSize: 32, fontFamily: "sans-serif", stroke: { color: 0x222222, width: 4 } },
});
gameoverScore.anchor.set(0.5);
const gameoverHint = new Text({
	text: "Click to return to menu",
	style: { fill: 0xffffff, fontSize: 20, fontFamily: "sans-serif" },
});
gameoverHint.anchor.set(0.5);
gameoverScene.addChild(gameoverTitle, gameoverScore, gameoverHint);

function layoutGameover(): void {
	const cx = app.screen.width / 2;
	const cy = app.screen.height / 2;
	gameoverTitle.position.set(cx, cy - 80);
	gameoverScore.position.set(cx, cy);
	gameoverHint.position.set(cx, cy + 80);
}
layoutGameover();
window.addEventListener("resize", layoutGameover);

gameoverScene.eventMode = "static";
gameoverScene.on("pointertap", () => {
	setState("menu");
});
```

**Step 2: Replace `endRun`**

```ts
function endRun(): void {
	const best = loadHighScore();
	const isNew = stepCount > best;
	if (isNew) saveHighScore(stepCount);
	gameoverScore.text = isNew
		? `New High Score: ${stepCount}!`
		: `Steps: ${stepCount} (best: ${best})`;
	stepCounterText.visible = false;
	setState("gameover");
}
```

**Step 3: Verify**

- Lose all 4 segments → "Game Over" appears with step count.
- If you beat the high score, it says "New High Score!".
- Click → back to menu. Click High Score button → shows the updated number.

`pnpm test` — passes.

**Step 4: Commit**

```bash
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "feat(grant-centipede-run): game over screen + persistent high score"
```

---

## Task 12: Speed ramp over time

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`

**Step 1: Accelerate speed in the ticker**

Replace the first lines of the `state === "playing"` block:

```ts
runTime += dt;
speed = Math.min(MAX_SPEED, BASE_SPEED + SPEED_ACCEL * runTime);
```

**Step 2: Verify**

Start a run, let it go 30+ seconds without dying (cheese it by jumping constantly or standing in a spike-free gap). The centipede should feel noticeably faster than at the start. Runs eventually hit the cap.

`pnpm test` — passes.

**Step 3: Commit**

```bash
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "feat(grant-centipede-run): speed accelerates over run duration"
```

---

## Task 13: Final verification + landing page card

**Files:**
- Modify: `nova-games/index.html` (add a card for Grant's game)

**Step 1: Add a landing-page card**

Open `nova-games/index.html`, find the `.game-grid`, add:

```html
<a href="./grant-centipede-run/" class="game-card">
	<span class="game-title">Centipede Run!</span>
	<span class="game-author">by Grant</span>
	<span class="game-engine">Pixi.js</span>
</a>
```

**Step 2: Full build**

From repo root:

```bash
pnpm build
```

Expected: all packages build. `dist/nova-games/grant-centipede-run/index.html` exists.

**Step 3: Preview the built output**

```bash
cd nova-games/grant-centipede-run
pnpm preview
```

Open the URL — the game should play the same as in dev.

**Step 4: Commit**

```bash
git add nova-games/index.html
git commit -m "feat(grant-centipede-run): list on nova-games landing page"
```

---

## Done

At this point the prototype is playable:
- Menu with title, New Run, High Score toggle
- 4-segment centipede runs automatically, accelerates
- Jump with space
- Ground spikes + flying bugs
- Tail-loss with invincibility flash
- Game over + persistent high score
- Listed on `/nova-games/`

Future work (explicitly not in this prototype): sound, sprite art, more hazard types, variable-height jumps, touch controls, menu keyboard navigation.
