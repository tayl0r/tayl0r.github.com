# grant-woodland-virus vertical slice — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the vertical slice of grant-woodland-virus described in `docs/plans/2026-05-07-grant-woodland-virus-vertical-slice-design.md`: title screen → first-person walk through a dark Three.js forest with stamina + sprint + flashlight + collision → touch the green flag → win screen with Play Again.

**Architecture:** Single Vite + TypeScript workspace under `nova-games/grant-woodland-virus/`. Source split across four focused modules: `main.ts` (bootstrap + state machine + game loop), `forest.ts` (tree/flag/boundary generation + collider list), `player.ts` (input + movement + collision + stamina), `ui.ts` (DOM overlays for title / stamina bar / win). DOM overlays sit above the WebGL canvas; pointer lock requested on canvas click during PLAYING.

**Tech Stack:** Three.js 0.164, TypeScript 5.9, Vite 7. No new deps (the scaffold from PR #20 already has them). Project-level verification is `pnpm test` (`tsc --noEmit && biome check`) and manual browser smoke testing — there is no unit-test framework in the kid's workspace, so each task ends in a `pnpm test` pass plus a documented browser check.

**Code style notes for every task:**
- Use **tab indentation** in all `.ts` files (biome enforces this).
- Use `import type { ... }` for type-only imports (biome's `useImportType`).
- Sort imports alphabetically inside each `from "..."` group (matches the scaffold style).
- Run `pnpm test` from the repo root after every task; fix any biome/tsc complaints before committing.
- Run the dev server with `pnpm dev` from inside `nova-games/grant-woodland-virus/` (the kid's workspace has its own Vite config on port 5173).

---

## File map

By the end of this plan the kid's source tree will look like:

```
nova-games/grant-woodland-virus/
  index.html              (unchanged from scaffold)
  package.json            (unchanged)
  tsconfig.json           (unchanged)
  vite.config.ts          (unchanged)
  src/
    main.ts               REWRITTEN — bootstrap, scene, state machine, game loop
    forest.ts             NEW — tree/flag/boundary generation + collider export
    player.ts             NEW — input handlers, movement, collision, stamina
    ui.ts                 NEW — DOM overlays + setters
```

---

## Task 1: Atmosphere baseline (replace scaffold cube with dark scene)

Replaces the rotating-cube scaffold with the slice's atmosphere foundation: clear color, exponential fog, ambient + hemisphere lights, and a dark ground plane. Camera stays static at eye height for now — input comes in Task 3.

**Files:**
- Modify: `nova-games/grant-woodland-virus/src/main.ts` (full rewrite)

- [ ] **Step 1: Replace `src/main.ts` with the atmosphere setup**

```typescript
import {
	AmbientLight,
	FogExp2,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	WebGLRenderer,
} from "three";

const scene = new Scene();
scene.fog = new FogExp2(0x050a08, 0.05);

const camera = new PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	500,
);
camera.position.set(0, 1.7, 0);
camera.lookAt(0, 1.7, -1);
scene.add(camera);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x050a08);
document.body.appendChild(renderer.domElement);

const ground = new Mesh(
	new PlaneGeometry(220, 220),
	new MeshStandardMaterial({ color: 0x0a1408 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

scene.add(new AmbientLight(0xffffff, 0.08));
scene.add(new HemisphereLight(0x0a0a14, 0x020402, 0.05));

function animate() {
	requestAnimationFrame(animate);
	renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
```

- [ ] **Step 2: Run `pnpm test` from the repo root**

```bash
pnpm test
```
Expected: `tsc --noEmit` succeeds; `biome check .` succeeds. No errors.

- [ ] **Step 3: Smoke test in the browser**

```bash
cd nova-games/grant-woodland-virus && pnpm dev
```
Open `http://localhost:5173/`. Expected: a near-black scene. The ground plane is barely visible directly below the camera and fades into fog. No cube. Resizing the browser window keeps the canvas full-bleed.

- [ ] **Step 4: Commit**

```bash
git add nova-games/grant-woodland-virus/src/main.ts
git commit -m "grant-woodland-virus: replace scaffold with dark-forest atmosphere"
```

---

## Task 2: Forest module (trees + flag + boundary)

Adds a `forest.ts` module that generates ~250 trees (rejection-sampled), the green winning flag at ~90 m from spawn, and exports a collider list + bounds for later collision. `main.ts` calls `buildForest(scene)` once during bootstrap.

Trees are `Group`s containing a brown trunk cylinder + a dark-green canopy cone. The flag is a thin grey pole + an emissive green cloth (so it pops in fog without lighting).

**Files:**
- Create: `nova-games/grant-woodland-virus/src/forest.ts`
- Modify: `nova-games/grant-woodland-virus/src/main.ts` (add import + call)

- [ ] **Step 1: Create `src/forest.ts`**

```typescript
import {
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	type Scene,
	Vector3,
} from "three";

export type TreeCollider = {
	x: number;
	z: number;
	radius: number;
};

export type Forest = {
	colliders: TreeCollider[];
	flagPosition: Vector3;
	bounds: { halfX: number; halfZ: number };
};

const AREA_HALF = 100;
const TREE_COUNT_TARGET = 250;
const TREE_RADIUS = 0.5;
const TREE_MIN_SPACING = 1.5;
const SPAWN_KEEP_CLEAR = 4;
const FLAG_KEEP_CLEAR = 3;
const FLAG_X = 63;
const FLAG_Z = 63;

const trunkMaterial = new MeshStandardMaterial({ color: 0x3a2814 });
const canopyMaterial = new MeshStandardMaterial({ color: 0x0a2a0a });
const poleMaterial = new MeshStandardMaterial({ color: 0xcccccc });
const clothMaterial = new MeshStandardMaterial({
	color: 0x00ff44,
	emissive: 0x00ff44,
	emissiveIntensity: 0.6,
});

function makeTree(x: number, z: number): Object3D {
	const tree = new Group();

	const trunk = new Mesh(
		new CylinderGeometry(TREE_RADIUS, TREE_RADIUS, 6, 8),
		trunkMaterial,
	);
	trunk.position.y = 3;
	tree.add(trunk);

	const canopy = new Mesh(new ConeGeometry(2, 4, 8), canopyMaterial);
	canopy.position.y = 8;
	tree.add(canopy);

	tree.position.set(x, 0, z);
	return tree;
}

function makeFlag(x: number, z: number): Object3D {
	const group = new Group();

	const pole = new Mesh(
		new CylinderGeometry(0.05, 0.05, 4, 8),
		poleMaterial,
	);
	pole.position.y = 2;
	group.add(pole);

	const cloth = new Mesh(new BoxGeometry(1.2, 0.6, 0.05), clothMaterial);
	cloth.position.set(0.6, 3.4, 0);
	group.add(cloth);

	group.position.set(x, 0, z);
	return group;
}

export function buildForest(scene: Scene): Forest {
	const colliders: TreeCollider[] = [];
	const positions: { x: number; z: number }[] = [];

	const maxAttempts = 5000;
	let attempts = 0;
	while (positions.length < TREE_COUNT_TARGET && attempts < maxAttempts) {
		attempts++;
		const x = (Math.random() * 2 - 1) * AREA_HALF * 0.95;
		const z = (Math.random() * 2 - 1) * AREA_HALF * 0.95;

		if (Math.hypot(x, z) < SPAWN_KEEP_CLEAR) continue;
		if (Math.hypot(x - FLAG_X, z - FLAG_Z) < FLAG_KEEP_CLEAR) continue;

		let tooClose = false;
		for (const p of positions) {
			if (Math.hypot(x - p.x, z - p.z) < TREE_MIN_SPACING) {
				tooClose = true;
				break;
			}
		}
		if (tooClose) continue;

		positions.push({ x, z });
	}

	for (const { x, z } of positions) {
		scene.add(makeTree(x, z));
		colliders.push({ x, z, radius: TREE_RADIUS });
	}

	scene.add(makeFlag(FLAG_X, FLAG_Z));

	return {
		colliders,
		flagPosition: new Vector3(FLAG_X, 0, FLAG_Z),
		bounds: { halfX: AREA_HALF, halfZ: AREA_HALF },
	};
}
```

- [ ] **Step 2: Wire it into `src/main.ts`**

Add the import to the top of `main.ts`:

```typescript
import { buildForest } from "./forest";
```

Add the call right after the lights are added (before the `animate()` definition). Insert these lines:

```typescript
const forest = buildForest(scene);
void forest; // referenced in later tasks
```

The `void forest;` keeps biome's `noUnusedVariables` quiet for this intermediate step. We delete it the moment a real consumer arrives in Task 4.

- [ ] **Step 3: Run `pnpm test` from the repo root**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 4: Smoke test in the browser**

```bash
cd nova-games/grant-woodland-virus && pnpm dev
```
Open `http://localhost:5173/`. Expected: spawn-position view shows several tree silhouettes around you, fading into fog. The bright-green flag is **not** visible from spawn (~90 m through dense fog). Refreshing produces a different tree layout (random per-load is intentional).

- [ ] **Step 5: Commit**

```bash
git add nova-games/grant-woodland-virus/src/forest.ts nova-games/grant-woodland-virus/src/main.ts
git commit -m "grant-woodland-virus: generate forest, boundary, and win flag"
```

---

## Task 3: Player module — WASD + mouse-look + pointer lock

Adds `player.ts` with the player state, key listeners, mouse-look math, and a `updatePlayer(dt)` function that integrates into the game loop. Pointer lock is requested on canvas click. **No collision yet** — Task 4 adds that. **No sprint/stamina yet** — Task 6 adds that.

**Files:**
- Create: `nova-games/grant-woodland-virus/src/player.ts`
- Modify: `nova-games/grant-woodland-virus/src/main.ts`

- [ ] **Step 1: Create `src/player.ts`**

```typescript
import { type PerspectiveCamera, Vector3 } from "three";

const PITCH_LIMIT = (85 / 180) * Math.PI;
const MOUSE_SENSITIVITY = 0.002;
const WALK_SPEED = 4;
const EYE_HEIGHT = 1.7;

export type PlayerState = {
	position: Vector3;
	yaw: number;
	pitch: number;
};

type Keys = { w: boolean; a: boolean; s: boolean; d: boolean };
const keys: Keys = { w: false, a: false, s: false, d: false };

export function createPlayer(): PlayerState {
	return {
		position: new Vector3(0, EYE_HEIGHT, 0),
		yaw: 0,
		pitch: 0,
	};
}

export function resetPlayer(player: PlayerState) {
	player.position.set(0, EYE_HEIGHT, 0);
	player.yaw = 0;
	player.pitch = 0;
}

export function attachPlayerInput(
	canvas: HTMLCanvasElement,
	player: PlayerState,
) {
	window.addEventListener("keydown", (e) => {
		const k = e.key.toLowerCase();
		if (k === "w") keys.w = true;
		else if (k === "a") keys.a = true;
		else if (k === "s") keys.s = true;
		else if (k === "d") keys.d = true;
	});
	window.addEventListener("keyup", (e) => {
		const k = e.key.toLowerCase();
		if (k === "w") keys.w = false;
		else if (k === "a") keys.a = false;
		else if (k === "s") keys.s = false;
		else if (k === "d") keys.d = false;
	});

	window.addEventListener("mousemove", (e) => {
		if (document.pointerLockElement !== canvas) return;
		player.yaw -= e.movementX * MOUSE_SENSITIVITY;
		player.pitch -= e.movementY * MOUSE_SENSITIVITY;
		if (player.pitch > PITCH_LIMIT) player.pitch = PITCH_LIMIT;
		if (player.pitch < -PITCH_LIMIT) player.pitch = -PITCH_LIMIT;
	});

	canvas.addEventListener("click", () => {
		if (document.pointerLockElement !== canvas) {
			canvas.requestPointerLock();
		}
	});
}

const tmpForward = new Vector3();
const tmpRight = new Vector3();
const tmpMove = new Vector3();

export function updatePlayer(
	player: PlayerState,
	camera: PerspectiveCamera,
	dt: number,
) {
	camera.rotation.order = "YXZ";
	camera.rotation.set(player.pitch, player.yaw, 0);

	if (document.pointerLockElement) {
		camera.getWorldDirection(tmpForward);
		tmpForward.y = 0;
		tmpForward.normalize();
		tmpRight.set(-tmpForward.z, 0, tmpForward.x);

		tmpMove.set(0, 0, 0);
		if (keys.w) tmpMove.add(tmpForward);
		if (keys.s) tmpMove.sub(tmpForward);
		if (keys.d) tmpMove.add(tmpRight);
		if (keys.a) tmpMove.sub(tmpRight);

		if (tmpMove.lengthSq() > 0) {
			tmpMove.normalize().multiplyScalar(WALK_SPEED * dt);
			player.position.add(tmpMove);
		}
	}

	camera.position.copy(player.position);
}
```

- [ ] **Step 2: Wire `player.ts` into `src/main.ts`**

Update `main.ts`. The full file at this point should be:

```typescript
import {
	AmbientLight,
	Clock,
	FogExp2,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	WebGLRenderer,
} from "three";
import { buildForest } from "./forest";
import { attachPlayerInput, createPlayer, updatePlayer } from "./player";

const scene = new Scene();
scene.fog = new FogExp2(0x050a08, 0.05);

const camera = new PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	500,
);
camera.position.set(0, 1.7, 0);
scene.add(camera);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x050a08);
document.body.appendChild(renderer.domElement);

const ground = new Mesh(
	new PlaneGeometry(220, 220),
	new MeshStandardMaterial({ color: 0x0a1408 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

scene.add(new AmbientLight(0xffffff, 0.08));
scene.add(new HemisphereLight(0x0a0a14, 0x020402, 0.05));

const forest = buildForest(scene);
void forest;

const player = createPlayer();
attachPlayerInput(renderer.domElement, player);

const clock = new Clock();
function animate() {
	requestAnimationFrame(animate);
	const dt = clock.getDelta();
	updatePlayer(player, camera, dt);
	renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
```

- [ ] **Step 3: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 4: Smoke test in the browser**

```bash
cd nova-games/grant-woodland-virus && pnpm dev
```
Open the page. Click the canvas (pointer lock engages — cursor disappears). Expected:
- W moves you forward, S backward, A strafes left, D strafes right.
- Mouse left/right turns yaw; mouse up/down turns pitch but clamps before flipping (~85°).
- You can walk **through** trees (collision is in Task 4).
- Esc unlocks pointer; movement freezes until you click again.

- [ ] **Step 5: Commit**

```bash
git add nova-games/grant-woodland-virus/src/player.ts nova-games/grant-woodland-virus/src/main.ts
git commit -m "grant-woodland-virus: add WASD + mouse-look first-person controls"
```

---

## Task 4: Tree & boundary collision

Adds collision against tree colliders + the world bounds. Player has a 0.3 m radius; trees have 0.5 m; threshold is the sum (0.8 m). Resolution is iterative push-out (3 passes per frame) so the player slides smoothly between trees instead of getting stuck.

**Files:**
- Modify: `nova-games/grant-woodland-virus/src/player.ts` (extend `updatePlayer` signature)
- Modify: `nova-games/grant-woodland-virus/src/main.ts` (pass forest to `updatePlayer`)

- [ ] **Step 1: Extend `player.ts` with collision resolution**

Add this near the constants at the top of `player.ts`:

```typescript
const PLAYER_RADIUS = 0.3;
```

Add this import alongside the existing `three` import:

```typescript
import { type PerspectiveCamera, Vector3 } from "three";
import type { TreeCollider } from "./forest";
```

Add the resolver function above `updatePlayer`:

```typescript
export type World = {
	colliders: TreeCollider[];
	bounds: { halfX: number; halfZ: number };
};

function resolveCollision(position: Vector3, world: World) {
	for (let pass = 0; pass < 3; pass++) {
		let pushed = false;
		for (const c of world.colliders) {
			const dx = position.x - c.x;
			const dz = position.z - c.z;
			const dist = Math.hypot(dx, dz);
			const minDist = c.radius + PLAYER_RADIUS;
			if (dist < minDist && dist > 0.0001) {
				const push = minDist - dist;
				position.x += (dx / dist) * push;
				position.z += (dz / dist) * push;
				pushed = true;
			}
		}
		if (!pushed) break;
	}

	const limitX = world.bounds.halfX - PLAYER_RADIUS;
	const limitZ = world.bounds.halfZ - PLAYER_RADIUS;
	if (position.x > limitX) position.x = limitX;
	if (position.x < -limitX) position.x = -limitX;
	if (position.z > limitZ) position.z = limitZ;
	if (position.z < -limitZ) position.z = -limitZ;
}
```

Update `updatePlayer` to accept `world` and call the resolver after movement:

```typescript
export function updatePlayer(
	player: PlayerState,
	camera: PerspectiveCamera,
	dt: number,
	world: World,
) {
	camera.rotation.order = "YXZ";
	camera.rotation.set(player.pitch, player.yaw, 0);

	if (document.pointerLockElement) {
		camera.getWorldDirection(tmpForward);
		tmpForward.y = 0;
		tmpForward.normalize();
		tmpRight.set(-tmpForward.z, 0, tmpForward.x);

		tmpMove.set(0, 0, 0);
		if (keys.w) tmpMove.add(tmpForward);
		if (keys.s) tmpMove.sub(tmpForward);
		if (keys.d) tmpMove.add(tmpRight);
		if (keys.a) tmpMove.sub(tmpRight);

		if (tmpMove.lengthSq() > 0) {
			tmpMove.normalize().multiplyScalar(WALK_SPEED * dt);
			player.position.add(tmpMove);
		}

		resolveCollision(player.position, world);
	}

	camera.position.copy(player.position);
}
```

- [ ] **Step 2: Pass `forest` to `updatePlayer` in `main.ts`**

Replace the line `void forest;` with nothing (delete it) and update the animate body:

```typescript
function animate() {
	requestAnimationFrame(animate);
	const dt = clock.getDelta();
	updatePlayer(player, camera, dt, forest);
	renderer.render(scene, camera);
}
```

- [ ] **Step 3: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 4: Smoke test in the browser**

Run `pnpm dev`, click to lock, walk into trees. Expected:
- Walking head-on into a tree stops you at the trunk; you can slide along it.
- Walking past a cluster of trees doesn't snag — you slide between them.
- Walking toward the edge of the world stops you at ±100 m.

- [ ] **Step 5: Commit**

```bash
git add nova-games/grant-woodland-virus/src/player.ts nova-games/grant-woodland-virus/src/main.ts
git commit -m "grant-woodland-virus: collide player with trees and world bounds"
```

---

## Task 5: Flashlight (camera-mounted SpotLight)

Adds a warm-white spotlight parented to the camera so it points wherever the player looks. Range ~25 m matches the fog falloff so the cone is the player's main visibility window.

**Files:**
- Modify: `nova-games/grant-woodland-virus/src/main.ts`

- [ ] **Step 1: Add the SpotLight to `main.ts`**

Update the `three` import to include `SpotLight`:

```typescript
import {
	AmbientLight,
	Clock,
	FogExp2,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	SpotLight,
	WebGLRenderer,
} from "three";
```

Add the flashlight setup right after the `HemisphereLight` line:

```typescript
const flashlight = new SpotLight(
	0xfff2cc,
	3,
	25,
	(25 / 180) * Math.PI,
	0.4,
	1.5,
);
flashlight.position.set(0, -0.3, 0);
flashlight.target.position.set(0, -0.3, -1);
camera.add(flashlight);
camera.add(flashlight.target);
```

- [ ] **Step 2: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 3: Smoke test in the browser**

Run `pnpm dev`. Expected:
- A clear bright cone illuminates the area in front of the camera, lighting trunks and canopies as you point at them.
- Looking at the dark sky-fade direction shows the cone tracking with mouse pitch.
- Outside the cone everything fades to near-black with the fog.

- [ ] **Step 4: Commit**

```bash
git add nova-games/grant-woodland-virus/src/main.ts
git commit -m "grant-woodland-virus: add camera-mounted flashlight"
```

---

## Task 6: Stamina + sprint (Q key)

Adds stamina to `PlayerState`, Q-key tracking, and sprint speed. Drains 25/s while sprinting; regenerates 15/s any time the player isn't actively sprinting (whether moving or still). Sprint requires Q held + non-zero movement input + stamina > 0. No HUD yet — that comes in Task 7.

**Files:**
- Modify: `nova-games/grant-woodland-virus/src/player.ts`

- [ ] **Step 1: Update constants at the top of `player.ts`**

Replace the constants block with:

```typescript
const PITCH_LIMIT = (85 / 180) * Math.PI;
const MOUSE_SENSITIVITY = 0.002;
const WALK_SPEED = 4;
const SPRINT_SPEED = 7;
const EYE_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.3;
const STAMINA_MAX = 100;
const STAMINA_DRAIN = 25;
const STAMINA_REGEN = 15;
```

- [ ] **Step 2: Add `stamina` to `PlayerState` and reset**

```typescript
export type PlayerState = {
	position: Vector3;
	yaw: number;
	pitch: number;
	stamina: number;
};

export function createPlayer(): PlayerState {
	return {
		position: new Vector3(0, EYE_HEIGHT, 0),
		yaw: 0,
		pitch: 0,
		stamina: STAMINA_MAX,
	};
}

export function resetPlayer(player: PlayerState) {
	player.position.set(0, EYE_HEIGHT, 0);
	player.yaw = 0;
	player.pitch = 0;
	player.stamina = STAMINA_MAX;
}
```

- [ ] **Step 3: Track the Q key**

Update the `Keys` type and the keydown/keyup handlers:

```typescript
type Keys = { w: boolean; a: boolean; s: boolean; d: boolean; q: boolean };
const keys: Keys = { w: false, a: false, s: false, d: false, q: false };
```

Add a `q` branch in both keydown and keyup handlers:

```typescript
	window.addEventListener("keydown", (e) => {
		const k = e.key.toLowerCase();
		if (k === "w") keys.w = true;
		else if (k === "a") keys.a = true;
		else if (k === "s") keys.s = true;
		else if (k === "d") keys.d = true;
		else if (k === "q") keys.q = true;
	});
	window.addEventListener("keyup", (e) => {
		const k = e.key.toLowerCase();
		if (k === "w") keys.w = false;
		else if (k === "a") keys.a = false;
		else if (k === "s") keys.s = false;
		else if (k === "d") keys.d = false;
		else if (k === "q") keys.q = false;
	});
```

- [ ] **Step 4: Apply sprint speed and stamina tick in `updatePlayer`**

Replace the movement block inside `updatePlayer`'s `if (document.pointerLockElement)` so it reads:

```typescript
	if (document.pointerLockElement) {
		camera.getWorldDirection(tmpForward);
		tmpForward.y = 0;
		tmpForward.normalize();
		tmpRight.set(-tmpForward.z, 0, tmpForward.x);

		tmpMove.set(0, 0, 0);
		if (keys.w) tmpMove.add(tmpForward);
		if (keys.s) tmpMove.sub(tmpForward);
		if (keys.d) tmpMove.add(tmpRight);
		if (keys.a) tmpMove.sub(tmpRight);

		const moving = tmpMove.lengthSq() > 0;
		const sprinting = moving && keys.q && player.stamina > 0;

		if (sprinting) {
			player.stamina -= STAMINA_DRAIN * dt;
			if (player.stamina < 0) player.stamina = 0;
		} else {
			player.stamina += STAMINA_REGEN * dt;
			if (player.stamina > STAMINA_MAX) player.stamina = STAMINA_MAX;
		}

		if (moving) {
			const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
			tmpMove.normalize().multiplyScalar(speed * dt);
			player.position.add(tmpMove);
		}

		resolveCollision(player.position, world);
	}
```

- [ ] **Step 5: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 6: Smoke test in the browser**

Open dev server, click to lock. Hold W; you walk. Now hold W+Q. Expected:
- You move noticeably faster (speed jumps from 4 → 7 m/s).
- After ~4 seconds of sustained sprint, sprint stops working (stamina hits 0).
- Releasing Q for a few seconds restores sprint capability.

You can verify stamina by adding a temporary `console.log` in `updatePlayer` or by inspecting the value in the next task's HUD. **Don't commit the console.log.**

- [ ] **Step 7: Commit**

```bash
git add nova-games/grant-woodland-virus/src/player.ts
git commit -m "grant-woodland-virus: add Q-to-sprint with stamina drain and regen"
```

---

## Task 7: UI module (title, stamina bar, win)

Adds a `ui.ts` module that builds DOM overlays sitting above the canvas: a title screen ("The Woodland Virus" + Start Game), a stamina bar (top-left), and a win screen ("You Survived" + Play Again). Exposes a small API the state machine (Task 8) drives.

The DOM lives directly on `<body>` next to the canvas. Buttons receive callbacks so `main.ts` controls transitions.

**Files:**
- Create: `nova-games/grant-woodland-virus/src/ui.ts`
- Modify: `nova-games/grant-woodland-virus/src/main.ts` (call `createUI()` and show the title initially; display live stamina value each frame)

- [ ] **Step 1: Create `src/ui.ts`**

```typescript
const CONTAINER_STYLE = `
	position: fixed;
	inset: 0;
	display: none;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	gap: 24px;
	font-family: Georgia, "Times New Roman", serif;
	color: #d4d4cc;
	pointer-events: auto;
	user-select: none;
`;

const TITLE_BG = `
	background: radial-gradient(circle at 50% 40%, rgba(8, 14, 10, 0.6), rgba(0, 0, 0, 0.95));
`;

const WIN_BG = `
	background: radial-gradient(circle at 50% 40%, rgba(6, 24, 12, 0.6), rgba(0, 0, 0, 0.95));
`;

const BUTTON_STYLE = `
	font: inherit;
	font-size: 22px;
	padding: 12px 32px;
	color: #d4d4cc;
	background: rgba(20, 30, 22, 0.7);
	border: 1px solid #4a6450;
	border-radius: 4px;
	cursor: pointer;
	letter-spacing: 0.05em;
`;

const TITLE_TEXT_STYLE = `
	font-size: 64px;
	letter-spacing: 0.12em;
	text-shadow: 0 0 20px rgba(20, 60, 30, 0.6);
	margin: 0;
`;

const SUBTITLE_STYLE = `
	font-size: 16px;
	color: #8a8a82;
	margin: 0;
	max-width: 400px;
	text-align: center;
	line-height: 1.5;
`;

const STAMINA_WRAP_STYLE = `
	position: fixed;
	top: 16px;
	left: 16px;
	width: 200px;
	height: 16px;
	background: rgba(0, 0, 0, 0.55);
	border: 1px solid #4a6450;
	border-radius: 3px;
	display: none;
	overflow: hidden;
	font-family: Georgia, "Times New Roman", serif;
`;

const STAMINA_FILL_STYLE = `
	height: 100%;
	width: 100%;
	background: linear-gradient(to right, #6cdc7a, #2a8a3a);
	transition: width 0.05s linear, background 0.2s linear;
`;

const RESUME_HINT_STYLE = `
	position: fixed;
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	padding: 14px 28px;
	background: rgba(0, 0, 0, 0.7);
	border: 1px solid #4a6450;
	border-radius: 4px;
	color: #d4d4cc;
	font-family: Georgia, "Times New Roman", serif;
	font-size: 18px;
	letter-spacing: 0.05em;
	display: none;
	pointer-events: none;
	user-select: none;
`;

export type UI = {
	setStamina: (value: number, max: number) => void;
	setStaminaVisible: (visible: boolean) => void;
	setResumeHintVisible: (visible: boolean) => void;
	showTitle: (onStart: () => void) => void;
	hideTitle: () => void;
	showWin: (onPlayAgain: () => void) => void;
	hideWin: () => void;
};

function makeOverlay(bgStyle: string): HTMLDivElement {
	const div = document.createElement("div");
	div.setAttribute("style", CONTAINER_STYLE + bgStyle);
	return div;
}

function makeButton(label: string): HTMLButtonElement {
	const btn = document.createElement("button");
	btn.type = "button";
	btn.textContent = label;
	btn.setAttribute("style", BUTTON_STYLE);
	return btn;
}

export function createUI(): UI {
	// Title overlay
	const title = makeOverlay(TITLE_BG);
	const titleHeading = document.createElement("h1");
	titleHeading.textContent = "The Woodland Virus";
	titleHeading.setAttribute("style", TITLE_TEXT_STYLE);
	title.appendChild(titleHeading);
	const titleHint = document.createElement("p");
	titleHint.textContent =
		"WASD to move. Mouse to look. Hold Q to sprint. Reach the green flag.";
	titleHint.setAttribute("style", SUBTITLE_STYLE);
	title.appendChild(titleHint);
	const startButton = makeButton("Start Game");
	title.appendChild(startButton);
	document.body.appendChild(title);

	// Win overlay
	const win = makeOverlay(WIN_BG);
	const winHeading = document.createElement("h1");
	winHeading.textContent = "You Survived";
	winHeading.setAttribute("style", TITLE_TEXT_STYLE);
	win.appendChild(winHeading);
	const playAgainButton = makeButton("Play Again");
	win.appendChild(playAgainButton);
	document.body.appendChild(win);

	// Stamina bar
	const staminaWrap = document.createElement("div");
	staminaWrap.setAttribute("style", STAMINA_WRAP_STYLE);
	const staminaFill = document.createElement("div");
	staminaFill.setAttribute("style", STAMINA_FILL_STYLE);
	staminaWrap.appendChild(staminaFill);
	document.body.appendChild(staminaWrap);

	// Resume hint
	const resumeHint = document.createElement("div");
	resumeHint.setAttribute("style", RESUME_HINT_STYLE);
	resumeHint.textContent = "Click to resume";
	document.body.appendChild(resumeHint);

	let startHandler: (() => void) | null = null;
	let playAgainHandler: (() => void) | null = null;

	startButton.addEventListener("click", () => {
		startHandler?.();
	});
	playAgainButton.addEventListener("click", () => {
		playAgainHandler?.();
	});

	return {
		setStamina(value, max) {
			const ratio = Math.max(0, Math.min(1, value / max));
			staminaFill.style.width = `${ratio * 100}%`;
			if (ratio < 0.25) {
				staminaFill.style.background =
					"linear-gradient(to right, #c44, #722)";
			} else {
				staminaFill.style.background =
					"linear-gradient(to right, #6cdc7a, #2a8a3a)";
			}
		},
		setStaminaVisible(visible) {
			staminaWrap.style.display = visible ? "block" : "none";
		},
		setResumeHintVisible(visible) {
			resumeHint.style.display = visible ? "block" : "none";
		},
		showTitle(onStart) {
			startHandler = onStart;
			title.style.display = "flex";
		},
		hideTitle() {
			title.style.display = "none";
		},
		showWin(onPlayAgain) {
			playAgainHandler = onPlayAgain;
			win.style.display = "flex";
		},
		hideWin() {
			win.style.display = "none";
		},
	};
}
```

- [ ] **Step 2: Wire UI into `main.ts` (preview only — full state machine in Task 8)**

Add the import:

```typescript
import { createUI } from "./ui";
```

Add this right after `attachPlayerInput(...)`:

```typescript
const ui = createUI();
ui.setStaminaVisible(true);
ui.showTitle(() => {
	ui.hideTitle();
});
```

Add live stamina updates inside the animate loop (after `updatePlayer`):

```typescript
ui.setStamina(player.stamina, 100);
```

This is a temporary preview wiring — Task 8 replaces the inline `showTitle(...)` callback with proper state-machine transitions.

- [ ] **Step 3: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 4: Smoke test in the browser**

Run `pnpm dev`. Expected:
- Title overlay appears centered with "The Woodland Virus" + "Start Game" button.
- Stamina bar visible top-left, full green.
- Clicking "Start Game" hides the title overlay (no pointer lock yet — Task 8).
- After Start, you can click the canvas to lock and walk; sprint causes the bar to drain (color shifts toward red below 25%).

- [ ] **Step 5: Commit**

```bash
git add nova-games/grant-woodland-virus/src/ui.ts nova-games/grant-woodland-virus/src/main.ts
git commit -m "grant-woodland-virus: add title, stamina bar, and win overlays"
```

---

## Task 8: State machine + win condition + Play Again

Wires `TITLE → PLAYING → WIN → TITLE`. Pointer-lock requested only when Start is clicked. Win triggers when player gets within 1.5 m of the flag. Play Again resets player state and returns to Title.

**Files:**
- Modify: `nova-games/grant-woodland-virus/src/main.ts`
- Modify: `nova-games/grant-woodland-virus/src/player.ts` (expose a way to disable input on key state when not playing)

- [ ] **Step 1: Add a "playing" gate to `player.ts`**

The simplest way to prevent movement in non-PLAYING states is to skip the `updatePlayer` movement branch unless an externally-set flag is true. Add a module-level flag and exporter at the top of `player.ts` (just under the `keys` declaration):

```typescript
let inputActive = false;

export function setInputActive(active: boolean) {
	inputActive = active;
	if (!active) {
		keys.w = false;
		keys.a = false;
		keys.s = false;
		keys.d = false;
		keys.q = false;
	}
}
```

Update the `if (document.pointerLockElement)` line in `updatePlayer` to also require `inputActive`:

```typescript
	if (document.pointerLockElement && inputActive) {
```

Also, the click-to-lock canvas listener should only request a lock when input is active. Update the canvas click handler:

```typescript
	canvas.addEventListener("click", () => {
		if (!inputActive) return;
		if (document.pointerLockElement !== canvas) {
			canvas.requestPointerLock();
		}
	});
```

- [ ] **Step 2: Replace the wiring block in `main.ts` with the state machine**

Replace the temporary preview block from Task 7 (the `ui.showTitle(...)` block and the existing `attachPlayerInput`/`createUI` wiring) so the full file reads:

```typescript
import {
	AmbientLight,
	Clock,
	FogExp2,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	SpotLight,
	WebGLRenderer,
} from "three";
import { buildForest } from "./forest";
import {
	attachPlayerInput,
	createPlayer,
	resetPlayer,
	setInputActive,
	updatePlayer,
} from "./player";
import { createUI } from "./ui";

type GameState = "title" | "playing" | "win";

const scene = new Scene();
scene.fog = new FogExp2(0x050a08, 0.05);

const camera = new PerspectiveCamera(
	75,
	window.innerWidth / window.innerHeight,
	0.1,
	500,
);
camera.position.set(0, 1.7, 0);
scene.add(camera);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x050a08);
document.body.appendChild(renderer.domElement);

const ground = new Mesh(
	new PlaneGeometry(220, 220),
	new MeshStandardMaterial({ color: 0x0a1408 }),
);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

scene.add(new AmbientLight(0xffffff, 0.08));
scene.add(new HemisphereLight(0x0a0a14, 0x020402, 0.05));

const flashlight = new SpotLight(
	0xfff2cc,
	3,
	25,
	(25 / 180) * Math.PI,
	0.4,
	1.5,
);
flashlight.position.set(0, -0.3, 0);
flashlight.target.position.set(0, -0.3, -1);
camera.add(flashlight);
camera.add(flashlight.target);

const forest = buildForest(scene);
const player = createPlayer();
attachPlayerInput(renderer.domElement, player);
const ui = createUI();

let state: GameState = "title";

function enterTitle() {
	state = "title";
	setInputActive(false);
	if (document.pointerLockElement) document.exitPointerLock();
	ui.hideWin();
	ui.setStaminaVisible(false);
	ui.setResumeHintVisible(false);
	ui.showTitle(() => {
		enterPlaying();
	});
}

function enterPlaying() {
	state = "playing";
	resetPlayer(player);
	ui.hideTitle();
	ui.setStaminaVisible(true);
	ui.setResumeHintVisible(false);
	setInputActive(true);
	renderer.domElement.requestPointerLock();
}

function enterWin() {
	state = "win";
	setInputActive(false);
	if (document.pointerLockElement) document.exitPointerLock();
	ui.setStaminaVisible(false);
	ui.setResumeHintVisible(false);
	ui.showWin(() => {
		enterTitle();
	});
}

document.addEventListener("pointerlockchange", () => {
	if (state !== "playing") return;
	ui.setResumeHintVisible(document.pointerLockElement !== renderer.domElement);
});

enterTitle();

const clock = new Clock();
function animate() {
	requestAnimationFrame(animate);
	const dt = clock.getDelta();
	updatePlayer(player, camera, dt, forest);
	if (state === "playing") {
		ui.setStamina(player.stamina, 100);
		const dx = player.position.x - forest.flagPosition.x;
		const dz = player.position.z - forest.flagPosition.z;
		if (Math.hypot(dx, dz) < 1.5) {
			enterWin();
		}
	}
	renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
```

- [ ] **Step 3: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS. If `tsc` complains about missing exports (`resetPlayer`, `setInputActive`), confirm Task 6 / Task 8 Step 1 added those — re-export from `player.ts` if needed.

- [ ] **Step 4: Smoke test in the browser**

Run `pnpm dev`. Expected, in order:
1. Title overlay appears; stamina bar hidden; canvas behind shows the dark forest but you cannot move.
2. Click "Start Game" → title hides, pointer locks, stamina bar appears, you spawn at (0, 1.7, 0) facing +Z, and you can walk.
3. Walking ~90 m to roughly (63, _, 63) (sprint helps) brings the green flag into view through the fog.
4. Touching the flag (within 1.5 m) → pointer unlocks, stamina bar hides, "You Survived" + "Play Again" overlay appears.
5. Click "Play Again" → win overlay hides, title overlay reappears, player is back at spawn.
6. Click Start again → fresh run resets stamina to full and player to spawn.
7. During play, pressing Esc unlocks the pointer, freezes movement, and shows a centered "Click to resume" hint; clicking the canvas re-locks, hides the hint, and resumes movement.

- [ ] **Step 5: Commit**

```bash
git add nova-games/grant-woodland-virus/src/main.ts nova-games/grant-woodland-virus/src/player.ts
git commit -m "grant-woodland-virus: wire title/playing/win state machine"
```

---

## Task 9: Final polish + repo-level build verify

Tune anything that felt off in the playthrough (fog density, flashlight cone, mouse sensitivity, flag distance). Then verify the full repo build pipeline, including the `build-games.mjs` orchestrator that copies the kid's `dist/` into `dist/nova-games/grant-woodland-virus/`.

**Files (potentially):**
- Modify: `nova-games/grant-woodland-virus/src/main.ts` (any tuning)
- Modify: `nova-games/grant-woodland-virus/src/player.ts` (any tuning)
- Modify: `nova-games/grant-woodland-virus/src/forest.ts` (any tuning)

- [ ] **Step 1: Playtest and tune**

Run `pnpm dev` from inside the kid's workspace. Walk through a full TITLE→PLAYING→WIN→TITLE→PLAYING loop. Note anything that feels off:

| Symptom                                   | Knob                                                 |
| ----------------------------------------- | ---------------------------------------------------- |
| Fog too dense (can't see anything)        | `FogExp2` density in `main.ts` (lower from `0.05`)   |
| Fog too thin (forest doesn't feel scary)  | Density up                                           |
| Flashlight cone too narrow                | Spot angle in `main.ts` (currently `25°`)            |
| Flashlight too dim                        | Spot intensity (currently `3`)                       |
| Mouse too sensitive                       | `MOUSE_SENSITIVITY` in `player.ts` (currently 0.002) |
| Sprint too short / too long               | `STAMINA_DRAIN` / `STAMINA_REGEN` in `player.ts`     |
| Flag too easy to find / too hard to find  | `FLAG_X` / `FLAG_Z` in `forest.ts`                   |
| Trees feel too sparse / too dense         | `TREE_COUNT_TARGET` / `TREE_MIN_SPACING` in `forest.ts` |

Make any small adjustments. Re-run `pnpm test` after each tweak.

- [ ] **Step 2: Verify repo-level build**

```bash
pnpm test
pnpm build
```
Expected:
- `pnpm test` passes (typecheck + lint on the whole repo).
- `pnpm build` runs `tsc && vite build && pnpm run build:games`. The build-games orchestrator should report `grant-woodland-virus` in the succeeded list and produce `dist/nova-games/grant-woodland-virus/index.html` plus its bundled assets.

- [ ] **Step 3: Smoke test the production build locally**

```bash
cd nova-games/grant-woodland-virus
pnpm preview
```
Open the URL printed (usually `http://localhost:4173/`). Run through the same flow as the dev smoke test in Task 8 Step 4. Expected: identical behavior to dev mode.

- [ ] **Step 4: Add a card to the landing page (optional but recommended)**

Open `nova-games/index.html`, find the `.game-grid` section, and add a card if grant-woodland-virus isn't already listed:

```html
<a href="./grant-woodland-virus/" class="game-card">
	<span class="game-title">The Woodland Virus</span>
	<span class="game-author">by Grant</span>
	<span class="game-engine">Three.js</span>
</a>
```

(Skip this step if a card already exists. Verify with: `grep grant-woodland-virus nova-games/index.html`.)

- [ ] **Step 5: Commit any tuning + landing-page changes**

```bash
git add nova-games/grant-woodland-virus/src nova-games/index.html
git commit -m "grant-woodland-virus: tune slice and list on landing page"
```

(If there were no changes in Step 1 and Step 4 was skipped, no commit needed — proceed to PR.)

---

## Done criteria (matches design's success criteria)

A reviewer playing the slice from a fresh checkout should be able to:

1. ✅ `pnpm install && pnpm dev` from inside the kid's workspace loads the title screen.
2. ✅ Title shows "The Woodland Virus" + Start button over the dark forest.
3. ✅ Click Start → pointer locks, walking enabled.
4. ✅ WASD moves, mouse looks, pitch clamped at ±85°.
5. ✅ Q-sprint drains stamina; releasing or hitting 0 returns to walk; stamina regenerates.
6. ✅ Flashlight illuminates a forward cone; outside the cone fades into fog.
7. ✅ Trees and world bounds block the player.
8. ✅ Touching the flag triggers Win overlay with Play Again.
9. ✅ Play Again resets to Title with player at spawn and stamina full.
10. ✅ `pnpm test` and `pnpm build` from the repo root both pass.

---

## Out of scope (next PR)

Per the design doc, the following are **explicitly deferred** to the follow-up PR and must NOT be added by this plan:

- Monster (deer-skull primitive build, follow AI, contact-triggered jumpscare)
- Hollow logs and the E-to-hide / E-to-exit interaction
- Web Audio breathing synth with distance-based gain
- Jumpscare animation/screen
- LOSE state and Title/New-Game buttons after the jumpscare
- Flashlight battery / toggle / footstep / wind audio

If during implementation you find yourself wanting to add scaffolding for these, stop and re-read the design — the slice's modules are designed so each of these slots in cleanly without touching what this plan ships.
