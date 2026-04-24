# case-retro-drifters overhaul — design

Date: 2026-04-23
Branch: `feat/case-retro-drifters-overhaul`

11 gameplay, visual, and handling changes to `nova-games/case-retro-drifters`. All decisions below reflect user choices during the brainstorming session — they're locked unless called out.

---

## 1. Scope

| # | Item | Summary |
|---|---|---|
| 1 | Zoom out | Wider camera framing |
| 2 | Realistic city | Gray road, yellow/white lines, concrete walls, tan/gray buildings on sides only |
| 3 | F1 start | Checker strip + 3-red-then-green pole lights, 1s each |
| 4 | Camera 10° lower | Shallower pitch, bundled with #1 |
| 5 | Transparent blocking buildings | Ray from camera to car, fade occluders |
| 6 | Sharper turns | Higher steer rate |
| 7 | W / ↑ accelerate | Input addition |
| 8 | Tap-shift drift, less countersteer | Rising-edge trigger, kick + auto-release |
| 9 | Wider roads | Road width 8 → 14 |
| 10 | Wall bounce | Replace off-track teleport with slide-and-graze |
| 11 | Drift smoke | CPU particles from rear wheels while drifting |

Out of scope: building collision, audio, AI opponents, mobile/touch controls.

---

## 2. File structure

New files:
- `nova-games/case-retro-drifters/src/fx/smoke.ts` — drift particle system
- `nova-games/case-retro-drifters/src/race/lights.ts` — F1 start lights rig
- `nova-games/case-retro-drifters/src/track/walls.ts` — wall collision + bounce

Modified files:
- `src/race.ts` — camera, start sequence, wall bounce, smoke wiring, transparency logic
- `src/input.ts` — W/↑ throttle, rising-edge shift
- `src/car/physics.ts` — steering, drift model
- `src/track/geometry.ts` — realistic materials, building placement rule, center/edge lines
- `src/track/waypoints.ts` — width bump
- `src/track/collision.ts` — new `resolveWallCollision`; drop `offTrack` usage

Design doc: this file.

---

## 3. Camera (#1, #4, #5)

Current: `camera.position.set(camTargetX, 18, camTargetZ + 10)`, pitch ≈ 61°.

**Change** to `y=26, zOffset=18`. Pitch becomes ~55° (10° shallower); sits further back and higher so more of the map is visible.

FOV stays at 40°.

### Building transparency (#5)

Each frame in `race.ts`:
1. Compute ray from `camera.position` to `car.position`.
2. For every tracked building mesh, test ray against AABB (three.js `Box3.intersectsRay` equivalent; easy manual slab test).
3. Also require the hit point to lie between camera and car (parameter `t ∈ (0, distCameraToCar)`).
4. Building meshes maintain a `targetOpacity`: 0.25 if occluding, 1.0 otherwise. Current opacity lerps toward target at `1 - exp(-dt / 0.3)`.
5. Materials set once to `transparent: true`, `depthWrite: false` when first made transparent; kept that way (cost negligible).

Keep a `Mesh[]` of buildings returned from `buildRoad`. ~40 AABB checks per frame — trivial.

---

## 4. City look (#2) + road width (#9)

### Materials

- **Road**: `color: 0x3a3a3e, roughness: 0.9, metalness: 0.05`.
- **Ground**: `color: 0x1a1c20, roughness: 1.0`.
- **Walls**: `color: 0xb0b0b0, roughness: 0.8, metalness: 0.1`. Emissive removed. Height 2.2 → 1.2.
- **Buildings**: palette `[0x8a8a90, 0xa09888, 0x6a6a78, 0x7a6a5a]` chosen per building, `roughness: 0.85, metalness: 0.1`. Emissive removed.

### Lane markings

Both built as additional thin meshes from the same curve samples:

- **Center line**: `y=0.02`, width 0.3, `color: 0xe8c200`, **dashed** via UV — draw only where `floor(uv.v * 20) % 2 == 0` (done by splitting geometry into per-segment dashes, simpler than a shader).
- **Edge lines**: `y=0.02`, width 0.25, `color: 0xe8e8e8`, solid. One strip at `+halfWidth`, one at `-halfWidth`.

Skip markings at the start line checker strip position (±2 units).

### Road width

`const W = 8` → `const W = 14` in `waypoints.ts`. The shibuya node's `W * 1.8` multiplier stays; that node becomes 25.2 wide.

### Building placement

Rules:
1. Sample ~40 positions along the curve (existing).
2. Pick random side (`side = Math.random() < 0.5 ? -1 : 1`).
3. Offset from centerline: `roadHalfWidth + 6 + Math.random() * 10`.
4. **Reject check**: compute min distance from the building's AABB footprint to *any* track segment polyline. If `< 2`, skip this building and try a new random offset/angle once; if that also fails, skip entirely. Guarantees no buildings inside road even around curves.

---

## 5. Input + handling (#6, #7, #8)

### Input (#7)

`input.ts`:
```ts
const throttle = (this.isDown("Space") || this.isDown("KeyW") || this.isDown("ArrowUp")) ? 1 : 0;
```

### Drift rising edge (#8)

Add to `Input`:
- `private prevShift = false;`
- In `readCar()`: `const shiftNow = isDown("ShiftLeft") || isDown("ShiftRight"); const driftPress = shiftNow && !this.prevShift; this.prevShift = shiftNow;`
- Return `{ throttle, brake, steer, driftPress }`.

`CarInput` type: replace `driftBtn: boolean` with `driftPress: boolean`. `brake` decoupled from shift (Shift+S no longer brakes — brake goes to its own key or is dropped; we drop it since throttle is the only action and it already decays on release).

Actually: keep `brake` but remove the `driftBtn && KeyS` gate — brake is now just KeyS held.

### Turning radius (#6)

- `STEER_RATE`: 3.0 → 4.2
- `ANGULAR_DAMPING`: 0.9 → 0.88

### Drift physics (#8)

`CarState` now owns drift latch. Add to state:
- `isDrifting: boolean` (already exists — now latched here, not derived from input)
- `driftExitTimer: number` (time spent near-straight, for auto-release)

On `inp.driftPress` and `s.speed > DRIFT_SPEED_THRESHOLD` and not currently drifting and not spun out:
- `isDrifting = true`
- Lateral kick: `vLateral += (steerSign || 1) * 8` where `steerSign = Math.sign(inp.steer)`.
- `grip = MIN_GRIP` immediately.
- `driftExitTimer = 0`.

While `isDrifting`:
- Existing drift lateral-injection formula stays.
- **Countersteer damping**: when `sign(inp.steer) === -sign(angularVelocity)`, damp at `0.94^(dt*60)` (was `0.85^(dt*60)`). Much gentler.
- `DRIFT_STEER_MULT` stays at 1.6.
- Grip stays at `MIN_GRIP` (don't auto-recover while drifting).

**Exit conditions** — any of:
- `|vLateral| < 1.5` for **0.15s continuous** (`driftExitTimer` accumulates while under threshold, resets otherwise).
- `speed < DRIFT_SPEED_THRESHOLD * 0.6` (= 10.8).
- `spinOutTimer > 0`.

On exit: `isDrifting = false`, `grip` recovery proceeds via existing `GRIP_RECOVERY`.

Spin-out stays as safety net for extreme slip without countersteer.

---

## 6. Wall bounce (#10)

Replace off-track teleport entirely.

### Detection

In `race.ts` update loop, after `updateCar`:
```ts
const hit = nearestSegment(car.position, tokyoWaypoints);
const halfW = tokyoWaypoints[hit.segmentIndex].width / 2;
if (hit.distance > halfW - 0.3) {
  car = resolveWallCollision(car, hit, tokyoWaypoints);
}
```

Buffer of 0.3 so the car "touches" wall just before geometric intersection.

### Resolution (slide-and-graze)

`resolveWallCollision(car, hit, waypoints) -> CarState`:
1. Compute segment direction `d` (unit) and normal `n` (unit, pointing outward from track on the side the car is).
2. **Clamp position**: move car along `-n` so `distance === halfW - 0.4` (slight inset — sticks against wall but not embedded).
3. Decompose velocity:
   - `vAlong = v · d`
   - `vInto = v · n` (will be positive — into wall)
4. New velocity:
   - `vAlong' = vAlong * 0.92` (scrape friction)
   - `vInto' = -vInto * 0.4` (reflected inward at 40%)
   - `velocity = d * vAlong' + n * vInto'`
5. `angularVelocity += Math.sign(vAlong) * 0.5` (nudge back toward road direction).
6. If `isDrifting`: `isDrifting = false`, `grip = 1` (instant recovery on impact).
7. `speed = |velocity|`.

### Remove

- `offTrack()` usage in `race.ts`.
- `applyOffTrackPenalty()` function.
- `penaltyTimer` state.
- "OFF TRACK" HUD flash.

`offTrack()` the function stays in `collision.ts` (might be useful later) but is no longer called.

### Shibuya plaza

Currently no walls are built at `tag === "shibuya"` nodes. Leave as-is — player can drive into the plaza without collision. Buildings there don't collide in v1 (see out-of-scope). Player can always steer back onto road.

---

## 7. Race start (#3)

### Start line

Painted checker strip across the road at start/finish position. Implementation: generate a 1.5-unit-deep, full-road-width plane with a procedural checker texture (CanvasTexture with drawn squares) OR build as alternating small black/white box meshes — pick whichever is simpler. Place at `y=0.015`.

### F1 lights rig

`src/race/lights.ts` exports `createStartLights(scene, startPos, rightNormal, roadHalfWidth)`.

Geometry (as a `Group`):
- Pole: thin cylinder, `color: 0x404040`, height 3, radius 0.1.
- Horizontal top bar: box, width 1.2, height 0.3, depth 0.3, `color: 0x202020`.
- 3 light bulbs: spheres, radius 0.12, evenly spaced along the bar.
- Bulb material: `MeshStandardMaterial` with `emissive` that gets set per-state.

Position: `pole.position = startPos + rightNormal * (roadHalfWidth + 3)`, `pole.rotation.y` aligned so bar faces the grid.

### States + API

```ts
type LightState = "off" | "red1" | "red2" | "red3" | "green";
setState(s: LightState): void;
```

- `off`: all bulbs dark (`emissive: 0x000000`, body color gray).
- `red1`: bulb 0 red glow (`emissive: 0xff1020, emissiveIntensity: 2.0`), rest dark.
- `red2`: bulbs 0, 1 red.
- `red3`: all 3 red.
- `green`: all 3 green (`emissive: 0x20ff40, emissiveIntensity: 2.2`).

### Countdown logic

Replace current `countdown = 3.0` + center-text `"3"/"2"/"1"` block in `race.ts`:

```
t=4.0 → state "off" (actually start at red1 immediately since that's more natural — see below)
```

Cleaner sequence, 4s total:
- t=4.0..3.0: `red1`
- t=3.0..2.0: `red2`
- t=2.0..1.0: `red3`
- t=1.0..0.0: `green`
- t<=0: car input unlocked, HUD flashes "GO" briefly, lights removed from scene after 2s.

Center HUD text stays unused during countdown (lights are the signal). "GO" still flashes at t=0 for emphasis.

---

## 8. Drift smoke (#11)

`src/fx/smoke.ts`:

```ts
export function createSmoke(scene: Scene): SmokeFx;
type SmokeFx = {
  emit(position: Vec3, velocity: Vec3): void;
  update(dt: number): void;
  dispose(): void;
};
```

Pool of 80 particles, stored as `Float32Array` per attribute, rendered as a single `Points` with a soft circular texture.

### Particle state (pool arrays)

- `positions[i*3..i*3+2]`
- `velocities[i*3..i*3+2]`
- `ages[i]`, `lifetimes[i]`
- `sizes[i]`, `alive[i]` (0/1)

### Per-frame update

For each alive particle:
- `age += dt`; if `age >= lifetime`, mark dead.
- `position += velocity * dt`
- `velocity.y += 0.6 * dt` (rise)
- `size += 6 * dt` (expand)
- `alpha = smoothstep(1 - age/lifetime)`; write to per-vertex color alpha.

### Emit

- Lifetime 0.8s.
- Initial size 0.4, expands to ~2.5 over lifetime.
- Velocity: passed in by caller (backward from car + small y bias + random jitter).
- Reuse dead slots first; if none free, skip emit.

### Material

`PointsMaterial`:
- `map`: CanvasTexture — 64×64 soft white disc (radial alpha gradient).
- `transparent: true`, `depthWrite: false`, `blending: NormalBlending`.
- `sizeAttenuation: true`, `vertexColors: true` (for per-particle alpha).
- `color: 0xc8c8c8` (smoky gray).

### Wiring in `race.ts`

```ts
const smoke = createSmoke(scene);
// each frame:
smoke.update(dt);
if (car.isDrifting) {
  for (const wheel of rearWheelWorldPositions(car)) {
    for (let i = 0; i < 2; i++) {
      smoke.emit(
        wheel,
        oppositeHeadingVelocity(car, 2 + Math.random())
      );
    }
  }
}
```

`rearWheelWorldPositions` = car position + rotate local offsets `(±0.95, 0.4, -1.6)` by `car.heading`.

---

## 9. Testing + verification

Mandatory:
- `pnpm run test` at repo root passes (tsc + biome).
- `pnpm run build` at repo root passes (includes `build-games` step for this game).

Manual smoke test (`pnpm dev`):
- [ ] Start line checker visible at start/finish.
- [ ] 3 red lights appear 1s apart on pole to right of grid; turn green at t=0; car locked until green.
- [ ] W, ↑, Space each accelerate.
- [ ] Sharper turn radius noticeable at speed.
- [ ] Tap Shift at speed: car kicks sideways, can hold slide with countersteer, auto-straightens.
- [ ] Drive into wall at angle: car scrapes along, keeps moving, small nudge back to road.
- [ ] Drive into wall head-on: significant speed loss, car stops against wall.
- [ ] Building in front of camera goes transparent, fades back when no longer blocking.
- [ ] Drift visibly produces smoke puffs from rear wheel positions.
- [ ] Road wider than before, gray with yellow dashed center and white edges.
- [ ] No buildings inside road anywhere on the loop.
- [ ] Lap counter + timer still work across all 3 laps.

Unit tests (new, `car/physics.test.ts`):
- Drift triggers only on rising edge above speed threshold.
- Drift auto-releases when lateral velocity stays near zero for required duration.
- Countersteer damps angular velocity but less aggressively than before.

---

## 10. Risk + tuning notes

- **Drift feel** is the highest-risk change. Numbers above (kick magnitude 8, countersteer damp 0.94, exit threshold 1.5) are starting points; expect to tune after playtesting.
- **Turning radius** change (`STEER_RATE` 3→4.2) may make the car twitchy at low speed. If so, consider speed-scaled steer: `effectiveSteer = steer * lerp(1.0, 0.6, speed/MAX_SPEED)`. Not in v1 unless needed.
- **Wall scrape sign** in `angularVelocity += sign(vAlong) * 0.5` — may push the wrong direction; easy to flip after testing.
- **Building reject radius (2 units)** may leave too few buildings near sharp curves. If the city looks sparse, reduce to 1.0 or increase the sample count from 40 to 60.
- **Transparency thrashing** — if a building teeters on the edge of the ray, opacity could flicker. The 0.3s lerp should mask it; if not, add a small hysteresis (opacity target only changes when crossing 0.5 threshold).

---

## 11. Implementation sequence (for writing-plans)

Suggested order (each step independently testable):

1. Branch + design doc commit (done).
2. Input changes (#7, #8 input side).
3. Car physics (#6, #8 physics side) + unit tests.
4. Waypoint width + road/ground/wall materials + lane markings (#2 part 1, #9).
5. Building placement rules + palette (#2 part 2).
6. Camera zoom + tilt (#1, #4).
7. Building transparency raycast (#5).
8. Wall bounce + remove off-track (#10).
9. F1 start lights + checker strip (#3).
10. Drift smoke (#11).
11. Final manual playtest + tuning pass.

Each step: run `pnpm run test`, commit.
