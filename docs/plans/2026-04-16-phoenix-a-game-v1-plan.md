# phoenix-a-game v1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a playable v1 prototype of phoenix-a-game: a third-person 3D fantasy dungeon with WASD movement, sword combat, auto-pickup loot, one 3×3 floor, and HP/stamina/hunger bars.

**Architecture:** Three.js scene rendered in a Vite app at `nova-games/phoenix-a-game/`. Game state is a single shared object mutated each frame. Modules split by concern (player, camera, world, monsters, combat, loot, hud). HUD is a DOM overlay driven from state. Pure-logic modules (state tick math, collision AABB, room-grid generation, drop rolls) get unit tests via Vitest; Three.js-bound behavior gets verified via browser smoke tests each task.

**Tech Stack:** TypeScript, Vite, Three.js, Vitest (new), Biome (already configured, tabs).

**Design doc:** `docs/plans/2026-04-16-phoenix-a-game-design.md`

**Working directory for all commands:** `nova-games/phoenix-a-game/` unless noted. Root-level commands say so explicitly.

---

## Conventions

- **Indent with tabs.** Biome enforces this repo-wide.
- **Type-safe strict mode.** `tsconfig.json` has `"strict": true`; no `any` without a comment explaining why.
- **Smoke test each visual task** by running `pnpm dev` and checking the stated behavior in a browser. The plan lists exactly what to look for.
- **Verify at repo root** that `pnpm run test` (tsc + biome) passes before committing — see @superpowers:verification-before-completion.
- **Commit after every task.** Messages start with `feat(phoenix):`, `test(phoenix):`, or `chore(phoenix):`.

---

## Task 1: Swap Pixi.js for Three.js and render a bare scene

**Files:**
- Modify: `nova-games/phoenix-a-game/package.json`
- Modify: `nova-games/phoenix-a-game/src/main.ts`

**Step 1: Replace the dependency**

Edit `package.json`: remove `"pixi.js"` from `dependencies`; add `"three": "^0.164.0"`. Add `"@types/three": "^0.164.0"` to `devDependencies`.

**Step 2: Install**

From repo root:
```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm install
```
Expected: resolves and installs `three` in the workspace.

**Step 3: Rewrite `src/main.ts` to a minimal Three.js scene**

Replace the entire file with:

```ts
import {
	AmbientLight,
	BoxGeometry,
	DirectionalLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	WebGLRenderer,
} from "three";

const scene = new Scene();
const camera = new PerspectiveCamera(
	60,
	window.innerWidth / window.innerHeight,
	0.1,
	1000,
);
camera.position.set(0, 8, 10);
camera.lookAt(0, 0, 0);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x101820);
document.body.appendChild(renderer.domElement);

const floor = new Mesh(
	new PlaneGeometry(32, 32),
	new MeshStandardMaterial({ color: 0x555555 }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const cube = new Mesh(
	new BoxGeometry(2, 2, 2),
	new MeshStandardMaterial({ color: 0xff3366 }),
);
cube.position.y = 1;
scene.add(cube);

scene.add(new AmbientLight(0xffffff, 0.5));
const sun = new DirectionalLight(0xffffff, 0.8);
sun.position.set(5, 10, 5);
scene.add(sun);

function animate() {
	requestAnimationFrame(animate);
	cube.rotation.y += 0.01;
	renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
```

**Step 4: Smoke test in browser**

```bash
cd nova-games/phoenix-a-game
pnpm dev
```
Open `http://localhost:5173/`. Expected: dark background, gray floor plane, rotating red cube with soft shading.

**Step 5: Root-level verification**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
```
Expected: `tsc --noEmit` and `biome check .` both pass.

**Step 6: Commit**

```bash
git add nova-games/phoenix-a-game/package.json pnpm-lock.yaml nova-games/phoenix-a-game/src/main.ts
git commit -m "feat(phoenix): swap Pixi.js for Three.js bare scene"
```

---

## Task 2: Add Vitest and shared game state module

**Files:**
- Modify: `nova-games/phoenix-a-game/package.json`
- Create: `nova-games/phoenix-a-game/src/state.ts`
- Create: `nova-games/phoenix-a-game/src/state.test.ts`
- Modify: `biome.json` (root) — no change expected, verify `.test.ts` isn't excluded

**Step 1: Add Vitest**

Edit `package.json` devDependencies: add `"vitest": "^1.6.0"`. Add scripts entry:
```json
"test": "vitest run"
```

Install:
```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm install
```

**Step 2: Write the failing test for initial state**

Create `src/state.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createInitialState } from "./state";

describe("createInitialState", () => {
	it("starts with 3 hearts, 20 stamina, 10 hunger", () => {
		const s = createInitialState();
		expect(s.player.health).toBe(3);
		expect(s.player.maxHealth).toBe(3);
		expect(s.player.stamina).toBe(20);
		expect(s.player.maxStamina).toBe(20);
		expect(s.player.hunger).toBe(10);
		expect(s.player.maxHunger).toBe(10);
	});
});
```

**Step 3: Run test to verify failure**

```bash
cd nova-games/phoenix-a-game && pnpm test
```
Expected: fails with "Cannot find module './state'".

**Step 4: Minimal implementation**

Create `src/state.ts`:
```ts
export interface PlayerState {
	health: number;
	maxHealth: number;
	stamina: number;
	maxStamina: number;
	hunger: number;
	maxHunger: number;
	swordDamage: number;
	iframesUntil: number;
}

export interface GameState {
	player: PlayerState;
	now: number;
	phase: "playing" | "dead" | "won";
}

export function createInitialState(): GameState {
	return {
		player: {
			health: 3,
			maxHealth: 3,
			stamina: 20,
			maxStamina: 20,
			hunger: 10,
			maxHunger: 10,
			swordDamage: 1,
			iframesUntil: 0,
		},
		now: 0,
		phase: "playing",
	};
}
```

**Step 5: Run test to verify pass**

```bash
pnpm test
```
Expected: PASS.

**Step 6: Root verification**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm run test
```
Expected: tsc and biome clean.

**Step 7: Commit**

```bash
git add nova-games/phoenix-a-game/package.json pnpm-lock.yaml nova-games/phoenix-a-game/src/state.ts nova-games/phoenix-a-game/src/state.test.ts
git commit -m "test(phoenix): add vitest and initial game state"
```

---

## Task 3: Player capsule + WASD ground movement

**Files:**
- Create: `nova-games/phoenix-a-game/src/input.ts`
- Create: `nova-games/phoenix-a-game/src/player.ts`
- Create: `nova-games/phoenix-a-game/src/player.test.ts`
- Modify: `nova-games/phoenix-a-game/src/main.ts`

**Step 1: Write the failing test for movement intent → velocity**

Create `src/player.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { computeVelocity } from "./player";

describe("computeVelocity", () => {
	it("is zero with no keys held", () => {
		const v = computeVelocity({ w: false, a: false, s: false, d: false }, false, 0);
		expect(v.x).toBe(0);
		expect(v.z).toBe(0);
	});
	it("moves forward along -Z when w is held", () => {
		const v = computeVelocity({ w: true, a: false, s: false, d: false }, false, 0);
		expect(v.z).toBeLessThan(0);
		expect(v.x).toBe(0);
	});
	it("sprint (shift) doubles speed", () => {
		const walk = computeVelocity({ w: true, a: false, s: false, d: false }, false, 0);
		const run = computeVelocity({ w: true, a: false, s: false, d: false }, true, 0);
		expect(Math.abs(run.z)).toBeCloseTo(Math.abs(walk.z) * 2, 5);
	});
	it("is rotated by camera yaw", () => {
		const v = computeVelocity({ w: true, a: false, s: false, d: false }, false, Math.PI / 2);
		expect(v.x).toBeLessThan(-0.5);
		expect(Math.abs(v.z)).toBeLessThan(0.01);
	});
});
```

**Step 2: Run test to verify failure**

```bash
cd nova-games/phoenix-a-game && pnpm test
```
Expected: fails with module/export error.

**Step 3: Write `input.ts`**

```ts
export interface InputState {
	w: boolean;
	a: boolean;
	s: boolean;
	d: boolean;
	shift: boolean;
	click: boolean;
}

export function createInput(): InputState {
	return { w: false, a: false, s: false, d: false, shift: false, click: false };
}

export function wireInput(input: InputState): void {
	const setKey = (e: KeyboardEvent, down: boolean) => {
		switch (e.code) {
			case "KeyW": input.w = down; break;
			case "KeyA": input.a = down; break;
			case "KeyS": input.s = down; break;
			case "KeyD": input.d = down; break;
			case "ShiftLeft":
			case "ShiftRight": input.shift = down; break;
		}
	};
	window.addEventListener("keydown", (e) => setKey(e, true));
	window.addEventListener("keyup", (e) => setKey(e, false));
	window.addEventListener("mousedown", (e) => {
		if (e.button === 0) input.click = true;
	});
	window.addEventListener("mouseup", (e) => {
		if (e.button === 0) input.click = false;
	});
}
```

**Step 4: Write `player.ts`**

```ts
import { CapsuleGeometry, Mesh, MeshStandardMaterial } from "three";

export const WALK_SPEED = 4;
export const RUN_SPEED = 8;

export interface MoveKeys {
	w: boolean;
	a: boolean;
	s: boolean;
	d: boolean;
}

export function computeVelocity(
	keys: MoveKeys,
	sprinting: boolean,
	cameraYaw: number,
): { x: number; z: number } {
	let fx = 0;
	let fz = 0;
	if (keys.w) fz -= 1;
	if (keys.s) fz += 1;
	if (keys.a) fx -= 1;
	if (keys.d) fx += 1;
	const len = Math.hypot(fx, fz);
	if (len === 0) return { x: 0, z: 0 };
	fx /= len;
	fz /= len;
	const speed = sprinting ? RUN_SPEED : WALK_SPEED;
	const cos = Math.cos(cameraYaw);
	const sin = Math.sin(cameraYaw);
	return {
		x: (fx * cos + fz * sin) * speed,
		z: (-fx * sin + fz * cos) * speed,
	};
}

export function createPlayerMesh(): Mesh {
	const mesh = new Mesh(
		new CapsuleGeometry(0.5, 1, 4, 8),
		new MeshStandardMaterial({ color: 0x66ccff }),
	);
	mesh.position.y = 1;
	return mesh;
}
```

**Step 5: Run tests to verify pass**

```bash
pnpm test
```
Expected: all 4 velocity tests PASS.

**Step 6: Wire it into `main.ts`**

Replace the rotating red cube with the player capsule and apply WASD velocity each frame. Use a simple delta-time clock. Camera stays fixed for now; we add follow next task. Relevant diff:

```ts
import { Clock } from "three";
import { createInput, wireInput } from "./input";
import { computeVelocity, createPlayerMesh } from "./player";

// …(replace the cube section)…
const player = createPlayerMesh();
scene.add(player);

const input = createInput();
wireInput(input);
const clock = new Clock();

function animate() {
	requestAnimationFrame(animate);
	const dt = clock.getDelta();
	const v = computeVelocity(input, input.shift, 0);
	player.position.x += v.x * dt;
	player.position.z += v.z * dt;
	renderer.render(scene, camera);
}
animate();
```

**Step 7: Smoke test**

```bash
pnpm dev
```
Expected: blue capsule on gray floor; WASD moves it; Shift makes it noticeably faster.

**Step 8: Root verification + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm run test
```
Expected: pass.

```bash
git add -A nova-games/phoenix-a-game/src
git commit -m "feat(phoenix): player capsule with WASD + sprint"
```

---

## Task 4: Third-person follow camera with mouse look

**Files:**
- Create: `nova-games/phoenix-a-game/src/camera.ts`
- Modify: `nova-games/phoenix-a-game/src/main.ts`
- Modify: `nova-games/phoenix-a-game/src/input.ts`

**Step 1: Add mouse-look fields to input**

In `input.ts`, add to `InputState`: `mouseDX: number; mouseDY: number;` and on pointer-lock movement listener, accumulate `movementX`/`movementY` into those fields (to be read and zeroed each frame by the camera).

**Step 2: Create `camera.ts`**

```ts
import type { Mesh, PerspectiveCamera } from "three";
import { Vector3 } from "three";

export interface FollowCamera {
	yaw: number;
	pitch: number;
	update(target: Mesh, dt: number, mouseDX: number, mouseDY: number): void;
}

const OFFSET_DISTANCE = 8;
const OFFSET_HEIGHT = 4;
const MOUSE_SENSITIVITY = 0.0025;
const PITCH_MIN = -Math.PI / 3;
const PITCH_MAX = Math.PI / 6;

export function createFollowCamera(camera: PerspectiveCamera): FollowCamera {
	const state: FollowCamera = {
		yaw: 0,
		pitch: -Math.PI / 8,
		update(target, _dt, mouseDX, mouseDY) {
			state.yaw -= mouseDX * MOUSE_SENSITIVITY;
			state.pitch = Math.max(
				PITCH_MIN,
				Math.min(PITCH_MAX, state.pitch - mouseDY * MOUSE_SENSITIVITY),
			);
			const horiz = Math.cos(state.pitch) * OFFSET_DISTANCE;
			const offset = new Vector3(
				Math.sin(state.yaw) * horiz,
				OFFSET_HEIGHT - Math.sin(state.pitch) * OFFSET_DISTANCE,
				Math.cos(state.yaw) * horiz,
			);
			camera.position.copy(target.position).add(offset);
			camera.lookAt(
				target.position.x,
				target.position.y + 1,
				target.position.z,
			);
		},
	};
	return state;
}
```

**Step 3: Wire pointer lock in main.ts**

```ts
renderer.domElement.addEventListener("click", () => {
	renderer.domElement.requestPointerLock();
});
```

Replace the fixed camera placement with:
```ts
import { createFollowCamera } from "./camera";
const follow = createFollowCamera(camera);

// in animate():
follow.update(player, dt, input.mouseDX, input.mouseDY);
input.mouseDX = 0;
input.mouseDY = 0;
const v = computeVelocity(input, input.shift, follow.yaw);
```

**Step 4: Smoke test**

Expected: click on canvas → cursor locks; mouse drag rotates camera around the player; WASD moves the player in directions relative to where the camera is facing; sprint still works.

**Step 5: Root verification + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm run test
```
```bash
git add -A nova-games/phoenix-a-game/src
git commit -m "feat(phoenix): third-person follow camera with mouse look"
```

---

## Task 5: Walls and AABB collision

**Files:**
- Create: `nova-games/phoenix-a-game/src/collision.ts`
- Create: `nova-games/phoenix-a-game/src/collision.test.ts`
- Modify: `nova-games/phoenix-a-game/src/main.ts`

**Step 1: Write failing collision tests**

Create `src/collision.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { resolveCircleVsAabb } from "./collision";

describe("resolveCircleVsAabb", () => {
	const wall = { minX: 0, maxX: 2, minZ: 0, maxZ: 10 };
	it("no push when circle is clear of the box", () => {
		const p = resolveCircleVsAabb(-5, 5, 0.5, wall);
		expect(p.x).toBe(-5);
		expect(p.z).toBe(5);
	});
	it("pushes out to the left when overlapping the left edge", () => {
		const p = resolveCircleVsAabb(-0.1, 5, 0.5, wall);
		expect(p.x).toBeCloseTo(-0.5, 5);
		expect(p.z).toBe(5);
	});
	it("pushes out along the nearest axis", () => {
		const p = resolveCircleVsAabb(1.9, 5, 0.5, wall);
		expect(p.x).toBeCloseTo(2.5, 5);
	});
});
```

**Step 2: Run to verify fail**

```bash
cd nova-games/phoenix-a-game && pnpm test
```

**Step 3: Implement `collision.ts`**

```ts
export interface Aabb {
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
}

export function resolveCircleVsAabb(
	x: number,
	z: number,
	radius: number,
	box: Aabb,
): { x: number; z: number } {
	const cx = Math.max(box.minX, Math.min(x, box.maxX));
	const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
	const dx = x - cx;
	const dz = z - cz;
	const distSq = dx * dx + dz * dz;
	if (distSq >= radius * radius) return { x, z };
	if (distSq === 0) {
		// Center inside box: push along nearest face.
		const leftDist = x - box.minX;
		const rightDist = box.maxX - x;
		const topDist = z - box.minZ;
		const bottomDist = box.maxZ - z;
		const m = Math.min(leftDist, rightDist, topDist, bottomDist);
		if (m === leftDist) return { x: box.minX - radius, z };
		if (m === rightDist) return { x: box.maxX + radius, z };
		if (m === topDist) return { x, z: box.minZ - radius };
		return { x, z: box.maxZ + radius };
	}
	const dist = Math.sqrt(distSq);
	const push = radius - dist;
	return { x: x + (dx / dist) * push, z: z + (dz / dist) * push };
}

export function resolveAll(
	x: number,
	z: number,
	radius: number,
	walls: Aabb[],
): { x: number; z: number } {
	let p = { x, z };
	for (const w of walls) p = resolveCircleVsAabb(p.x, p.z, radius, w);
	return p;
}
```

**Step 4: Run tests to verify pass**

**Step 5: Add one test wall in `main.ts`** — a 2×2×10 box mesh; register its AABB; call `resolveAll` after applying velocity each frame before writing back to `player.position`.

**Step 6: Smoke test** — walking the capsule into the wall should stop at the wall surface.

**Step 7: Root verification + commit**

```bash
git add -A nova-games/phoenix-a-game/src
git commit -m "feat(phoenix): AABB circle collision against walls"
```

---

## Task 6: 3×3 room grid generator

**Files:**
- Create: `nova-games/phoenix-a-game/src/world.ts`
- Create: `nova-games/phoenix-a-game/src/world.test.ts`
- Modify: `nova-games/phoenix-a-game/src/main.ts`

**Step 1: Decide geometry**
- Each room is 16×16 world units, floor at y=0.
- Walls are 1 unit thick and 3 units tall.
- Doorways are 4 units wide, centered on shared walls.
- Grid is 3×3 rooms → total 48×48 units plus outer walls.

**Step 2: Write failing tests**

Create `src/world.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { generate3x3Grid } from "./world";

describe("generate3x3Grid", () => {
	const grid = generate3x3Grid();
	it("produces exactly 9 rooms centered on a 48x48 area", () => {
		expect(grid.rooms).toHaveLength(9);
		const xs = grid.rooms.map((r) => r.centerX);
		expect(Math.min(...xs)).toBeCloseTo(-16, 5);
		expect(Math.max(...xs)).toBeCloseTo(16, 5);
	});
	it("produces wall AABBs with a doorway gap between adjacent rooms", () => {
		// Walk along y=0, z=0 (middle row): we must be able to get from
		// room (0,1) to room (1,1) through a doorway. This means there
		// must be NO wall AABB covering the point (0, 0) with z=0.
		const at = (x: number, z: number) =>
			grid.walls.some(
				(w) => x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ,
			);
		expect(at(-8, 0)).toBe(false);
		expect(at(0, 0)).toBe(false);
		expect(at(8, 0)).toBe(false);
	});
});
```

**Step 3: Implement `world.ts`**

```ts
import type { Aabb } from "./collision";

export interface Room {
	col: number;
	row: number;
	centerX: number;
	centerZ: number;
}

export interface WorldGrid {
	rooms: Room[];
	walls: Aabb[];
}

const ROOM_SIZE = 16;
const WALL_THICKNESS = 1;
const DOORWAY_WIDTH = 4;

export function generate3x3Grid(): WorldGrid {
	const rooms: Room[] = [];
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 3; col++) {
			rooms.push({
				col,
				row,
				centerX: (col - 1) * ROOM_SIZE,
				centerZ: (row - 1) * ROOM_SIZE,
			});
		}
	}

	const walls: Aabb[] = [];
	const half = ROOM_SIZE / 2;
	const halfDoor = DOORWAY_WIDTH / 2;
	const t = WALL_THICKNESS / 2;

	// Horizontal walls (split by vertical doorways to cross between rows)
	for (let row = 0; row <= 3; row++) {
		const z = (row - 1.5) * ROOM_SIZE;
		for (let col = 0; col < 3; col++) {
			const centerX = (col - 1) * ROOM_SIZE;
			const left = centerX - half;
			const right = centerX + half;
			const interior = row !== 0 && row !== 3;
			if (interior) {
				walls.push({ minX: left, maxX: centerX - halfDoor, minZ: z - t, maxZ: z + t });
				walls.push({ minX: centerX + halfDoor, maxX: right, minZ: z - t, maxZ: z + t });
			} else {
				walls.push({ minX: left, maxX: right, minZ: z - t, maxZ: z + t });
			}
		}
	}

	// Vertical walls
	for (let col = 0; col <= 3; col++) {
		const x = (col - 1.5) * ROOM_SIZE;
		for (let row = 0; row < 3; row++) {
			const centerZ = (row - 1) * ROOM_SIZE;
			const top = centerZ - half;
			const bottom = centerZ + half;
			const interior = col !== 0 && col !== 3;
			if (interior) {
				walls.push({ minX: x - t, maxX: x + t, minZ: top, maxZ: centerZ - halfDoor });
				walls.push({ minX: x - t, maxX: x + t, minZ: centerZ + halfDoor, maxZ: bottom });
			} else {
				walls.push({ minX: x - t, maxX: x + t, minZ: top, maxZ: bottom });
			}
		}
	}

	return { rooms, walls };
}
```

**Step 4: Run tests to verify pass**

**Step 5: Render the grid in `main.ts`**
- Scale/move the floor plane to cover 48×48 units.
- For each wall AABB, add a `Mesh` with a `BoxGeometry` sized to the AABB extents (y from 0 to 3).
- Pass `grid.walls` to `resolveAll` for collision.
- Remove the single test wall from Task 5.

**Step 6: Smoke test**

Expected: 9 square rooms visible, each with doorways between adjacent rooms; capsule can walk through doorways and is blocked by walls.

**Step 7: Root verification + commit**

```bash
git add -A nova-games/phoenix-a-game/src
git commit -m "feat(phoenix): 3x3 room grid with doorways"
```

---

## Task 7: HUD DOM overlay and stamina/hunger/health tick

**Files:**
- Create: `nova-games/phoenix-a-game/src/hud.ts`
- Modify: `nova-games/phoenix-a-game/src/state.ts`
- Create: `nova-games/phoenix-a-game/src/tick.ts`
- Create: `nova-games/phoenix-a-game/src/tick.test.ts`
- Modify: `nova-games/phoenix-a-game/index.html`
- Modify: `nova-games/phoenix-a-game/src/main.ts`

**Step 1: Write failing tick tests**

Create `src/tick.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { createInitialState } from "./state";
import { tickPlayer } from "./tick";

describe("tickPlayer", () => {
	it("drains half a hunger per 60s of walking", () => {
		const s = createInitialState();
		tickPlayer(s, 60, true, false);
		expect(s.player.hunger).toBeCloseTo(9.5, 5);
	});
	it("drains one hunger per 30s of sprinting", () => {
		const s = createInitialState();
		tickPlayer(s, 30, true, true);
		expect(s.player.hunger).toBeCloseTo(9, 5);
	});
	it("drains stamina while sprinting and regenerates otherwise", () => {
		const s = createInitialState();
		tickPlayer(s, 2, true, true);
		expect(s.player.stamina).toBeLessThan(20);
		tickPlayer(s, 5, false, false);
		expect(s.player.stamina).toBe(20);
	});
	it("ticks health down when hunger reaches 0", () => {
		const s = createInitialState();
		s.player.hunger = 0;
		tickPlayer(s, 10, true, false);
		expect(s.player.health).toBeLessThan(3);
	});
});
```

**Step 2: Run to verify fail**

**Step 3: Implement `tick.ts`**

```ts
import type { GameState } from "./state";

const HUNGER_PER_SEC_WALKING = 0.5 / 60;
const HUNGER_PER_SEC_SPRINTING = 1 / 30;
const STAMINA_DRAIN_PER_SEC = 3;
const STAMINA_REGEN_PER_SEC = 5;
const STARVE_DAMAGE_PER_SEC = 0.1;

export function tickPlayer(
	state: GameState,
	dt: number,
	moving: boolean,
	sprinting: boolean,
): void {
	const p = state.player;
	if (moving) {
		const drain = sprinting ? HUNGER_PER_SEC_SPRINTING : HUNGER_PER_SEC_WALKING;
		p.hunger = Math.max(0, p.hunger - drain * dt);
	}
	if (sprinting && p.stamina > 0) {
		p.stamina = Math.max(0, p.stamina - STAMINA_DRAIN_PER_SEC * dt);
	} else if (!sprinting) {
		p.stamina = Math.min(p.maxStamina, p.stamina + STAMINA_REGEN_PER_SEC * dt);
	}
	if (p.hunger === 0) {
		p.health = Math.max(0, p.health - STARVE_DAMAGE_PER_SEC * dt);
	}
	state.now += dt;
}
```

**Step 4: Run tests to verify pass**

**Step 5: Add HUD DOM**

In `index.html`, add inside `<body>` before the script tag:
```html
<div id="hud" style="
	position: fixed; inset: 0; pointer-events: none;
	color: #fff; font-family: sans-serif; font-size: 20px;
	text-shadow: 0 0 4px #000;
">
	<div id="hud-health" style="position: absolute; top: 12px; left: 12px;"></div>
	<div id="hud-stamina" style="position: absolute; top: 12px; left: 50%; transform: translateX(-50%);"></div>
	<div id="hud-hunger" style="position: absolute; top: 12px; right: 12px;"></div>
	<div id="hud-banner" style="
		position: absolute; inset: 0; display: none;
		align-items: center; justify-content: center;
		background: rgba(0,0,0,0.6); font-size: 48px;
	"></div>
</div>
```

**Step 6: Create `hud.ts`**

```ts
import type { GameState } from "./state";

export function renderHud(state: GameState): void {
	const p = state.player;
	const heartCount = Math.max(0, Math.ceil(p.health));
	const healthEl = document.getElementById("hud-health");
	if (healthEl) healthEl.textContent = "HP " + "♥".repeat(heartCount);
	const stamEl = document.getElementById("hud-stamina");
	if (stamEl) stamEl.textContent = "STAM " + Math.round(p.stamina) + "/" + p.maxStamina;
	const hungEl = document.getElementById("hud-hunger");
	if (hungEl) hungEl.textContent = "🍗".repeat(Math.ceil(p.hunger));
	const banner = document.getElementById("hud-banner");
	if (banner) {
		if (state.phase === "dead") {
			banner.style.display = "flex";
			banner.textContent = "You Died — click to respawn";
		} else if (state.phase === "won") {
			banner.style.display = "flex";
			banner.textContent = "You Win! — click to restart";
		} else {
			banner.style.display = "none";
		}
	}
}
```

**Step 7: Wire into main.ts animate loop**

```ts
import { createInitialState } from "./state";
import { tickPlayer } from "./tick";
import { renderHud } from "./hud";
const state = createInitialState();

// in animate():
const moving = Math.hypot(v.x, v.z) > 0.01;
tickPlayer(state, dt, moving, moving && input.shift);
renderHud(state);
```

**Step 8: Smoke test**

Expected: three bars visible; walking slowly reduces hunger; sprinting drains stamina; stamina refills on release; if you stand still for ~20 minutes (or artificially zero-out hunger in console), health starts ticking down and eventually the banner shows.

**Step 9: Root verification + commit**

```bash
git add -A nova-games/phoenix-a-game
git commit -m "feat(phoenix): HUD overlay with hp/stamina/hunger tick"
```

---

## Task 8: Monster type A — chase AI, contact damage, i-frames

**Files:**
- Create: `nova-games/phoenix-a-game/src/monsters.ts`
- Create: `nova-games/phoenix-a-game/src/monsters.test.ts`
- Modify: `nova-games/phoenix-a-game/src/main.ts`

**Step 1: Write failing tests**

Create `src/monsters.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { moveMonsterTowards, type Monster } from "./monsters";

describe("moveMonsterTowards", () => {
	it("walks toward the player at its speed", () => {
		const m: Monster = {
			kind: "goblin", x: 0, z: 0, hp: 2, speed: 2,
			radius: 0.4, contact: 0.5, damage: 0,
		};
		moveMonsterTowards(m, 10, 0, 1);
		expect(m.x).toBeCloseTo(2, 5);
	});
	it("does not overshoot the player", () => {
		const m: Monster = {
			kind: "goblin", x: 0, z: 0, hp: 2, speed: 100,
			radius: 0.4, contact: 0.5, damage: 0,
		};
		moveMonsterTowards(m, 1, 0, 1);
		expect(m.x).toBeLessThanOrEqual(1);
	});
});
```

**Step 2: Run to verify fail.**

**Step 3: Implement `monsters.ts`**

```ts
import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";

export type MonsterKind = "goblin" | "ogre" | "boss";

export interface Monster {
	kind: MonsterKind;
	x: number;
	z: number;
	hp: number;
	speed: number;
	radius: number;
	contact: number;
	damage: number;
	mesh?: Mesh;
}

export function createGoblin(x: number, z: number): Monster {
	return { kind: "goblin", x, z, hp: 2, speed: 3, radius: 0.4, contact: 0.9, damage: 0.5 };
}

export function createMonsterMesh(m: Monster): Mesh {
	const size = m.kind === "boss" ? 1.5 : m.kind === "ogre" ? 1 : 0.6;
	const color = m.kind === "boss" ? 0xaa0000 : m.kind === "ogre" ? 0x885500 : 0x22aa22;
	const mesh = new Mesh(
		new BoxGeometry(size, size, size),
		new MeshStandardMaterial({ color }),
	);
	mesh.position.set(m.x, size / 2, m.z);
	return mesh;
}

export function moveMonsterTowards(
	m: Monster,
	targetX: number,
	targetZ: number,
	dt: number,
): void {
	const dx = targetX - m.x;
	const dz = targetZ - m.z;
	const d = Math.hypot(dx, dz);
	if (d < 0.01) return;
	const step = Math.min(d, m.speed * dt);
	m.x += (dx / d) * step;
	m.z += (dz / d) * step;
}

export function overlapsPlayer(m: Monster, px: number, pz: number, pr: number): boolean {
	const d = Math.hypot(m.x - px, m.z - pz);
	return d < m.contact + pr;
}
```

**Step 4: Apply contact damage + i-frames (add to `tick.ts`)**

```ts
import type { Monster } from "./monsters";

export function applyContactDamage(
	state: GameState,
	monsters: Monster[],
	playerX: number,
	playerZ: number,
	playerRadius: number,
): void {
	if (state.now < state.player.iframesUntil) return;
	for (const m of monsters) {
		if (m.hp <= 0) continue;
		const d = Math.hypot(m.x - playerX, m.z - playerZ);
		if (d < m.contact + playerRadius) {
			state.player.health -= m.damage;
			state.player.iframesUntil = state.now + 1;
			break;
		}
	}
}
```

**Step 5: Spawn goblins in main.ts**
- Create 3 goblins at random positions in the 3×3 grid (not in the center room — that's for the boss later).
- Add their meshes to the scene.
- In the animate loop: move each living monster toward player; sync `mesh.position`; call `applyContactDamage`.

**Step 6: Smoke test**

Expected: green cubes visibly chase the capsule; touching them reduces health and you flash invulnerable for 1s (no hit-flash yet, but HP shouldn't plummet faster than ~1/sec).

**Step 7: Commit**

```bash
git add -A nova-games/phoenix-a-game
git commit -m "feat(phoenix): goblin monsters with chase AI and contact damage"
```

---

## Task 9: Sword swing, hitbox, monster death

**Files:**
- Create: `nova-games/phoenix-a-game/src/combat.ts`
- Modify: `nova-games/phoenix-a-game/src/monsters.ts` (dispose mesh on death)
- Modify: `nova-games/phoenix-a-game/src/main.ts`
- Modify: `nova-games/phoenix-a-game/src/player.ts` (add sword mesh as child of capsule)

**Step 1: Attach a sword mesh**

In `createPlayerMesh`, add a thin box as a child representing the sword, positioned out in front. Export the sword mesh as part of the player so it can be animated.

**Step 2: Implement `combat.ts`**

```ts
import type { Monster } from "./monsters";

const SWING_DURATION = 0.3;
const HITBOX_REACH = 1.5;
const HITBOX_HALF_WIDTH = 1.0;

export interface SwingState {
	active: boolean;
	startedAt: number;
	hitThisSwing: Set<Monster>;
}

export function createSwing(): SwingState {
	return { active: false, startedAt: 0, hitThisSwing: new Set() };
}

export function startSwing(swing: SwingState, now: number): void {
	if (swing.active) return;
	swing.active = true;
	swing.startedAt = now;
	swing.hitThisSwing.clear();
}

export function updateSwing(
	swing: SwingState,
	now: number,
	damage: number,
	facingX: number,
	facingZ: number,
	playerX: number,
	playerZ: number,
	monsters: Monster[],
): void {
	if (!swing.active) return;
	const elapsed = now - swing.startedAt;
	if (elapsed >= SWING_DURATION) {
		swing.active = false;
		return;
	}
	// Hit window: middle 50% of swing
	if (elapsed < SWING_DURATION * 0.25 || elapsed > SWING_DURATION * 0.75) return;
	for (const m of monsters) {
		if (m.hp <= 0 || swing.hitThisSwing.has(m)) continue;
		const rx = m.x - playerX;
		const rz = m.z - playerZ;
		const forward = rx * facingX + rz * facingZ;
		if (forward < 0 || forward > HITBOX_REACH) continue;
		const side = rx * -facingZ + rz * facingX;
		if (Math.abs(side) > HITBOX_HALF_WIDTH) continue;
		m.hp -= damage;
		swing.hitThisSwing.add(m);
	}
}
```

**Step 3: Wire into main.ts**

- Track swing state; on `input.click` rising edge (compare to `previousClick` you store across frames), call `startSwing`. `input.click` is level-triggered (true while held), so the consumer is responsible for edge detection.
- Each frame: `updateSwing` with player facing derived from camera yaw (`facingX = -sin(yaw); facingZ = -cos(yaw)`).
- Rotate the sword mesh during the swing for a visible arc (just animate rotation from -90° to +90° across `SWING_DURATION`).
- When `m.hp <= 0`, remove `m.mesh` from the scene and dispose geometry/material.

**Step 4: Smoke test**

Expected: left-click swings the sword (visible rotation); if a goblin is in front, it takes 2 hits to die and disappears.

**Step 5: Commit**

```bash
git add -A nova-games/phoenix-a-game
git commit -m "feat(phoenix): sword swing with hitbox and monster death"
```

---

## Task 10: Second monster type — ogres

**Files:**
- Modify: `nova-games/phoenix-a-game/src/monsters.ts`
- Modify: `nova-games/phoenix-a-game/src/main.ts`

**Step 1: Add `createOgre` factory** (hp 4, speed 1.5, contact 1.2, damage 1, radius 0.6).

**Step 2: Spawn mix in main.ts** — distribute ~6 goblins and ~3 ogres across the 8 non-boss rooms.

**Step 3: Smoke test**

Expected: brown cubes (bigger, slower) mixed with green cubes; ogres take 4 hits; ogre contact deals a full heart.

**Step 4: Commit**

```bash
git add -A nova-games/phoenix-a-game
git commit -m "feat(phoenix): ogre monster type"
```

---

## Task 11: Chests, drop table, auto-pickup

**Files:**
- Create: `nova-games/phoenix-a-game/src/loot.ts`
- Create: `nova-games/phoenix-a-game/src/loot.test.ts`
- Modify: `nova-games/phoenix-a-game/src/main.ts`

**Step 1: Write failing drop test**

Create `src/loot.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { rollDrop } from "./loot";

describe("rollDrop", () => {
	it("returns 'food' most of the time and 'sword' otherwise", () => {
		let food = 0;
		let sword = 0;
		let rng = 0;
		const fakeRandom = () => {
			const v = (rng += 0.01) % 1;
			return v;
		};
		for (let i = 0; i < 100; i++) {
			const d = rollDrop(fakeRandom);
			if (d === "food") food++;
			if (d === "sword") sword++;
		}
		expect(food).toBeGreaterThan(50);
		expect(sword).toBeGreaterThan(20);
	});
	it("boss chest is always a sword", () => {
		for (let i = 0; i < 10; i++) {
			expect(rollDrop(Math.random, true)).toBe("sword");
		}
	});
});
```

**Step 2: Run to verify fail.**

**Step 3: Implement `loot.ts`**

```ts
import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import type { GameState } from "./state";

export type DropKind = "food" | "sword";

export function rollDrop(rng: () => number, boss = false): DropKind {
	if (boss) return "sword";
	return rng() < 0.6 ? "food" : "sword";
}

export interface Chest {
	x: number;
	z: number;
	opened: boolean;
	boss: boolean;
	mesh: Mesh;
}

export function createChest(x: number, z: number, boss = false): Chest {
	const mesh = new Mesh(
		new BoxGeometry(0.8, 0.6, 0.8),
		new MeshStandardMaterial({ color: boss ? 0xffd700 : 0xaa7733 }),
	);
	mesh.position.set(x, 0.3, z);
	return { x, z, opened: false, boss, mesh };
}

export function tryOpenChest(
	chest: Chest,
	playerX: number,
	playerZ: number,
	state: GameState,
	rng: () => number,
): void {
	if (chest.opened) return;
	if (Math.hypot(chest.x - playerX, chest.z - playerZ) > 1.2) return;
	chest.opened = true;
	const drop = rollDrop(rng, chest.boss);
	if (drop === "food") {
		state.player.hunger = Math.min(state.player.maxHunger, state.player.hunger + 3);
	} else {
		const bump = chest.boss ? 2 : 1;
		state.player.swordDamage += bump;
	}
	chest.mesh.material = new MeshStandardMaterial({ color: 0x333333 });
}
```

**Step 4: Run tests to verify pass.**

**Step 5: Spawn 5 chests in main.ts** — one in each of 5 non-boss rooms, deterministic placement. Call `tryOpenChest` for each per frame.

**Step 6: Smoke test**

Expected: brown boxes visible; walking onto one turns it dark and either boosts hunger (visible on HUD) or upgrades sword damage (swing kills goblins faster).

**Step 7: Commit**

```bash
git add -A nova-games/phoenix-a-game
git commit -m "feat(phoenix): chests with auto-pickup drops"
```

---

## Task 12: Boss, boss chest, stairs, win state

**Files:**
- Modify: `nova-games/phoenix-a-game/src/monsters.ts`
- Modify: `nova-games/phoenix-a-game/src/main.ts`

**Step 1: Add `createBoss`** — hp 10, speed 2, contact 1.8, damage 1, radius 0.9; only one spawned in the center room.

**Step 2: Add a "stairs" mesh** — a distinctive cylinder in the boss room, invisible/grayed until boss is dead. When the player walks onto the stairs while it's active, set `state.phase = "won"`.

**Step 3: On boss death**, spawn a boss chest at the boss's final position and reveal the stairs.

**Step 4: HUD already reads `state.phase`** — renderHud will show the win banner.

**Step 5: Smoke test**

Expected: large red cube in the center room; takes 10 hits; on death a gold chest appears and a gray cylinder lights up; standing on the cylinder shows "You Win!".

**Step 6: Commit**

```bash
git add -A nova-games/phoenix-a-game
git commit -m "feat(phoenix): boss, boss chest, stairs, win state"
```

---

## Task 13: Death and respawn flow

**Files:**
- Modify: `nova-games/phoenix-a-game/src/main.ts`
- Modify: `nova-games/phoenix-a-game/src/state.ts`

**Step 1: Detect death**
When `state.player.health <= 0` and phase is `"playing"`, set `state.phase = "dead"` and stop ticking the player / AI movement in the animate loop.

**Step 2: Click-to-respawn**
When phase is `"dead"` and a mousedown arrives, reset:
- `player.health = maxHealth`
- `player.stamina = maxStamina`
- `player.hunger = maxHunger`
- player position to floor-entry (e.g., center of room at col=1 row=0)
- `phase = "playing"`
Leave `m.hp` values alone — already-dead monsters stay dead; opened chests stay opened.

**Step 3: Similarly for won → click restarts run**
Reset as above, plus re-spawn all monsters (reset hp arrays) and reset chests/boss state. Easiest: factor initial spawn into a `resetRun(state, scene)` function and call it both on boot and on post-win click.

**Step 4: Smoke test**

Expected: starving or getting pummeled → "You Died" banner; click → HUD refills, capsule back at entry, dead monsters still dead. Kill boss + descend stairs → "You Win" banner; click → fresh run with monsters back.

**Step 5: Commit**

```bash
git add -A nova-games/phoenix-a-game
git commit -m "feat(phoenix): death and respawn flow"
```

---

## Task 14: Polish pass

**Files:**
- Modify: `nova-games/phoenix-a-game/src/camera.ts`
- Modify: `nova-games/phoenix-a-game/src/main.ts`
- Modify: `nova-games/phoenix-a-game/index.html`

**Step 1: Camera smoothing**

Lerp the camera position each frame toward the computed offset instead of snapping:
```ts
camera.position.lerp(target.position.clone().add(offset), 1 - Math.exp(-dt * 10));
```

**Step 2: Hit flash**

When a monster takes damage, briefly set its material emissive to red and decay it over 0.15s. When the player takes damage, briefly tint the HUD root red via a CSS class.

**Step 3: Click-to-start overlay**

Add a full-screen `<div id="start-overlay">` with "phoenix-a-game — click to begin" that hides on first click and requests pointer lock.

**Step 4: Final smoke test — verify success criteria from the design doc**

Run `pnpm dev` and walk the criteria list:

1. Loads in browser ✓
2. Default capsule + follow camera ✓
3. WASD + Shift + stamina drain + hunger tick + starvation damage ✓
4. All 9 rooms reachable ✓
5. Monsters chase and attack, sword kills them ✓
6. Chests apply drops ✓
7. Boss takes 10 hits + better sword drop ✓
8. Stairs → win screen ✓
9. Death → respawn, dead monsters stay dead ✓
10. Root `pnpm run test` passes ✓

**Step 5: Final root verification**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm run test && pnpm run build
```
Expected: type-check, lint, full build all pass. Built game appears at `dist/nova-games/phoenix-a-game/`.

**Step 6: Add landing page entry**

Edit `nova-games/index.html` — add a card for phoenix-a-game inside `.game-grid`:
```html
<a href="./phoenix-a-game/" class="game-card">
	<span class="game-title">Phoenix</span>
	<span class="game-author">by Phoenix</span>
	<span class="game-engine">Three.js</span>
</a>
```

**Step 7: Final commit**

```bash
git add -A
git commit -m "feat(phoenix): polish + landing page entry"
```

---

## Done criteria

All 10 success criteria from the design doc are verified in the Task 14 smoke test, `pnpm run test` + `pnpm run build` pass at the repo root, and the game is linked from the Nova Games landing page.

From here, the v2 plan picks up: character creation, inventory menu, procedural generation, more floors, bow/shield/emblems, rarity tiers, XP.
