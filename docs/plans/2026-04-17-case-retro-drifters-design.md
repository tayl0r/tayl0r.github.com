# Retro Drifters — prototype design

**Project:** `nova-games/case-retro-drifters/`
**Author:** Case (Nova Middle School coding club)
**Date:** 2026-04-17
**Status:** approved for implementation

---

## Goal

Ship a playable prototype of a top-down 3D drift racer. Success = boot
the menu, click Start, drive a full 3-lap Tokyo race with drift feeling
good, finish, return to menu.

The full spec from Case covers a Fortnite-style lobby, 4 matchmaking
modes, 7 cars, 5 maps, Shop/Locker/Friends tabs, crowns and ranks. The
prototype deliberately cuts almost all of that: one menu screen, one
car, one map. Drift feel is the risky, novel part — prove it first.

---

## Core decisions (locked via brainstorming)

| Dimension | Choice |
|---|---|
| Scope | Gameplay-first + simple menu (spinning car + Start) |
| Stack | Three.js v0.164 (swap out Pixi template); same version as `phoenix-a-game` |
| Camera | Hades-style slight tilt (~15-20°), perspective, follows car position only |
| Car | Primitive boxes, Skyline R34 silhouette |
| Map | Spline-defined track from waypoint list + instanced building boxes |
| Drift | Shift-initiated traction loss + counter-steer; Shift+S = hard brake |
| Throttle | Hold Space to accelerate (not tap-to-mash) |

---

## Architecture

### Stack swap

Replace the Pixi.js v8 template in `case-retro-drifters/` with Three.js
v0.164. Matches `phoenix-a-game`. Add Vitest (also from phoenix).

`package.json` dependencies:

```json
"dependencies": { "three": "^0.164.0" },
"devDependencies": {
  "@types/three": "^0.164.0",
  "typescript": "^5.9.3",
  "vite": "^7.3.1",
  "vitest": "^1.6.0"
}
```

### Code layout

```
src/
  main.ts              boot, renderer ownership, scene switcher
  menu.ts              menu scene (spinning car + title + Start button)
  race.ts              race scene wiring (car + track + HUD + camera)
  car/
    geometry.ts        build Skyline from boxes
    physics.ts         pure function: update(state, input, dt) → state
    physics.test.ts    unit tests
  track/
    waypoints.ts       Tokyo waypoint array
    geometry.ts        waypoints → road mesh + walls + buildings
    collision.ts       off-track test, wall resolution
    collision.test.ts  unit tests
  hud.ts               DOM-overlay speedometer + lap counter + transient text
  input.ts             keyboard state
  types.ts             CarState, Waypoint, Vec2
```

### Scene model

`main.ts` owns the Three.js renderer and a `currentScene` variable.
Every scene exposes `init()`, `update(dt)`, `dispose()`. Swapping =
`dispose(); currentScene = newScene; init()`. No framework, no router.

---

## Scenes

### Menu scene

- Dark gradient (purple → black) background.
- One Skyline at center, slow Y-axis rotation.
- Title `Retro Drifters` as DOM element over canvas — purple neon via
  CSS `text-shadow` stack (10× cheaper than WebGL text for this).
- Big `START` button, DOM, purple neon border.
- Click Start → fade canvas + HTML to black → dispose menu → init race.

### Race scene

- New Three.js scene + camera. Track, car, HUD.
- Lap counting, timer, off-track penalty.
- On finish or Esc → back to menu.

---

## Car

### Geometry (all primitive boxes/cylinders, single `THREE.Group`)

| Part | Dims (x,y,z) | Position | Material |
|---|---|---|---|
| Body | 2.0 × 0.5 × 4.4 | y=0.35 | neon purple/pearl |
| Roof/greenhouse | 1.7 × 0.4 × 2.0 | y=0.80, z=-0.1 | near-black (tinted windows) |
| Hood scoop | 0.6 × 0.1 × 0.6 | y=0.62, z=1.2 | body color |
| Wheels (×4) | cylinder r=0.4, h=0.55 | corners | near-black |
| Taillight bar | 1.8 × 0.15 × 0.05 | y=0.5, z=-2.2 | emissive red |
| Headlights (×2) | 0.4 × 0.15 × 0.05 | y=0.5, z=2.2 | emissive white |

Extension point: `buildCar(model: CarModel): Group` — swap to Miata,
Supra, etc. later. Physics never cares about geometry.

### Physics state

```ts
type CarState = {
  position: Vec2;         // x,z on ground plane
  velocity: Vec2;         // world-space m/s
  heading: number;        // radians
  angularVelocity: number;
  speed: number;          // abs(velocity)
  grip: number;           // 1.0 full, 0.3 drifting
  isDrifting: boolean;
  spinOutTimer: number;   // >0 = locked out of input
};
```

### Physics loop (pure function, `car/physics.ts`)

Per frame, given `(state, input, dt)`:

1. Read `input`: `throttle`, `brake`, `steer` (-1..1), `driftBtn`, `hardBrake`.
2. **Drift engage:** if `driftBtn` held AND `|steer| > 0` AND `speed > driftThreshold` → `isDrifting = true`, `grip` decays toward `0.3` over ~0.5s.
3. **Drift release:** if `driftBtn` released → `grip` recovers toward `1.0` over ~0.4s.
4. **Steering torque:** `angularVelocity += steer * steerRate * dt`; `steerRate` is scaled ~1.6× while drifting (heading rotates faster than velocity — the thing that makes drift visible).
5. **Throttle force:** apply along `heading` vector.
6. **Brake:** `hardBrake` = strong directional deceleration regardless of grip; drift button is NOT a brake (it's a traction modifier).
7. **Lateral friction:** decompose velocity into parallel + perpendicular components relative to `heading`. Decay perpendicular by `grip * dt`. Low grip = perpendicular velocity persists = sideways slide = drift.
8. **Spin-out check:** compute slip angle = `angle_between(heading_vector, velocity_vector)`. If `> 120°` and player isn't counter-steering → `spinOut()`: kill input for 0.8s, angularVelocity goes chaotic, speed *= 0.2.
9. **Counter-steer bonus:** if drifting AND `sign(steer) == -sign(angularVelocity)` → extra angular damping. Mechanically rewards the right reflex.
10. Integrate: `position += velocity * dt`, `heading += angularVelocity * dt`, `angularVelocity *= angularDamping`.

Constants live at the top of `physics.ts`:

```ts
const maxSpeed = 30;       // m/s
const driftThreshold = 18; // m/s
const gripRecovery = 2.5;
const gripDecay = 1.4;
const steerRate = 3.0;     // rad/s per unit input
const driftSteerMult = 1.6;
const spinOutSlipAngle = Math.PI * 2/3; // 120°
```

---

## Track

### Waypoints

Tokyo track = one `Waypoint[]` in `waypoints.ts`, closed loop of ~20
points:

```ts
type Waypoint = {
  pos: Vec2;
  width: number;          // road width at this point
  tag?: 'shibuya' | 'start';
};
```

### Generated at load

- **Road mesh:** Catmull-Rom spline through waypoints, sampled at ~200
  segments, extruded perpendicular to road width. Dark grey, faint
  lane-marking texture.
- **Inner + outer edge polylines:** spline offset by ±width/2. Used
  for walls AND off-track test.
- **Wall meshes:** instanced neon-outlined boxes, ~3m tall, along both
  edges. Segments tagged `shibuya` skip walls → open crossing.
- **Buildings:** 30-50 procedurally scattered box meshes beyond the
  walls, varying heights, neon emissive top-edge trim. Cheap depth for
  camera tilt.
- **Start/finish line:** stripe texture across road at the `start`
  waypoint; also the lap-trigger plane.

### Off-track detection

Per frame: find nearest waypoint segment, compute perpendicular
distance from car to segment centerline. `> width/2` → off-track.

**Penalty:** freeze throttle for 3s, show "OFF TRACK" HUD text, snap
car back to nearest on-track point with heading aligned to segment
direction, speed *= 0.5. Screen flash for readability.

### Wall collision

Car bounding circle vs. wall segment. On penetration: push out along
wall normal, dampen perpendicular velocity by 0.6. Bumpable, not
stopping.

### Laps

Cross start/finish plane forward → `lap++`. Prototype = 3 laps. No
checkpoints — reverse-driving cheese acceptable for now. On lap 3
finish: show "FINISH" + total time + "Back to Menu" button.

---

## Controls

| Action | Key |
|---|---|
| Throttle | Space (hold) |
| Steer left / right | A / D (also ← / →) |
| Drift / ebrake | Shift (hold while turning) |
| Hard brake | Shift + S |
| Pause / back to menu | Esc |

---

## Camera

Perspective camera (not orthographic — kills the tilt feel).
Position = `car.position + (0, 18, 10)` world-space, looking at
`car.position`. Orientation fixed (Hades-style) — camera does NOT
rotate with the car.

FOV ~40°.

**Subtle touch:** camera position lags horizontally ~0.1s behind car's
lateral velocity. Makes sideways slides feel fast. Single tunable
constant.

---

## HUD

DOM overlay mounted by race scene. All neon glow via CSS `text-shadow`.

- **Bottom-left:** vertical 200px speedometer bar, purple fill tracking
  `speed/maxSpeed`. Glow intensifies during drift.
- **Top-left:** `LAP 1 / 3`, purple neon.
- **Top-right:** current lap timer + best lap time.
- **Center (transient):** "OFF TRACK" during penalty, "FINISH" at end,
  "3 / 2 / 1 / GO" at race start.

Race loop writes state via `updateHUD(state)` calls.

---

## Testing

### Unit-tested (Vitest)

- `car/physics.ts` (pure, no Three imports):
  - Throttle accelerates; decays when released.
  - Steering above threshold rotates heading.
  - Shift + turn → `isDrifting=true`, grip decays.
  - Counter-steer during drift damps angular velocity.
  - > 120° slip angle without counter-steer → `spinOut`.
- `track/collision.ts`:
  - Point-to-segment distance correctness.
  - Off-track detection at various car positions.
- `track/geometry.ts`:
  - Spline generates expected segment count.
  - Walls skip `shibuya`-tagged segments.

### Eyeball-only

- Drift feel / tuning constants.
- Camera lag amount.
- Neon material look.
- Menu button positioning.

### Pre-commit check

- `pnpm test` at repo root (tsc + biome).
- Manual: boot menu, click Start, drive full 3-lap Tokyo, finish.

---

## Out of scope (prototype)

Listed so we don't drift into them:

- Locker / Shop / Friends tabs
- Ranked / Timed / Regular / Make Match modes
- Other 6 cars (Miata, GT3RS, 350Z, E36, E46, Supra, Aventador)
- Other 4 maps (Sahara, Amazon, Venice, Swiss Alps)
- Welcome-username toast, multiple spinning cars on menu
- NPCs, multiplayer, leaderboards, ranks, crowns
- Shortcuts on the track
- Sound effects / music
- Mobile / touch controls

---

## Extension seams (deliberate, not implemented)

- `buildCar(model)` accepts a `CarModel` enum → adding cars = new
  geometry file.
- Track = waypoint list + palette object → adding Sahara = new
  `waypoints-sahara.ts` + sand material + "slippery grip" multiplier.
- Scene switcher supports N scenes → adding Locker = new scene.
- HUD is DOM — new UI panels are new divs.

These exist so the iteration 2+ work doesn't require rewrites.
