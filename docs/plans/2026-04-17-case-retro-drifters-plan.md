# Retro Drifters Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship a playable prototype of Retro Drifters at `nova-games/case-retro-drifters/`: a Hades-tilt top-down drift racer with a spinning-car menu, one Skyline, one Tokyo track, and a full 3-lap race with drift physics, off-track penalty, and lap timing.

**Architecture:** Three.js scene rendered in a Vite app. Two scenes (menu, race) managed by a tiny scene-switcher in `main.ts` — each scene exposes `init/update/dispose`. Car physics is a pure function (no Three imports) unit-tested with Vitest. Track geometry is generated at load from a waypoint list. HUD is a DOM overlay driven from state via `textContent` only (no `innerHTML`). Tunable constants live at the top of `physics.ts`.

**Tech Stack:** TypeScript, Vite, Three.js v0.164, Vitest, Biome (already configured repo-wide, tabs).

**Design doc:** `docs/plans/2026-04-17-case-retro-drifters-design.md`

**Working directory for all commands:** `nova-games/case-retro-drifters/` unless noted. Root-level commands say so explicitly.

---

## Conventions

- **Indent with tabs.** Biome enforces this repo-wide.
- **TypeScript strict.** `tsconfig.json` has `"strict": true`; no `any` without an inline comment.
- **Never use `innerHTML`.** Build DOM with `textContent` and dedicated child elements.
- **TDD the pure code.** `car/physics.ts` and `track/collision.ts` are pure and get Vitest tests. Everything else is smoke-tested in a browser — the plan says what to look for.
- **Verify at repo root** that `pnpm run test` (tsc + biome) passes before every commit — see @superpowers:verification-before-completion.
- **Commit after every task.** Messages start with `feat(drifters):`, `test(drifters):`, or `chore(drifters):`.
- **Units:** distance = meters, time = seconds, angles = radians. Ground plane is XZ; Y is up.

---

## Task 1: Swap Pixi.js for Three.js and wire Vitest

**Files:**
- Modify: `nova-games/case-retro-drifters/package.json`
- Modify: `nova-games/case-retro-drifters/src/main.ts`
- Create: `nova-games/case-retro-drifters/vitest.config.ts`

**Step 1: Update `package.json`**

Set to exactly:

```json
{
	"name": "@nova-games/case-retro-drifters",
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
		"three": "^0.164.0"
	},
	"devDependencies": {
		"@types/three": "^0.164.0",
		"typescript": "^5.9.3",
		"vite": "^7.3.1",
		"vitest": "^1.6.0"
	}
}
```

**Step 2: Install from repo root**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm install
```

Expected: resolves and installs `three`, `@types/three`, `vitest`.

**Step 3: Minimal Three.js boot in `src/main.ts`**

Replace the entire file with:

```ts
import {
	AmbientLight,
	BoxGeometry,
	DirectionalLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	Scene,
	WebGLRenderer,
} from "three";

const scene = new Scene();
scene.background = null;

const camera = new PerspectiveCamera(
	40,
	window.innerWidth / window.innerHeight,
	0.1,
	1000,
);
camera.position.set(0, 8, 10);
camera.lookAt(0, 0, 0);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x12081c);
document.body.appendChild(renderer.domElement);

scene.add(new AmbientLight(0x8080a0, 0.6));
const dir = new DirectionalLight(0xffffff, 0.8);
dir.position.set(5, 10, 4);
scene.add(dir);

const cube = new Mesh(
	new BoxGeometry(1, 1, 1),
	new MeshStandardMaterial({ color: 0xff66cc }),
);
scene.add(cube);

function tick(): void {
	cube.rotation.y += 0.01;
	renderer.render(scene, camera);
	requestAnimationFrame(tick);
}
tick();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
```

**Step 4: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
```

**Step 5: Smoke test**

```bash
cd nova-games/case-retro-drifters
pnpm dev
```

Expect a pink rotating cube on a deep-purple background.

**Step 6: Lint/type check at repo root**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
```

Expected: passes.

**Step 7: Commit**

```bash
git add nova-games/case-retro-drifters pnpm-lock.yaml
git commit -m "chore(drifters): swap pixi for three.js and wire vitest"
```

---

## Task 2: Types module

**Files:**
- Create: `nova-games/case-retro-drifters/src/types.ts`

**Step 1: Write it**

```ts
export type Vec2 = { x: number; z: number };

export type CarInput = {
	throttle: number;    // 0..1
	brake: number;       // 0..1 (Shift+S)
	steer: number;       // -1..1
	driftBtn: boolean;   // Shift held
};

export type CarState = {
	position: Vec2;
	velocity: Vec2;
	heading: number;        // radians; 0 = +Z
	angularVelocity: number;
	speed: number;          // |velocity|
	grip: number;           // 1.0 full, 0.3 drift min
	isDrifting: boolean;
	spinOutTimer: number;   // seconds > 0 = locked out
};

export type Waypoint = {
	pos: Vec2;
	width: number;
	tag?: "shibuya" | "start";
};

export const v2 = (x: number, z: number): Vec2 => ({ x, z });
export const v2add = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x + b.x, z: a.z + b.z });
export const v2sub = (a: Vec2, b: Vec2): Vec2 => ({ x: a.x - b.x, z: a.z - b.z });
export const v2scale = (a: Vec2, s: number): Vec2 => ({ x: a.x * s, z: a.z * s });
export const v2len = (a: Vec2): number => Math.hypot(a.x, a.z);
export const v2dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z;
```

**Step 2: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src/types.ts
git commit -m "feat(drifters): add shared types and vec2 helpers"
```

---

## Task 3: Scene switcher in `main.ts`

**Files:**
- Create: `nova-games/case-retro-drifters/src/scene.ts`
- Modify: `nova-games/case-retro-drifters/src/main.ts`

**Step 1: Create `src/scene.ts`**

```ts
import type { PerspectiveCamera, Scene } from "three";

export type GameScene = {
	scene: Scene;
	camera: PerspectiveCamera;
	update: (dt: number) => void;
	dispose: () => void;
};

export type SceneContext = {
	readonly width: number;
	readonly height: number;
	switchTo: (next: SceneFactory) => void;
};

export type SceneFactory = (ctx: SceneContext) => GameScene;
```

**Step 2: Rewrite `src/main.ts`**

```ts
import { AmbientLight, PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { GameScene, SceneContext, SceneFactory } from "./scene";

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

let current: GameScene | null = null;

const ctx: SceneContext = {
	get width(): number { return window.innerWidth; },
	get height(): number { return window.innerHeight; },
	switchTo(next: SceneFactory): void { loadScene(next); },
};

function loadScene(factory: SceneFactory): void {
	if (current) current.dispose();
	current = factory(ctx);
}

const placeholder: SceneFactory = (): GameScene => {
	const scene = new Scene();
	scene.add(new AmbientLight(0xffffff, 0.5));
	const camera = new PerspectiveCamera(40, 1, 0.1, 1000);
	return {
		scene,
		camera,
		update() {},
		dispose() {},
	};
};
loadScene(placeholder);

let last = performance.now();
function tick(now: number): void {
	const dt = Math.min((now - last) / 1000, 1 / 30);
	last = now;
	if (current) {
		current.update(dt);
		renderer.render(current.scene, current.camera);
	}
	requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener("resize", () => {
	const w = window.innerWidth;
	const h = window.innerHeight;
	renderer.setSize(w, h);
	if (current) {
		current.camera.aspect = w / h;
		current.camera.updateProjectionMatrix();
	}
});
```

**Step 3: Smoke test**

`pnpm dev` → page loads without errors (empty black canvas is fine). Check browser console has no red.

**Step 4: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src
git commit -m "feat(drifters): scene-switcher scaffolding"
```

---

## Task 4: Menu scene shell — DOM title + Start button

**Files:**
- Modify: `nova-games/case-retro-drifters/index.html`
- Create: `nova-games/case-retro-drifters/src/menu.ts`
- Modify: `nova-games/case-retro-drifters/src/main.ts`

**Step 1: Add CSS and DOM to `index.html`**

Replace the entire body content. Full `index.html` becomes:

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Retro Drifters</title>
		<style>
			body { margin: 0; overflow: hidden; background: #0a0515;
				font-family: system-ui, sans-serif; color: #e0b8ff; }
			canvas { display: block; }
			#menu-ui { position: fixed; inset: 0; display: flex; flex-direction: column;
				align-items: center; justify-content: center; pointer-events: none; z-index: 10; }
			#menu-title {
				font-size: clamp(48px, 9vw, 120px); font-weight: 900;
				letter-spacing: 0.08em; color: #e0b8ff;
				text-shadow: 0 0 4px #c080ff, 0 0 14px #a040ff,
					0 0 28px #7010cc, 0 0 50px #400080;
				margin-bottom: 2rem;
			}
			#menu-start {
				pointer-events: auto; background: transparent; color: #e0b8ff;
				border: 2px solid #a040ff; border-radius: 8px;
				padding: 0.9rem 3rem; font-size: 1.6rem; font-weight: 700;
				letter-spacing: 0.2em; cursor: pointer;
				box-shadow: 0 0 16px #a040ff, inset 0 0 8px #7010cc;
				text-shadow: 0 0 6px #c080ff;
			}
			#menu-start:hover { background: rgba(160, 64, 255, 0.15); }

			#race-hud { position: fixed; inset: 0; pointer-events: none;
				z-index: 10; display: none; }
			#race-hud.active { display: block; }

			#hud-speed {
				position: absolute; bottom: 24px; left: 24px;
				width: 24px; height: 220px;
				border: 2px solid #a040ff; border-radius: 6px;
				box-shadow: 0 0 12px #a040ff;
				background: rgba(20,10,40,0.6); overflow: hidden;
			}
			#hud-speed-fill {
				position: absolute; bottom: 0; left: 0; right: 0;
				background: linear-gradient(to top, #ff40c0, #a040ff, #4080ff);
				box-shadow: 0 0 10px #a040ff; height: 0%;
				transition: height 60ms linear;
			}
			#hud-lap {
				position: absolute; top: 18px; left: 24px;
				font-size: 22px; font-weight: 700; letter-spacing: 0.12em;
				text-shadow: 0 0 8px #a040ff;
			}
			#hud-timer {
				position: absolute; top: 18px; right: 24px; text-align: right;
				font-variant-numeric: tabular-nums; text-shadow: 0 0 8px #a040ff;
			}
			#hud-timer-current { font-size: 20px; font-weight: 600; }
			#hud-timer-best { display: block; font-size: 14px; opacity: 0.6; }
			#hud-center {
				position: absolute; top: 40%; left: 50%;
				transform: translate(-50%, -50%);
				font-size: 56px; font-weight: 900; letter-spacing: 0.08em;
				color: #ffe0c0;
				text-shadow: 0 0 12px #ff4080, 0 0 24px #a040ff;
				opacity: 0; transition: opacity 300ms; text-align: center;
				white-space: pre-line;
			}
			#hud-center.visible { opacity: 1; }
			#hud-back {
				position: absolute; bottom: 30px; right: 30px;
				pointer-events: auto; background: transparent; color: #e0b8ff;
				border: 2px solid #a040ff; border-radius: 8px;
				padding: 0.6rem 1.4rem; font-size: 1rem;
				text-shadow: 0 0 6px #c080ff; cursor: pointer;
				box-shadow: 0 0 10px #a040ff;
				opacity: 0; transition: opacity 300ms;
			}
			#hud-back.visible { opacity: 1; pointer-events: auto; }
		</style>
	</head>
	<body>
		<div id="menu-ui">
			<div id="menu-title">RETRO DRIFTERS</div>
			<button id="menu-start">START</button>
		</div>
		<div id="race-hud">
			<div id="hud-speed"><div id="hud-speed-fill"></div></div>
			<div id="hud-lap">LAP 1 / 3</div>
			<div id="hud-timer">
				<span id="hud-timer-current">00:00.000</span>
				<span id="hud-timer-best">best --</span>
			</div>
			<div id="hud-center"></div>
			<button id="hud-back">BACK TO MENU</button>
		</div>
		<script type="module" src="/src/main.ts"></script>
	</body>
</html>
```

**Step 2: Create `src/menu.ts`**

```ts
import {
	AmbientLight,
	DirectionalLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
} from "three";
import type { GameScene, SceneContext, SceneFactory } from "./scene";

export const createMenuScene: SceneFactory = (ctx: SceneContext): GameScene => {
	const scene = new Scene();
	const camera = new PerspectiveCamera(40, ctx.width / ctx.height, 0.1, 1000);
	camera.position.set(0, 4, 9);
	camera.lookAt(0, 0.5, 0);

	scene.add(new AmbientLight(0x8060c0, 0.7));
	const key = new DirectionalLight(0xff80ff, 0.9);
	key.position.set(6, 8, 4);
	scene.add(key);
	const fill = new DirectionalLight(0x6040ff, 0.5);
	fill.position.set(-5, 6, 3);
	scene.add(fill);

	const floor = new Mesh(
		new PlaneGeometry(30, 30),
		new MeshStandardMaterial({ color: 0x1a0a2a }),
	);
	floor.rotation.x = -Math.PI / 2;
	scene.add(floor);

	const menuUI = document.getElementById("menu-ui") as HTMLDivElement;
	const startBtn = document.getElementById("menu-start") as HTMLButtonElement;
	menuUI.style.display = "flex";

	const onStart = async (): Promise<void> => {
		const { createRaceScene } = await import("./race");
		ctx.switchTo(createRaceScene);
	};
	startBtn.addEventListener("click", onStart);

	return {
		scene,
		camera,
		update(_dt: number) {},
		dispose() {
			menuUI.style.display = "none";
			startBtn.removeEventListener("click", onStart);
			floor.geometry.dispose();
			(floor.material as MeshStandardMaterial).dispose();
		},
	};
};
```

**Step 3: Wire menu into `main.ts`**

In `main.ts`, at top add:

```ts
import { createMenuScene } from "./menu";
```

Remove the `placeholder` factory and replace `loadScene(placeholder)` with:

```ts
loadScene(createMenuScene);
```

**Step 4: Smoke test**

`pnpm dev` → you see:
- Dark purple background.
- Glowing purple "RETRO DRIFTERS" title.
- "START" button centered.
- Clicking Start does nothing visible yet (menu unloads, empty scene — that's expected until race is built).

**Step 5: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters
git commit -m "feat(drifters): menu scene shell with neon title and start button"
```

---

## Task 5: Car geometry module

**Files:**
- Create: `nova-games/case-retro-drifters/src/car/geometry.ts`

**Step 1: Write `buildCar`**

```ts
import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
} from "three";

export type CarModel = "skyline";

export function buildCar(model: CarModel = "skyline"): Group {
	const group = new Group();
	if (model !== "skyline") {
		throw new Error(`car model not implemented: ${model}`);
	}

	const bodyMat = new MeshStandardMaterial({
		color: 0xa060ff, metalness: 0.6, roughness: 0.35,
	});
	const windowMat = new MeshStandardMaterial({
		color: 0x060010, metalness: 0.2, roughness: 0.1,
	});
	const wheelMat = new MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
	const tailMat = new MeshStandardMaterial({
		color: 0xff2244, emissive: 0xff2244, emissiveIntensity: 1.4,
	});
	const headMat = new MeshStandardMaterial({
		color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.1,
	});

	const addBox = (w: number, h: number, d: number, mat: MeshStandardMaterial,
		x: number, y: number, z: number): Mesh => {
		const m = new Mesh(new BoxGeometry(w, h, d), mat);
		m.position.set(x, y, z);
		group.add(m);
		return m;
	};

	addBox(2.0, 0.5, 4.4, bodyMat, 0, 0.35, 0);
	addBox(1.7, 0.4, 2.0, windowMat, 0, 0.80, -0.1);
	addBox(0.6, 0.1, 0.6, bodyMat, 0, 0.62, 1.2);
	addBox(1.8, 0.15, 0.05, tailMat, 0, 0.5, -2.2);
	addBox(0.4, 0.15, 0.05, headMat, -0.55, 0.5, 2.2);
	addBox(0.4, 0.15, 0.05, headMat, 0.55, 0.5, 2.2);

	const wheelGeo = new CylinderGeometry(0.4, 0.4, 0.5, 16);
	const wheelPositions: [number, number][] = [
		[-0.95, 1.6], [0.95, 1.6], [-0.95, -1.6], [0.95, -1.6],
	];
	for (const [x, z] of wheelPositions) {
		const w = new Mesh(wheelGeo, wheelMat);
		w.position.set(x, 0.4, z);
		w.rotation.z = Math.PI / 2;
		group.add(w);
	}

	return group;
}
```

**Step 2: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src/car
git commit -m "feat(drifters): primitive-box skyline geometry"
```

---

## Task 6: Menu scene spinning car

**Files:**
- Modify: `nova-games/case-retro-drifters/src/menu.ts`

**Step 1: Add car import**

```ts
import type { Group } from "three";
import { buildCar } from "./car/geometry";
```

**Step 2: Add car to scene**

Inside `createMenuScene`, after adding `floor`:

```ts
const car: Group = buildCar("skyline");
car.position.set(0, 0, 0);
scene.add(car);
```

Update `update`:

```ts
update(dt: number) {
	car.rotation.y += dt * 0.6;
},
```

Add car disposal to `dispose()`:

```ts
dispose() {
	menuUI.style.display = "none";
	startBtn.removeEventListener("click", onStart);
	floor.geometry.dispose();
	(floor.material as MeshStandardMaterial).dispose();
	car.traverse((obj) => {
		const mesh = obj as { geometry?: { dispose(): void }; material?: { dispose(): void } };
		mesh.geometry?.dispose();
		mesh.material?.dispose();
	});
},
```

**Step 3: Smoke test**

Skyline visible on menu, spinning slowly. Taillights red glow, headlights white glow.

**Step 4: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src/menu.ts
git commit -m "feat(drifters): spinning skyline on menu"
```

---

## Task 7: Input module

**Files:**
- Create: `nova-games/case-retro-drifters/src/input.ts`

**Step 1: Write it**

```ts
import type { CarInput } from "./types";

type KeyState = Record<string, boolean>;

export class Input {
	private keys: KeyState = {};

	constructor() {
		window.addEventListener("keydown", this.onDown);
		window.addEventListener("keyup", this.onUp);
	}

	dispose(): void {
		window.removeEventListener("keydown", this.onDown);
		window.removeEventListener("keyup", this.onUp);
	}

	private onDown = (e: KeyboardEvent): void => {
		this.keys[e.code] = true;
	};
	private onUp = (e: KeyboardEvent): void => {
		this.keys[e.code] = false;
	};

	isDown(code: string): boolean {
		return !!this.keys[code];
	}

	readCar(): CarInput {
		const left = this.isDown("ArrowLeft") || this.isDown("KeyA");
		const right = this.isDown("ArrowRight") || this.isDown("KeyD");
		const throttle = this.isDown("Space") ? 1 : 0;
		const driftBtn = this.isDown("ShiftLeft") || this.isDown("ShiftRight");
		const brake = driftBtn && this.isDown("KeyS") ? 1 : 0;
		const steer = (left ? -1 : 0) + (right ? 1 : 0);
		return { throttle, brake, steer, driftBtn };
	}
}
```

**Step 2: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src/input.ts
git commit -m "feat(drifters): keyboard input module"
```

---

## Task 8: Physics — throttle + steering (TDD)

**Files:**
- Create: `nova-games/case-retro-drifters/src/car/physics.ts`
- Create: `nova-games/case-retro-drifters/src/car/physics.test.ts`

**Step 1: Write the failing tests**

`src/car/physics.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { initialCarState, updateCar } from "./physics";

const noInput = { throttle: 0, brake: 0, steer: 0, driftBtn: false };

describe("updateCar", () => {
	it("returns state with same position at rest with no input", () => {
		const s0 = initialCarState();
		const s1 = updateCar(s0, noInput, 0.016);
		expect(s1.position.x).toBeCloseTo(s0.position.x);
		expect(s1.position.z).toBeCloseTo(s0.position.z);
		expect(s1.speed).toBeCloseTo(0);
	});

	it("throttle accelerates the car forward", () => {
		let s = initialCarState();
		for (let i = 0; i < 60; i++) {
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		}
		expect(s.speed).toBeGreaterThan(5);
		expect(s.velocity.z).toBeGreaterThan(0);
	});

	it("throttle decays when released", () => {
		let s = initialCarState();
		for (let i = 0; i < 60; i++) s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		const peak = s.speed;
		for (let i = 0; i < 120; i++) s = updateCar(s, noInput, 0.016);
		expect(s.speed).toBeLessThan(peak - 3);
	});

	it("steering with speed rotates heading", () => {
		let s = initialCarState();
		for (let i = 0; i < 60; i++) s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		const h0 = s.heading;
		for (let i = 0; i < 60; i++) {
			s = updateCar(s, { ...noInput, throttle: 1, steer: 1 }, 0.016);
		}
		expect(Math.abs(s.heading - h0)).toBeGreaterThan(0.3);
	});
});
```

**Step 2: Run tests**

```bash
cd nova-games/case-retro-drifters
pnpm test
```

Expected: fails with "cannot find module" or similar.

**Step 3: Minimal implementation**

`src/car/physics.ts`:

```ts
import type { CarInput, CarState, Vec2 } from "../types";
import { v2, v2dot, v2len } from "../types";

export const MAX_SPEED = 30;
export const DRIFT_SPEED_THRESHOLD = 18;
export const THROTTLE_FORCE = 40;
export const IDLE_DECAY = 4;
export const HARD_BRAKE_DECAY = 30;
export const STEER_RATE = 3.0;
export const DRIFT_STEER_MULT = 1.6;
export const ANGULAR_DAMPING = 0.90;
export const GRIP_RECOVERY = 2.5;
export const GRIP_DECAY = 1.4;
export const MIN_GRIP = 0.3;
export const SPIN_OUT_ANGLE = (Math.PI * 2) / 3;
export const SPIN_OUT_DURATION = 0.8;
export const LATERAL_FRICTION = 5;

export function initialCarState(): CarState {
	return {
		position: v2(0, 0),
		velocity: v2(0, 0),
		heading: 0,
		angularVelocity: 0,
		speed: 0,
		grip: 1,
		isDrifting: false,
		spinOutTimer: 0,
	};
}

function headingVec(heading: number): Vec2 {
	return v2(Math.sin(heading), Math.cos(heading));
}

export function updateCar(s: CarState, inp: CarInput, dt: number): CarState {
	if (dt <= 0) return s;

	const effectiveInput: CarInput = s.spinOutTimer > 0
		? { throttle: 0, brake: 0, steer: 0, driftBtn: false }
		: inp;

	const fwd = headingVec(s.heading);

	let angularVelocity = s.angularVelocity + effectiveInput.steer * STEER_RATE * dt;
	// Framerate-independent exponential damping (reference rate: 60Hz).
	angularVelocity *= Math.pow(ANGULAR_DAMPING, dt * 60);

	let vForward = v2dot(s.velocity, fwd);
	vForward += effectiveInput.throttle * THROTTLE_FORCE * dt;
	if (effectiveInput.throttle === 0) {
		const decay = IDLE_DECAY * dt;
		vForward = vForward > 0
			? Math.max(0, vForward - decay)
			: Math.min(0, vForward + decay);
	}
	if (effectiveInput.brake > 0) {
		const decay = HARD_BRAKE_DECAY * dt;
		vForward = vForward > 0
			? Math.max(0, vForward - decay)
			: Math.min(0, vForward + decay);
	}
	vForward = Math.max(-MAX_SPEED * 0.5, Math.min(MAX_SPEED, vForward));

	const velocity: Vec2 = { x: fwd.x * vForward, z: fwd.z * vForward };
	const heading = s.heading + angularVelocity * dt;
	const position: Vec2 = {
		x: s.position.x + velocity.x * dt,
		z: s.position.z + velocity.z * dt,
	};

	return {
		position, velocity, heading, angularVelocity,
		speed: v2len(velocity),
		grip: 1, isDrifting: false,
		spinOutTimer: Math.max(0, s.spinOutTimer - dt),
	};
}
```

**Step 4: Run tests → all 4 passing**

```bash
pnpm test
```

**Step 5: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src/car
git commit -m "feat(drifters): basic throttle + steering physics (TDD)"
```

---

## Task 9: Physics — drift grip + lateral slide (TDD)

**Files:**
- Modify: `nova-games/case-retro-drifters/src/car/physics.ts`
- Modify: `nova-games/case-retro-drifters/src/car/physics.test.ts`

**Step 1: Add failing tests**

Append to `physics.test.ts`:

```ts
import { DRIFT_SPEED_THRESHOLD } from "./physics";

describe("drift & grip", () => {
	it("does not drift below speed threshold", () => {
		let s = initialCarState();
		for (let i = 0; i < 10; i++) s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		for (let i = 0; i < 10; i++) {
			s = updateCar(s, { throttle: 1, brake: 0, steer: 1, driftBtn: true }, 0.016);
		}
		expect(s.isDrifting).toBe(false);
		expect(s.grip).toBeGreaterThan(0.9);
	});

	it("drifts above speed threshold when shift + steer", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++) s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		expect(s.speed).toBeGreaterThan(DRIFT_SPEED_THRESHOLD);
		for (let i = 0; i < 30; i++) {
			s = updateCar(s, { throttle: 1, brake: 0, steer: 1, driftBtn: true }, 0.016);
		}
		expect(s.isDrifting).toBe(true);
		expect(s.grip).toBeLessThan(0.8);
	});

	it("grip recovers after drift released", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++) s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		for (let i = 0; i < 30; i++) {
			s = updateCar(s, { throttle: 1, brake: 0, steer: 1, driftBtn: true }, 0.016);
		}
		const dropped = s.grip;
		expect(dropped).toBeLessThan(0.8);
		for (let i = 0; i < 60; i++) s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		expect(s.grip).toBeGreaterThan(dropped + 0.1);
	});

	it("drifting creates lateral velocity (slip angle > 0)", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++) s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		for (let i = 0; i < 30; i++) {
			s = updateCar(s, { throttle: 1, brake: 0, steer: 1, driftBtn: true }, 0.016);
		}
		const hx = Math.sin(s.heading);
		const hz = Math.cos(s.heading);
		const vMag = Math.hypot(s.velocity.x, s.velocity.z);
		const dot = (s.velocity.x * hx + s.velocity.z * hz) / Math.max(vMag, 1e-5);
		const slip = Math.acos(Math.max(-1, Math.min(1, dot)));
		expect(slip).toBeGreaterThan(0.1);
	});
});
```

**Step 2: Run → 4 new failures.**

**Step 3: Replace `updateCar` body**

Replace the existing `updateCar` function body in `physics.ts` with:

```ts
export function updateCar(s: CarState, inp: CarInput, dt: number): CarState {
	if (dt <= 0) return s;

	const effectiveInput: CarInput = s.spinOutTimer > 0
		? { throttle: 0, brake: 0, steer: 0, driftBtn: false }
		: inp;

	const fwd = headingVec(s.heading);

	// Drift state.
	const wantsDrift =
		effectiveInput.driftBtn &&
		Math.abs(effectiveInput.steer) > 0.01 &&
		s.speed > DRIFT_SPEED_THRESHOLD;
	const isDrifting = wantsDrift;
	const gripTarget = isDrifting ? MIN_GRIP : 1;
	const gripRate = isDrifting ? GRIP_DECAY : GRIP_RECOVERY;
	let grip = s.grip;
	if (grip < gripTarget) grip = Math.min(gripTarget, grip + gripRate * dt);
	else if (grip > gripTarget) grip = Math.max(gripTarget, grip - gripRate * dt);

	// Angular velocity.
	const steerMult = isDrifting ? DRIFT_STEER_MULT : 1;
	let angularVelocity =
		s.angularVelocity + effectiveInput.steer * STEER_RATE * steerMult * dt;
	// Framerate-independent exponential damping (reference rate: 60Hz).
	angularVelocity *= Math.pow(ANGULAR_DAMPING, dt * 60);

	// Decompose velocity into forward and lateral (right-vector) components.
	const rightX = Math.cos(s.heading);
	const rightZ = -Math.sin(s.heading);
	let vForward = v2dot(s.velocity, fwd);
	let vLateral = s.velocity.x * rightX + s.velocity.z * rightZ;

	// Throttle.
	vForward += effectiveInput.throttle * THROTTLE_FORCE * dt;
	if (effectiveInput.throttle === 0) {
		const decay = IDLE_DECAY * dt;
		vForward = vForward > 0 ? Math.max(0, vForward - decay) : Math.min(0, vForward + decay);
	}
	if (effectiveInput.brake > 0) {
		const decay = HARD_BRAKE_DECAY * dt;
		vForward = vForward > 0 ? Math.max(0, vForward - decay) : Math.min(0, vForward + decay);
	}
	vForward = Math.max(-MAX_SPEED * 0.5, Math.min(MAX_SPEED, vForward));

	// Drift: inject lateral velocity proportional to how much heading is
	// rotating vs how much grip we have left.
	const driftInjection = (1 - grip) * angularVelocity * Math.abs(vForward) * dt * 0.6;
	vLateral += driftInjection;

	// Lateral friction — stronger with more grip.
	const lateralDecay = grip * LATERAL_FRICTION * dt;
	vLateral = vLateral > 0
		? Math.max(0, vLateral - lateralDecay)
		: Math.min(0, vLateral + lateralDecay);

	const velocity: Vec2 = {
		x: fwd.x * vForward + rightX * vLateral,
		z: fwd.z * vForward + rightZ * vLateral,
	};

	const heading = s.heading + angularVelocity * dt;
	const position: Vec2 = {
		x: s.position.x + velocity.x * dt,
		z: s.position.z + velocity.z * dt,
	};

	return {
		position, velocity, heading, angularVelocity,
		speed: v2len(velocity),
		grip, isDrifting,
		spinOutTimer: Math.max(0, s.spinOutTimer - dt),
	};
}
```

**Step 4: Run → all 8 tests pass**

**Step 5: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src/car
git commit -m "feat(drifters): drift grip + lateral slide (TDD)"
```

---

## Task 10: Physics — spin-out + counter-steer (TDD)

**Files:**
- Modify: `nova-games/case-retro-drifters/src/car/physics.ts`
- Modify: `nova-games/case-retro-drifters/src/car/physics.test.ts`

**Step 1: Add failing tests**

Append to `physics.test.ts`:

```ts
import type { CarState } from "../types";
import { v2 } from "../types";

describe("spin-out", () => {
	it("extreme drift without counter-steer triggers spin-out", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++) s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		for (let i = 0; i < 240; i++) {
			s = updateCar(s, { throttle: 1, brake: 0, steer: 1, driftBtn: true }, 0.016);
		}
		expect(s.spinOutTimer).toBeGreaterThan(0);
	});

	it("spin-out locks out input (throttle ignored)", () => {
		const stuck: CarState = {
			...initialCarState(),
			spinOutTimer: 0.5,
			velocity: v2(0, 10),
			speed: 10,
		};
		const next = updateCar(stuck, { throttle: 1, brake: 0, steer: 0, driftBtn: false }, 0.016);
		expect(next.spinOutTimer).toBeLessThan(0.5);
		expect(next.speed).toBeLessThanOrEqual(stuck.speed);
	});
});
```

**Step 2: Run → 2 new failures.**

**Step 3: Extend `updateCar`**

In `physics.ts`, **after** computing `velocity` (and `heading` and `position`) but **before** the final `return`, insert:

```ts
	// Spin-out detection.
	let spinOutTimer = Math.max(0, s.spinOutTimer - dt);
	const vMag = Math.hypot(velocity.x, velocity.z);
	if (spinOutTimer === 0 && isDrifting && vMag > 5) {
		const dot = (velocity.x * fwd.x + velocity.z * fwd.z) / vMag;
		const slip = Math.acos(Math.max(-1, Math.min(1, dot)));
		const counterSteering =
			Math.sign(effectiveInput.steer) !== 0 &&
			Math.sign(effectiveInput.steer) === -Math.sign(angularVelocity) &&
			Math.abs(effectiveInput.steer) > 0.5;
		if (slip > SPIN_OUT_ANGLE && !counterSteering) {
			spinOutTimer = SPIN_OUT_DURATION;
			angularVelocity = (Math.random() - 0.5) * 8;
			velocity.x *= 0.2;
			velocity.z *= 0.2;
		}
	}

	// Counter-steer reward: extra damping on angular velocity.
	if (
		isDrifting &&
		Math.sign(effectiveInput.steer) !== 0 &&
		Math.sign(effectiveInput.steer) === -Math.sign(angularVelocity)
	) {
		angularVelocity *= Math.pow(0.85, dt * 60);
	}
```

Replace the final return's `spinOutTimer` field to use the new variable:

```ts
	return {
		position, velocity, heading, angularVelocity,
		speed: v2len(velocity),
		grip, isDrifting,
		spinOutTimer,
	};
```

**Step 4: Run tests → all passing**

```bash
pnpm test
```

**Step 5: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src/car
git commit -m "feat(drifters): spin-out + counter-steer damping (TDD)"
```

---

## Task 11: Tokyo waypoints

**Files:**
- Create: `nova-games/case-retro-drifters/src/track/waypoints.ts`

**Step 1: Write**

```ts
import type { Waypoint } from "../types";

const W = 8;

export const tokyoWaypoints: Waypoint[] = [
	{ pos: { x: 0,   z: 0   }, width: W, tag: "start" },
	{ pos: { x: 30,  z: 10  }, width: W },
	{ pos: { x: 55,  z: 35  }, width: W },
	{ pos: { x: 70,  z: 70  }, width: W },
	{ pos: { x: 70,  z: 105 }, width: W },
	{ pos: { x: 50,  z: 130 }, width: W },
	{ pos: { x: 20,  z: 140 }, width: W },
	{ pos: { x: -15, z: 130 }, width: W },
	{ pos: { x: -40, z: 110 }, width: W },
	{ pos: { x: -50, z: 80  }, width: W },
	{ pos: { x: -55, z: 45  }, width: W * 1.8, tag: "shibuya" },
	{ pos: { x: -50, z: 10  }, width: W },
	{ pos: { x: -35, z: -20 }, width: W },
	{ pos: { x: -10, z: -40 }, width: W },
	{ pos: { x: 20,  z: -45 }, width: W },
	{ pos: { x: 50,  z: -35 }, width: W },
	{ pos: { x: 65,  z: -15 }, width: W },
	{ pos: { x: 40,  z: -5  }, width: W },
	{ pos: { x: 20,  z: -2  }, width: W },
];
```

**Step 2: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src/track
git commit -m "feat(drifters): tokyo track waypoints"
```

---

## Task 12: Track collision (TDD)

**Files:**
- Create: `nova-games/case-retro-drifters/src/track/collision.ts`
- Create: `nova-games/case-retro-drifters/src/track/collision.test.ts`

**Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import type { Waypoint } from "../types";
import { v2 } from "../types";
import { nearestSegment, offTrack, pointToSegment } from "./collision";

const loop: Waypoint[] = [
	{ pos: v2(0, 0), width: 4 },
	{ pos: v2(10, 0), width: 4 },
	{ pos: v2(10, 10), width: 4 },
	{ pos: v2(0, 10), width: 4 },
];

describe("pointToSegment", () => {
	it("distance to a point on the segment is 0", () => {
		const d = pointToSegment(v2(5, 0), v2(0, 0), v2(10, 0));
		expect(d.distance).toBeCloseTo(0);
		expect(d.t).toBeCloseTo(0.5);
	});

	it("perpendicular distance", () => {
		const d = pointToSegment(v2(5, 3), v2(0, 0), v2(10, 0));
		expect(d.distance).toBeCloseTo(3);
	});

	it("clamps before segment start", () => {
		const d = pointToSegment(v2(-2, 0), v2(0, 0), v2(10, 0));
		expect(d.distance).toBeCloseTo(2);
		expect(d.t).toBe(0);
	});
});

describe("nearestSegment", () => {
	it("finds closest segment of closed loop", () => {
		const n = nearestSegment(v2(5, 1), loop);
		expect(n.segmentIndex).toBe(0);
		expect(n.distance).toBeCloseTo(1);
	});
});

describe("offTrack", () => {
	it("point on centerline is on track", () => {
		expect(offTrack(v2(5, 0), loop)).toBe(false);
	});

	it("point well outside is off track", () => {
		expect(offTrack(v2(5, 10), loop)).toBe(true);
	});

	it("point just inside width is on track", () => {
		expect(offTrack(v2(5, 1.9), loop)).toBe(false);
	});
});
```

**Step 2: Run → failures.**

**Step 3: Implement `collision.ts`**

```ts
import type { Vec2, Waypoint } from "../types";

export type SegmentHit = {
	segmentIndex: number;
	distance: number;
	t: number;
	closestPoint: Vec2;
};

export function pointToSegment(p: Vec2, a: Vec2, b: Vec2): SegmentHit {
	const dx = b.x - a.x;
	const dz = b.z - a.z;
	const lenSq = dx * dx + dz * dz;
	let t = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.z - a.z) * dz) / lenSq;
	t = Math.max(0, Math.min(1, t));
	const cx = a.x + dx * t;
	const cz = a.z + dz * t;
	return {
		segmentIndex: -1,
		distance: Math.hypot(p.x - cx, p.z - cz),
		t,
		closestPoint: { x: cx, z: cz },
	};
}

export function nearestSegment(p: Vec2, waypoints: Waypoint[]): SegmentHit {
	let best: SegmentHit = {
		segmentIndex: -1, distance: Infinity, t: 0,
		closestPoint: { x: 0, z: 0 },
	};
	for (let i = 0; i < waypoints.length; i++) {
		const a = waypoints[i].pos;
		const b = waypoints[(i + 1) % waypoints.length].pos;
		const hit = pointToSegment(p, a, b);
		if (hit.distance < best.distance) best = { ...hit, segmentIndex: i };
	}
	return best;
}

export function offTrack(p: Vec2, waypoints: Waypoint[]): boolean {
	const hit = nearestSegment(p, waypoints);
	if (hit.segmentIndex < 0) return true;
	const a = waypoints[hit.segmentIndex];
	const b = waypoints[(hit.segmentIndex + 1) % waypoints.length];
	const avgHalfWidth = (a.width + b.width) / 4;
	return hit.distance > avgHalfWidth;
}

export function segmentDirection(a: Vec2, b: Vec2): Vec2 {
	const dx = b.x - a.x;
	const dz = b.z - a.z;
	const len = Math.hypot(dx, dz) || 1;
	return { x: dx / len, z: dz / len };
}
```

**Step 4: Run → all passing**

```bash
pnpm test
```

**Step 5: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src/track
git commit -m "feat(drifters): track collision math (TDD)"
```

---

## Task 13: Track geometry — road mesh

**Files:**
- Create: `nova-games/case-retro-drifters/src/track/geometry.ts`

**Step 1: Write**

```ts
import {
	BoxGeometry,
	BufferAttribute,
	BufferGeometry,
	CatmullRomCurve3,
	DoubleSide,
	Group,
	Mesh,
	MeshStandardMaterial,
	PlaneGeometry,
	Vector3,
} from "three";
import type { Waypoint } from "../types";

export type TrackSample = { x: number; z: number; width: number; tag?: string };

export type TrackMeshes = {
	root: Group;
	road: Mesh;
	sampled: TrackSample[];
};

export function buildRoad(waypoints: Waypoint[]): TrackMeshes {
	const pts = waypoints.map((w) => new Vector3(w.pos.x, 0, w.pos.z));
	const curve = new CatmullRomCurve3(pts, true, "catmullrom", 0.3);
	const samples = curve.getPoints(200);

	const sampled: TrackSample[] = samples.map((p) => {
		let nearest = waypoints[0];
		let best = Infinity;
		for (const w of waypoints) {
			const d = Math.hypot(p.x - w.pos.x, p.z - w.pos.z);
			if (d < best) {
				best = d;
				nearest = w;
			}
		}
		return { x: p.x, z: p.z, width: nearest.width, tag: nearest.tag };
	});

	const positions: number[] = [];
	const uvs: number[] = [];
	const indices: number[] = [];

	for (let i = 0; i < samples.length; i++) {
		const curr = samples[i];
		const next = samples[(i + 1) % samples.length];
		const tx = next.x - curr.x;
		const tz = next.z - curr.z;
		const len = Math.hypot(tx, tz) || 1;
		const nx = -tz / len;
		const nz = tx / len;
		const halfW = sampled[i].width / 2;
		positions.push(curr.x + nx * halfW, 0.01, curr.z + nz * halfW);
		positions.push(curr.x - nx * halfW, 0.01, curr.z - nz * halfW);
		uvs.push(0, i / 4);
		uvs.push(1, i / 4);
	}

	const n = samples.length;
	for (let i = 0; i < n; i++) {
		const a = i * 2;
		const b = i * 2 + 1;
		const c = ((i + 1) % n) * 2;
		const d = ((i + 1) % n) * 2 + 1;
		indices.push(a, c, b, b, c, d);
	}

	const roadGeo = new BufferGeometry();
	roadGeo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
	roadGeo.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));
	roadGeo.setIndex(indices);
	roadGeo.computeVertexNormals();

	const roadMat = new MeshStandardMaterial({
		color: 0x1a1a24, roughness: 0.85, side: DoubleSide,
	});
	const road = new Mesh(roadGeo, roadMat);

	const root = new Group();

	const ground = new Mesh(
		new PlaneGeometry(800, 800),
		new MeshStandardMaterial({ color: 0x0a0515, roughness: 1 }),
	);
	ground.rotation.x = -Math.PI / 2;
	ground.position.y = -0.01;
	root.add(ground);
	root.add(road);

	const wallMat = new MeshStandardMaterial({
		color: 0x6020a0, emissive: 0x4020c0, emissiveIntensity: 0.6,
		metalness: 0.4, roughness: 0.3,
	});
	for (let i = 0; i < sampled.length; i++) {
		if (sampled[i].tag === "shibuya") continue;
		const curr = sampled[i];
		const next = sampled[(i + 1) % sampled.length];
		if (next.tag === "shibuya") continue;
		const tx = next.x - curr.x;
		const tz = next.z - curr.z;
		const len = Math.hypot(tx, tz) || 1;
		const nx = -tz / len;
		const nz = tx / len;
		const halfW = curr.width / 2 + 0.4;
		for (const side of [1, -1]) {
			// Long axis of the box is Z so that after lookAt (which orients
			// local -Z toward the target), the wall extends along the track.
			const wall = new Mesh(new BoxGeometry(0.4, 2.2, len + 0.6), wallMat);
			wall.position.set(
				curr.x + nx * halfW * side + tx / 2,
				1.1,
				curr.z + nz * halfW * side + tz / 2,
			);
			wall.lookAt(wall.position.x + tx, 1.1, wall.position.z + tz);
			root.add(wall);
		}
	}

	const buildingMat = new MeshStandardMaterial({
		color: 0x1a0a3a, emissive: 0x4020c0, emissiveIntensity: 0.25,
		metalness: 0.6, roughness: 0.4,
	});
	for (let i = 0; i < 40; i++) {
		const idx = Math.floor((i / 40) * sampled.length);
		const s = sampled[idx];
		const next = sampled[(idx + 1) % sampled.length];
		const tx = next.x - s.x;
		const tz = next.z - s.z;
		const len = Math.hypot(tx, tz) || 1;
		const nx = -tz / len;
		const nz = tx / len;
		const offset = s.width / 2 + 4 + Math.random() * 8;
		const h = 6 + Math.random() * 18;
		const bw = 3 + Math.random() * 4;
		const b = new Mesh(new BoxGeometry(bw, h, bw), buildingMat);
		b.position.set(s.x + nx * offset, h / 2, s.z + nz * offset);
		root.add(b);
	}

	return { root, road, sampled };
}
```

**Step 2: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src/track/geometry.ts
git commit -m "feat(drifters): track spline mesh + walls + buildings"
```

---

## Task 14: HUD module

**Files:**
- Create: `nova-games/case-retro-drifters/src/hud.ts`

**Step 1: Write**

```ts
import { MAX_SPEED } from "./car/physics";

export class HUD {
	private root = document.getElementById("race-hud") as HTMLDivElement;
	private fill = document.getElementById("hud-speed-fill") as HTMLDivElement;
	private lap = document.getElementById("hud-lap") as HTMLDivElement;
	private timerCurrent = document.getElementById("hud-timer-current") as HTMLSpanElement;
	private timerBest = document.getElementById("hud-timer-best") as HTMLSpanElement;
	private center = document.getElementById("hud-center") as HTMLDivElement;
	private back = document.getElementById("hud-back") as HTMLButtonElement;
	private hideTimer: number | null = null;

	show(): void { this.root.classList.add("active"); }
	hide(): void {
		this.root.classList.remove("active");
		this.back.classList.remove("visible");
	}

	setSpeed(speed: number, drifting: boolean): void {
		const pct = Math.max(0, Math.min(1, speed / MAX_SPEED));
		this.fill.style.height = `${pct * 100}%`;
		this.fill.style.filter = drifting ? "brightness(1.4) saturate(1.5)" : "";
	}

	setLap(current: number, total: number): void {
		this.lap.textContent = `LAP ${current} / ${total}`;
	}

	setTimes(current: number, best: number | null): void {
		this.timerCurrent.textContent = fmt(current);
		this.timerBest.textContent = best == null ? "best --" : `best ${fmt(best)}`;
	}

	flash(text: string, durationMs: number): void {
		this.setCenter(text);
		if (this.hideTimer !== null) window.clearTimeout(this.hideTimer);
		this.hideTimer = window.setTimeout(() => {
			this.clearCenter();
			this.hideTimer = null;
		}, durationMs);
	}

	setCenter(text: string): void {
		this.center.textContent = text;
		this.center.classList.add("visible");
	}

	clearCenter(): void {
		this.center.classList.remove("visible");
	}

	onBack(handler: () => void): () => void {
		this.back.addEventListener("click", handler);
		return () => this.back.removeEventListener("click", handler);
	}

	showBack(): void { this.back.classList.add("visible"); }
}

function fmt(seconds: number): string {
	const m = Math.floor(seconds / 60);
	const s = (seconds % 60).toFixed(3).padStart(6, "0");
	return `${m.toString().padStart(2, "0")}:${s}`;
}
```

**Step 2: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src/hud.ts
git commit -m "feat(drifters): HUD module (DOM overlay)"
```

---

## Task 15: Race scene — assemble everything

**Files:**
- Create: `nova-games/case-retro-drifters/src/race.ts`

**Step 1: Write the race scene**

```ts
import {
	AmbientLight,
	DirectionalLight,
	type Group,
	PerspectiveCamera,
	Scene,
} from "three";
import { buildCar } from "./car/geometry";
import { initialCarState, updateCar } from "./car/physics";
import { HUD } from "./hud";
import { Input } from "./input";
import type { GameScene, SceneContext, SceneFactory } from "./scene";
import { nearestSegment, offTrack, segmentDirection } from "./track/collision";
import { buildRoad } from "./track/geometry";
import { tokyoWaypoints } from "./track/waypoints";
import type { CarInput, CarState } from "./types";

const TOTAL_LAPS = 3;

export const createRaceScene: SceneFactory = (ctx: SceneContext): GameScene => {
	const scene = new Scene();
	scene.add(new AmbientLight(0x6060a0, 0.55));
	const dirLight = new DirectionalLight(0xffeeff, 0.75);
	dirLight.position.set(20, 40, 15);
	scene.add(dirLight);

	const camera = new PerspectiveCamera(40, ctx.width / ctx.height, 0.1, 1000);

	const track = buildRoad(tokyoWaypoints);
	scene.add(track.root);

	const carMesh: Group = buildCar("skyline");
	scene.add(carMesh);

	const input = new Input();
	const hud = new HUD();
	hud.show();
	hud.setLap(1, TOTAL_LAPS);
	hud.setTimes(0, null);
	hud.setSpeed(0, false);

	// Car state, pointed toward waypoint 1.
	let car: CarState = {
		...initialCarState(),
		position: { ...tokyoWaypoints[0].pos },
	};
	{
		const a = tokyoWaypoints[0].pos;
		const b = tokyoWaypoints[1].pos;
		car.heading = Math.atan2(b.x - a.x, b.z - a.z);
	}

	// Race progression.
	let countdown = 3.0;
	hud.setCenter("3");
	let raceTime = 0;
	let lapStart = 0;
	let lap = 1;
	let bestLap: number | null = null;
	let finished = false;
	let halfwayReached = false;
	let penaltyTimer = 0;

	// Start line direction (used as forward direction AND to derive its
	// left-perpendicular normal for side-of-line detection).
	const startA = tokyoWaypoints[0].pos;
	const startB = tokyoWaypoints[1].pos;
	const startDirX = startB.x - startA.x;
	const startDirZ = startB.z - startA.z;
	// Perpendicular to startDir (left-hand). Not normalized — we only use
	// signs and relative magnitudes.
	const startNormX = -startDirZ;
	const startNormZ = startDirX;

	// Camera smoothing.
	let camTargetX = car.position.x;
	let camTargetZ = car.position.z;

	// Esc / back handlers.
	const removeBackHandler = hud.onBack(() => goBack());
	const onKey = (e: KeyboardEvent): void => {
		if (e.code === "Escape") goBack();
	};
	window.addEventListener("keydown", onKey);
	let disposed = false;

	async function goBack(): Promise<void> {
		if (disposed) return;
		const { createMenuScene } = await import("./menu");
		ctx.switchTo(createMenuScene);
	}

	function applyOffTrackPenalty(): void {
		const hit = nearestSegment(car.position, tokyoWaypoints);
		const a = tokyoWaypoints[hit.segmentIndex].pos;
		const b = tokyoWaypoints[(hit.segmentIndex + 1) % tokyoWaypoints.length].pos;
		const dir = segmentDirection(a, b);
		car = {
			...car,
			position: { ...hit.closestPoint },
			velocity: { x: dir.x * car.speed * 0.5, z: dir.z * car.speed * 0.5 },
			heading: Math.atan2(dir.x, dir.z),
			angularVelocity: 0,
			speed: car.speed * 0.5,
			isDrifting: false,
			grip: 1,
		};
		penaltyTimer = 3;
		hud.setCenter("OFF TRACK");
	}

	function detectLapCross(prev: { x: number; z: number }, next: { x: number; z: number }): boolean {
		// Signed perpendicular distance from the infinite start-finish line.
		// Racing forward carries the car from prevSide < 0 to nextSide >= 0.
		const prevSide = (prev.x - startA.x) * startNormX + (prev.z - startA.z) * startNormZ;
		const nextSide = (next.x - startA.x) * startNormX + (next.z - startA.z) * startNormZ;
		// Guard: only count forward crossings (velocity has positive
		// component along startDir).
		const vDotDir = (next.x - prev.x) * startDirX + (next.z - prev.z) * startDirZ;
		return prevSide < 0 && nextSide >= 0 && vDotDir > 0;
	}

	return {
		scene,
		camera,
		update(dt: number) {
			// Countdown: freeze car, just animate camera.
			if (countdown > 0) {
				countdown -= dt;
				const n = Math.ceil(countdown);
				if (countdown <= 0) {
					hud.flash("GO", 700);
					countdown = 0;
				} else {
					hud.setCenter(String(n));
				}
				carMesh.position.set(car.position.x, 0, car.position.z);
				carMesh.rotation.y = car.heading;
				camTargetX = car.position.x;
				camTargetZ = car.position.z;
				camera.position.set(camTargetX, 18, camTargetZ + 10);
				camera.lookAt(camTargetX, 0, camTargetZ);
				return;
			}

			if (finished) {
				// Keep rendering but ignore input.
				camera.position.set(camTargetX, 18, camTargetZ + 10);
				camera.lookAt(camTargetX, 0, camTargetZ);
				return;
			}

			let inp: CarInput = input.readCar();
			if (penaltyTimer > 0) {
				inp = { throttle: 0, brake: 0, steer: 0, driftBtn: false };
				penaltyTimer -= dt;
				if (penaltyTimer <= 0) hud.clearCenter();
			}

			const prev = { ...car.position };
			car = updateCar(car, inp, dt);

			if (penaltyTimer <= 0 && offTrack(car.position, tokyoWaypoints)) {
				applyOffTrackPenalty();
			}

			raceTime += dt;
			const lapTime = raceTime - lapStart;

			// Track halfway state — lap only counts after car has been far
			// from the start/finish line.
			const distFromStart = Math.hypot(
				car.position.x - startA.x,
				car.position.z - startA.z,
			);
			if (distFromStart > 60) halfwayReached = true;

			if (halfwayReached && detectLapCross(prev, car.position)) {
				if (bestLap == null || lapTime < bestLap) bestLap = lapTime;
				if (lap < TOTAL_LAPS) {
					lap += 1;
					lapStart = raceTime;
					halfwayReached = false;
					hud.setLap(lap, TOTAL_LAPS);
					hud.flash(`LAP ${lap}`, 900);
				} else {
					finished = true;
					hud.setCenter(`FINISH\n${raceTime.toFixed(2)}s`);
					hud.showBack();
				}
			}

			// Camera: Hades-tilt follow, extra snap when drifting.
			const lag = car.isDrifting ? 0.08 : 0.2;
			const lerp = Math.min(1, dt / lag);
			camTargetX += (car.position.x - camTargetX) * lerp;
			camTargetZ += (car.position.z - camTargetZ) * lerp;
			camera.position.set(camTargetX, 18, camTargetZ + 10);
			camera.lookAt(camTargetX, 0, camTargetZ);

			carMesh.position.set(car.position.x, 0, car.position.z);
			carMesh.rotation.y = car.heading;
			hud.setSpeed(car.speed, car.isDrifting);
			hud.setTimes(lapTime, bestLap);
		},
		dispose() {
			disposed = true;
			input.dispose();
			removeBackHandler();
			window.removeEventListener("keydown", onKey);
			hud.hide();
			hud.clearCenter();
			scene.traverse((obj) => {
				const m = obj as { geometry?: { dispose(): void }; material?: { dispose(): void } | { dispose(): void }[] };
				m.geometry?.dispose();
				if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
				else m.material?.dispose();
			});
		},
	};
};
```

**Step 2: Smoke test**

`pnpm dev` → Menu → Start →
- Countdown "3/2/1/GO" plays; car static for 3s.
- After GO, Space accelerates, A/D steer, Shift+steer at speed drifts, counter-steer recovers.
- Speedometer fills; brightens on drift.
- Driving off-track → "OFF TRACK" + snap-back + throttle frozen 3s.
- Drive around the full loop, cross start line → "LAP 2" flashes, counter updates.
- After 3 laps → "FINISH" + total time + BACK TO MENU button appears.
- Esc or Back button → menu scene.

**Step 3: Verify + commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
git add nova-games/case-retro-drifters/src/race.ts
git commit -m "feat(drifters): full race scene — car, track, HUD, laps, penalty"
```

---

## Task 16: Wire landing page + final verification

**Files:**
- Modify: `nova-games/index.html`

**Step 1: Add game card**

Inside the `.game-grid` in `nova-games/index.html`, add (keep existing cards):

```html
<a href="./case-retro-drifters/" class="game-card">
	<span class="game-title">Retro Drifters</span>
	<span class="game-author">by Case</span>
	<span class="game-engine">Three.js</span>
</a>
```

**Step 2: Full repo test**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm run test
```

Expected: passes (tsc + biome clean).

**Step 3: Full build check**

```bash
pnpm run build
```

Expected: `build-games.mjs` logs `case-retro-drifters: ok`. `dist/nova-games/case-retro-drifters/index.html` exists.

**Step 4: Manual play-test checklist**

```bash
cd nova-games/case-retro-drifters
pnpm dev
```

- [ ] Menu: neon purple title, START button, spinning Skyline.
- [ ] Start → loads race.
- [ ] Countdown 3-2-1-GO before control.
- [ ] Space accelerates; speedometer fills.
- [ ] A / D steer; Arrow keys also work.
- [ ] Shift + steer at speed → car drifts (visible slide, speedometer glow).
- [ ] Counter-steer recovers drift without spin-out.
- [ ] Hold drift too long without counter-steer → spin out (brief chaos, slow down, resume).
- [ ] Shift + S → hard brake, no drift.
- [ ] Off-track → "OFF TRACK" + snap-back + 3s lockout.
- [ ] Full loop crossing start line → "LAP 2" flashes.
- [ ] 3 laps completed → "FINISH" + timer + BACK TO MENU button.
- [ ] Esc at any point → menu (clean, no stuck UI).
- [ ] No console errors during a full run.

**Step 5: Commit**

```bash
git add nova-games/index.html
git commit -m "feat(drifters): list retro drifters on nova-games landing page"
```

---

## Done

Prototype meets the design brief:

- **Menu:** spinning Skyline + neon purple title + START button.
- **Race:** Hades-tilt camera, Tokyo spline track with neon walls + buildings + open Shibuya crossing, throttle/steer/drift physics with counter-steer and spin-out, off-track penalty, 3-lap timing with best-lap tracking, countdown, finish screen, back-to-menu.
- **Testable core:** `car/physics.ts` and `track/collision.ts` are pure and covered by Vitest.
- **Extension seams for iteration 2+:**
  - `buildCar(model)` for adding Miata/Supra/etc.
  - Waypoint-based maps for adding Sahara/Amazon/Venice/Alps (plus palette swap).
  - Scene switcher supports adding Locker/Shop/Friends scenes without core rewrites.
