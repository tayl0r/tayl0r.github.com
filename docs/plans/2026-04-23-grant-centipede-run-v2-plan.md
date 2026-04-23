# Centipede Run v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade `nova-games/grant-centipede-run` to match the brainstormed design: smooth uneven terrain, a cuter centipede, sphere + homing-fireball enemies replacing the old spike/bug hazards, and blue/red mushroom powerups.

**Architecture:** Edit `nova-games/grant-centipede-run/src/main.ts` in place. Keep the existing Pixi.js v8 single-file structure and the chunk-based infinite level model. Introduce a pure `groundHeightAt(worldX)` function as the terrain source of truth so rendering, physics, and spawn placement all agree. Replace the `Hazard` union with a richer `Spawnable` union that covers spheres, fireballs, and both mushrooms.

**Tech Stack:** TypeScript, Pixi.js v8 (`Application`, `Container`, `Graphics`, `Text`, `FederatedPointerEvent`), Vite, pnpm workspace under the repo root.

## TDD note

This game has no automated test harness by design (see the design doc's "Testing" and "Non-goals" sections). Each task replaces the TDD cycle with:

1. Make the code edit.
2. Run `pnpm run test` at the repo root — that runs `tsc --noEmit && biome check .` and must pass.
3. Start / keep running `pnpm dev` in `nova-games/grant-centipede-run/` and visually verify the described behavior in the browser.
4. Commit.

The executing agent should launch `pnpm dev` in the background once (task 1) and leave it running for the duration of the plan. It auto-reloads on each edit.

## Pre-flight

- Branch: `grant-centipede-run` (already checked out).
- Working directory for edits: `/Users/taylor/dev/tayl0r.github.com-grant/nova-games/grant-centipede-run/`.
- Working directory for test/commit: `/Users/taylor/dev/tayl0r.github.com-grant/` (repo root).
- One file is edited by every task: `nova-games/grant-centipede-run/src/main.ts`.
- All numeric tuning constants live near the top of that file so the executor can find them by `CTRL-F`.

---

### Task 1: Start the dev server and baseline-check

**Files:** none modified.

**Step 1: Start Vite in the game folder, in the background.**

```bash
cd /Users/taylor/dev/tayl0r.github.com-grant/nova-games/grant-centipede-run
pnpm dev
```

Run this with `run_in_background: true`. Vite will serve on `http://localhost:5173` by default.

**Step 2: Open a Chrome tab on the dev URL.**

Use `mcp__claude-in-chrome__tabs_create_mcp` with URL `http://localhost:5173/`. Confirm the menu renders with "Centipede Run!" title, "New Run", "High Score". Click "New Run"; confirm the centipede appears on a flat green ground and starts running right automatically. Space makes it jump. Step counter in top-right ticks up. No console errors.

**Step 3: Baseline `pnpm run test` at repo root.**

```bash
cd /Users/taylor/dev/tayl0r.github.com-grant
pnpm run test
```

Expected: clean pass. If it fails, fix the failure before starting Task 2 — we must start from green.

**Step 4: No commit.** This is a pre-flight.

---

### Task 2: Introduce `groundHeightAt` with flat behavior (refactor, no visible change)

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts` (add a constant + helper; swap call sites).

**Step 1: Add terrain constants near the other constants block (just under `CHUNK_WIDTH`).**

```ts
const TERRAIN_AMPLITUDE = 0;      // will be bumped in Task 3
const TERRAIN_RAMP_START = 0;
const TERRAIN_RAMP_END = 2000;
```

**Step 2: Add `groundHeightAt(worldX)` just after `groundY()`.**

```ts
function groundHeightAt(worldX: number): number {
	const base = groundY();
	if (TERRAIN_AMPLITUDE <= 0) return base;
	const rampT = Math.min(
		1,
		Math.max(0, (worldX - TERRAIN_RAMP_START) / (TERRAIN_RAMP_END - TERRAIN_RAMP_START)),
	);
	const amp = TERRAIN_AMPLITUDE * rampT;
	const h =
		Math.sin(worldX * 0.004) * amp * 0.7 +
		Math.sin(worldX * 0.011 + 1.3) * amp * 0.3;
	return base - h;
}
```

Returning `base` early when amplitude is 0 guarantees this task is a no-op refactor.

**Step 3: Replace the hard-coded floor-y in the ticker with a call to `groundHeightAt`.**

In the `app.ticker.add((time) => { ... })` body, change:

```ts
const floorY = groundY() - CENTIPEDE_RADIUS;
```

to:

```ts
const floorY = groundHeightAt(head.x) - CENTIPEDE_RADIUS;
```

**Step 4: Have trailing segments sample their own x against `groundHeightAt`.**

Replace the trailing-follow loop body:

```ts
for (let i = 1; i < centipede.segments.length; i++) {
	const prev = centipede.segments[i - 1];
	const seg = centipede.segments[i];
	seg.x = prev.x - CENTIPEDE_SEG_SPACING;
	seg.y = prev.y;
}
```

with:

```ts
for (let i = 1; i < centipede.segments.length; i++) {
	const prev = centipede.segments[i - 1];
	const seg = centipede.segments[i];
	seg.x = prev.x - CENTIPEDE_SEG_SPACING;
	seg.y = groundHeightAt(seg.x) - CENTIPEDE_RADIUS;
}
```

Because `TERRAIN_AMPLITUDE === 0`, this still produces the same y as before for every x.

**Step 5: Update `spawnCentipede` to use `groundHeightAt` for each segment's initial y.**

In `spawnCentipede`, change:

```ts
const y = groundY() - CENTIPEDE_RADIUS;
```

and the loop's `const x = startX - i * CENTIPEDE_SEG_SPACING;` block, so each segment's y is sampled individually:

```ts
for (let i = 0; i < CENTIPEDE_SEG_COUNT; i++) {
	const g = drawSegment(i === 0);
	const x = startX - i * CENTIPEDE_SEG_SPACING;
	const y = groundHeightAt(x) - CENTIPEDE_RADIUS;
	g.position.set(x, y);
	gameScene.addChild(g);
	const legs = new Graphics();
	gameScene.addChild(legs);
	centipede.segments.push({ g, legs, x, y });
}
```

**Step 6: Verify.**

Run:

```bash
cd /Users/taylor/dev/tayl0r.github.com-grant && pnpm run test
```

Expected: PASS. In the browser, reload and play a run. Behavior should be identical to baseline.

**Step 7: Commit.**

```bash
cd /Users/taylor/dev/tayl0r.github.com-grant
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "$(cat <<'EOF'
refactor(grant-centipede-run): route physics through groundHeightAt

Introduces a single-source-of-truth terrain sampler (flat for now) so the
next commit can switch to uneven hills without touching physics again.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Enable uneven rolling terrain

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`.

**Step 1: Raise `TERRAIN_AMPLITUDE`.**

Change:

```ts
const TERRAIN_AMPLITUDE = 0;
```

to:

```ts
const TERRAIN_AMPLITUDE = 60;
```

**Step 2: Make the ground render as per-chunk polygons.**

Delete the existing single-rectangle ground and its resize handler:

```ts
const ground = new Graphics()
	.rect(-10000, 0, 20000, GROUND_Y_FROM_BOTTOM)
	.fill(0x3a7d2c);
ground.position.set(0, groundY());
world.addChild(ground);

window.addEventListener("resize", () => {
	ground.position.set(0, groundY());
});
```

Also delete the `ground.position.x = cameraX;` line inside the ticker.

Add a ground container and helpers in their place:

```ts
const groundLayer = new Container();
world.addChild(groundLayer);

function buildChunkGround(index: number): Graphics {
	const g = new Graphics();
	const startX = index * CHUNK_WIDTH;
	const endX = startX + CHUNK_WIDTH;
	const step = 8;
	const bottom = groundY() + GROUND_Y_FROM_BOTTOM;
	g.moveTo(startX, bottom);
	g.lineTo(startX, groundHeightAt(startX));
	for (let x = startX + step; x <= endX; x += step) {
		g.lineTo(x, groundHeightAt(x));
	}
	g.lineTo(endX, bottom);
	g.closePath();
	g.fill(0x3a7d2c);
	return g;
}
```

**Step 3: Extend `Chunk` to own its ground graphic.**

Change the `Chunk` interface:

```ts
interface Chunk {
	index: number;
	hazards: Hazard[];
	ground: Graphics;
}
```

Update `generateChunk` to build and attach the ground graphic:

```ts
function generateChunk(index: number): Chunk {
	const ground = buildChunkGround(index);
	groundLayer.addChild(ground);
	const chunk: Chunk = { index, hazards: [], ground };
	if (index <= 2) return chunk;
	// ...existing hazard loop unchanged for now...
}
```

Update `destroyChunk`:

```ts
function destroyChunk(chunk: Chunk): void {
	for (const h of chunk.hazards) h.g.destroy();
	chunk.ground.destroy();
}
```

**Step 4: Verify.**

Run `pnpm run test` at repo root — expect PASS. In the browser, reload. You should see the ground gently roll. The centipede body follows the hills; the head jumps cleanly; no fall-through. The first screen is still mostly flat because `TERRAIN_RAMP_END = 2000`.

**Step 5: Commit.**

```bash
cd /Users/taylor/dev/tayl0r.github.com-grant
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "$(cat <<'EOF'
feat(grant-centipede-run): uneven rolling terrain

Terrain is now sampled from two layered sines per x, ramped in over the
first 2000px so the player has a clean launch area. Ground renders as a
polygon per chunk, owned by the chunk lifecycle.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Centipede cuteness pass

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`.

**Step 1: Replace `drawSegment`.**

Replace the entire existing `drawSegment` with:

```ts
function drawSegment(isHead: boolean): Graphics {
	const g = new Graphics();
	// Slightly rounder body
	g.ellipse(0, 0, CENTIPEDE_RADIUS, CENTIPEDE_RADIUS * 0.8).fill(0xffd64a);
	// Brown shell dome
	g.arc(0, 0, CENTIPEDE_RADIUS, Math.PI, 0).fill(0x7a4a1e);
	if (isHead) {
		// Symmetric big eyes
		const eyeY = -2;
		const eyeX = CENTIPEDE_RADIUS * 0.45;
		// Sclera
		g.circle(eyeX, eyeY, 6).fill(0xffffff);
		g.circle(-eyeX, eyeY, 6).fill(0xffffff);
		// Pupils
		g.circle(eyeX, eyeY, 3).fill(0x000000);
		g.circle(-eyeX, eyeY, 3).fill(0x000000);
		// Highlight glints
		g.circle(eyeX + 1.2, eyeY - 1.5, 1).fill(0xffffff);
		g.circle(-eyeX + 1.2, eyeY - 1.5, 1).fill(0xffffff);
		// Rosy cheeks
		g.circle(eyeX + 2, eyeY + 5, 2.5).fill(0xff9ab0);
		g.circle(-eyeX + 2, eyeY + 5, 2.5).fill(0xff9ab0);
		// Smile
		g.arc(0, eyeY + 6, 3.5, 0.15 * Math.PI, 0.85 * Math.PI).stroke({
			color: 0x3a2516,
			width: 1.5,
		});
	}
	return g;
}
```

**Step 2: Add antennae drawing. Create `drawAntennae` helper and a graphic that belongs to the head segment.**

Extend the `Segment` interface:

```ts
interface Segment {
	g: Graphics;
	legs: Graphics;
	antennae: Graphics | null;
	x: number;
	y: number;
}
```

Add a helper next to `drawLegs`:

```ts
function drawAntennae(a: Graphics, phase: number): void {
	const swing = Math.sin(phase * 0.8) * 4;
	a.clear()
		.moveTo(-6, -CENTIPEDE_RADIUS + 2)
		.quadraticCurveTo(-10 + swing, -CENTIPEDE_RADIUS - 10, -8 + swing, -CENTIPEDE_RADIUS - 16)
		.stroke({ color: 0x3a2516, width: 2 })
		.circle(-8 + swing, -CENTIPEDE_RADIUS - 17, 2)
		.fill(0x3a2516)
		.moveTo(6, -CENTIPEDE_RADIUS + 2)
		.quadraticCurveTo(10 - swing, -CENTIPEDE_RADIUS - 10, 8 - swing, -CENTIPEDE_RADIUS - 16)
		.stroke({ color: 0x3a2516, width: 2 })
		.circle(8 - swing, -CENTIPEDE_RADIUS - 17, 2)
		.fill(0x3a2516);
}
```

In `spawnCentipede`, attach an antennae graphic only to the head segment:

```ts
for (let i = 0; i < CENTIPEDE_SEG_COUNT; i++) {
	const g = drawSegment(i === 0);
	const x = startX - i * CENTIPEDE_SEG_SPACING;
	const y = groundHeightAt(x) - CENTIPEDE_RADIUS;
	g.position.set(x, y);
	gameScene.addChild(g);
	const legs = new Graphics();
	gameScene.addChild(legs);
	let antennae: Graphics | null = null;
	if (i === 0) {
		antennae = new Graphics();
		gameScene.addChild(antennae);
	}
	centipede.segments.push({ g, legs, antennae, x, y });
}
```

**Step 3: Replace `drawLegs` with a boot-equipped version.**

```ts
function drawLegs(legs: Graphics, phase: number): void {
	const swing = Math.sin(phase) * 10;
	legs.clear();
	for (const side of [-1, 1]) {
		const hipX = 8 * side;
		const footX = (8 + swing * side) * side;
		const footY = 18;
		legs
			.moveTo(hipX, 0)
			.lineTo(footX, footY)
			.stroke({ color: 0x222222, width: 3 });
		// Boot: dark rounded rect pinned to the foot
		legs
			.roundRect(footX - 5 * side - 1, footY - 1, 7, 5, 2)
			.fill(0x3a2516);
	}
}
```

**Step 4: Add body ripple and redraw antennae each frame. In the ticker, after setting each segment's y from `groundHeightAt`, add a small bob.**

Before the segment render block, compute the ripple:

```ts
for (let i = 0; i < centipede.segments.length; i++) {
	const s = centipede.segments[i];
	const bob = Math.sin(phase + i * 0.9) * 2;
	s.y += bob;
}
```

Insert this loop *after* the trailing-follow loop has set each segment's y from `groundHeightAt`, and *before* the render loop that sets `s.g.position`. Note: head's y is set by physics, not `groundHeightAt`, but applying the same bob to it keeps the head in sync with the ripple during ground-running. Skip the bob for the head when airborne:

```ts
for (let i = 0; i < centipede.segments.length; i++) {
	const s = centipede.segments[i];
	if (i === 0 && !centipede.onGround) continue;
	const bob = Math.sin(phase + i * 0.9) * 2;
	s.y += bob;
}
```

Also in the ticker, after the legs loop, draw the antennae for the head:

```ts
const headSeg = centipede.segments[0];
if (headSeg?.antennae) {
	headSeg.antennae.position.set(headSeg.x, headSeg.y);
	drawAntennae(headSeg.antennae, phase);
}
```

Update `loseSegment` and the destroy in `spawnCentipede` so antennae get cleaned up too:

```ts
for (const s of centipede.segments) {
	s.g.destroy();
	s.legs.destroy();
	s.antennae?.destroy();
}
```

(Apply to both the top of `spawnCentipede` and to `loseSegment` via the `tail.antennae?.destroy()` line.)

**Step 5: Verify.**

`pnpm run test` — PASS. In the browser: the head now has big symmetric eyes with glints, rosy cheeks, a smile, wobbling antennae, and the body has a gentle ripple. Boots are visible on the legs.

**Step 6: Commit.**

```bash
cd /Users/taylor/dev/tayl0r.github.com-grant
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "$(cat <<'EOF'
feat(grant-centipede-run): cuter centipede

Big symmetric eyes with glints, rosy cheeks, a smile, wiggly antennae on
the head, boots on every leg, and a small vertical ripple along the body
so it undulates as it walks.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Rip out spike and bug hazards

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`.

**Step 1: Delete `makeBug` and `makeSpike` entirely.**

**Step 2: Change the `Hazard` interface's `kind` field and the hazard loop in `generateChunk`. Temporarily gut the hazard roll.**

Replace the `Hazard` interface:

```ts
type SpawnableKind = "sphere" | "fireball" | "blueMushroom" | "redMushroom";

interface Spawnable {
	kind: SpawnableKind;
	g: Graphics;
	x: number;
	y: number;
	vx?: number; // for fireball
	vy?: number; // for fireball
	width: number;
	height: number;
	alive: boolean;
}
```

Rename `Chunk.hazards` → `Chunk.spawns: Spawnable[]` (update `generateChunk`, `destroyChunk`, the ticker collision loop accordingly).

Replace the body of `generateChunk` (after the `if (index <= 2) return chunk;`) with a placeholder:

```ts
// Spawns are added in subsequent tasks (Tasks 6-9).
return chunk;
```

In the ticker, rewrite the collision block so it compiles against the new shape:

```ts
if (!invincible) {
	const h = centipede.segments[0];
	outer: for (const chunk of chunks.values()) {
		for (const s of chunk.spawns) {
			if (!s.alive) continue;
			if (
				Math.abs(h.x - s.x) < s.width / 2 + CENTIPEDE_RADIUS * 0.7 &&
				Math.abs(h.y - s.y) < s.height / 2 + CENTIPEDE_RADIUS * 0.7
			) {
				// handled per-kind in Tasks 6-9
				break outer;
			}
		}
	}
}
```

Update `destroyChunk`:

```ts
function destroyChunk(chunk: Chunk): void {
	for (const s of chunk.spawns) s.g.destroy();
	chunk.ground.destroy();
}
```

Also delete the now-unused `segmentsCollideHazard` helper.

**Step 3: Verify.**

`pnpm run test` — PASS. In the browser, the world is now enemy-free and powerup-free; you should just see the rolling terrain + centipede running forever.

**Step 4: Commit.**

```bash
cd /Users/taylor/dev/tayl0r.github.com-grant
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "$(cat <<'EOF'
refactor(grant-centipede-run): drop spike/bug hazards; Spawnable scaffold

Clears the ground for the new enemy + powerup types. World briefly has no
obstacles; the next commits add spheres, fireballs, and mushrooms.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Sphere enemy

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`.

**Step 1: Add a constant and a `makeSphere` builder.**

Near the other constants:

```ts
const SPHERE_RADIUS = 28;
```

Factory:

```ts
function makeSphere(worldX: number): Spawnable {
	const g = new Graphics();
	g.circle(0, 0, SPHERE_RADIUS).fill(0x8a2be2).stroke({ color: 0x3a0d5a, width: 2 });
	// Angry eyes
	g.circle(-10, -4, 4).fill(0xffffff);
	g.circle(10, -4, 4).fill(0xffffff);
	g.circle(-10, -3, 2).fill(0x000000);
	g.circle(10, -3, 2).fill(0x000000);
	// Angled eyebrows
	g.moveTo(-16, -12).lineTo(-4, -8).stroke({ color: 0x1a0030, width: 3 });
	g.moveTo(16, -12).lineTo(4, -8).stroke({ color: 0x1a0030, width: 3 });
	// Two boots at the bottom
	g.roundRect(-13, SPHERE_RADIUS - 4, 10, 6, 2).fill(0x3a2516);
	g.roundRect(3, SPHERE_RADIUS - 4, 10, 6, 2).fill(0x3a2516);
	const y = groundHeightAt(worldX) - SPHERE_RADIUS;
	g.position.set(worldX, y);
	gameScene.addChild(g);
	return {
		kind: "sphere",
		g,
		x: worldX,
		y,
		width: SPHERE_RADIUS * 2,
		height: SPHERE_RADIUS * 2,
		alive: true,
	};
}
```

**Step 2: Spawn one sphere per chunk temporarily (for playtesting this task).**

In `generateChunk`, after `if (index <= 2) return chunk;`, for now:

```ts
const worldX = index * CHUNK_WIDTH + 150 + Math.random() * 100;
chunk.spawns.push(makeSphere(worldX));
return chunk;
```

We'll replace this with proper spawn rolls in Task 9.

**Step 3: Handle sphere collision in the ticker.**

Replace the placeholder collision block with:

```ts
if (!invincible) {
	const h = centipede.segments[0];
	outer: for (const chunk of chunks.values()) {
		for (const s of chunk.spawns) {
			if (!s.alive) continue;
			const dx = Math.abs(h.x - s.x);
			const dy = Math.abs(h.y - s.y);
			if (
				dx < s.width / 2 + CENTIPEDE_RADIUS * 0.7 &&
				dy < s.height / 2 + CENTIPEDE_RADIUS * 0.7
			) {
				if (s.kind === "sphere") {
					s.alive = false;
					s.g.destroy();
					loseSegment();
					break outer;
				}
			}
		}
	}
}
```

**Step 4: Verify.**

`pnpm run test` — PASS. Play a run: every chunk past chunk 2 has one purple sphere on the ground. Jumping over it works. Touching it costs a segment and the sphere disappears. Reaching 0 segments ends the run.

**Step 5: Commit.**

```bash
cd /Users/taylor/dev/tayl0r.github.com-grant
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "$(cat <<'EOF'
feat(grant-centipede-run): add sphere enemy

Angry purple sphere with boots, sits on the ground. Contact costs one
segment; sphere disappears. Spawn frequency is placeholder for now.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Homing fireball enemy

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`.

**Step 1: Add constants.**

```ts
const FIREBALL_RADIUS = 24;
const FIREBALL_SPEED = 120;       // px/s
const FIREBALL_DESPAWN_BEHIND_PX = 150;
```

**Step 2: Add `makeFireball`.**

```ts
function makeFireball(worldX: number): Spawnable {
	const g = new Graphics();
	// Outer flame
	g.circle(0, 0, FIREBALL_RADIUS).fill(0xff5a1f).stroke({ color: 0x801800, width: 2 });
	// Inner flicker
	g.circle(-2, 2, FIREBALL_RADIUS * 0.6).fill(0xffc400);
	// Single angry eye
	g.circle(0, 0, 7).fill(0xffffff);
	g.circle(0, 1, 3).fill(0x000000);
	// Eyebrow (angled line above the eye)
	g.moveTo(-8, -8).lineTo(8, -10).stroke({ color: 0x200800, width: 3 });
	const y = groundHeightAt(worldX) - (180 + Math.random() * 80);
	g.position.set(worldX, y);
	gameScene.addChild(g);
	return {
		kind: "fireball",
		g,
		x: worldX,
		y,
		vx: 0,
		vy: 0,
		width: FIREBALL_RADIUS * 2,
		height: FIREBALL_RADIUS * 2,
		alive: true,
	};
}
```

**Step 3: Spawn fireballs. For this task, replace the Task 6 placeholder in `generateChunk` with a 50/50 sphere-or-fireball roll.**

```ts
const worldX = index * CHUNK_WIDTH + 150 + Math.random() * 100;
if (Math.random() < 0.5) {
	chunk.spawns.push(makeSphere(worldX));
} else {
	chunk.spawns.push(makeFireball(worldX));
}
```

**Step 4: Update fireball motion in the ticker.** Before the collision block, add a per-spawn update loop:

```ts
for (const chunk of chunks.values()) {
	for (const s of chunk.spawns) {
		if (!s.alive) continue;
		if (s.kind === "fireball") {
			const head = centipede.segments[0];
			const dxh = head.x - s.x;
			const dyh = head.y - s.y;
			const dist = Math.max(1, Math.hypot(dxh, dyh));
			s.x += (dxh / dist) * FIREBALL_SPEED * dt;
			s.y += (dyh / dist) * FIREBALL_SPEED * dt;
			s.g.position.set(s.x, s.y);
			if (s.x < head.x - FIREBALL_DESPAWN_BEHIND_PX) {
				s.alive = false;
				s.g.destroy();
			}
		}
	}
}
```

**Step 5: Extend the collision block to handle fireballs.**

Inside the collision `if`, add:

```ts
if (s.kind === "fireball") {
	s.alive = false;
	s.g.destroy();
	loseSegment();
	break outer;
}
```

**Step 6: Verify.**

`pnpm run test` — PASS. Play: fireballs spawn in the air ahead, curve toward the centipede. Jumping at the right moment makes them pass over or under. Contact costs a segment.

**Step 7: Commit.**

```bash
cd /Users/taylor/dev/tayl0r.github.com-grant
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "$(cat <<'EOF'
feat(grant-centipede-run): add homing fireball enemy

Spawns in the air, drifts toward the centipede at 120 px/s, despawns after
passing the player. Contact costs one segment.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Blue mushroom powerup

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`.

**Step 1: Add a mushroom helper that both colors share.**

```ts
const MUSHROOM_HEIGHT = 34;
const MUSHROOM_WIDTH = 30;

function drawMushroom(capColor: number): Graphics {
	const g = new Graphics();
	// Cap
	g.arc(0, 0, MUSHROOM_WIDTH / 2, Math.PI, 0).fill(capColor).stroke({ color: 0x222222, width: 2 });
	// Cap spots (lighter)
	const spot = 0xffffff;
	g.circle(-6, -6, 3).fill(spot);
	g.circle(5, -3, 2).fill(spot);
	g.circle(2, -10, 2).fill(spot);
	// Stem
	g.roundRect(-7, 0, 14, MUSHROOM_HEIGHT / 2, 3).fill(0xfff3d1).stroke({ color: 0x222222, width: 2 });
	return g;
}

function makeBlueMushroom(worldX: number): Spawnable {
	const g = drawMushroom(0x3aa0ff);
	const y = groundHeightAt(worldX) - MUSHROOM_HEIGHT / 2;
	g.position.set(worldX, y);
	gameScene.addChild(g);
	return {
		kind: "blueMushroom",
		g,
		x: worldX,
		y,
		width: MUSHROOM_WIDTH,
		height: MUSHROOM_HEIGHT,
		alive: true,
	};
}
```

**Step 2: Add a `gainSegments(n)` function.**

```ts
function gainSegments(n: number): void {
	if (state !== "playing") return;
	const tail = centipede.segments[centipede.segments.length - 1];
	const baseX = tail ? tail.x : 120;
	const baseY = tail ? tail.y : groundHeightAt(baseX) - CENTIPEDE_RADIUS;
	for (let i = 0; i < n; i++) {
		const g = drawSegment(false);
		const x = baseX - (i + 1) * CENTIPEDE_SEG_SPACING;
		const y = groundHeightAt(x) - CENTIPEDE_RADIUS;
		g.position.set(x, y);
		gameScene.addChild(g);
		const legs = new Graphics();
		gameScene.addChild(legs);
		centipede.segments.push({ g, legs, antennae: null, x, y });
	}
}
```

**Step 3: Handle pickup in the collision block.**

Add an `else if` path inside the collision:

```ts
if (s.kind === "blueMushroom") {
	s.alive = false;
	s.g.destroy();
	gainSegments(Math.random() < 0.5 ? 1 : 3);
	break outer;
}
```

Note: the existing collision block is gated by `if (!invincible)` — mushroom pickups must work even when invincible from a prior hit. Move the blue mushroom check **outside** the `!invincible` gate: restructure to iterate spawns once per frame and dispatch by kind, checking invincibility only for damage-dealing kinds.

Concretely, replace the whole collision block with:

```ts
const h = centipede.segments[0];
for (const chunk of chunks.values()) {
	for (const s of chunk.spawns) {
		if (!s.alive) continue;
		const dx = Math.abs(h.x - s.x);
		const dy = Math.abs(h.y - s.y);
		const hit =
			dx < s.width / 2 + CENTIPEDE_RADIUS * 0.7 &&
			dy < s.height / 2 + CENTIPEDE_RADIUS * 0.7;
		if (!hit) continue;
		if (s.kind === "blueMushroom") {
			s.alive = false;
			s.g.destroy();
			gainSegments(Math.random() < 0.5 ? 1 : 3);
		} else if (s.kind === "sphere") {
			s.alive = false;
			s.g.destroy();
			if (!invincible) loseSegment();
		} else if (s.kind === "fireball") {
			s.alive = false;
			s.g.destroy();
			if (!invincible) loseSegment();
		}
	}
}
```

(When invincible, enemies still die on touch but the centipede doesn't lose a segment. This matches the design.)

**Step 4: Tweak spawn roll in `generateChunk`.**

Temporarily force some blue mushrooms for this task's verification:

```ts
const worldX = index * CHUNK_WIDTH + 150 + Math.random() * 100;
const r = Math.random();
if (r < 0.4) chunk.spawns.push(makeBlueMushroom(worldX));
else if (r < 0.7) chunk.spawns.push(makeSphere(worldX));
else chunk.spawns.push(makeFireball(worldX));
```

**Step 5: Verify.**

`pnpm run test` — PASS. Play: run through several chunks collecting blue mushrooms; body should grow by 1 or 3 per pickup. Lose segments to spheres/fireballs and recover them from mushrooms.

**Step 6: Commit.**

```bash
cd /Users/taylor/dev/tayl0r.github.com-grant
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "$(cat <<'EOF'
feat(grant-centipede-run): add blue mushroom powerup

On contact, adds 1 or 3 new tail segments (50/50). Pickups fire even during
post-hit invincibility. Enemies now always die on touch; segment loss is
gated on invincibility.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Red mushroom powerup and rainbow shimmer

**Files:**
- Modify: `nova-games/grant-centipede-run/src/main.ts`.

**Step 1: Add constants.**

```ts
const POWERUP_INVINCIBILITY_SECONDS = 5;
```

**Step 2: Add a second invincibility timer.**

Near the other `let` state:

```ts
let powerupInvincibleUntil = 0;
```

Update the invincibility check in the ticker:

```ts
const invincible = runTime < invincibleUntil || runTime < powerupInvincibleUntil;
const powerupActive = runTime < powerupInvincibleUntil;
```

**Step 3: Update the per-frame visual effect.**

Replace the existing `for (const s of centipede.segments) s.g.alpha = ...` with:

```ts
for (let i = 0; i < centipede.segments.length; i++) {
	const s = centipede.segments[i];
	if (powerupActive) {
		const hue = (runTime * 300 + i * 40) % 360;
		s.g.tint = hslToHex(hue, 0.9, 0.6);
		s.g.alpha = 1;
	} else if (invincible) {
		s.g.tint = 0xffffff;
		s.g.alpha = 0.4 + 0.3 * Math.sin(runTime * 30);
	} else {
		s.g.tint = 0xffffff;
		s.g.alpha = 1;
	}
}
```

Add a tiny `hslToHex` helper near the other small helpers:

```ts
function hslToHex(h: number, s: number, l: number): number {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let r = 0;
	let g = 0;
	let b = 0;
	if (h < 60) { r = c; g = x; b = 0; }
	else if (h < 120) { r = x; g = c; b = 0; }
	else if (h < 180) { r = 0; g = c; b = x; }
	else if (h < 240) { r = 0; g = x; b = c; }
	else if (h < 300) { r = x; g = 0; b = c; }
	else { r = c; g = 0; b = x; }
	const to = (v: number) => Math.round((v + m) * 255);
	return (to(r) << 16) | (to(g) << 8) | to(b);
}
```

**Step 4: Add `makeRedMushroom` and handle pickup.**

```ts
function makeRedMushroom(worldX: number): Spawnable {
	const g = drawMushroom(0xff3a3a);
	const y = groundHeightAt(worldX) - MUSHROOM_HEIGHT / 2;
	g.position.set(worldX, y);
	gameScene.addChild(g);
	return {
		kind: "redMushroom",
		g,
		x: worldX,
		y,
		width: MUSHROOM_WIDTH,
		height: MUSHROOM_HEIGHT,
		alive: true,
	};
}
```

In the collision dispatcher, add:

```ts
} else if (s.kind === "redMushroom") {
	s.alive = false;
	s.g.destroy();
	powerupInvincibleUntil = runTime + POWERUP_INVINCIBILITY_SECONDS;
}
```

Reset `powerupInvincibleUntil = 0` at the top of `startRun`.

**Step 5: Put the spawn tuning into its final shape in `generateChunk`.**

Replace the placeholder roll with:

```ts
const slots: number[] = [];
const slot = () => 60 + slots.length * 140 + Math.random() * 40;
// Enemy rolls
const enemyRoll = Math.random();
const enemyCount = enemyRoll < 0.6 ? 1 : enemyRoll < 0.85 ? 2 : 0;
for (let i = 0; i < enemyCount; i++) {
	const x = slot();
	if (x > CHUNK_WIDTH - 40) break;
	const worldX = index * CHUNK_WIDTH + x;
	if (Math.random() < 0.65) chunk.spawns.push(makeSphere(worldX));
	else chunk.spawns.push(makeFireball(worldX));
	slots.push(x);
}
// Powerup roll
if (Math.random() < 0.35) {
	const x = slot();
	if (x <= CHUNK_WIDTH - 40) {
		const worldX = index * CHUNK_WIDTH + x;
		if (Math.random() < 0.7) chunk.spawns.push(makeBlueMushroom(worldX));
		else chunk.spawns.push(makeRedMushroom(worldX));
		slots.push(x);
	}
}
return chunk;
```

**Step 6: Verify.**

`pnpm run test` — PASS. Play a long run:
- Roughly 60–85% of chunks have one or two enemies.
- ~35% of chunks have a mushroom, mostly blue.
- Red mushroom pickups give ~5 seconds of visible rainbow shimmer, during which enemies explode on contact and no segment is lost.
- Blue pickups grow the tail by 1 or 3.
- Reaching 0 segments ends the run; the step count is written to high score when beating the previous best.

**Step 7: Commit.**

```bash
cd /Users/taylor/dev/tayl0r.github.com-grant
git add nova-games/grant-centipede-run/src/main.ts
git commit -m "$(cat <<'EOF'
feat(grant-centipede-run): add red mushroom powerup + spawn tuning

Red mushroom grants 5 seconds of invincibility with a rainbow shimmer; the
centipede destroys enemies on touch during the window. Also moves chunk
spawn rolls to the final tuned values (60% one enemy, 25% two, 15% none;
65% sphere / 35% fireball; 35% chance of a mushroom per chunk, 70% blue).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Final manual QA pass and any cleanup

**Files:** maybe none.

**Step 1: Full playthrough in the browser.** Verify from the design's "Testing" checklist:

- Menu: both buttons respond to the mouse. High-score button toggles panel on/off. Title reads "Centipede Run!".
- Run: Space jumps, only while on the ground (no double-jump). Step counter in the top-right ticks up and is always visible.
- Terrain: visibly rolling hills; body conforms.
- Centipede: all four cute elements present (eyes, cheeks + smile, antennae, body ripple) + boots.
- Enemies: both types spawn, both behave as spec'd.
- Powerups: both types spawn. Blue: sometimes +1, sometimes +3. Red: 5s rainbow shimmer, enemies die on touch, no segment loss.
- Game over: at 0 segments, step counter freezes, game-over screen shows. Returning to menu works. High score persists across reloads.

**Step 2: Stop the backgrounded Vite dev server.** If it's still running, kill the background bash task.

**Step 3: Only commit if any small cleanup edits came out of QA.** If the game passes the whole checklist as is, skip this step.

**Step 4: Task complete.** Report to user with the commit list and a note that the feature branch is ready to merge.

---

## Execution notes

- Prefer Edit over Write for every change. `main.ts` is the only code file being modified.
- Do not amend commits. Each task is its own commit. If a `pnpm run test` failure surfaces between an edit and its commit, fix forward and commit the fix as part of the same task.
- If a browser visual verification fails (bug, wrong behavior), fix it in the same task before committing, rather than opening a new task.
- Numeric constants are intentionally at the top of the file; the executor can adjust tuning values during QA without restructuring code.
