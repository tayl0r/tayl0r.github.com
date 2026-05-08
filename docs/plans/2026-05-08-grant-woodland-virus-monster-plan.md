# grant-woodland-virus monster + jumpscare — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the monster + audio + hollow logs + jumpscare + LOSE state described in `docs/plans/2026-05-08-grant-woodland-virus-monster-design.md` so the project matches Grant's original prompt feature-for-feature.

**Architecture:** Extend the four slice modules (`main.ts`, `forest.ts`, `player.ts`, `ui.ts`) and add two new ones (`monster.ts`, `audio.ts`). `monster.ts` owns the deer-skull primitive build + simple chase AI. `audio.ts` is a pure Web Audio module: brown-noise breathing modulated by a slow LFO, plus a one-shot scream. `forest.ts` rejection-samples ~12 hollow logs alongside its trees. `player.ts` gains a `hidden` flag and an E-key handler. `main.ts` adds a LOSE state, drives audio lifecycle, runs the per-frame contact + win checks, and orchestrates the jumpscare DOM sequence.

**Tech Stack:** Three.js 0.164, TypeScript 5.9, Vite 7, Web Audio API. No new dependencies.

**Code style notes for every task:**
- Use **tab indentation** in all `.ts` files (biome enforces this).
- Use `import type { ... }` for type-only imports (biome's `useImportType`).
- Sort imports alphabetically inside each `from "..."` group.
- Run `pnpm test` from the repo root after every task; fix any biome/tsc complaints before committing.
- Run the dev server with `pnpm dev` from inside `nova-games/grant-woodland-virus/`.

---

## File map (after this plan)

```
nova-games/grant-woodland-virus/
  src/
    main.ts        EXTENDED — add LOSE state, jumpscare, monster + audio wiring
    forest.ts      EXTENDED — generate ~12 hollow logs
    player.ts      EXTENDED — hidden flag, E key, hide/unhide
    ui.ts          EXTENDED — hide prompt, jumpscare, LOSE overlays
    monster.ts     NEW — deer-skull primitive build + chase AI
    audio.ts       NEW — Web Audio breathing + scream
```

---

## Task 1: Audio module (standalone)

Build the Web Audio module first since it's pure synthesis with zero game dependencies. After this task the file exists, exports `startBreathing`, `setBreathingGain`, `playScream`, `stopAll`. Nothing in main.ts uses it yet.

**Files:**
- Create: `nova-games/grant-woodland-virus/src/audio.ts`

- [ ] **Step 1: Create `src/audio.ts`**

Use this EXACT content:

```typescript
let ctx: AudioContext | null = null;
let outerGain: GainNode | null = null;

function makeBrownNoiseBuffer(audio: AudioContext, seconds: number): AudioBuffer {
	const length = Math.floor(seconds * audio.sampleRate);
	const buffer = audio.createBuffer(1, length, audio.sampleRate);
	const data = buffer.getChannelData(0);
	let last = 0;
	for (let i = 0; i < length; i++) {
		const white = Math.random() * 2 - 1;
		last = (last + 0.02 * white) / 1.02;
		data[i] = last * 3.5;
	}
	return buffer;
}

export function startBreathing(): void {
	if (ctx) return;
	const audio = new AudioContext();
	ctx = audio;

	const noise = audio.createBufferSource();
	noise.buffer = makeBrownNoiseBuffer(audio, 2);
	noise.loop = true;

	const lowpass = audio.createBiquadFilter();
	lowpass.type = "lowpass";
	lowpass.frequency.value = 600;
	lowpass.Q.value = 1;

	const breathMod = audio.createGain();
	breathMod.gain.value = 0.5;

	const lfo = audio.createOscillator();
	lfo.type = "sine";
	lfo.frequency.value = 0.33;

	const lfoGain = audio.createGain();
	lfoGain.gain.value = 0.5;

	const master = audio.createGain();
	master.gain.value = 0;
	outerGain = master;

	noise.connect(lowpass);
	lowpass.connect(breathMod);
	breathMod.connect(master);
	master.connect(audio.destination);

	lfo.connect(lfoGain);
	lfoGain.connect(breathMod.gain);

	noise.start();
	lfo.start();
}

export function setBreathingGain(gain01: number): void {
	if (!ctx || !outerGain) return;
	const clamped = Math.max(0, Math.min(1, gain01));
	outerGain.gain.setTargetAtTime(clamped, ctx.currentTime, 0.05);
}

export function playScream(): void {
	if (!ctx) return;
	const audio = ctx;
	const now = audio.currentTime;

	const osc1 = audio.createOscillator();
	osc1.type = "sawtooth";
	osc1.frequency.setValueAtTime(150, now);
	osc1.frequency.exponentialRampToValueAtTime(70, now + 1.0);

	const osc2 = audio.createOscillator();
	osc2.type = "square";
	osc2.frequency.setValueAtTime(170, now);
	osc2.frequency.exponentialRampToValueAtTime(80, now + 1.0);

	const filter = audio.createBiquadFilter();
	filter.type = "bandpass";
	filter.Q.value = 2;
	filter.frequency.setValueAtTime(1500, now);
	filter.frequency.linearRampToValueAtTime(400, now + 1.0);

	const env = audio.createGain();
	env.gain.setValueAtTime(0, now);
	env.gain.linearRampToValueAtTime(0.8, now + 0.05);
	env.gain.linearRampToValueAtTime(0, now + 1.2);

	osc1.connect(filter);
	osc2.connect(filter);
	filter.connect(env);
	env.connect(audio.destination);

	osc1.start(now);
	osc2.start(now);
	osc1.stop(now + 1.3);
	osc2.stop(now + 1.3);
}

export function stopAll(): void {
	if (!ctx || !outerGain) return;
	outerGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
}
```

- [ ] **Step 2: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS. (Biome's `noUnusedVariables` may complain because `audio.ts` is not imported anywhere yet — if so, that's normal; biome only flags unused locals, not unused exports. If it does complain, double-check you're not importing audio.ts from somewhere by accident.)

- [ ] **Step 3: Commit**

```bash
git add nova-games/grant-woodland-virus/src/audio.ts
git commit -m "$(cat <<'EOF'
grant-woodland-virus: add Web Audio breathing + scream module

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Hollow logs in forest

Extend `forest.ts` to also rejection-sample ~12 hollow log positions and render them as horizontal cylinder pairs (outer + inverted-normal inner for the dark hollow). Expose log positions on the `Forest` type so `main.ts` and `player.ts` can iterate them.

**Files:**
- Modify: `nova-games/grant-woodland-virus/src/forest.ts`

- [ ] **Step 1: Extend `forest.ts`**

The current file (post-slice) imports `BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, type Object3D, type Scene, Vector3` from "three" and exports `TreeCollider`, `Forest`, `buildForest`. We need:

1. Add `BackSide` to the `from "three"` import (alphabetical).
2. Add a new exported type `LogTransform` near the top, next to `TreeCollider`:

```typescript
export type LogTransform = {
	x: number;
	z: number;
	angle: number;
};
```

3. Extend the `Forest` type with a `logs` field:

```typescript
export type Forest = {
	colliders: TreeCollider[];
	flagPosition: Vector3;
	bounds: { halfX: number; halfZ: number };
	logs: LogTransform[];
};
```

4. Add log-related constants near the existing tree constants:

```typescript
const LOG_COUNT_TARGET = 12;
const LOG_LENGTH = 3;
const LOG_RADIUS = 1.2;
const LOG_MIN_SPACING = 4;
const LOG_TREE_CLEARANCE = 1.5;
const LOG_SPAWN_CLEARANCE = 3;
const LOG_FLAG_CLEARANCE = 4;
```

5. Add log materials near the tree/flag materials:

```typescript
const logOuterMaterial = new MeshStandardMaterial({ color: 0x2c1c10 });
const logInnerMaterial = new MeshStandardMaterial({
	color: 0x080404,
	side: BackSide,
});
```

6. Add a `makeLog(t: LogTransform)` helper alongside `makeTree` / `makeFlag`:

```typescript
function makeLog(t: LogTransform): Object3D {
	const group = new Group();

	const outer = new Mesh(
		new CylinderGeometry(LOG_RADIUS, LOG_RADIUS, LOG_LENGTH, 12, 1, true),
		logOuterMaterial,
	);
	outer.rotation.z = Math.PI / 2;
	group.add(outer);

	const inner = new Mesh(
		new CylinderGeometry(
			LOG_RADIUS - 0.02,
			LOG_RADIUS - 0.02,
			LOG_LENGTH - 0.05,
			12,
			1,
			true,
		),
		logInnerMaterial,
	);
	inner.rotation.z = Math.PI / 2;
	group.add(inner);

	group.position.set(t.x, LOG_RADIUS, t.z);
	group.rotation.y = t.angle;
	return group;
}
```

7. Update `buildForest(scene)` so it ALSO generates and renders the logs. The existing function ends with `return { colliders, flagPosition: ..., bounds: ... };` — we need to add log placement before the return and include `logs` in the returned object.

After the `for (const { x, z } of positions)` loop (which adds trees) and the `scene.add(makeFlag(FLAG_X, FLAG_Z));` line, add this log-placement block:

```typescript
const logs: LogTransform[] = [];
let logAttempts = 0;
const maxLogAttempts = 4000;
while (logs.length < LOG_COUNT_TARGET && logAttempts < maxLogAttempts) {
	logAttempts++;
	const x = (Math.random() * 2 - 1) * AREA_HALF * 0.95;
	const z = (Math.random() * 2 - 1) * AREA_HALF * 0.95;

	if (Math.hypot(x, z) < LOG_SPAWN_CLEARANCE) continue;
	if (Math.hypot(x - FLAG_X, z - FLAG_Z) < LOG_FLAG_CLEARANCE) continue;

	let tooCloseToTree = false;
	for (const c of colliders) {
		if (Math.hypot(x - c.x, z - c.z) < LOG_TREE_CLEARANCE) {
			tooCloseToTree = true;
			break;
		}
	}
	if (tooCloseToTree) continue;

	let tooCloseToLog = false;
	for (const other of logs) {
		if (Math.hypot(x - other.x, z - other.z) < LOG_MIN_SPACING) {
			tooCloseToLog = true;
			break;
		}
	}
	if (tooCloseToLog) continue;

	const angle = Math.random() * Math.PI * 2;
	logs.push({ x, z, angle });
}

for (const t of logs) {
	scene.add(makeLog(t));
}
```

Then update the return statement to include `logs`:

```typescript
	return {
		colliders,
		flagPosition: new Vector3(FLAG_X, 0, FLAG_Z),
		bounds: { halfX: AREA_HALF, halfZ: AREA_HALF },
		logs,
	};
```

- [ ] **Step 2: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add nova-games/grant-woodland-virus/src/forest.ts
git commit -m "$(cat <<'EOF'
grant-woodland-virus: add hollow logs to forest generation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Monster module — geometry only

Create `monster.ts` with a `createMonster()` that returns a `MonsterState` (root Group, position, yaw). All deer-skull anatomy is built from primitives. Wire into `main.ts` so the monster is visible at spawn. No AI yet.

**Files:**
- Create: `nova-games/grant-woodland-virus/src/monster.ts`
- Modify: `nova-games/grant-woodland-virus/src/main.ts`

- [ ] **Step 1: Create `src/monster.ts`**

```typescript
import {
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PointLight,
	SphereGeometry,
	Vector3,
} from "three";

export type MonsterState = {
	root: Group;
	position: Vector3;
	yaw: number;
	chest: Mesh;
};

const SPAWN_X = 60;
const SPAWN_Z = 60;

const furMaterial = new MeshStandardMaterial({ color: 0x2a1810 });
const torsoMaterial = new MeshStandardMaterial({ color: 0x1a0e08 });
const bloodMaterial = new MeshStandardMaterial({
	color: 0x4a0808,
	emissive: 0x4a0808,
	emissiveIntensity: 0.2,
});
const boneMaterial = new MeshStandardMaterial({ color: 0xe8e2d0 });
const clawMaterial = new MeshStandardMaterial({ color: 0xc8c0b0 });
const socketMaterial = new MeshStandardMaterial({ color: 0x000000 });
const greenEyeMaterial = new MeshBasicMaterial({ color: 0x00ff44 });

function makeAntler(side: 1 | -1): Group {
	const antler = new Group();

	const main = new Mesh(
		new CylinderGeometry(0.04, 0.06, 0.5, 6),
		boneMaterial,
	);
	main.position.y = 0.25;
	main.rotation.z = side * -0.3;
	antler.add(main);

	const branchA = new Mesh(
		new CylinderGeometry(0.025, 0.04, 0.3, 6),
		boneMaterial,
	);
	branchA.position.set(side * 0.18, 0.5, 0);
	branchA.rotation.z = side * -0.7;
	antler.add(branchA);

	const branchB = new Mesh(
		new CylinderGeometry(0.025, 0.035, 0.25, 6),
		boneMaterial,
	);
	branchB.position.set(side * 0.05, 0.55, 0);
	branchB.rotation.z = side * -0.2;
	antler.add(branchB);

	const tipA = new Mesh(new ConeGeometry(0.025, 0.1, 6), boneMaterial);
	tipA.position.set(side * 0.32, 0.62, 0);
	tipA.rotation.z = side * -0.7;
	antler.add(tipA);

	const tipB = new Mesh(new ConeGeometry(0.025, 0.1, 6), boneMaterial);
	tipB.position.set(side * 0.08, 0.7, 0);
	tipB.rotation.z = side * -0.2;
	antler.add(tipB);

	return antler;
}

function makeArm(side: 1 | -1): Group {
	const arm = new Group();
	arm.position.set(side * 0.45, 1.85, 0);

	const upper = new Mesh(
		new CylinderGeometry(0.1, 0.09, 0.5, 8),
		furMaterial,
	);
	upper.position.y = -0.25;
	arm.add(upper);

	const forearm = new Mesh(
		new CylinderGeometry(0.08, 0.07, 0.5, 8),
		furMaterial,
	);
	forearm.position.y = -0.75;
	arm.add(forearm);

	const hand = new Group();
	hand.position.y = -1;
	for (let i = 0; i < 3; i++) {
		const claw = new Mesh(new ConeGeometry(0.04, 0.18, 6), clawMaterial);
		claw.position.set((i - 1) * 0.06, -0.1, 0);
		claw.rotation.x = Math.PI;
		hand.add(claw);
	}
	arm.add(hand);

	return arm;
}

function makeLeg(side: 1 | -1): Group {
	const leg = new Group();
	leg.position.set(side * 0.18, 0.95, 0);

	const thigh = new Mesh(
		new CylinderGeometry(0.13, 0.11, 0.55, 8),
		furMaterial,
	);
	thigh.position.y = -0.275;
	thigh.rotation.x = 0.2;
	leg.add(thigh);

	const shin = new Mesh(
		new CylinderGeometry(0.1, 0.08, 0.55, 8),
		furMaterial,
	);
	shin.position.set(0, -0.75, 0.08);
	shin.rotation.x = -0.3;
	leg.add(shin);

	const foot = new Mesh(new BoxGeometry(0.18, 0.08, 0.3), furMaterial);
	foot.position.set(0, -1, 0.12);
	leg.add(foot);

	return leg;
}

function makeHead(): Group {
	const head = new Group();
	head.position.y = 2.5;

	const skull = new Mesh(new SphereGeometry(0.3, 16, 12), boneMaterial);
	skull.scale.set(1, 1.1, 1.3);
	head.add(skull);

	const socketL = new Mesh(new BoxGeometry(0.07, 0.07, 0.07), socketMaterial);
	socketL.position.set(-0.13, 0.05, 0.28);
	head.add(socketL);

	const socketR = new Mesh(new BoxGeometry(0.07, 0.07, 0.07), socketMaterial);
	socketR.position.set(0.13, 0.05, 0.28);
	head.add(socketR);

	const greenEye = new Mesh(new SphereGeometry(0.04, 8, 6), greenEyeMaterial);
	greenEye.position.set(-0.13, 0.05, 0.32);
	head.add(greenEye);

	const eyeLight = new PointLight(0x00ff44, 1, 3);
	eyeLight.position.set(-0.13, 0.05, 0.32);
	head.add(eyeLight);

	const antlerL = makeAntler(-1);
	antlerL.position.set(-0.18, 0.25, 0);
	head.add(antlerL);

	const antlerR = makeAntler(1);
	antlerR.position.set(0.18, 0.25, 0);
	head.add(antlerR);

	return head;
}

export function createMonster(): MonsterState {
	const root = new Group();
	root.position.set(SPAWN_X, 0, SPAWN_Z);

	const torso = new Mesh(
		new CylinderGeometry(0.5, 0.45, 1.2, 12),
		torsoMaterial,
	);
	torso.position.y = 1.95;
	root.add(torso);

	const chest = new Mesh(new BoxGeometry(0.7, 0.5, 0.25), bloodMaterial);
	chest.position.set(0, 2.1, 0.4);
	root.add(chest);

	root.add(makeArm(-1));
	root.add(makeArm(1));
	root.add(makeLeg(-1));
	root.add(makeLeg(1));
	root.add(makeHead());

	return {
		root,
		position: root.position,
		yaw: 0,
		chest,
	};
}
```

- [ ] **Step 2: Wire `monster.ts` into `main.ts`**

Add the import after the existing imports:

```typescript
import { createMonster } from "./monster";
```

After `const forest = buildForest(scene);` and `const player = createPlayer();` and `attachPlayerInput(...)` and `const ui = createUI();`, add:

```typescript
const monster = createMonster();
scene.add(monster.root);
```

(`monster` will be referenced by later tasks for AI, audio gain, contact detection — no `void monster;` needed because biome won't flag it; `scene.add(monster.root)` reads it. If biome complains, add `void monster;` temporarily and remove it in Task 4.)

- [ ] **Step 3: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add nova-games/grant-woodland-virus/src/monster.ts nova-games/grant-woodland-virus/src/main.ts
git commit -m "$(cat <<'EOF'
grant-woodland-virus: build deer-skull monster from primitives

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Monster chase AI

Add `updateMonster(monster, player, dt)` to `monster.ts` and wire it into the animate loop. Monster moves toward the player at 3 m/s, smoothly yaws to face them, animates its chest breathing, and stays inside the world bounds. Hide-aware behavior comes in Task 7.

**Files:**
- Modify: `nova-games/grant-woodland-virus/src/monster.ts`
- Modify: `nova-games/grant-woodland-virus/src/main.ts`

- [ ] **Step 1: Extend `monster.ts`**

Add a type-only import for `PlayerState`. The current first line is:

```typescript
import {
	BoxGeometry,
```

Add **above** that:

```typescript
import type { PlayerState } from "./player";
```

Add new constants near `SPAWN_X`:

```typescript
const MONSTER_SPEED = 3;
const MONSTER_YAW_RATE = 2;
const MONSTER_BOUNDS_HALF = 100;
const BREATH_AMPLITUDE = 0.04;
const BREATH_PERIOD = 3;
```

Track elapsed time at module level (used by chest breathing):

```typescript
let elapsed = 0;
```

Add a helper that wraps an angle to the range `[-π, π]`:

```typescript
function wrapAngle(a: number): number {
	let v = a;
	while (v > Math.PI) v -= 2 * Math.PI;
	while (v < -Math.PI) v += 2 * Math.PI;
	return v;
}
```

Add `updateMonster` exported function (place at the bottom of the file):

```typescript
export function updateMonster(
	monster: MonsterState,
	player: PlayerState,
	dt: number,
): void {
	elapsed += dt;
	const breath = 1 + BREATH_AMPLITUDE * Math.sin((elapsed * 2 * Math.PI) / BREATH_PERIOD);
	monster.chest.scale.y = breath;

	const dx = player.position.x - monster.position.x;
	const dz = player.position.z - monster.position.z;
	const targetYaw = Math.atan2(-dx, -dz);
	const yawDelta = wrapAngle(targetYaw - monster.yaw);
	const maxYawStep = MONSTER_YAW_RATE * dt;
	const yawStep =
		Math.abs(yawDelta) < maxYawStep
			? yawDelta
			: Math.sign(yawDelta) * maxYawStep;
	monster.yaw += yawStep;
	monster.root.rotation.y = monster.yaw;

	const dist = Math.hypot(dx, dz);
	if (dist > 0.0001) {
		const step = MONSTER_SPEED * dt;
		monster.position.x += (dx / dist) * step;
		monster.position.z += (dz / dist) * step;
	}

	if (monster.position.x > MONSTER_BOUNDS_HALF)
		monster.position.x = MONSTER_BOUNDS_HALF;
	if (monster.position.x < -MONSTER_BOUNDS_HALF)
		monster.position.x = -MONSTER_BOUNDS_HALF;
	if (monster.position.z > MONSTER_BOUNDS_HALF)
		monster.position.z = MONSTER_BOUNDS_HALF;
	if (monster.position.z < -MONSTER_BOUNDS_HALF)
		monster.position.z = -MONSTER_BOUNDS_HALF;
}
```

- [ ] **Step 2: Wire `updateMonster` into `main.ts`**

Update the import to include `updateMonster`:

```typescript
import { createMonster, updateMonster } from "./monster";
```

In the animate loop, inside the `if (state === "playing")` block (which currently updates stamina + win check), add a call to `updateMonster` BEFORE the win check:

```typescript
if (state === "playing") {
	updateMonster(monster, player, dt);
	ui.setStamina(player.stamina, 100);
	const dx = player.position.x - forest.flagPosition.x;
	const dz = player.position.z - forest.flagPosition.z;
	if (Math.hypot(dx, dz) < 1.5) {
		enterWin();
	}
}
```

- [ ] **Step 3: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add nova-games/grant-woodland-virus/src/monster.ts nova-games/grant-woodland-virus/src/main.ts
git commit -m "$(cat <<'EOF'
grant-woodland-virus: monster chases player at 3 m/s

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Player hide mechanic (data + E key + movement gate)

Extend `PlayerState` with `hidden: boolean`. Add module-level `activeLog` plus `setHideTarget(player, log)`. Add E-key handling in `attachPlayerInput` with `e.repeat` debounce. Gate the movement block on `!player.hidden`. Wire main.ts to find the nearest log within 2 m each frame and call `setHideTarget`.

UI prompt comes in Task 6.

**Files:**
- Modify: `nova-games/grant-woodland-virus/src/player.ts`
- Modify: `nova-games/grant-woodland-virus/src/main.ts`

- [ ] **Step 1: Extend `player.ts`**

Add a type-only import for `LogTransform`:

```typescript
import type { LogTransform, TreeCollider } from "./forest";
```

(The existing import of `TreeCollider` becomes a combined import.)

Add new constants near the existing ones:

```typescript
const HIDE_RADIUS = 2;
const HIDE_EYE_HEIGHT = 0.8;
```

Update `PlayerState` to add `hidden`:

```typescript
export type PlayerState = {
	position: Vector3;
	yaw: number;
	pitch: number;
	stamina: number;
	hidden: boolean;
};
```

Update `createPlayer()` to set `hidden: false`:

```typescript
export function createPlayer(): PlayerState {
	return {
		position: new Vector3(0, EYE_HEIGHT, 0),
		yaw: 0,
		pitch: 0,
		stamina: STAMINA_MAX,
		hidden: false,
	};
}
```

Update `resetPlayer()` to also reset hide state and eye height:

```typescript
export function resetPlayer(player: PlayerState) {
	player.position.set(0, EYE_HEIGHT, 0);
	player.yaw = 0;
	player.pitch = 0;
	player.stamina = STAMINA_MAX;
	player.hidden = false;
}
```

Add module-level state and a setter (place these right after the existing `let inputActive = false;` and its `setInputActive` function):

```typescript
let activeLog: LogTransform | null = null;

export function setHideTarget(player: PlayerState, log: LogTransform | null) {
	if (player.hidden) return;
	activeLog = log;
}

export function getHideTarget(): LogTransform | null {
	return activeLog;
}
```

Add E-key handling. Inside `attachPlayerInput`, ADD a separate keydown listener at the END (after the click handler) so we can guard on `e.repeat` without affecting the existing W/A/S/D/Q handlers:

```typescript
	window.addEventListener("keydown", (e) => {
		if (e.repeat) return;
		if (!inputActive) return;
		if (e.key.toLowerCase() !== "e") return;

		if (player.hidden) {
			player.position.y = EYE_HEIGHT;
			player.hidden = false;
		} else if (activeLog) {
			player.position.set(activeLog.x, HIDE_EYE_HEIGHT, activeLog.z);
			player.hidden = true;
		}
	});
```

Update the movement gate in `updatePlayer` to also require `!player.hidden`:

```typescript
	if (document.pointerLockElement && inputActive && !player.hidden) {
```

Update `setInputActive(false)` so that when input is deactivated AND the player happens to be hidden, we leave them hidden but they obviously can't toggle out. (No change needed here — the function already clears keys; hidden state is preserved across pause/resume because nothing writes to it from `setInputActive`.)

- [ ] **Step 2: Wire main.ts to compute the hide target each frame**

Update the player import in `main.ts` to include `setHideTarget`:

```typescript
import {
	attachPlayerInput,
	createPlayer,
	resetPlayer,
	setHideTarget,
	setInputActive,
	updatePlayer,
} from "./player";
```

Add a type-only import for `LogTransform` near the other imports in `main.ts`:

```typescript
import type { LogTransform } from "./forest";
```

Inside the animate loop's `if (state === "playing")` block, ADD a per-frame nearest-log search BEFORE the `updateMonster` call:

```typescript
if (state === "playing") {
	if (!player.hidden) {
		let nearest: LogTransform | null = null;
		let nearestDist = 2;
		for (const log of forest.logs) {
			const ldx = log.x - player.position.x;
			const ldz = log.z - player.position.z;
			const d = Math.hypot(ldx, ldz);
			if (d < nearestDist) {
				nearest = log;
				nearestDist = d;
			}
		}
		setHideTarget(player, nearest);
	}
	updateMonster(monster, player, dt);
	ui.setStamina(player.stamina, 100);
	const dx = player.position.x - forest.flagPosition.x;
	const dz = player.position.z - forest.flagPosition.z;
	if (Math.hypot(dx, dz) < 1.5) {
		enterWin();
	}
}
```

- [ ] **Step 3: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS.

If biome complains about `Vector3` in the inline type expression or unused `LogTransform`, switch to the explicit `import type { LogTransform } from "./forest";` form.

- [ ] **Step 4: Commit**

```bash
git add nova-games/grant-woodland-virus/src/player.ts nova-games/grant-woodland-virus/src/main.ts
git commit -m "$(cat <<'EOF'
grant-woodland-virus: add E-to-hide / E-to-exit log mechanic

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Hide-prompt UI

Extend `ui.ts` with a `setHidePromptVisible(visible, mode)` method that shows a centered-bottom hint reading "Press E to hide" or "Press E to exit". Wire into the animate loop so the prompt reflects the current state.

**Files:**
- Modify: `nova-games/grant-woodland-virus/src/ui.ts`
- Modify: `nova-games/grant-woodland-virus/src/main.ts`

- [ ] **Step 1: Extend `ui.ts`**

Add a new style constant near the other style constants (placed after `RESUME_HINT_STYLE`):

```typescript
const HIDE_PROMPT_STYLE = `
	position: fixed;
	bottom: 80px;
	left: 50%;
	transform: translateX(-50%);
	padding: 10px 22px;
	background: rgba(0, 0, 0, 0.7);
	border: 1px solid #4a6450;
	border-radius: 4px;
	color: #d4d4cc;
	font-family: Georgia, "Times New Roman", serif;
	font-size: 16px;
	letter-spacing: 0.04em;
	display: none;
	pointer-events: none;
	user-select: none;
`;
```

Update the `UI` type to include the new method:

```typescript
export type UI = {
	setStamina: (value: number, max: number) => void;
	setStaminaVisible: (visible: boolean) => void;
	setResumeHintVisible: (visible: boolean) => void;
	setHidePromptVisible: (visible: boolean, mode: "hide" | "exit") => void;
	showTitle: (onStart: () => void) => void;
	hideTitle: () => void;
	showWin: (onPlayAgain: () => void) => void;
	hideWin: () => void;
};
```

In `createUI()`, after the resume-hint DOM creation and before `let startHandler ...`, ADD:

```typescript
	// Hide prompt
	const hidePrompt = document.createElement("div");
	hidePrompt.setAttribute("style", HIDE_PROMPT_STYLE);
	document.body.appendChild(hidePrompt);
```

In the returned object literal, ADD the new method (place it after `setResumeHintVisible`):

```typescript
		setHidePromptVisible(visible, mode) {
			hidePrompt.textContent =
				mode === "hide" ? "Press E to hide" : "Press E to exit";
			hidePrompt.style.display = visible ? "block" : "none";
		},
```

- [ ] **Step 2: Wire prompt into `main.ts`**

Import `getHideTarget` from player to read the active log. Update the player import:

```typescript
import {
	attachPlayerInput,
	createPlayer,
	getHideTarget,
	resetPlayer,
	setHideTarget,
	setInputActive,
	updatePlayer,
} from "./player";
```

In the animate loop, after the `setHideTarget(player, nearest)` call (or just inside the `if (state === "playing")` block, after the hide-target assignment), ADD the prompt-toggle logic:

```typescript
	if (player.hidden) {
		ui.setHidePromptVisible(true, "exit");
	} else {
		ui.setHidePromptVisible(getHideTarget() !== null, "hide");
	}
```

Place this AFTER the nearest-log search but BEFORE the `updateMonster` call so the UI reflects the latest hide target.

Also: in the state-machine entry functions, hide the prompt on TITLE / WIN. Update `enterTitle()` to add:

```typescript
	ui.setHidePromptVisible(false, "hide");
```

(Place just before / after the existing `ui.setResumeHintVisible(false);` call.)

Update `enterWin()` similarly to hide the prompt:

```typescript
	ui.setHidePromptVisible(false, "hide");
```

- [ ] **Step 3: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add nova-games/grant-woodland-virus/src/ui.ts nova-games/grant-woodland-virus/src/main.ts
git commit -m "$(cat <<'EOF'
grant-woodland-virus: show hide prompt near logs

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Hide-aware monster + audio integration

Two small changes:
1. Monster idles when `player.hidden === true` (no chase, no yaw-track).
2. Audio: `startBreathing()` on `enterPlaying`, `stopAll()` on `enterTitle` / `enterWin`, and per-frame `setBreathingGain` based on monster distance.

**Files:**
- Modify: `nova-games/grant-woodland-virus/src/monster.ts`
- Modify: `nova-games/grant-woodland-virus/src/main.ts`

- [ ] **Step 1: Make monster hide-aware in `monster.ts`**

Update `updateMonster` to early-exit movement when the player is hidden. Replace the body so the breathing animation still runs but movement/yaw-tracking is skipped:

```typescript
export function updateMonster(
	monster: MonsterState,
	player: PlayerState,
	dt: number,
): void {
	elapsed += dt;
	const breath = 1 + BREATH_AMPLITUDE * Math.sin((elapsed * 2 * Math.PI) / BREATH_PERIOD);
	monster.chest.scale.y = breath;

	if (player.hidden) return;

	const dx = player.position.x - monster.position.x;
	const dz = player.position.z - monster.position.z;
	const targetYaw = Math.atan2(-dx, -dz);
	const yawDelta = wrapAngle(targetYaw - monster.yaw);
	const maxYawStep = MONSTER_YAW_RATE * dt;
	const yawStep =
		Math.abs(yawDelta) < maxYawStep
			? yawDelta
			: Math.sign(yawDelta) * maxYawStep;
	monster.yaw += yawStep;
	monster.root.rotation.y = monster.yaw;

	const dist = Math.hypot(dx, dz);
	if (dist > 0.0001) {
		const step = MONSTER_SPEED * dt;
		monster.position.x += (dx / dist) * step;
		monster.position.z += (dz / dist) * step;
	}

	if (monster.position.x > MONSTER_BOUNDS_HALF)
		monster.position.x = MONSTER_BOUNDS_HALF;
	if (monster.position.x < -MONSTER_BOUNDS_HALF)
		monster.position.x = -MONSTER_BOUNDS_HALF;
	if (monster.position.z > MONSTER_BOUNDS_HALF)
		monster.position.z = MONSTER_BOUNDS_HALF;
	if (monster.position.z < -MONSTER_BOUNDS_HALF)
		monster.position.z = -MONSTER_BOUNDS_HALF;
}
```

The only change vs. Task 4: the `if (player.hidden) return;` line after the breathing-scale update.

- [ ] **Step 2: Wire audio into `main.ts` state transitions and animate loop**

Add the audio import (alphabetical order; place it after the `./forest` import):

```typescript
import * as audio from "./audio";
```

Update `enterPlaying()` to start breathing. Add this line at the END of the function body:

```typescript
	audio.startBreathing();
```

Update `enterTitle()` to stop breathing. Add this line near the start of the body (after the `if (document.pointerLockElement) document.exitPointerLock();` line):

```typescript
	audio.stopAll();
```

Update `enterWin()` to stop breathing — same line, same place:

```typescript
	audio.stopAll();
```

In the animate loop, INSIDE the `if (state === "playing")` block, ADD a per-frame breathing-gain update — calculate distance to monster, map to a 0..1 gain. Place this AFTER the `updateMonster(...)` call:

```typescript
	const mdx = monster.position.x - player.position.x;
	const mdz = monster.position.z - player.position.z;
	const monsterDist = Math.hypot(mdx, mdz);
	audio.setBreathingGain(Math.max(0, Math.min(1, 1 - monsterDist / 40)));
```

- [ ] **Step 3: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add nova-games/grant-woodland-virus/src/monster.ts nova-games/grant-woodland-virus/src/main.ts
git commit -m "$(cat <<'EOF'
grant-woodland-virus: hide-aware monster + breathing audio gain

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Jumpscare + LOSE state

Add `"lose"` to `GameState`. Extend `ui.ts` with `showJumpscare` / `hideJumpscare` / `showLose` / `hideLose` (CSS skull + red flash + LOSE buttons). Add `enterJumpscare()` to `main.ts` and call it from a per-frame contact check.

**Files:**
- Modify: `nova-games/grant-woodland-virus/src/ui.ts`
- Modify: `nova-games/grant-woodland-virus/src/main.ts`

- [ ] **Step 1: Extend `ui.ts` with jumpscare + LOSE overlays**

Add these style constants near the existing ones (after `HIDE_PROMPT_STYLE`):

```typescript
const JUMPSCARE_BG_STYLE = `
	position: fixed;
	inset: 0;
	display: none;
	align-items: center;
	justify-content: center;
	background: rgba(0, 0, 0, 0.92);
	pointer-events: none;
	z-index: 100;
`;

const JUMPSCARE_FLASH_STYLE = `
	position: absolute;
	inset: 0;
	background: rgba(180, 0, 0, 0);
	transition: background 0.15s linear;
	pointer-events: none;
`;

const SKULL_STYLE = `
	position: relative;
	width: 380px;
	height: 480px;
`;

const SKULL_DOME_STYLE = `
	position: absolute;
	left: 0;
	top: 0;
	width: 380px;
	height: 380px;
	background: #f0ebd8;
	border-radius: 50% 50% 45% 45%;
	box-shadow: 0 0 60px rgba(255, 240, 220, 0.4);
`;

const SKULL_SOCKET_STYLE = `
	position: absolute;
	width: 90px;
	height: 110px;
	background: #050505;
	border-radius: 50%;
	top: 130px;
`;

const SKULL_GREEN_STYLE = `
	position: absolute;
	width: 26px;
	height: 26px;
	background: #00ff44;
	border-radius: 50%;
	box-shadow: 0 0 30px #00ff44, 0 0 60px #00ff44;
	top: 175px;
	left: 110px;
`;

const SKULL_JAW_STYLE = `
	position: absolute;
	left: 80px;
	top: 320px;
	width: 220px;
	height: 130px;
	background: #f0ebd8;
	clip-path: polygon(10% 0%, 90% 0%, 100% 100%, 0% 100%);
`;
```

Update the `UI` type with the new methods:

```typescript
export type UI = {
	setStamina: (value: number, max: number) => void;
	setStaminaVisible: (visible: boolean) => void;
	setResumeHintVisible: (visible: boolean) => void;
	setHidePromptVisible: (visible: boolean, mode: "hide" | "exit") => void;
	showTitle: (onStart: () => void) => void;
	hideTitle: () => void;
	showWin: (onPlayAgain: () => void) => void;
	hideWin: () => void;
	showJumpscare: () => void;
	hideJumpscare: () => void;
	showLose: (onNewGame: () => void, onTitle: () => void) => void;
	hideLose: () => void;
};
```

In `createUI()`, ADD the jumpscare + LOSE DOM construction. Place this AFTER the hide-prompt DOM creation and BEFORE the `let startHandler ...` block:

```typescript
	// Jumpscare overlay (CSS skull + red flash)
	const jumpscare = document.createElement("div");
	jumpscare.setAttribute("style", JUMPSCARE_BG_STYLE);

	const skull = document.createElement("div");
	skull.setAttribute("style", SKULL_STYLE);

	const skullDome = document.createElement("div");
	skullDome.setAttribute("style", SKULL_DOME_STYLE);
	skull.appendChild(skullDome);

	const socketL = document.createElement("div");
	socketL.setAttribute("style", `${SKULL_SOCKET_STYLE} left: 100px;`);
	skull.appendChild(socketL);

	const socketR = document.createElement("div");
	socketR.setAttribute("style", `${SKULL_SOCKET_STYLE} right: 100px;`);
	skull.appendChild(socketR);

	const greenEye = document.createElement("div");
	greenEye.setAttribute("style", SKULL_GREEN_STYLE);
	skull.appendChild(greenEye);

	const jaw = document.createElement("div");
	jaw.setAttribute("style", SKULL_JAW_STYLE);
	skull.appendChild(jaw);

	jumpscare.appendChild(skull);

	const flash = document.createElement("div");
	flash.setAttribute("style", JUMPSCARE_FLASH_STYLE);
	jumpscare.appendChild(flash);

	document.body.appendChild(jumpscare);

	// LOSE overlay
	const lose = makeOverlay(WIN_BG);
	const loseHeading = document.createElement("h1");
	loseHeading.textContent = "You Died";
	loseHeading.setAttribute("style", TITLE_TEXT_STYLE);
	lose.appendChild(loseHeading);
	const loseRow = document.createElement("div");
	loseRow.setAttribute(
		"style",
		"display: flex; gap: 20px;",
	);
	const newGameButton = makeButton("New Game");
	const titleButton = makeButton("Title Screen");
	loseRow.appendChild(newGameButton);
	loseRow.appendChild(titleButton);
	lose.appendChild(loseRow);
	document.body.appendChild(lose);
```

Add new handler refs alongside `startHandler` and `playAgainHandler`:

```typescript
	let newGameHandler: (() => void) | null = null;
	let titleHandler: (() => void) | null = null;

	newGameButton.addEventListener("click", () => {
		newGameHandler?.();
	});
	titleButton.addEventListener("click", () => {
		titleHandler?.();
	});
```

In the returned object literal, ADD the new methods (after `hideWin`):

```typescript
		showJumpscare() {
			jumpscare.style.display = "flex";
			flash.style.background = "rgba(180, 0, 0, 0.6)";
			window.setTimeout(() => {
				flash.style.background = "rgba(180, 0, 0, 0)";
			}, 150);
		},
		hideJumpscare() {
			jumpscare.style.display = "none";
			flash.style.background = "rgba(180, 0, 0, 0)";
		},
		showLose(onNewGame, onTitle) {
			newGameHandler = onNewGame;
			titleHandler = onTitle;
			lose.style.display = "flex";
		},
		hideLose() {
			lose.style.display = "none";
		},
```

- [ ] **Step 2: Wire LOSE state into `main.ts`**

Update the `GameState` type to include `"lose"`:

```typescript
type GameState = "title" | "playing" | "win" | "lose";
```

Add an `enterJumpscare()` function. Place it right after `enterWin()`. There is no separate `enterLose()` — `enterJumpscare` itself drives the LOSE state directly via the `setTimeout` callback that swaps the jumpscare overlay for the LOSE buttons.

```typescript
function enterJumpscare() {
	state = "lose";
	setInputActive(false);
	if (document.pointerLockElement) document.exitPointerLock();
	ui.setStaminaVisible(false);
	ui.setHidePromptVisible(false, "hide");
	ui.setResumeHintVisible(false);

	const jdx = monster.position.x - player.position.x;
	const jdz = monster.position.z - player.position.z;
	player.yaw = Math.atan2(-jdx, -jdz);
	player.pitch = 0;

	audio.stopAll();
	audio.playScream();
	ui.showJumpscare();

	window.setTimeout(() => {
		ui.hideJumpscare();
		ui.showLose(
			() => enterPlaying(),
			() => enterTitle(),
		);
	}, 1500);
}
```

Update each entry function so it correctly hides the LOSE overlay when leaving the LOSE state:

In `enterTitle()` add `ui.hideLose();` (place near the other UI hides).

In `enterPlaying()` add `ui.hideLose();` (so a New Game from LOSE clears it).

In `enterWin()` add `ui.hideLose();` defensively too.

Add a contact check in the animate loop, INSIDE `if (state === "playing")`, AFTER the breathing-gain update, BEFORE the win check:

```typescript
	if (!player.hidden && monsterDist < 1.2) {
		enterJumpscare();
	}
```

Note `monsterDist` was computed in Task 7 and is already in scope here.

- [ ] **Step 3: Run `pnpm test`**

```bash
pnpm test
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add nova-games/grant-woodland-virus/src/ui.ts nova-games/grant-woodland-virus/src/main.ts
git commit -m "$(cat <<'EOF'
grant-woodland-virus: jumpscare + LOSE state on monster contact

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Polish + repo build verify

Final task. Don't add features. Run repo-level test + build, confirm `grant-woodland-virus` is in the succeeded list, and confirm the production build still produces `dist/nova-games/grant-woodland-virus/`.

**Files:** none (or trivial tuning).

- [ ] **Step 1: Run `pnpm test` from the repo root**

```bash
cd /Users/taylor/dev/tayl0r.github.com-grant
pnpm test
```
Expected: PASS.

- [ ] **Step 2: Run `pnpm build` from the repo root**

```bash
pnpm build
```
Expected: succeeds; build-games orchestrator output includes `grant-woodland-virus` in the succeeded list.

- [ ] **Step 3: Verify dist output**

```bash
ls dist/nova-games/grant-woodland-virus/
```
Expected: `index.html` + `assets/` directory.

- [ ] **Step 4: Optional — playtest tuning**

If any of the following felt off, tune:

| Symptom                                  | Knob                                                  |
| ---------------------------------------- | ----------------------------------------------------- |
| Monster too easy / hard to outrun        | `MONSTER_SPEED` in `monster.ts`                       |
| Breathing audio too quiet / loud at peak | The `1 - dist/40` formula in `main.ts` animate loop   |
| Hide prompt appears too late / early     | `HIDE_RADIUS` in `player.ts`                          |
| Logs too dense / sparse                  | `LOG_COUNT_TARGET` in `forest.ts`                     |
| Jumpscare too long / short               | `1500` ms `setTimeout` in `enterJumpscare`            |

Re-run `pnpm test` after any tweak.

- [ ] **Step 5: Commit any tuning**

If you made any tuning changes:

```bash
git add nova-games/grant-woodland-virus/src
git commit -m "$(cat <<'EOF'
grant-woodland-virus: tune monster + audio + hide feel

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

If no tuning, no commit — proceed to PR.

---

## Done criteria

After this plan completes, a fresh checkout should let a reviewer:

1. ✅ `pnpm install && pnpm dev` from `nova-games/grant-woodland-virus/` → title screen.
2. ✅ Click Start → pointer lock, breathing audio softly modulated.
3. ✅ Walk into the forest; the monster (visible deer-skull primitive build) approaches at 3 m/s.
4. ✅ Sprint outruns it; releasing Q lets it catch up over time.
5. ✅ Walking near a hollow log shows "Press E to hide". E ducks the camera into the log; "Press E to exit" appears. Monster idles.
6. ✅ Pressing E exits; monster resumes chase.
7. ✅ Touching the monster while not hidden triggers the jumpscare (CSS skull + red flash + scream), then a LOSE screen with "New Game" and "Title Screen" buttons.
8. ✅ "New Game" → fresh PLAYING with player at spawn, monster reset, full stamina, breathing restarted.
9. ✅ "Title Screen" → returns to title with audio stopped.
10. ✅ Touching the flag without dying → WIN with Play Again as before.
11. ✅ Repo-level: `pnpm test` and `pnpm build` pass; `build:games` lists `grant-woodland-virus` as succeeded.

After this PR, the project matches Grant's original prompt feature-for-feature.
