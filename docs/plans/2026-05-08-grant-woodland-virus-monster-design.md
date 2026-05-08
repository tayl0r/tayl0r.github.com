# grant-woodland-virus — monster + jumpscare design

Follow-up to the vertical-slice merged in PR #29
(`docs/plans/2026-05-07-grant-woodland-virus-vertical-slice-design.md`).
The slice shipped title → walking forest → flag → win. This design
covers everything from Grant's original prompt that was deferred:

- Deer-skull monster that spawns near the flag and follows the player
- Heavy-breathing audio that scales with the monster's distance
- Hollow logs spread through the forest with E-to-hide / E-to-exit
- Jumpscare on monster contact + LOSE state with New Game / Title Screen

After this PR ships, the prompt is fully implemented.

## Goal

Add the monster, audio, hide mechanic, jumpscare, and lose state to
the existing slice without redesigning what's already there. The
slice's modules (main / forest / player / ui) are extended; two new
modules (`monster.ts`, `audio.ts`) own the new behavior.

## Design decisions (resolved during brainstorming)

| Question                                | Decision                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Monster speed                           | **3 m/s** (slower than walk; can be outrun by sprint)                     |
| Monster vs. trees                       | **Passes through trees** — no AI pathfinding for v1                       |
| Hide mechanic semantics                 | While hidden, monster ignores you and idles                               |
| Hidden player hears monster             | **Yes** — breathing audio still gates on distance                         |
| Jumpscare style                         | Full-screen CSS skull + red flash + Web Audio scream + LOSE after 1.5 s   |
| Hollow log count                        | ~12, rejection-sampled (min 4 m apart, 3 m from spawn, 4 m from flag)     |
| Audio                                   | Web Audio synthesis only (no asset files)                                 |
| Audio falloff distance                  | Breathing audible from ~40 m away, peaks at contact                       |
| New game state                          | `LOSE` added; `New Game` → PLAYING, `Title Screen` → TITLE                |

## Architecture

The slice's four modules grow; two new modules are added:

```
nova-games/grant-woodland-virus/src/
  main.ts        extended: LOSE state, jumpscare sequence, monster wiring
  forest.ts      extended: rejection-sample ~12 logs alongside trees
  player.ts      extended: hidden flag + hide/unhide + E-key handling
  monster.ts     NEW — geometry, follow AI, contact detection
  audio.ts       NEW — Web Audio breathing synth + scream
  ui.ts          extended: hide-prompt hint, jumpscare overlay, LOSE overlay
```

Module dependencies (kept loose):

- `monster.ts` consumes only Three.js + the player's position; it does
  not import from `forest.ts` (the monster passes through trees).
- `audio.ts` is pure Web Audio; no Three.js imports.
- `forest.ts` is unchanged in shape — it just exports an additional
  `logs` array on the `Forest` type.
- `player.ts` extends `PlayerState` with `hidden: boolean` and gains a
  small public surface for hide/unhide.
- `main.ts` orchestrates: spawns the monster, starts/stops audio at
  state transitions, runs the contact / win checks per frame, drives
  the jumpscare and LOSE overlays.

## Gameplay systems

### Monster

**Geometry** (single `Group`, all primitives, no asset files):

- **Torso**: dark grey `CylinderGeometry` ~1.2 m tall, ~0.5 m radius,
  centered at y=1.4 (so feet on ground after legs are added).
- **Bloody fur**: a slightly larger rounded `BoxGeometry` (~0.7 ×
  0.5 × 0.25) attached to the chest with `MeshStandardMaterial`
  `{ color: 0x4a0808, emissive: 0x4a0808, emissiveIntensity: 0.2 }` for
  a wet-blood matte sheen.
- **Back legs**: two leg `Group`s, each = thigh `CylinderGeometry`
  (0.12 r × 0.6 h, rotated forward ~10°) + shin `CylinderGeometry`
  (0.1 r × 0.6 h, rotated back ~20° at a "knee" pivot). Color
  `0x2a1810` (dark fur).
- **Arms with claws**: two arm `Group`s parented to the upper torso.
  Each = upper arm cylinder (0.1 r × 0.5 h) + forearm cylinder + a
  hand `Group` of 3 small `ConeGeometry` claws (0.05 base × 0.18 tip,
  white-ish `MeshStandardMaterial`).
- **Head (deer skull)**: a slightly elongated `SphereGeometry` (0.3 r,
  scaled to 1.0, 1.1, 1.3) in bone-white. Two black `BoxGeometry`
  inset eye sockets (0.07 cubes pushed slightly into the skull).
- **Antlers**: two `Group`s on top of the skull. Each antler =
  one main `CylinderGeometry` branch + two smaller branch cylinders
  forking at ~30°, capped with `ConeGeometry` tips. Bone-white.
- **Green eye**: small `SphereGeometry` (0.04 r) inside the **left**
  socket with `MeshBasicMaterial` `{ color: 0x00ff44 }` plus a
  `PointLight` (color `0x00ff44`, intensity 1, distance 3) so it
  visibly glows even outside the flashlight cone.
- **Breathing animation**: each frame, scale the bloody-fur and torso
  meshes vertically by `1 + 0.04 * sin(t * 2π / 3)` (3 s period) so the
  chest visibly rises and falls.

**State** (`MonsterState` type):

```ts
type MonsterState = {
	root: Group;       // for adding to / removing from scene
	position: Vector3; // duplicates root.position; cheap to read
	yaw: number;       // tracked separately; drives root.rotation.y
};
```

**AI** (in `updateMonster(monster, player, dt)`):

- If `player.hidden` → idle: do not move, do not yaw-track. (Breathing
  scale animation continues so the body still rises/falls.)
- Else:
  - Compute `target = player.position - monster.position` (XZ-plane only).
  - Lerp `monster.yaw` toward `atan2(-target.x, -target.z)` at ~2 rad/s
    so the monster smoothly turns to face the player.
  - Move `monster.position` along the target direction at 3 m/s.
  - Monster ignores tree colliders (passes through). It DOES respect
    world bounds (clamp to ±100 m on x and z) so it can't escape.

**Spawn**: `(60, 0, 60)` — about 5 m from the flag at (63, 0, 63),
inside the playable area, oriented toward the world origin.

**Contact**: in the animate loop, when `state === "playing" &&
!player.hidden`, check `distance(player, monster) < 1.2 m`. If true →
`enterJumpscare()`.

### Hollow logs

Extend `forest.ts` so `buildForest(scene)` ALSO generates ~12 logs.
Each log:

- A short `CylinderGeometry` (length 3 m, radius 1.2 m, 12 radial
  segments, **open ends**) rotated 90° on Z so the cylinder axis is
  horizontal. Outer material: `MeshStandardMaterial` `{ color:
  0x2c1c10, side: FrontSide }`.
- An inner `CylinderGeometry` (length 2.95, radius 1.18, open ends)
  with `side: BackSide` and a near-black material so the inside reads
  as a dark hollow.
- The log group is rotated by a random `angle` around Y so logs lie at
  varied orientations.

Placement uses the same rejection-sampling pattern as trees:
- Min 4 m from any other log
- Min 3 m from spawn (0, 0)
- Min 4 m from flag (63, 63)
- Min 1.5 m from any tree
- Within ±95 m on each axis (slightly inset from world bounds)

`Forest` type gains:

```ts
export type LogTransform = {
	x: number;
	z: number;
	angle: number; // radians, around Y
};

export type Forest = {
	colliders: TreeCollider[];
	flagPosition: Vector3;
	bounds: { halfX: number; halfZ: number };
	logs: LogTransform[]; // NEW
};
```

The logs themselves are not collidable terrain — the player simply
overlaps them when entering, and the monster passes through them too.

### Hide mechanic

Extend `PlayerState`:

```ts
export type PlayerState = {
	position: Vector3;
	yaw: number;
	pitch: number;
	stamina: number;
	hidden: boolean; // NEW
};
```

`createPlayer()` and `resetPlayer()` initialize `hidden = false`.

Add module-level state in `player.ts`:
- `let activeLog: LogTransform | null = null;` — the log within hide
  range, set by an `updateHideTarget(player, logs)` function called
  from the animate loop in PLAYING.

Add an E-key handler in `attachPlayerInput`. When E is pressed:
- If `inputActive` and `!hidden` and `activeLog` is set: move player
  to `(activeLog.x, 0.8, activeLog.z)` (eye height drops to 0.8 m), set
  `hidden = true`. UI hides the "Press E to hide" hint and shows
  "Press E to exit".
- If `inputActive` and `hidden`: keep player position, restore eye
  height to 1.7 m, set `hidden = false`. UI swaps hints back.

E debounce: the keydown listener early-exits if `e.repeat === true`
so a held E doesn't toggle hide/unhide repeatedly. The single gate
is the existing `inputActive` flag — during PLAYING it's `true` (so
E works whether or not the player is hidden), and during TITLE / WIN
/ LOSE it's `false` (so E does nothing). Hidden state is preserved
across pause/resume because pointerlockchange doesn't toggle
`inputActive`, only the state-machine entry functions do.

While `hidden`:
- WASD/Q are ignored in `updatePlayer` (movement skipped).
- Mouse-look still works (peek out of the log).
- Stamina regenerates as normal.
- The eye-height drop is animated to 0.8 m on entry, restored on exit
  (instant for v1; tweened only if it feels jarring during playtest).

### Audio module (`audio.ts`)

Pure Web Audio. No Three.js imports. Public API:

```ts
export function startBreathing(): void;
export function setBreathingGain(gain01: number): void;
export function playScream(): void;
export function stopAll(): void;
```

**Breathing synthesis:**
- One `AudioContext` (lazy-created on first call to `startBreathing`).
- Brown-noise generator using `AudioBufferSourceNode` with a 2-s
  pre-baked brown-noise buffer (looped).
- Through a `BiquadFilterNode` set to lowpass, cutoff ~600 Hz, Q ~1.
- Through a `GainNode` (call this `breathGain`) whose value is animated
  by an LFO: a low-frequency `OscillatorNode` (~0.33 Hz, sine, gain
  ±0.5) connected to `breathGain.gain` so the gain rises and falls in
  a 3 s cycle.
- Through a final master `GainNode` whose value is set by
  `setBreathingGain(g)`. Clamps `g` to `[0, 1]`. The main loop calls
  `setBreathingGain(clamp(1 - dist/40, 0, 1))` each frame.

**Scream:**
- Triggered as a one-shot:
  - Two `OscillatorNode`s detuned (~120 Hz and ~135 Hz, sawtooth +
    square) routed through a `BiquadFilterNode` (bandpass, center
    freq sweeping from 1500 Hz down to 400 Hz over 1.0 s via
    `linearRampToValueAtTime`).
  - A short white-noise burst layered in for "rasp."
  - Master gain 0.8 → 0 over 1.2 s.
  - Both oscillators stop after 1.2 s.

**Lifecycle:**
- `startBreathing()` is called from the **Start Game** button click
  (the user gesture browsers require for AudioContext). It's
  idempotent — calling it again on LOSE → New Game is safe; if the
  context exists the function only restarts the noise source.
- `stopAll()` silences only the breathing chain (it sets
  `breathGain.gain = 0` and stops the noise source). Already-
  scheduled one-shots like the scream play through to their
  scheduled stop time. So:
  - On **TITLE** entry: `stopAll()` (no monster, no breathing).
  - On **WIN** entry: `stopAll()` (player escaped).
  - On **LOSE** entry: `stopAll()` immediately, BUT the jumpscare
    sequence calls `playScream()` right after, which is a
    self-contained one-shot independent of the breathing chain.
    Result: the chest-breathing sound stops the moment the scream
    starts — a clean audio cut to the jumpscare.

### Jumpscare + LOSE state

Add `"lose"` to `GameState`. The full type:

```ts
type GameState = "title" | "playing" | "win" | "lose";
```

`enterJumpscare()` is a new `main.ts` function (entered from the
contact check):

1. `state = "lose"` (immediately, so further frame ticks don't re-fire).
2. `setInputActive(false)` — freezes movement / Q / E.
3. Snap camera yaw to face the monster:
   `player.yaw = atan2(-(monster.x - player.x), -(monster.z - player.z))`
   and `player.pitch = 0` (skull face is roughly at eye height).
4. `ui.showJumpscare()` — full-screen DOM overlay containing the
   skull (drawn with absolutely positioned `<div>`s: a large white
   ellipse for the skull, two black ovals for eye sockets, a small
   green dot in the left, and a triangular `<div>` jaw). Plus a red
   flash overlay that animates `opacity 0 → 0.6 → 0` over 0.4 s via
   CSS transition.
5. `audio.playScream()`.
6. `setTimeout(() => { ui.hideJumpscare(); ui.showLose(...); }, 1500)`.

The LOSE overlay shows two buttons:
- **New Game** → `enterPlaying()` (resets player + monster, restarts
  breathing, full stamina, hidden=false).
- **Title Screen** → `enterTitle()` (stops breathing, returns to title).

### State-machine extensions

Existing transitions plus the new ones:

```
TITLE  ─[Start clicked]→  PLAYING  ─[touched flag]→  WIN
                              │                        │
                              │                        └─[Play Again]→ TITLE
                              │
                              └─[touched monster, !hidden]→  LOSE
                                                              │
                                                              ├─[New Game]→ PLAYING
                                                              └─[Title Screen]→ TITLE
```

`enterPlaying()` is now responsible for:
- Resetting player position, yaw, pitch, stamina, **hidden**
- Resetting monster position to (60, 0, 60) and yaw to face origin
- Calling `audio.startBreathing()` (idempotent — safe to call repeatedly)
- Re-locking the pointer

`enterTitle()` and `enterWin()` both call `audio.stopAll()` — the
breathing chain shouldn't keep playing under static screens.
`enterJumpscare()` calls `audio.stopAll()` too, but its very next
step is `audio.playScream()`, which is a separate one-shot — so the
audible result is breathing cuts → scream begins.

## UI extensions

`ui.ts` gains:

- `setHidePromptVisible(visible: boolean, mode: "hide" | "exit")` —
  centered-bottom small text, "Press E to hide" or "Press E to exit".
- `showJumpscare(): void` and `hideJumpscare(): void` — full-screen
  overlay with the CSS skull + red flash.
- `showLose(onNewGame, onTitle): void` and `hideLose(): void` — full
  overlay with two buttons.

The existing setters (stamina bar, title, win, resume hint) are
unchanged.

## Out of scope (won't ship in this PR)

- Pathfinding for the monster (it passes through trees)
- Variable monster speed / aggression
- Multiple monsters
- Footstep audio, ambient wind, log creak
- Flashlight battery / toggle
- Mobile/touch controls
- Difficulty settings
- Stamina balancing tweaks beyond what playtest reveals
- Animated camera move INTO the monster face (we use a CSS skull
  jumpscare instead — already approved as the simpler approach)

After this PR, the project matches Grant's original prompt feature-
for-feature. Any further tuning is interactive playtest territory.

## Success criteria

A reviewer playing a fresh checkout should be able to:

1. ✅ `pnpm install && pnpm dev` from the kid's workspace → title screen.
2. ✅ Click Start → PLAYING; breathing audio is audible and softly
   modulated.
3. ✅ The monster is visible from the flag direction; as the player
   approaches the flag, breathing grows louder.
4. ✅ Walking near a hollow log shows "Press E to hide". Pressing E
   ducks the camera into the log; "Press E to exit" appears. The
   monster stops chasing.
5. ✅ Pressing E again exits the log; the monster resumes chase.
6. ✅ Sprint outruns the monster at 7 m/s vs. its 3 m/s.
7. ✅ Touching the monster while not hidden triggers the jumpscare
   (CSS skull + red flash + scream), then LOSE screen with two
   buttons.
8. ✅ "New Game" returns to PLAYING with everything reset; "Title
   Screen" returns to TITLE.
9. ✅ Touching the flag without dying triggers WIN as before; audio
   stops cleanly.
10. ✅ `pnpm test` (typecheck + biome) and `pnpm build` pass at the
    repo root; `build:games` lists `grant-woodland-virus` as
    succeeded.
