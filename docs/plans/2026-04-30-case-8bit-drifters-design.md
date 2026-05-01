# 8-Bit Drifters — vertical-slice design

**Project:** `nova-games/case-8bit-drifters/`
**Author:** Case (Nova Middle School coding club)
**Date:** 2026-04-30
**Status:** approved for implementation

---

## Goal

Ship a playable vertical slice. Success = boot the loading screen, hit
Start, pick a name, see the home shell, click Race, drive 5 laps of a
neon Tokyo circuit with drift that feels satisfying, finish, see your
best lap time saved on next boot.

The full spec from Case is large: loading screen with spinning tire,
profile/name picker with school-appropriate uniqueness, Home + Locker
tabs with active-amplification, gear → settings (Exit / Restart /
Advanced), 3-mode toggle (Timed Runs / Free Practice / Ranked), top-5
leaderboard, ghost cars (your best or map best), advanced drive-style
options, Tokyo at night with Shibuya crossing + lake park + neon
buildings, drift physics with spin-out + counter-drift, locker
customization including car color and headlights/taillights.

The slice deliberately cuts most of that. The drift feel and the
night-Tokyo art direction are the riskiest, most novel pieces — prove
them first.

---

## Core decisions (locked via brainstorming)

| Dimension          | Choice                                                                  |
| ------------------ | ----------------------------------------------------------------------- |
| Scope              | Vertical slice — playable end-to-end, thin features                     |
| Stack              | Pixi.js v8 (already templated, no swap)                                 |
| Camera             | 2D translate-only (no rotation, no tilt). Oblique look comes from *art*, not camera — see "Camera & projection" |
| Art pipeline       | Procedural `Graphics`, hooks to swap in authored sprites later          |
| Drift              | Tap Shift while turning → enter drift; over-rotate → spin; counter-steer recovers |
| Drift tunability   | Single config object with 4 constants; ship "forgiving" defaults        |
| Architecture       | Scene-factory + `GameContext` (mirrors `case-retro-drifters`)           |
| Tabs in slice      | Both Home and Locker visible; Locker greyed out                         |
| Mode button        | Rotates labels Timed/Practice/Ranked; gameplay identical                |
| Persistence        | `localStorage` only; profile name + best lap per map                    |

---

## What's in the slice — and what's not

**In:**
- Loading screen (animated spinning tire with smoke + Start button)
- Name picker (local-only, no uniqueness check, school-appropriate filter)
- Home shell (both tabs, gear icon, map list with Tokyo, mode button, race button)
- Settings panel (Exit, Restart) — no Advanced Options
- Tokyo race (start lights, 5 laps, lap counter HUD, current/best lap times)
- Drift state machine with spin-out + counter-steer
- Headlights and taillights (procedural)
- `localStorage` persistence for profile name + Tokyo best lap

**Deferred (explicitly not in slice):**
- Locker contents (color picker, customization)
- Mode-specific gameplay (Practice/Ranked do nothing different)
- Top-5 leaderboard widget
- Ghost cars (own-best or map-best)
- Advanced Options screen + drive-style picker
- Authored building sprites (procedural buildings only for now)
- Landmark-faithful Shibuya crossing (we'll have *a* crossing area)
- Username uniqueness check
- Audio

---

## Architecture

### Scene-factory pattern

Each screen is a factory returning `{ root, update, dispose }`. Top-level
`main.ts` owns the Pixi `Application` and swaps scenes via
`ctx.switchTo(factory)`. Same shape as `case-retro-drifters` so the
pattern is consistent across Case's two games.

### Code layout

```
src/
  main.ts                  Pixi Application init, scene swap loop
  context.ts               GameContext type + factory
  storage.ts               typed localStorage helpers
  scenes/
    loading.ts             spinning tire + Start button
    name-picker.ts         car preview + editable name tag
    home.ts                tabs, gear, map list, mode button, race button
    race.ts                race scene; composes race/* modules
  ui/
    pixel-text.ts          shared "8-bit font" Text style helpers
    button.ts              shared button (hit area, hover, focus)
    tabs.ts                Home/Locker tabs with active-amplification
    panel.ts               shared rounded-rect panel for menus
  race/
    track.ts               Tokyo polyline, barriers, lap-line, occlusion zones
    car.ts                 Car class (state + update + render)
    input.ts               KeyboardInput (slice has only this one)
    drift.ts               pure drift state-machine + tunable constants
    particles.ts           smoke pool (typed arrays, no GC pressure)
    skid.ts                skid-mark stamp layer
    lights.ts              start-light state machine
    hud.ts                 lap counter + best time + current time
    camera.ts              follow-cam (centered, no rotation)
  art/
    car.ts                 procedural car sprite (recolorable later)
    tire.ts                procedural spinning tire (loading screen)
    buildings.ts           procedural building sprites with neon trim
```

### `GameContext`

```ts
type GameContext = {
  app: Application;
  switchTo(factory: SceneFactory): void;
  profile: { name: string };          // mutable, persisted on change
  bests: Record<string, number>;      // mapId → best lap ms
  settings: Settings;                 // see Persistence section
};

type Scene = { root: Container; update(dt: number): void; dispose(): void };
type SceneFactory = (ctx: GameContext) => Scene;
```

### Main loop

`main.ts`:
1. `await app.init({ background: "#0a0a14", resizeTo: window, antialias: true })`
2. Read `localStorage` → seed `GameContext`
3. `loadScene(loadingFactory)` (initial scene)
4. `app.ticker.add(time => current.update(time.deltaMS / 1000))`
5. On `switchTo`: dispose current scene, remove root, instantiate next, add root

---

## Screens & flow

```
loading → name-picker (first boot) → home ↔ race
             ↑ home → name-picker (click name tag, optional)
```

### Loading screen

- Black/dark navy background with subtle scanline overlay
- Centered: a black tire (procedural circle + spokes) with silver rims,
  spinning continuously (~2 rev/s)
- Smoke puffs trail off the back-right of the tire (typed-array pool,
  fade out)
- Below: "START" button in white pixel-style text, hover-pulse,
  click-scale
- Click → switch to name picker (or directly to home if profile already
  exists in storage and we want to skip — slice: always go to name picker
  on first boot, skip on subsequent boots)

### Name picker

- Black background, subtle gridlines
- Center: procedural car sprite (top-down 3/4 view, default red)
- Above car: name tag in white pixel font, hover shows pencil
  icon, click → text-edit mode. The text-edit overlay is a DOM
  `<input>` *centered on screen* (not tracking the in-world tag
  position) — Pixi's `resizeTo: window` plus device-pixel-ratio makes
  in-world DOM positioning fragile, and a centered modal-style input
  is clearer to the player anyway. The Pixi name tag is hidden while
  the overlay is open.
- School-appropriate filter: simple deny-list of profanity (small
  hardcoded list in `name-picker.ts`); rejected name → red shake +
  message
- "CONTINUE" button bottom; disabled until name is non-empty + clean
- Continue → persist `profile.name` → switch to home

### Home

Layout (all in Pixi, no DOM):

```
┌───────────────────────────────────────────────────────┐
│ ⚙ [HOME] [locker]                                      │  ← top bar
│ ┌──────────┐                                          │
│ │ MAPS     │                                          │
│ │ • Tokyo  │           ┌──────────────┐               │
│ │          │           │              │               │  ← center: car preview
│ │          │           │   your car   │                  (sprite, recolorable later)
│ │          │           │              │               │
│ │          │           └──────────────┘               │
│ │          │                                          │
│ │          │                  ┌────────────────────┐  │
│ │          │                  │  Timed Runs    ⟳   │  │  ← mode toggle
│ │          │                  └────────────────────┘  │
│ │          │                  ┌────────────────────┐  │
│ │          │                  │       RACE         │  │  ← race button
│ │          │                  └────────────────────┘  │
│ └──────────┘                                          │
└───────────────────────────────────────────────────────┘
```

Behaviors:
- **Tabs** — Home is "amplified" (larger font + glow + brighter color);
  Locker is dim/desaturated (disabled in slice). Click Locker → no-op
  with a small shake. (Visible-but-inert is an intentional user choice
  so the player sees the shape of the full game from day one.)
- **Gear icon** (top-left) — opens settings panel as a modal overlay
  (semi-transparent backdrop, centered panel) with two buttons: Exit
  (back to loading) and Restart (reload current scene). Click backdrop
  to close.
- **Map list** — single entry "Tokyo," highlighted/selected by default.
  Clicking it does nothing different in slice (only one map).
- **Mode button** — shows "Timed Runs" by default. Click → 90° rotate
  animation (tween over 250ms) → label changes to next of
  `[Timed Runs, Free Practice, Ranked]`. Slice: gameplay identical for
  all three. (Same visible-but-inert intent as Locker tab.)
- **Race button** — switch to race scene with `mapId: "tokyo"`.

### Race

Owns the entire race lifecycle: build track, spawn car at start
position, run start-light sequence, hand control to player, count laps,
end race when 5 laps complete, show final summary, return to home.

**Dev override**: `?laps=N` URL param overrides the lap count for
local testing (5-lap iteration on the end-of-race overlay is too slow).
Default 5; `?laps=1` for fast iteration. Only consulted in `import.meta.env.DEV`.

**Race Again semantics**: "Race Again" calls `ctx.switchTo(raceFactory)`
— a fresh scene instance. The previous scene is disposed (Pixi
containers destroyed, including the skid-mark `RenderTexture`). No
soft-reset path; everything starts clean. This is the simpler
contract.

See "Race internals" section below.

---

## Race internals

The race scene composes purpose-narrow modules. Each module has one job;
`race.ts` orchestrates.

### Track (`race/track.ts`)

Tokyo as data:

```ts
type TrackData = {
  centerline: { x: number; y: number }[];   // polyline, ~120-200 points
  width: number;                            // road width in world units
  startIndex: number;                       // which segment is start/finish
  occluders: BuildingRect[];                // rectangles that may cover car
  decorations: SceneDecoration[];           // neon signs, crosswalks, lake, etc.
};
```

Authored as a TypeScript constant. The polyline is hand-tuned for
~60 second lap at typical speeds. Track shape includes:

- Long straight (start/finish at midpoint)
- 2-3 hairpins between buildings
- A sweeping "Shibuya-ish" intersection (4-way crosswalk visual, track
  passes through one direction)
- A park section with a small lake on one side (track curves around it)

Rendering:
- Asphalt: thick stroke along centerline (dark grey)
- Yellow boundary line: two parallel offsets at ±width/2, painted yellow
- Barriers: short concrete posts at offsets; collide hard
- Lap line: bright stripe perpendicular to centerline at `startIndex`

Lap-line crossing: each frame, check if car crossed the perpendicular
line segment. Two gates required to count a lap:

1. **Direction**: must cross from "before" side to "after" side (no
   reverse-cheating).
2. **Halfway flag**: a `halfwayReached` boolean that flips true once
   the car's distance-along-track exceeds half a lap. The flag resets
   to false on each successful lap-line cross. Without this, the GO
   countdown wiggle or a small reversal at the start line counts as a
   lap. (This is the same gate the sister game `case-retro-drifters`
   uses; mirroring it here.)

Barrier collision (slice): treat track edges as a soft wall — if the car
goes past width/2 from centerline, push it back and zero its
perpendicular velocity. Hard concrete barriers also exist for the lake
edge and building corners.

### Car (`race/car.ts`)

```ts
type CarLook = {
  bodyColor: number;       // recolorable from locker later
  windshieldColor: number;
  headlightColor: number;
  taillightColor: number;
};

class Car {
  x: number; y: number;                    // world position
  vx: number; vy: number;                  // velocity vector
  facing: number;                          // angle the car points (rad)
  drift: DriftState;                       // see drift.ts
  look: CarLook;
  update(dt: number, input: Input, track: Track): void;
  render(g: Graphics): void;     // calls renderCar(g, this, look)
}
```

The car is sprite-like but procedurally drawn each frame (small
rectangle body + windshield + lights). The `renderCar(g, state, look)`
function takes `look` parametrically from day one — that's the hook
the future Locker tab will write to without rewriting the renderer.

Headlights = two cone gradients projected ahead based on `facing`;
taillights = two dots in `look.taillightColor` that brighten when
braking. The headlight cone is its own `Graphics` redrawn each frame
with `look.headlightColor` as input — so swapping headlight color
later is also a parameter change, not a refactor.

The decoupling matters: `vx/vy` is *where the car is moving*, `facing`
is *which way it points*. Normally they match. During drift they don't —
the car points one way and slides another. That gap is what makes drift
look and feel like drift.

### Input (`race/input.ts`)

KeyboardInput maps keys → input state:

```ts
type Input = {
  throttle: -1 | 0 | 1;   // S=back, W=forward
  steer: -1 | 0 | 1;      // A=left, D=right
  drift: boolean;         // Shift held
  driftPressed: boolean;  // Shift just pressed this frame (edge)
};
```

Default scheme: WASD + Shift. Other schemes deferred to Advanced
Options (post-slice).

### Drift (`race/drift.ts`)

State machine:

```
GRIP → (driftPressed && |steer| > 0 && speed > minDriftSpeed) → DRIFTING
DRIFTING → (yaw rate exceeds maxYawRate)                      → SPINNING
DRIFTING → (drift released && |slip| < exitSlipThreshold)     → GRIP
SPINNING → (|yawRate| < spinExitYawRate)                      → GRIP
```

Where `slip` = angle between `facing` and velocity direction. The
`speed > minDriftSpeed` gate prevents the "stand still + tap Shift"
edge case from doing anything weird.

Tunable config (one object, hot-reloadable later). Expanded up front
because 4 knobs is genuinely not enough to dial in arcade drift —
better to ship a wider config and rename never than to add fields
mid-tuning:

```ts
const DRIFT_CONFIG = {
  // Entry / exit
  minDriftSpeed: 6.0,            // m/s; below this, Shift does nothing
  entryAngleThreshold: 0.15,     // rad of slip to consider "drifting"
  exitSlipThreshold: 0.05,       // rad; below this and Shift released → GRIP
  // Yaw
  maxYawRate: 4.0,               // rad/sec before SPINNING
  spinExitYawRate: 0.5,          // rad/sec; below this in SPIN → recover
  // Steering authority
  steerAuthorityGrip: 1.0,
  steerAuthorityDrift: 2.5,      // multiplier on steer during drift
  // Grip
  lateralGripGrip: 12.0,         // how fast lateral velocity decays in GRIP
  lateralGripDrift: 2.5,         // ditto in DRIFTING (lower = slidier)
  longitudinalGripDrift: 0.85,   // multiplier on forward speed during drift
  // Recovery
  gripRecoveryRate: 8.0,         // how fast slip → 0 in GRIP state
};
```

Forgiving defaults; tune by feel after first drive. Throttle behavior
during DRIFTING: forward (`W`) maintains drift; back (`S`) acts as a
soft brake that bleeds longitudinal speed but does not exit drift.

Inside DRIFTING:
- Lateral grip is reduced (car slides)
- Steering directly rotates the car (instead of the car following its
  velocity vector)
- If the player keeps steering *into* the slide, rotation rate climbs
  → can hit `maxRotationRate` → SPINNING
- Counter-steering (turning away from slide direction) reduces rotation
  rate and brings facing back toward velocity → exit drift

### Particles (`race/particles.ts`)

Typed-array pool. ~256 particles max. Each frame:
- Spawn smoke particles at rear wheels when DRIFTING or SPINNING
- Update positions, fade alpha by age
- Render as a single batched `Graphics` (one beginFill, many circles)

```ts
const SIZE = 256;
const x = new Float32Array(SIZE);
const y = new Float32Array(SIZE);
const vx = new Float32Array(SIZE);
const vy = new Float32Array(SIZE);
const age = new Float32Array(SIZE);
const ttl = new Float32Array(SIZE);
let head = 0;  // ring buffer index
```

### Skid marks (`race/skid.ts`)

When the car is DRIFTING, stamp two dark grey rectangles per frame at
each rear wheel position into a persistent low-alpha layer. The layer
is a single `RenderTexture` rendered behind the car. Stamps fade slowly
(or not at all within a single race — cleared on race start).

### Start lights (`race/lights.ts`)

State machine:

```
COUNTDOWN_3 (red)    → 1.0s → COUNTDOWN_2 (red)
COUNTDOWN_2 (red)    → 1.0s → COUNTDOWN_1 (red)
COUNTDOWN_1 (red)    → 1.0s → GO (green)
GO (green)           → 1.5s → HIDDEN
```

Three light circles displayed near the start line. Inputs are ignored
until GO. Lap timer starts at GO.

### HUD (`race/hud.ts`)

Top bar overlay:
- Lap counter ("LAP 2 / 5")
- Current lap time (mm:ss.ms)
- Best lap time (mm:ss.ms or "—")

End-of-race overlay:
- Final time per lap, best lap highlighted
- "RACE AGAIN" + "BACK TO MENU" buttons

### Camera & projection (`race/camera.ts`)

Pixi 2D cannot truly tilt a scene; a real perspective tilt would
require pre-projected art for every sprite or a third-party 3D
extension. So the slice resolves the tension this way:

- **Camera** is a 2D translate-only container. No rotation, no scale
  tween, no tilt:
  ```
  worldContainer.x = app.screen.width / 2 - car.x * scale;
  worldContainer.y = app.screen.height / 2 - car.y * scale;
  ```
- **Art** is drawn in *axonometric* style — buildings have a visible
  flat-roof polygon plus front and side facades drawn underneath.
  Ground features (track, lake, crosswalks, skid marks) are drawn flat
  (true top-down). Cars are drawn flat with a slight 3D shaping (body
  + windshield + light glows) but no separate facing-angle sprites in
  the slice — facing comes from rotating the procedural car graphic.

The result reads as "low oblique" without ever being a real 3D camera.
Buildings appear to have height because their facades are baked into
the sprite; the world stays a 2D plane in code.

### Sprite layering and depth-sort

The world container holds three sub-layers:

1. **Ground layer** — track surface, yellow lines, crosswalks, lake,
   skid-mark `RenderTexture`, lap line. Drawn flat. Z-fixed at bottom.
2. **Entity layer** — cars and particles. Sorted each frame by world
   `y` so things further south draw on top of things further north
   (since "further north" is "further away from the camera" in the
   axonometric convention).
3. **Building layer** — building sprites. Each building has an anchor
   at its base (south edge); sorted with entities by base-`y`. A
   building south of the car draws *over* the car (because its base is
   "in front of" the car); a building north of the car draws *behind*
   the car. This is what makes the axonometric feel work.

### Building occlusion (alpha fade)

Because buildings have visible height baked into the sprite, the top of
a building can extend *above* its base — meaning a building whose base
is south of the car can still visually cover the car's screen position
with its upper facade. When a building's screen-space rect overlaps the
car's screen position, fade its alpha to 0.3 over ~150ms. When it no
longer overlaps, fade back to 1.0.

This is the version of "buildings go transparent when blocking the
track" that's actually meaningful in this projection. Without
axonometric art it would be a no-op (a true-top-down building is just a
roof and never covers anything except by collision).

---

## Persistence

```ts
type StoredState = {
  profile: { name: string } | null;
  bests: Record<string, number>;          // mapId → best lap ms
};
```

Storage key: `case-8bit-drifters`. Read on boot, write on:
- Profile name change
- New best lap recorded

No schema version field yet — we'll add one the first time we actually
need to migrate. Read errors (corrupt JSON, missing key) silently fall
back to defaults; no prompt, no scary banner, the kid has nothing
precious to lose.

---

## Tokyo map specifics

Visual identity:
- Background: deep navy (`#0a0a14`) with subtle grid
- Buildings: tall procedural rectangles with lit windows (random pattern)
  and neon trim along edges (cyan, magenta, lime)
- Neon signs: a few oversized rectangles on building sides with glowing
  text or shapes (procedural, 4-6 distinct designs)
- "Shibuya-ish" intersection: large painted crosswalk pattern (white
  parallel lines), surrounded by 4 corner buildings
- Lake park: a teal-green lake polygon with a darker outline; track
  curves around it; small "tree" sprites (dark green circles) scattered
- Streetlights: small bright dots along the track edge at intervals,
  with subtle bloom
- Car headlight cones reach forward and slightly illuminate the asphalt
  ahead (additive blend, low alpha)

Track length target: ~1500m at scale where car cruises at ~25m/s
during a clean lap → ~60s/lap. Tunable.

---

## Visual style notes

The "8-bit / Dave the Diver" feel comes from:
- Limited palette per scene (3-5 hues + black/white)
- Chunky shapes. Anti-aliasing and pixel-snapping fight each other,
  so split by layer: the **world container** (track, car, buildings,
  particles) uses `roundPixels: true` and pixel-style art; the **UI
  container** (HUD text, menu text, buttons) keeps anti-aliasing on
  for crisp text. `Application.init({ antialias: true })` stays — the
  per-container `roundPixels` overrides where needed.
- Flat color blocks rather than gradients (except neon glows, which
  *are* gradients to sell light emission)
- Generous use of additive-blend glows for lights, neon, and FX
- Pixel-style font for all UI text (use a free Google font like
  "Press Start 2P" or "VT323")

Procedural-everything for the slice means we control all of this from
code — easy to recolor for the locker later, easy for Case to tweak.

---

## Testing strategy

Slice does not block on automated tests, but worth setting up:

- `pnpm run test` (root) must pass: `tsc --noEmit && biome check`
- The drift state machine in `race/drift.ts` has pure functions that
  are unit-testable; a small Vitest suite would be nice-to-have but not
  required for the slice
- Manual test checklist (in commit message or PR body):
  1. Boot — loading screen renders, tire spins, smoke puffs
  2. Click Start → name picker, type name, Continue
  3. Home renders with both tabs (Locker dim), gear, map, mode, race
  4. Click gear → settings opens, Restart works, Exit works
  5. Click Locker tab → no-op shake
  6. Click mode button → label rotates through 3 options
  7. Click Race → start lights run, GO triggers timer
  8. Drive a clean lap; lap counter increments
  9. Drift on a corner; smoke + skid marks appear; recover
  10. Over-rotate → spin-out; recover by counter-steer
  11. Hit barrier → soft pushback, no clip-through
  12. Complete 5 laps → end overlay with times
  13. Race Again → resets; Back to Menu → home
  14. Reload page → loading skips name picker (profile exists), best
      time persists

---

## Milestones (commit plan)

Each milestone is a separately-committable PR-sized change:

1. **Bootstrap** — `GameContext`, scene-factory plumbing in `main.ts`,
   one stub scene that says "loading." Replaces the hello-world template.
2. **Loading screen** — spinning tire art, smoke pool, Start button,
   transition to name picker.
3. **Name picker** — car preview, editable name tag with DOM input
   overlay, school-appropriate filter, persist to storage.
4. **Home shell** — tabs (Home active, Locker dim), gear icon + settings
   modal, map list, mode-toggle button with rotation, race button. No
   functional race wiring yet (race button is a no-op).
5. **Tokyo track + camera** — track data + rendering (asphalt, yellow
   line, barriers, lap line, buildings, neon, lake park, "Shibuya"
   crosswalk), camera follow, building-occlusion fade. Static car at
   start position, no driving yet.
6. **Car + input + camera** — keyboard input, basic car movement
   (throttle, steer, no drift), camera centers on car, headlights and
   taillights.
7. **Drift mechanics** — drift state machine, particles, skid marks,
   spin-out behavior. Tune.
8. **Race lifecycle** — start lights, lap counter, lap-line crossing
   detection, lap timing, best-time persistence, end-of-race overlay,
   Race Again / Back to Menu.

Each milestone leaves the game in a runnable state. Milestone 8
completes the slice.

---

## Out-of-scope — explicitly deferred

Listed here so we don't lose them, and so the slice can stay a slice:

- Locker: car color picker, decals, headlight color, taillight pattern
- Mode-specific gameplay: Practice (no laps, free roam), Ranked
  (server-validated times — needs a backend or fake leaderboard)
- Top-5 leaderboard widget on home
- Ghost cars: own-best replay + map-best replay; ghost selection in
  settings; replay buffer recording during race
- Advanced Options: drive-style picker (arrows, gamepad), drift-config
  sliders, audio toggles, ghost selection
- Authored building sprites for Tokyo — replace procedural buildings
  with hand-pixeled facades
- Landmark-faithful Shibuya crossing (recognizable scramble + neon walls)
- Username uniqueness check (needs storage of taken names — local list
  for single-device, backend for cross-device)
- Audio: engine note, drift screech, brake, ambient city, start beep
- Multiple maps (currently only Tokyo)
- Car selection (currently only one)
- Mobile/touch controls

---

## Risks & open questions

- **Drift feel** — the four config constants drive the entire game's
  feel. Plan to ship forgiving defaults, drive the slice, then tune.
  No way to know the right values without driving.
- **Building occlusion performance** — naive O(buildings × frames)
  check is fine for ~30 buildings; would need spatial partition if
  Tokyo grows much larger.
- **Pixel-art readability at variable resolutions** — `resizeTo: window`
  means non-integer scale factors. May need to lock the world to a
  fixed virtual resolution (e.g., 480×270) and scale up with
  `roundPixels: true` to preserve pixel snapping. Decide during
  implementation of milestone 5.
- **Name picker DOM overlay** — using a transient `<input>` element
  positioned over the canvas is the simplest way to get text input;
  the alternative is implementing a full text editor in Pixi (overkill
  for the slice). The overlay is centered on screen, not tracking the
  in-world tag, to avoid DPR/resize positioning headaches.

---

## Adversarial review notes

This design was reviewed by an adversarial pass before commit. Changes
made in response:

- **Camera / projection** rewritten — Pixi 2D can't truly tilt a scene;
  the oblique look comes from axonometric *art*, not a tilted camera.
  Sprite layering and depth-sort spelled out so building occlusion is
  actually meaningful.
- **Drift state machine** — added `minDriftSpeed` gate so standing
  still + Shift does nothing weird. Defined throttle behavior during
  drift. Expanded tunable config from 4 knobs to 11.
- **Lap-line crossing** — added `halfwayReached` gate (mirroring sister
  game) so GO-countdown wiggles can't clock fake laps.
- **Dev `?laps=` URL param** — added so end-of-race overlay iteration
  doesn't require a 5-minute drive each time.
- **Name picker DOM input** — switched to centered-on-screen overlay,
  not tracking the in-world tag. DPR + `resizeTo: window` make
  in-world DOM positioning fragile.
- **`schemaVersion: 1`** — dropped. YAGNI; will add when there's
  actually a schema change to migrate.
- **`renderCar` signature** — declared parametric `look` from day one
  so the future Locker doesn't require a renderer rewrite.
- **`roundPixels` vs. `antialias`** — split per-layer (world =
  pixel-snap, UI = antialiased) instead of waving at "we'll use
  roundPixels on relevant containers."
- **Race Again** — explicitly defined as full scene re-instantiation
  (no soft-reset path).

Items rejected from the review:

- Removing the inert mode button and Locker tab — these are explicit
  user requests for visible-but-inert UI so the slice telegraphs the
  shape of the full game. Kept as designed.
