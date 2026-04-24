# case-retro-drifters Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship 11 gameplay, visual, and handling changes to `nova-games/case-retro-drifters` on the `feat/case-retro-drifters-overhaul` branch.

**Architecture:** Three.js + TypeScript scene system. `race.ts` composes `car/physics.ts`, `track/geometry.ts`, `input.ts`, `hud.ts`. New modules: `fx/smoke.ts` (particle system), `race/lights.ts` (F1 starting lights), `track/walls.ts` (bounce resolution). Changes are sequenced so each task independently passes `pnpm test` and `pnpm run test` at the repo root.

**Tech Stack:** Three.js v0.164, Vite 7, TypeScript 5.9, Vitest 1.6, Biome.

**Reference:** Full design in `docs/plans/2026-04-23-case-retro-drifters-overhaul-design.md`.

---

## Working directory convention

All relative paths below resolve against `/Users/taylor/dev/tayl0r.github.com-case/`.
- Game source: `nova-games/case-retro-drifters/src/`
- Game test command (scoped): `cd nova-games/case-retro-drifters && pnpm test`
- Repo-wide lint + typecheck: `pnpm run test` (from repo root)
- Dev server: `cd nova-games/case-retro-drifters && pnpm dev`

Before every commit:
1. `cd nova-games/case-retro-drifters && pnpm test` (unit tests)
2. `cd ../.. && pnpm run test` (root tsc + biome)

---

## Task 1: Input — rising-edge drift trigger + W/↑ throttle

**Files:**
- Modify: `nova-games/case-retro-drifters/src/types.ts`
- Modify: `nova-games/case-retro-drifters/src/input.ts`

**Step 1: Update CarInput type**

Open `nova-games/case-retro-drifters/src/types.ts`. Find the `CarInput` type (around line 3). Replace `driftBtn: boolean` with `driftPress: boolean`:

```ts
export type CarInput = {
	throttle: number; // 0..1
	brake: number; // 0..1
	steer: number; // -1..1
	driftPress: boolean; // rising edge of Shift
};
```

Update the `// Shift held` comment since it's no longer accurate — now documented as rising edge.

**Step 2: Update Input class**

Open `nova-games/case-retro-drifters/src/input.ts`. Replace the file entirely with:

```ts
import type { CarInput } from "./types";

type KeyState = Record<string, boolean>;

export class Input {
	private keys: KeyState = {};
	private prevShift = false;

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
		const throttle =
			this.isDown("Space") || this.isDown("KeyW") || this.isDown("ArrowUp")
				? 1
				: 0;
		const brake = this.isDown("KeyS") ? 1 : 0;
		const shiftNow =
			this.isDown("ShiftLeft") || this.isDown("ShiftRight");
		const driftPress = shiftNow && !this.prevShift;
		this.prevShift = shiftNow;
		const steer = (left ? -1 : 0) + (right ? 1 : 0);
		return { throttle, brake, steer, driftPress };
	}
}
```

Changes vs original:
- Added `private prevShift` field for rising-edge detect.
- `throttle` now triggers on Space | KeyW | ArrowUp.
- `brake` now triggers on KeyS alone (no longer gated by shift).
- `driftBtn: boolean` (latched) replaced with `driftPress: boolean` (one-frame rising edge).

**Step 3: Verify it compiles**

Run: `cd nova-games/case-retro-drifters && npx tsc --noEmit`
Expected: errors in `physics.ts`, `physics.test.ts`, and `race.ts` referencing `driftBtn`. That's expected — we fix those next. No *new* errors in `input.ts` or `types.ts`.

**Step 4: Do NOT commit yet**

The codebase won't build until Task 2 updates physics. Don't commit until Task 2 is complete — we'll commit them together.

---

## Task 2: Car physics — sharper steering + tap-drift + auto-release

**Files:**
- Modify: `nova-games/case-retro-drifters/src/types.ts`
- Modify: `nova-games/case-retro-drifters/src/car/physics.ts`
- Modify: `nova-games/case-retro-drifters/src/car/physics.test.ts`

**Step 1: Add driftExitTimer to CarState**

In `types.ts`, add to `CarState`:

```ts
export type CarState = {
	position: Vec2;
	velocity: Vec2;
	heading: number;
	angularVelocity: number;
	speed: number;
	grip: number;
	isDrifting: boolean;
	spinOutTimer: number;
	driftExitTimer: number; // seconds near-straight while drifting (for auto-release)
};
```

**Step 2: Update initial state**

In `car/physics.ts`, update `initialCarState`:

```ts
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
		driftExitTimer: 0,
	};
}
```

**Step 3: Update physics constants**

In `car/physics.ts`, change:

```ts
export const STEER_RATE = 4.2;       // was 3.0 — sharper turns
export const ANGULAR_DAMPING = 0.88; // was 0.9 — holds tighter arcs
```

Add new constants at the top of the constants block:

```ts
export const DRIFT_KICK_MAGNITUDE = 8;      // initial lateral impulse on drift engage
export const DRIFT_EXIT_LATERAL = 1.5;       // |vLateral| threshold for "straight again"
export const DRIFT_EXIT_DURATION = 0.15;     // seconds below threshold before auto-release
export const DRIFT_EXIT_SPEED = DRIFT_SPEED_THRESHOLD * 0.6; // speed floor
export const COUNTERSTEER_DAMP = 0.94;       // was 0.85 — gentler
```

**Step 4: Rewrite updateCar to use new drift model**

Replace the body of `updateCar` in `car/physics.ts` with:

```ts
export function updateCar(s: CarState, inp: CarInput, dt: number): CarState {
	if (dt <= 0) return s;

	const effectiveInput: CarInput =
		s.spinOutTimer > 0
			? { throttle: 0, brake: 0, steer: 0, driftPress: false }
			: inp;

	const fwd = headingVec(s.heading);

	// Decompose current velocity before any change, so we can add kicks cleanly.
	const rightX = Math.cos(s.heading);
	const rightZ = -Math.sin(s.heading);
	let vForward = v2dot(s.velocity, fwd);
	let vLateral = s.velocity.x * rightX + s.velocity.z * rightZ;

	// Drift engage (rising edge of driftPress, above speed threshold, not mid-spin).
	let isDrifting = s.isDrifting;
	let driftExitTimer = s.driftExitTimer;
	let grip = s.grip;
	if (
		effectiveInput.driftPress &&
		!isDrifting &&
		s.speed > DRIFT_SPEED_THRESHOLD &&
		s.spinOutTimer === 0
	) {
		isDrifting = true;
		const kickSign = Math.sign(effectiveInput.steer) || 1;
		vLateral += kickSign * DRIFT_KICK_MAGNITUDE;
		grip = MIN_GRIP;
		driftExitTimer = 0;
	}

	// Grip behaviour (no change to recovery logic; during drift we pin it at MIN_GRIP).
	if (isDrifting) {
		grip = MIN_GRIP;
	} else if (grip < 1) {
		grip = Math.min(1, grip + GRIP_RECOVERY * dt);
	}

	// Angular velocity.
	const steerMult = isDrifting ? DRIFT_STEER_MULT : 1;
	let angularVelocity =
		s.angularVelocity + effectiveInput.steer * STEER_RATE * steerMult * dt;
	angularVelocity *= ANGULAR_DAMPING ** (dt * 60);

	// Throttle.
	vForward += effectiveInput.throttle * THROTTLE_FORCE * dt;
	if (effectiveInput.throttle === 0) {
		const decay = IDLE_DECAY * dt;
		vForward =
			vForward > 0
				? Math.max(0, vForward - decay)
				: Math.min(0, vForward + decay);
	}
	if (effectiveInput.brake > 0) {
		const decay = HARD_BRAKE_DECAY * dt;
		vForward =
			vForward > 0
				? Math.max(0, vForward - decay)
				: Math.min(0, vForward + decay);
	}
	vForward = Math.max(-MAX_SPEED * 0.5, Math.min(MAX_SPEED, vForward));

	// Drift injection (same formula as before) — only while drifting.
	if (isDrifting) {
		const driftInjection =
			(1 - grip) * angularVelocity * Math.abs(vForward) * dt * 0.6;
		vLateral += driftInjection;
	}

	// Lateral friction.
	const lateralDecay = grip * LATERAL_FRICTION * dt;
	vLateral =
		vLateral > 0
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

	// Spin-out detection (unchanged except reading isDrifting from latch).
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
			isDrifting = false;
		}
	}

	// Counter-steer damping (softer than before).
	if (
		isDrifting &&
		Math.sign(effectiveInput.steer) !== 0 &&
		Math.sign(effectiveInput.steer) === -Math.sign(angularVelocity)
	) {
		angularVelocity *= COUNTERSTEER_DAMP ** (dt * 60);
	}

	// Auto-release: accumulate time near-straight, or exit on low speed / spin-out.
	if (isDrifting) {
		if (Math.abs(vLateral) < DRIFT_EXIT_LATERAL) {
			driftExitTimer += dt;
		} else {
			driftExitTimer = 0;
		}
		const speedNow = Math.hypot(velocity.x, velocity.z);
		if (
			driftExitTimer >= DRIFT_EXIT_DURATION ||
			speedNow < DRIFT_EXIT_SPEED ||
			spinOutTimer > 0
		) {
			isDrifting = false;
			driftExitTimer = 0;
		}
	} else {
		driftExitTimer = 0;
	}

	return {
		position,
		velocity,
		heading,
		angularVelocity,
		speed: v2len(velocity),
		grip,
		isDrifting,
		spinOutTimer,
		driftExitTimer,
	};
}
```

**Step 5: Update existing tests to use new input shape**

In `car/physics.test.ts`, update the `noInput` constant:

```ts
const noInput = { throttle: 0, brake: 0, steer: 0, driftPress: false };
```

Global find-and-replace within the test file: `driftBtn: true` → `driftPress: true`, `driftBtn: false` → `driftPress: false`.

The "drifts above speed threshold when shift + steer" test currently holds `driftBtn: true` every frame. With the new rising-edge model, this produces exactly one engage (first frame). Replace its body with:

```ts
it("drifts on shift tap above speed threshold", () => {
	let s = initialCarState();
	for (let i = 0; i < 120; i++)
		s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
	expect(s.speed).toBeGreaterThan(DRIFT_SPEED_THRESHOLD);
	// Single tap on frame 1.
	s = updateCar(
		s,
		{ throttle: 1, brake: 0, steer: 1, driftPress: true },
		0.016,
	);
	expect(s.isDrifting).toBe(true);
	expect(s.grip).toBeLessThanOrEqual(0.31);
	// Continue holding steer (no further press) — drift stays engaged for a while.
	for (let i = 0; i < 10; i++) {
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: false },
			0.016,
		);
	}
	expect(s.isDrifting).toBe(true);
});
```

Update "grip recovers after drift released": change the drift loop to single press + continued hold:

```ts
it("grip recovers after drift auto-releases", () => {
	let s = initialCarState();
	for (let i = 0; i < 120; i++)
		s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
	s = updateCar(
		s,
		{ throttle: 1, brake: 0, steer: 1, driftPress: true },
		0.016,
	);
	// Straighten out — no steer, no further press. Drift should auto-exit.
	for (let i = 0; i < 120; i++)
		s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
	expect(s.isDrifting).toBe(false);
	expect(s.grip).toBeGreaterThan(0.8);
});
```

Update "drifting creates lateral velocity (slip angle > 0)": same pattern — tap once, then hold steer:

```ts
it("drifting creates lateral velocity (slip angle > 0)", () => {
	let s = initialCarState();
	for (let i = 0; i < 120; i++)
		s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
	s = updateCar(
		s,
		{ throttle: 1, brake: 0, steer: 1, driftPress: true },
		0.016,
	);
	for (let i = 0; i < 20; i++) {
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: false },
			0.016,
		);
	}
	const hx = Math.sin(s.heading);
	const hz = Math.cos(s.heading);
	const vMag = Math.hypot(s.velocity.x, s.velocity.z);
	const dot = (s.velocity.x * hx + s.velocity.z * hz) / Math.max(vMag, 1e-5);
	const slip = Math.acos(Math.max(-1, Math.min(1, dot)));
	expect(slip).toBeGreaterThan(0.1);
});
```

Update "does not drift below speed threshold": tap once at low speed, assert it doesn't engage:

```ts
it("does not drift below speed threshold", () => {
	let s = initialCarState();
	for (let i = 0; i < 10; i++)
		s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
	expect(s.speed).toBeLessThan(DRIFT_SPEED_THRESHOLD);
	s = updateCar(
		s,
		{ throttle: 1, brake: 0, steer: 1, driftPress: true },
		0.016,
	);
	expect(s.isDrifting).toBe(false);
	expect(s.grip).toBeGreaterThan(0.9);
});
```

Spin-out tests: change `driftBtn: true` → `driftPress: true` mechanically. Note that the "slip angle exceeding threshold triggers spin-out" test sets up an already-drifting state, but with rising-edge semantics we need `isDrifting: true` pre-set. Update the `extreme` construction:

```ts
const extreme: CarState = {
	...initialCarState(),
	velocity: v2(0, -20),
	speed: 20,
	grip: 0.3,
	isDrifting: true, // already drifting — slip will trigger spin-out
};
```

Same update for the counter-steering variant.

**Step 6: Add new unit tests**

Append to `car/physics.test.ts`:

```ts
describe("drift tap mechanics", () => {
	it("engages drift only on rising edge, not sustained press", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		// Frame 1: press — should engage.
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: true },
			0.016,
		);
		expect(s.isDrifting).toBe(true);
		const latAfterEngage = Math.abs(
			s.velocity.x * Math.cos(s.heading) +
				s.velocity.z * -Math.sin(s.heading),
		);
		// Frame 2: another driftPress=true (shouldn't re-kick — already drifting).
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: true },
			0.016,
		);
		const latAfterSecond = Math.abs(
			s.velocity.x * Math.cos(s.heading) +
				s.velocity.z * -Math.sin(s.heading),
		);
		// Lateral velocity should not grow by another full kick — within ~1 unit.
		expect(Math.abs(latAfterSecond - latAfterEngage)).toBeLessThan(3);
	});

	it("auto-releases drift when lateral velocity stays near zero", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: true },
			0.016,
		);
		expect(s.isDrifting).toBe(true);
		// No more steer, no more press. Lateral friction should kill vLateral
		// and the auto-release timer should trip within DRIFT_EXIT_DURATION.
		for (let i = 0; i < 60; i++) {
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		}
		expect(s.isDrifting).toBe(false);
	});

	it("auto-releases drift when speed drops below floor", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: true },
			0.016,
		);
		expect(s.isDrifting).toBe(true);
		// Hard brake the whole way down.
		for (let i = 0; i < 200; i++) {
			s = updateCar(
				s,
				{ throttle: 0, brake: 1, steer: 0, driftPress: false },
				0.016,
			);
		}
		expect(s.speed).toBeLessThan(5);
		expect(s.isDrifting).toBe(false);
	});
});
```

**Step 7: Update race.ts to compile**

Open `nova-games/case-retro-drifters/src/race.ts`. There's one reference to `driftBtn` inside `applyOffTrackPenalty` that doesn't exist — but also `penaltyTimer` block at line ~161 creates `{ throttle: 0, brake: 0, steer: 0, driftBtn: false }`. Change that line to `driftPress: false`.

**Step 8: Run tests**

Run: `cd nova-games/case-retro-drifters && pnpm test`
Expected: all tests pass. If a drift-related assertion fails, confirm the test was updated to the new shape.

Run: `cd ../.. && pnpm run test`
Expected: tsc clean, biome clean.

**Step 9: Commit**

```bash
git add nova-games/case-retro-drifters/src/input.ts \
        nova-games/case-retro-drifters/src/types.ts \
        nova-games/case-retro-drifters/src/car/physics.ts \
        nova-games/case-retro-drifters/src/car/physics.test.ts \
        nova-games/case-retro-drifters/src/race.ts
git commit -m "$(cat <<'EOF'
feat(case-retro-drifters): tap-to-drift, sharper turns, W/↑ throttle

- Shift is now rising-edge: tap engages drift with lateral kick, auto-releases when car straightens or slows.
- Countersteer damping softened (0.85→0.94).
- Steering sharpened (STEER_RATE 3.0→4.2, ANGULAR_DAMPING 0.9→0.88).
- W and ArrowUp now accelerate alongside Space.
- Brake (KeyS) decoupled from shift.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Track — wider roads + realistic materials + lane markings

**Files:**
- Modify: `nova-games/case-retro-drifters/src/track/waypoints.ts`
- Modify: `nova-games/case-retro-drifters/src/track/geometry.ts`

**Step 1: Widen the track**

In `track/waypoints.ts`, change `const W = 8;` to `const W = 14;`. No other changes — the shibuya multiplier stays proportional.

**Step 2: Update road material**

In `track/geometry.ts`, find `roadMat` (around line 78). Replace with:

```ts
const roadMat = new MeshStandardMaterial({
	color: 0x3a3a3e,
	roughness: 0.9,
	metalness: 0.05,
	side: DoubleSide,
});
```

**Step 3: Update ground material**

In the same file, find the `ground` Mesh construction (around line 87). Replace its material:

```ts
const ground = new Mesh(
	new PlaneGeometry(800, 800),
	new MeshStandardMaterial({ color: 0x1a1c20, roughness: 1 }),
);
```

**Step 4: Update wall material + height**

Find `wallMat` (around line 96). Replace with:

```ts
const wallMat = new MeshStandardMaterial({
	color: 0xb0b0b0,
	roughness: 0.8,
	metalness: 0.1,
});
```

Inside the wall-construction loop, change wall geometry from `new BoxGeometry(0.4, 2.2, len + 0.6)` to `new BoxGeometry(0.4, 1.2, len + 0.6)`, and `wall.position.set(..., 1.1, ...)` to `wall.position.set(..., 0.6, ...)`. Same for `wall.lookAt(..., 1.1, ...)` → `wall.lookAt(..., 0.6, ...)`.

**Step 5: Add lane markings**

In `track/geometry.ts`, add a helper below the existing imports at the top of the file:

```ts
function buildLineStrip(
	samples: { x: number; z: number }[],
	sampled: TrackSample[],
	offset: number, // 0 = centerline, +halfW = right edge, -halfW = left edge
	width: number,
	color: number,
	dashed: boolean,
): Mesh {
	const positions: number[] = [];
	const indices: number[] = [];
	let vertIdx = 0;
	const n = samples.length;
	for (let i = 0; i < n; i++) {
		if (dashed && Math.floor(i / 4) % 2 === 1) continue; // 4 samples on, 4 off
		const curr = samples[i];
		const next = samples[(i + 1) % n];
		const tx = next.x - curr.x;
		const tz = next.z - curr.z;
		const len = Math.hypot(tx, tz) || 1;
		const nx = -tz / len;
		const nz = tx / len;
		const halfW = sampled[i].width / 2;
		const cx = curr.x + nx * halfW * offset; // offset expressed as fraction of halfW... no, we pass absolute offset
		// Actually: offset is absolute (0 = centerline, ±halfW = edge).
		const baseX = curr.x + (nx * offset) / Math.max(halfW, 1e-6) * halfW; // = curr.x + nx * offset
		const baseZ = curr.z + (nz * offset) / Math.max(halfW, 1e-6) * halfW;
		// Simplify: just use absolute offset directly.
		const bx = curr.x + nx * offset;
		const bz = curr.z + nz * offset;
		positions.push(bx + nx * (width / 2), 0.02, bz + nz * (width / 2));
		positions.push(bx - nx * (width / 2), 0.02, bz - nz * (width / 2));
		if (i < n - 1) {
			const a = vertIdx;
			const b = vertIdx + 1;
			const c = vertIdx + 2;
			const d = vertIdx + 3;
			indices.push(a, c, b, b, c, d);
		}
		vertIdx += 2;
	}
	const geo = new BufferGeometry();
	geo.setAttribute(
		"position",
		new BufferAttribute(new Float32Array(positions), 3),
	);
	geo.setIndex(indices);
	geo.computeVertexNormals();
	return new Mesh(
		geo,
		new MeshStandardMaterial({
			color,
			roughness: 0.7,
			side: DoubleSide,
		}),
	);
}
```

Simplify the helper body — the earlier attempt has redundant lines. Clean version:

```ts
function buildLineStrip(
	samples: { x: number; z: number }[],
	sampled: TrackSample[],
	centerOffset: number, // absolute units from road centerline (signed)
	lineWidth: number,
	color: number,
	dashed: boolean,
): Mesh {
	const positions: number[] = [];
	const indices: number[] = [];
	let vertIdx = 0;
	const n = samples.length;
	for (let i = 0; i < n; i++) {
		const dashOn = !dashed || Math.floor(i / 4) % 2 === 0;
		const curr = samples[i];
		const next = samples[(i + 1) % n];
		const tx = next.x - curr.x;
		const tz = next.z - curr.z;
		const len = Math.hypot(tx, tz) || 1;
		const nx = -tz / len;
		const nz = tx / len;
		const bx = curr.x + nx * centerOffset;
		const bz = curr.z + nz * centerOffset;
		positions.push(bx + nx * (lineWidth / 2), 0.02, bz + nz * (lineWidth / 2));
		positions.push(bx - nx * (lineWidth / 2), 0.02, bz - nz * (lineWidth / 2));
		if (i < n - 1 && dashOn) {
			const a = vertIdx;
			const b = vertIdx + 1;
			const c = vertIdx + 2;
			const d = vertIdx + 3;
			indices.push(a, c, b, b, c, d);
		}
		vertIdx += 2;
	}
	const geo = new BufferGeometry();
	geo.setAttribute(
		"position",
		new BufferAttribute(new Float32Array(positions), 3),
	);
	geo.setIndex(indices);
	geo.computeVertexNormals();
	return new Mesh(
		geo,
		new MeshStandardMaterial({
			color,
			roughness: 0.7,
			side: DoubleSide,
		}),
	);
}
```

**Step 6: Wire lane markings into buildRoad**

In `buildRoad` (after `root.add(road);` around line 94), add:

```ts
const centerline = buildLineStrip(samples, sampled, 0, 0.3, 0xe8c200, true);
root.add(centerline);
// Edge lines sit just inside the wall position.
const avgHalfW = sampled[0].width / 2;
const leftEdge = buildLineStrip(samples, sampled, avgHalfW - 0.4, 0.25, 0xe8e8e8, false);
const rightEdge = buildLineStrip(samples, sampled, -(avgHalfW - 0.4), 0.25, 0xe8e8e8, false);
root.add(leftEdge);
root.add(rightEdge);
```

Note: `avgHalfW` is a rough value from the start point. Lines won't hug the widened shibuya section exactly — acceptable for v1 (a later improvement is per-sample width).

**Step 7: Run tests**

Run: `cd nova-games/case-retro-drifters && pnpm test`
Expected: pass.

Run: `cd ../.. && pnpm run test`
Expected: tsc + biome clean.

**Step 8: Manual visual check**

Run: `cd nova-games/case-retro-drifters && pnpm dev`
Open the URL. Click "start race" → see a wider gray road, yellow dashed center, white edges, concrete walls shorter than before. Press Esc/back to return.
If visual looks broken, fix and retest before committing.

**Step 9: Commit**

```bash
git add nova-games/case-retro-drifters/src/track/waypoints.ts \
        nova-games/case-retro-drifters/src/track/geometry.ts
git commit -m "$(cat <<'EOF'
feat(case-retro-drifters): realistic city palette + lane markings + wider roads

Gray asphalt (0x3a3a3e), yellow dashed centerline, white solid edge
lines, concrete jersey-barrier walls (0xb0b0b0, 1.2m tall vs 2.2m).
Road width 8→14 across all waypoints; shibuya node proportional.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Buildings — both sides, tan/gray palette, no overlap with road

**Files:**
- Modify: `nova-games/case-retro-drifters/src/track/geometry.ts`

**Step 1: Expose buildings from buildRoad**

Update the `TrackMeshes` type in `track/geometry.ts` to include buildings:

```ts
export type TrackMeshes = {
	root: Group;
	road: Mesh;
	sampled: TrackSample[];
	buildings: Mesh[];
};
```

**Step 2: Rewrite the building loop**

In `buildRoad`, replace the existing building block (starting from `const buildingMat = ...` through the `for (let i = 0; i < 40; i++)` loop) with:

```ts
const buildingColors = [0x8a8a90, 0xa09888, 0x6a6a78, 0x7a6a5a];
const buildings: Mesh[] = [];

// Simple distance check: min distance from point p to the sampled track polyline.
const distToTrack = (px: number, pz: number): number => {
	let best = Number.POSITIVE_INFINITY;
	for (let i = 0; i < sampled.length; i++) {
		const a = sampled[i];
		const b = sampled[(i + 1) % sampled.length];
		const dx = b.x - a.x;
		const dz = b.z - a.z;
		const lenSq = dx * dx + dz * dz || 1;
		let t = ((px - a.x) * dx + (pz - a.z) * dz) / lenSq;
		t = Math.max(0, Math.min(1, t));
		const cx = a.x + dx * t;
		const cz = a.z + dz * t;
		const d = Math.hypot(px - cx, pz - cz) - a.width / 2;
		if (d < best) best = d;
	}
	return best; // >0 means outside road, <0 means inside road
};

const BUILDING_COUNT = 50;
for (let i = 0; i < BUILDING_COUNT; i++) {
	const idx = Math.floor((i / BUILDING_COUNT) * sampled.length);
	const s = sampled[idx];
	const next = sampled[(idx + 1) % sampled.length];
	const tx = next.x - s.x;
	const tz = next.z - s.z;
	const len = Math.hypot(tx, tz) || 1;
	const nx = -tz / len;
	const nz = tx / len;
	const side = Math.random() < 0.5 ? 1 : -1;
	const h = 6 + Math.random() * 18;
	const bw = 3 + Math.random() * 4;

	// Try two offsets; skip if both would overlap the road shoulder.
	let placed = false;
	for (const attempt of [6 + Math.random() * 10, 10 + Math.random() * 8]) {
		const offset = s.width / 2 + attempt;
		const bx = s.x + nx * offset * side;
		const bz = s.z + nz * offset * side;
		// Reject if building's nearest corner is within 2 units of road edge.
		const buildingRadius = (bw * Math.SQRT2) / 2;
		if (distToTrack(bx, bz) - buildingRadius > 2) {
			const mat = new MeshStandardMaterial({
				color: buildingColors[i % buildingColors.length],
				roughness: 0.85,
				metalness: 0.1,
			});
			const b = new Mesh(new BoxGeometry(bw, h, bw), mat);
			b.position.set(bx, h / 2, bz);
			root.add(b);
			buildings.push(b);
			placed = true;
			break;
		}
	}
	// If neither offset worked, skip this building — we're near a curve where
	// the opposite track segment is close.
	if (!placed) continue;
}
```

**Step 3: Return buildings from buildRoad**

Update the return statement at the end of `buildRoad`:

```ts
return { root, road, sampled, buildings };
```

**Step 4: Remove unused import**

If `buildingMat` was the only non-declaration reference to something that can now go, clean up imports. `MeshStandardMaterial`, `BoxGeometry` stay (used elsewhere).

**Step 5: Run tests**

Run: `cd nova-games/case-retro-drifters && pnpm test`
Expected: pass.

Run: `cd ../.. && pnpm run test`
Expected: tsc + biome clean.

**Step 6: Manual visual check**

Run dev server, start race. Drive the full lap. Buildings should be on BOTH sides and never inside the road. If you see a building in the road, note where (waypoint index) and tweak `BUILDING_COUNT` down or increase the 2-unit reject threshold.

**Step 7: Commit**

```bash
git add nova-games/case-retro-drifters/src/track/geometry.ts
git commit -m "$(cat <<'EOF'
feat(case-retro-drifters): buildings on both sides, never inside road

Buildings randomly distributed left/right of track with road-overlap
rejection (2-unit buffer). Tan/gray palette replaces neon purple;
emissive removed. Building meshes returned from buildRoad so race
scene can hook occlusion transparency later.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Camera zoom + tilt

**Files:**
- Modify: `nova-games/case-retro-drifters/src/race.ts`

**Step 1: Replace camera offsets**

In `race.ts`, find both places where `camera.position.set(camTargetX, 18, camTargetZ + 10)` appears (countdown block and main update block). Replace each with `camera.position.set(camTargetX, 26, camTargetZ + 18)`.

There should be 3 occurrences (countdown, finished, main). Update all three.

**Step 2: Run tests**

Run: `cd nova-games/case-retro-drifters && pnpm test`
Expected: pass.

Run: `cd ../.. && pnpm run test`
Expected: tsc + biome clean.

**Step 3: Manual check**

Run dev server, start race. Camera should sit further back and tilted slightly more toward horizon. Track visibility should improve — you can see more ahead.

**Step 4: Commit**

```bash
git add nova-games/case-retro-drifters/src/race.ts
git commit -m "$(cat <<'EOF'
feat(case-retro-drifters): zoom camera out, tilt 10° shallower

y: 18→26, z offset: 10→18. Pitch from ~61° to ~55°. More of the map
visible, better corner preview.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Building transparency when blocking camera

**Files:**
- Modify: `nova-games/case-retro-drifters/src/race.ts`

**Step 1: Import what we need**

Add to the top of `race.ts` imports:

```ts
import { Box3, type Mesh, Ray, Vector3 } from "three";
```

Merge with existing three.js import.

**Step 2: Track buildings and their opacity state**

Inside `createRaceScene`, after `scene.add(track.root);`, add:

```ts
const buildings = track.buildings;
// Make materials transparent-ready.
for (const b of buildings) {
	const mat = b.material as { transparent: boolean; depthWrite: boolean; opacity: number };
	mat.transparent = true;
	mat.depthWrite = false;
	mat.opacity = 1;
}
const buildingBoxes = buildings.map((b) => new Box3().setFromObject(b));
const buildingTargetOpacity = new Float32Array(buildings.length).fill(1);
const ray = new Ray();
const camPos = new Vector3();
const carPos = new Vector3();
```

**Step 3: Add the occlusion update inside the main `update(dt)` block**

After the camera `camera.lookAt(...)` line in the main (non-countdown, non-finished) update path, add:

```ts
// Occlusion transparency for buildings between camera and car.
camPos.copy(camera.position);
carPos.set(car.position.x, 1, car.position.z);
ray.origin.copy(camPos);
ray.direction.copy(carPos).sub(camPos).normalize();
const distToCar = camPos.distanceTo(carPos);
const hit = new Vector3();
for (let i = 0; i < buildings.length; i++) {
	const target = ray.intersectBox(buildingBoxes[i], hit);
	let blocking = false;
	if (target) {
		const d = camPos.distanceTo(hit);
		if (d > 0.1 && d < distToCar) blocking = true;
	}
	buildingTargetOpacity[i] = blocking ? 0.25 : 1.0;
}
// Smoothly lerp current opacity toward target.
const opacityLerp = 1 - Math.exp(-dt / 0.3);
for (let i = 0; i < buildings.length; i++) {
	const mat = buildings[i].material as { opacity: number };
	mat.opacity += (buildingTargetOpacity[i] - mat.opacity) * opacityLerp;
}
```

**Step 4: Run tests**

Run: `cd nova-games/case-retro-drifters && pnpm test`
Expected: pass.

Run: `cd ../.. && pnpm run test`
Expected: tsc + biome clean.

**Step 5: Manual visual check**

Run dev server, start race. Drive toward a building. When a building sits between camera and car, it should fade to ~25% opacity; when the car passes it, it fades back to full.

If transparency looks too subtle, lower the 0.25 target to 0.1. If transparent buildings still obscure the car, that means we need to handle cases where the car mesh itself is being rendered behind a transparent building — the `depthWrite: false` should make the building not obscure, but if it still does, check Three.js renderer sort order.

**Step 6: Commit**

```bash
git add nova-games/case-retro-drifters/src/race.ts
git commit -m "$(cat <<'EOF'
feat(case-retro-drifters): fade buildings blocking camera-to-car

Per-frame ray test from camera to car against each building AABB;
occluders lerp toward opacity 0.25 over 0.3s, non-occluders back to
1.0. depthWrite off so transparent buildings don't punch holes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wall bounce — replace off-track teleport

**Files:**
- Create: `nova-games/case-retro-drifters/src/track/walls.ts`
- Modify: `nova-games/case-retro-drifters/src/race.ts`
- Modify: `nova-games/case-retro-drifters/src/car/physics.ts` (tiny — no change to signatures)

**Step 1: Create walls module**

Create `nova-games/case-retro-drifters/src/track/walls.ts`:

```ts
import type { CarState, Waypoint } from "../types";
import { nearestSegment } from "./collision";

const WALL_BUFFER = 0.3; // car considered "hitting" this close to edge
const WALL_INSET = 0.4; // clamp position to this inside the wall
const SCRAPE_RETAIN = 0.92; // keep 92% of along-wall velocity
const REBOUND = 0.4; // reflect 40% of into-wall velocity
const NUDGE = 0.5; // angular velocity nudge back toward road direction

export function resolveWallCollision(
	car: CarState,
	waypoints: Waypoint[],
): CarState {
	const hit = nearestSegment(car.position, waypoints);
	if (hit.segmentIndex < 0) return car;
	const a = waypoints[hit.segmentIndex].pos;
	const b = waypoints[(hit.segmentIndex + 1) % waypoints.length].pos;
	const halfW = waypoints[hit.segmentIndex].width / 2;
	if (hit.distance <= halfW - WALL_BUFFER) return car; // not touching wall

	// Segment direction + outward normal (side the car is on).
	const dx = b.x - a.x;
	const dz = b.z - a.z;
	const segLen = Math.hypot(dx, dz) || 1;
	const dirX = dx / segLen;
	const dirZ = dz / segLen;
	// Signed side: positive means left of segment direction, negative right.
	const toCarX = car.position.x - hit.closestPoint.x;
	const toCarZ = car.position.z - hit.closestPoint.z;
	const side = Math.sign(toCarX * -dirZ + toCarZ * dirX) || 1;
	const nX = -dirZ * side;
	const nZ = dirX * side;

	// Clamp position: push car back so it's at halfW - WALL_INSET from centerline.
	const clamp = halfW - WALL_INSET;
	const newPos = {
		x: hit.closestPoint.x + nX * clamp,
		z: hit.closestPoint.z + nZ * clamp,
	};

	// Decompose velocity.
	const vAlong = car.velocity.x * dirX + car.velocity.z * dirZ;
	const vInto = car.velocity.x * nX + car.velocity.z * nZ;

	const vAlongNew = vAlong * SCRAPE_RETAIN;
	const vIntoNew = -Math.max(vInto, 0) * REBOUND; // only reflect outward component

	const velocity = {
		x: dirX * vAlongNew + nX * vIntoNew,
		z: dirZ * vAlongNew + nZ * vIntoNew,
	};

	return {
		...car,
		position: newPos,
		velocity,
		speed: Math.hypot(velocity.x, velocity.z),
		angularVelocity: car.angularVelocity + Math.sign(vAlong) * NUDGE,
		isDrifting: false,
		grip: 1,
		driftExitTimer: 0,
	};
}
```

**Step 2: Wire into race.ts, remove teleport**

In `race.ts`:
- Remove the `import` of `offTrack` from `./track/collision` (keep `nearestSegment`, `segmentDirection`).
- Add `import { resolveWallCollision } from "./track/walls";`.
- Delete the `applyOffTrackPenalty` function entirely.
- Delete the `let penaltyTimer = 0;` declaration.
- In the main update block, delete the `if (penaltyTimer > 0) { ... }` branch that zeroed input.
- Delete the `if (penaltyTimer <= 0 && offTrack(...)) applyOffTrackPenalty();` block.
- After `car = updateCar(car, inp, dt);` add:

```ts
car = resolveWallCollision(car, tokyoWaypoints);
```

**Step 3: Add a wall collision unit test**

Create `nova-games/case-retro-drifters/src/track/walls.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { initialCarState } from "../car/physics";
import { v2, type CarState, type Waypoint } from "../types";
import { resolveWallCollision } from "./walls";

// Straight segment from (0,0) to (0,100), width 10 → half-width 5.
const segment: Waypoint[] = [
	{ pos: v2(0, 0), width: 10 },
	{ pos: v2(0, 100), width: 10 },
];

describe("resolveWallCollision", () => {
	it("is a no-op when car is within track", () => {
		const s: CarState = { ...initialCarState(), position: v2(1, 50), velocity: v2(0, 20), speed: 20 };
		const r = resolveWallCollision(s, segment);
		expect(r.position.x).toBeCloseTo(1);
		expect(r.velocity.z).toBeCloseTo(20);
	});

	it("clamps position when car crosses wall buffer", () => {
		const s: CarState = { ...initialCarState(), position: v2(6, 50), velocity: v2(5, 10), speed: 11 };
		const r = resolveWallCollision(s, segment);
		expect(r.position.x).toBeLessThanOrEqual(4.7); // inside halfW - WALL_INSET
	});

	it("reflects velocity going into wall", () => {
		const s: CarState = { ...initialCarState(), position: v2(6, 50), velocity: v2(10, 5), speed: Math.hypot(10, 5) };
		const r = resolveWallCollision(s, segment);
		expect(r.velocity.x).toBeLessThan(0); // bounced outward reversed to into-track
	});

	it("preserves along-wall velocity (mostly)", () => {
		const s: CarState = { ...initialCarState(), position: v2(6, 50), velocity: v2(0, 20), speed: 20 };
		const r = resolveWallCollision(s, segment);
		expect(r.velocity.z).toBeGreaterThan(15); // kept most of along-component
	});

	it("kills drift state on impact", () => {
		const s: CarState = {
			...initialCarState(),
			position: v2(6, 50),
			velocity: v2(5, 10),
			speed: 11,
			isDrifting: true,
			grip: 0.3,
		};
		const r = resolveWallCollision(s, segment);
		expect(r.isDrifting).toBe(false);
		expect(r.grip).toBe(1);
	});
});
```

Note: in the "reflects velocity going into wall" test, the car is at (6, 50) which is right of the segment (positive x side). `side = +1`, `nX = -dirZ * 1 = -1`, `nZ = dirX * 1 = 0`. So wall normal points to -X. `vInto = v · n = 10 * -1 + 5 * 0 = -10`. `vIntoNew = -max(-10, 0) * 0.4 = 0`. Hmm — that's the "outward" component only. The component we want to reflect is the *into-wall* component. Let me re-read the walls.ts code.

Actually the normal `n` points outward (away from road center, toward wall). The car is outside, so `vInto = v · n` being positive means velocity is pointing further outward (deeper into wall). We reflect that.

Re-checking: at (6, 50) with segment (0,0)→(0,100): segment direction is (0,1). Car offset from closest point (0,50) is (6, 0). Cross product sign: `toCar.x * -dirZ + toCar.z * dirX = 6 * -1 + 0 * 0 = -6`. So `side = -1`, `nX = -dirZ * -1 = 1, nZ = dirX * -1 = 0`. Normal points to +X (away from segment, out toward the wall the car is against). Good.

`vInto = v · n = 10 * 1 + 5 * 0 = 10` (positive — velocity is heading further into wall). `vIntoNew = -10 * 0.4 = -4` (reflected inward). So `velocity.x = dirX * vAlongNew + nX * vIntoNew = 0 * vAlong + 1 * -4 = -4`. Good — x-velocity flipped from +10 to -4.

Test `expect(r.velocity.x).toBeLessThan(0)` passes.

**Step 4: Run tests**

Run: `cd nova-games/case-retro-drifters && pnpm test`
Expected: all pass.

Run: `cd ../.. && pnpm run test`
Expected: tsc + biome clean.

**Step 5: Manual check**

Run dev server, start race. Deliberately steer into a wall:
- At an angle → car should scrape along the wall, keep moving.
- Head-on → car comes to near-stop against wall, no teleport, no "OFF TRACK" flash.

**Step 6: Commit**

```bash
git add nova-games/case-retro-drifters/src/track/walls.ts \
        nova-games/case-retro-drifters/src/track/walls.test.ts \
        nova-games/case-retro-drifters/src/race.ts
git commit -m "$(cat <<'EOF'
feat(case-retro-drifters): wall bounce replaces off-track teleport

resolveWallCollision clamps the car at halfWidth - 0.4, retains 92%
of along-wall velocity, reflects 40% of into-wall velocity, nudges
angular velocity toward road direction, and kills drift on impact.
Off-track penalty + reset logic removed.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: F1 start lights + checker start line

**Files:**
- Create: `nova-games/case-retro-drifters/src/race/lights.ts`
- Modify: `nova-games/case-retro-drifters/src/track/geometry.ts` (checker strip)
- Modify: `nova-games/case-retro-drifters/src/race.ts` (countdown logic)

**Step 1: Create the start lights module**

Create `nova-games/case-retro-drifters/src/race/lights.ts`:

```ts
import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	type Scene,
	SphereGeometry,
} from "three";

export type LightState = "off" | "red1" | "red2" | "red3" | "green";

export type StartLights = {
	group: Group;
	setState(s: LightState): void;
	dispose(): void;
};

export function createStartLights(
	scene: Scene,
	position: { x: number; z: number },
	rightNormal: { x: number; z: number },
	roadHalfWidth: number,
): StartLights {
	const group = new Group();
	const poleX = position.x + rightNormal.x * (roadHalfWidth + 3);
	const poleZ = position.z + rightNormal.z * (roadHalfWidth + 3);
	group.position.set(poleX, 0, poleZ);

	// Pole.
	const poleMat = new MeshStandardMaterial({ color: 0x404040, roughness: 0.8 });
	const pole = new Mesh(new CylinderGeometry(0.1, 0.1, 3, 8), poleMat);
	pole.position.y = 1.5;
	group.add(pole);

	// Bar.
	const barMat = new MeshStandardMaterial({ color: 0x202020, roughness: 0.7 });
	const bar = new Mesh(new BoxGeometry(1.4, 0.3, 0.3), barMat);
	bar.position.y = 3;
	group.add(bar);

	// 3 bulbs.
	const bulbMats: MeshStandardMaterial[] = [];
	const bulbs: Mesh[] = [];
	for (let i = 0; i < 3; i++) {
		const mat = new MeshStandardMaterial({
			color: 0x400000,
			emissive: 0x000000,
			emissiveIntensity: 0,
			roughness: 0.3,
		});
		const bulb = new Mesh(new SphereGeometry(0.14, 16, 12), mat);
		bulb.position.set(-0.45 + i * 0.45, 3, 0.2);
		group.add(bulb);
		bulbMats.push(mat);
		bulbs.push(bulb);
	}

	scene.add(group);

	const setBulb = (i: number, color: number, emissive: number, intensity: number): void => {
		bulbMats[i].color.setHex(color);
		bulbMats[i].emissive.setHex(emissive);
		bulbMats[i].emissiveIntensity = intensity;
	};

	const setState = (s: LightState): void => {
		const red = (i: number): void => setBulb(i, 0xff1020, 0xff1020, 2);
		const green = (i: number): void => setBulb(i, 0x20ff40, 0x20ff40, 2.2);
		const dark = (i: number): void => setBulb(i, 0x200000, 0x000000, 0);
		const reds = s === "red1" ? 1 : s === "red2" ? 2 : s === "red3" ? 3 : 0;
		const isGreen = s === "green";
		for (let i = 0; i < 3; i++) {
			if (isGreen) green(i);
			else if (i < reds) red(i);
			else dark(i);
		}
	};

	setState("off");

	return {
		group,
		setState,
		dispose: (): void => {
			scene.remove(group);
			for (const bulb of bulbs) (bulb.geometry as { dispose(): void }).dispose();
			for (const mat of bulbMats) mat.dispose();
			(pole.geometry as { dispose(): void }).dispose();
			(bar.geometry as { dispose(): void }).dispose();
			poleMat.dispose();
			barMat.dispose();
		},
	};
}
```

**Step 2: Add a checker strip to buildRoad**

In `track/geometry.ts`, add a helper (near `buildLineStrip`):

```ts
function buildCheckerStrip(
	startPos: { x: number; z: number },
	dir: { x: number; z: number },
	halfWidth: number,
	depth: number,
): Mesh {
	// Build 2 rows × N squares, full width.
	const squareSize = 0.6;
	const squaresAcross = Math.floor((halfWidth * 2) / squareSize);
	const rows = Math.max(1, Math.floor(depth / squareSize));
	const positions: number[] = [];
	const colors: number[] = [];
	const indices: number[] = [];
	const nx = -dir.z;
	const nz = dir.x;
	let v = 0;
	for (let r = 0; r < rows; r++) {
		for (let c = 0; c < squaresAcross; c++) {
			const white = (r + c) % 2 === 0;
			const col = white ? 1 : 0.04;
			const u0 = c * squareSize - halfWidth;
			const u1 = u0 + squareSize;
			const t0 = r * squareSize - depth / 2;
			const t1 = t0 + squareSize;
			for (const [u, t] of [
				[u0, t0],
				[u1, t0],
				[u1, t1],
				[u0, t1],
			]) {
				const x = startPos.x + nx * u + dir.x * t;
				const z = startPos.z + nz * u + dir.z * t;
				positions.push(x, 0.015, z);
				colors.push(col, col, col);
			}
			indices.push(v, v + 1, v + 2, v, v + 2, v + 3);
			v += 4;
		}
	}
	const geo = new BufferGeometry();
	geo.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
	geo.setAttribute("color", new BufferAttribute(new Float32Array(colors), 3));
	geo.setIndex(indices);
	geo.computeVertexNormals();
	return new Mesh(
		geo,
		new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: DoubleSide }),
	);
}
```

Expose from `buildRoad`: add parameters to the TrackMeshes type if we want to hand back start info, OR build and add the checker mesh inside `buildRoad` using `waypoints[0]`'s position and direction. Do the latter for simplicity.

Inside `buildRoad`, after the lane markings, add:

```ts
const startA = waypoints[0].pos;
const startB = waypoints[1].pos;
const dx = startB.x - startA.x;
const dz = startB.z - startA.z;
const dlen = Math.hypot(dx, dz) || 1;
const startDir = { x: dx / dlen, z: dz / dlen };
const checker = buildCheckerStrip(startA, startDir, waypoints[0].width / 2, 1.5);
root.add(checker);
```

**Step 3: Extend TrackMeshes to expose start orientation**

To avoid recomputing in `race.ts`, expose the useful info:

```ts
export type TrackMeshes = {
	root: Group;
	road: Mesh;
	sampled: TrackSample[];
	buildings: Mesh[];
	startInfo: {
		pos: { x: number; z: number };
		dir: { x: number; z: number };
		rightNormal: { x: number; z: number };
		halfWidth: number;
	};
};
```

At the end of `buildRoad`:

```ts
return {
	root,
	road,
	sampled,
	buildings,
	startInfo: {
		pos: startA,
		dir: startDir,
		rightNormal: { x: -startDir.z, z: startDir.x }, // right of forward
		halfWidth: waypoints[0].width / 2,
	},
};
```

**Step 4: Rewire countdown in race.ts**

In `race.ts`:
- Add `import { createStartLights } from "./race/lights";`.
- Create lights: `const lights = createStartLights(scene, track.startInfo.pos, track.startInfo.rightNormal, track.startInfo.halfWidth);`
- Change initial countdown: `let countdown = 4.0;` (was 3.0).
- Remove `hud.setCenter("3");` initial call.
- Set initial light state: `lights.setState("red1");` — actually no, at t=4.0 we want the lights to step *into* red1. Set to "off" initially; the tick-down handles transitions.

New countdown block (replace the existing one):

```ts
if (countdown > 0) {
	const prev = countdown;
	countdown -= dt;
	// Transition points: 4→red1, 3→red2, 2→red3, 1→green, 0→lights off.
	const cross = (from: number, to: number): boolean =>
		prev > from && countdown <= from;
	if (countdown >= 3) lights.setState("red1");
	else if (countdown >= 2) lights.setState("red2");
	else if (countdown >= 1) lights.setState("red3");
	else if (countdown > 0) lights.setState("green");
	else {
		lights.setState("off");
		hud.flash("GO", 700);
		countdown = 0;
	}
	// Keep camera pinned on the car during countdown.
	carMesh.position.set(car.position.x, 0, car.position.z);
	carMesh.rotation.y = car.heading;
	camTargetX = car.position.x;
	camTargetZ = car.position.z;
	camera.position.set(camTargetX, 26, camTargetZ + 18);
	camera.lookAt(camTargetX, 0, camTargetZ);
	return;
}
```

(The `cross` helper turned out unused — drop it if biome flags.)

**Step 5: Dispose lights**

In the `dispose()` method of the scene, call `lights.dispose();` before the `scene.traverse` cleanup.

**Step 6: Run tests**

Run: `cd nova-games/case-retro-drifters && pnpm test`
Expected: pass.

Run: `cd ../.. && pnpm run test`
Expected: tsc + biome clean.

**Step 7: Manual check**

Run dev server, start race. At race start:
- Checker strip visible across road at start/finish.
- Pole with 3 dark bulbs to the right of the road.
- Bulbs illuminate red one per second (t=4→3→2).
- At t=1 all 3 turn green.
- At t=0 lights go dark, "GO" flashes, car unlocks.

**Step 8: Commit**

```bash
git add nova-games/case-retro-drifters/src/race/lights.ts \
        nova-games/case-retro-drifters/src/track/geometry.ts \
        nova-games/case-retro-drifters/src/race.ts
git commit -m "$(cat <<'EOF'
feat(case-retro-drifters): F1 start lights + checker start line

3 red lights turn on one per second (red/red/red), then all turn green
on the final beat → car input unlocks. Lights rendered on a roadside
pole. Painted checker strip across the start line using vertex-colored
geometry.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Drift smoke particle system

**Files:**
- Create: `nova-games/case-retro-drifters/src/fx/smoke.ts`
- Modify: `nova-games/case-retro-drifters/src/race.ts`

**Step 1: Create smoke module**

Create `nova-games/case-retro-drifters/src/fx/smoke.ts`:

```ts
import {
	AdditiveBlending,
	BufferAttribute,
	BufferGeometry,
	CanvasTexture,
	NormalBlending,
	Points,
	PointsMaterial,
	type Scene,
} from "three";

const MAX_PARTICLES = 80;
const LIFETIME = 0.8;

export type SmokeFx = {
	emit(x: number, y: number, z: number, vx: number, vy: number, vz: number): void;
	update(dt: number): void;
	dispose(): void;
};

function makePuffTexture(): CanvasTexture {
	const size = 64;
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		const grad = ctx.createRadialGradient(size / 2, size / 2, 2, size / 2, size / 2, size / 2);
		grad.addColorStop(0, "rgba(255,255,255,1)");
		grad.addColorStop(0.4, "rgba(255,255,255,0.5)");
		grad.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, size, size);
	}
	return new CanvasTexture(canvas);
}

export function createSmoke(scene: Scene): SmokeFx {
	const positions = new Float32Array(MAX_PARTICLES * 3);
	const colors = new Float32Array(MAX_PARTICLES * 4); // RGBA
	const velocities = new Float32Array(MAX_PARTICLES * 3);
	const ages = new Float32Array(MAX_PARTICLES);
	const alive = new Uint8Array(MAX_PARTICLES);
	const sizes = new Float32Array(MAX_PARTICLES);

	const geo = new BufferGeometry();
	geo.setAttribute("position", new BufferAttribute(positions, 3));
	const colorAttr = new BufferAttribute(colors, 4);
	geo.setAttribute("color", colorAttr);
	// three.js PointsMaterial supports per-vertex alpha only via a custom
	// shader — we fake it by scaling the alpha into color brightness and
	// accepting a slight look difference. Simpler: use size attenuation +
	// a solid gray material and accept lifetime-based size-scaling only.
	// For simplicity we'll scale size instead of alpha.

	const texture = makePuffTexture();
	const mat = new PointsMaterial({
		size: 1,
		map: texture,
		color: 0xc8c8c8,
		transparent: true,
		depthWrite: false,
		blending: NormalBlending,
		sizeAttenuation: true,
		vertexColors: false,
	});
	const points = new Points(geo, mat);
	points.frustumCulled = false;
	scene.add(points);

	// Hide unused particles by pushing them far away and size=0.
	for (let i = 0; i < MAX_PARTICLES; i++) {
		positions[i * 3 + 0] = 0;
		positions[i * 3 + 1] = -1000;
		positions[i * 3 + 2] = 0;
	}

	let nextSearch = 0;
	const findSlot = (): number => {
		for (let j = 0; j < MAX_PARTICLES; j++) {
			const i = (nextSearch + j) % MAX_PARTICLES;
			if (!alive[i]) {
				nextSearch = (i + 1) % MAX_PARTICLES;
				return i;
			}
		}
		return -1;
	};

	const emit: SmokeFx["emit"] = (x, y, z, vx, vy, vz) => {
		const i = findSlot();
		if (i < 0) return;
		alive[i] = 1;
		ages[i] = 0;
		sizes[i] = 0.5;
		positions[i * 3 + 0] = x;
		positions[i * 3 + 1] = y;
		positions[i * 3 + 2] = z;
		velocities[i * 3 + 0] = vx;
		velocities[i * 3 + 1] = vy;
		velocities[i * 3 + 2] = vz;
	};

	const update: SmokeFx["update"] = (dt) => {
		for (let i = 0; i < MAX_PARTICLES; i++) {
			if (!alive[i]) continue;
			ages[i] += dt;
			if (ages[i] >= LIFETIME) {
				alive[i] = 0;
				positions[i * 3 + 1] = -1000;
				continue;
			}
			velocities[i * 3 + 1] += 0.6 * dt;
			positions[i * 3 + 0] += velocities[i * 3 + 0] * dt;
			positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
			positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
			sizes[i] += 6 * dt;
		}
		geo.getAttribute("position").needsUpdate = true;
		// Scale size by mean alive size (crude — all particles draw at same size).
		let maxSize = 0.5;
		for (let i = 0; i < MAX_PARTICLES; i++) if (alive[i] && sizes[i] > maxSize) maxSize = sizes[i];
		mat.size = maxSize;
	};

	const dispose = (): void => {
		scene.remove(points);
		geo.dispose();
		mat.dispose();
		texture.dispose();
	};

	return { emit, update, dispose };
}
```

Note the simplification: per-particle alpha via vertex colors requires custom shaders with `PointsMaterial`. We fake it by simply not drawing dead particles (positioned offscreen) and accepting a uniform particle size. This is adequate for a "drift puff" effect.

**Step 2: Wire smoke into race.ts**

Add import: `import { createSmoke } from "./fx/smoke";`

Inside `createRaceScene`, after the buildings setup:

```ts
const smoke = createSmoke(scene);
```

In the main update block (after camera updates), add:

```ts
smoke.update(dt);
if (car.isDrifting) {
	const cos = Math.cos(car.heading);
	const sin = Math.sin(car.heading);
	// Local rear-wheel offsets (x, z): (±0.95, -1.6). y is fixed ~0.3.
	const wheels: [number, number][] = [
		[-0.95, -1.6],
		[0.95, -1.6],
	];
	for (const [lx, lz] of wheels) {
		// Rotate local offsets into world space. headingVec uses sin/cos on z-forward convention.
		const wx = car.position.x + sin * lz + cos * lx;
		const wz = car.position.z + cos * lz - sin * lx;
		for (let i = 0; i < 2; i++) {
			const jitter = (Math.random() - 0.5) * 0.8;
			const back = -2 - Math.random();
			const vx = -sin * back + cos * jitter;
			const vz = -cos * back - sin * jitter;
			smoke.emit(wx, 0.3, wz, vx, 0.5 + Math.random(), vz);
		}
	}
}
```

**Step 3: Dispose smoke**

In `dispose()`, add `smoke.dispose();` before the scene.traverse cleanup.

**Step 4: Run tests**

Run: `cd nova-games/case-retro-drifters && pnpm test`
Expected: pass.

Run: `cd ../.. && pnpm run test`
Expected: tsc + biome clean.

**Step 5: Manual check**

Run dev server, start race. Accelerate to above drift threshold, tap Shift + steer. White/gray smoke puffs should spawn behind rear wheels and disperse upward. They should stop when drift ends.

**Step 6: Commit**

```bash
git add nova-games/case-retro-drifters/src/fx/smoke.ts \
        nova-games/case-retro-drifters/src/race.ts
git commit -m "$(cat <<'EOF'
feat(case-retro-drifters): drift smoke particles

CPU particle pool (80 max) rendered as a single Three.js Points. Emits
2 particles per rear wheel each frame while isDrifting; particles rise
slowly, expand, and recycle on death.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Full playtest + tuning pass

**Files:**
- Possibly: `nova-games/case-retro-drifters/src/car/physics.ts` (constants tweaks)
- Possibly: `nova-games/case-retro-drifters/src/track/geometry.ts` (building density)
- Possibly: `nova-games/case-retro-drifters/src/race.ts` (camera or transparency tuning)

No test changes in this task — tuning is observational.

**Step 1: Full manual playthrough**

Run: `cd nova-games/case-retro-drifters && pnpm dev`

Walk through the checklist in the design doc's Section 9:
- [ ] Start line checker visible at start/finish
- [ ] 3 red lights 1s apart → green → GO
- [ ] W, ↑, Space each accelerate
- [ ] Sharper turn radius noticeable at speed
- [ ] Tap Shift at speed → kick + countersteer + auto-release
- [ ] Wall scrape at angle = smooth graze
- [ ] Wall head-on = hard stop, no teleport
- [ ] Buildings fade when blocking camera
- [ ] Drift smoke visible
- [ ] Road visibly wider, gray + yellow + white markings
- [ ] No buildings inside road
- [ ] 3 laps work end-to-end

**Step 2: Document issues**

Note any that feel wrong. Likely candidates:
- Drift kick too weak / too strong → adjust `DRIFT_KICK_MAGNITUDE` (6 or 10).
- Countersteer still feels off → adjust `COUNTERSTEER_DAMP` (0.92 for stronger, 0.96 for weaker).
- Steering twitchy at low speed → add speed-scaled steer in physics (see design risk notes).
- Buildings too sparse → drop reject threshold from 2 to 1 in `track/geometry.ts`.
- Transparency flicker → add hysteresis (target only updates when crossing 0.5).

**Step 3: Apply fixes**

Make targeted edits. One issue → one commit. Example:

```bash
git add nova-games/case-retro-drifters/src/car/physics.ts
git commit -m "$(cat <<'EOF'
tune(case-retro-drifters): softer countersteer (0.94→0.96)

Felt too grabby during playtest — tiny steering corrections during
drift would kill rotation before player could hold the line.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Step 4: Verify final state**

Run: `cd nova-games/case-retro-drifters && pnpm test && cd ../.. && pnpm run test && pnpm run build`
Expected: all green. `pnpm run build` will also run `build-games` which builds the kid's project end-to-end.

**Step 5: Push branch**

```bash
git push -u origin feat/case-retro-drifters-overhaul
```

**Step 6: Offer PR**

Ask user if they want a PR opened, or if they want to merge locally.

---

## Summary

10 tasks, bite-sized commits, each independently passes lint + tests. Full design context in `docs/plans/2026-04-23-case-retro-drifters-overhaul-design.md`. Out of scope: building collision, audio, AI cars, mobile.

Reference sub-skills:
- @superpowers:test-driven-development for any test-before-code steps
- @superpowers:verification-before-completion before claiming done
