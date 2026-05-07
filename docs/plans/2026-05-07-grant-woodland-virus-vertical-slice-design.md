# grant-woodland-virus — vertical slice design

Nova Games entry at `nova-games/grant-woodland-virus/`. Long-term vision
(per Grant's prompt) is a first-person dark-forest horror game: title
screen → spawn in a dark 3D forest → walk with WASD, sprint with Q,
flashlight in front of camera → hide in hollow logs (E) → reach a green
flag very far from spawn to win → meanwhile a deer-skull monster spawns
near the flag, follows the player, breathes louder as it closes, and
jumpscares + game-overs the player on contact.

This design scopes the **vertical slice** — the first playable build we
can iterate on. The monster, hollow logs, breathing audio, jumpscare,
and lose state are deferred to a follow-up PR.

## Goal

A playable vertical slice: **title screen → walk through a dark forest
→ touch the flag → win.** Atmospheric foundation (fog, flashlight, low
ambient, stamina, sprint) is in place so the monster slots in cleanly
next PR.

## Design decisions (resolved during brainstorming)

| Question                           | Decision                                                                  |
| ---------------------------------- | ------------------------------------------------------------------------- |
| Engine                             | Three.js (already scaffolded)                                             |
| View                               | First-person 3D                                                           |
| Slice scope                        | Title + walking forest + flashlight + stamina + flag/win (no monster yet) |
| Controls                           | **WASD + mouse look** (deviation from prompt's keyboard-only A/D yaw)     |
| Art                                | Three.js primitives only (BoxGeometry / CylinderGeometry / ConeGeometry)  |
| Audio                              | Web Audio API synthesis (no asset files) — deferred to monster PR         |
| Forest size                        | 200 × 200 m, ~250 trees, invisible boundary walls                         |
| Flag distance                      | ~90 m from spawn (try first; tune if too short/long)                      |
| File layout                        | Split into `main.ts`, `player.ts`, `forest.ts`, `ui.ts`                   |
| Stamina mechanics                  | 100 max, sprint −25/s, regen +15/s when not sprinting                     |
| Win condition                      | Player within 1.5 m of flag → WIN state                                   |

## Architecture

The Three.js scaffold from PR #20 is already in place — same Vite +
TypeScript workspace setup as other Nova Games entries. No dependency
changes; this slice only edits source under
`nova-games/grant-woodland-virus/src/`.

### Module layout (`src/`)

- `main.ts` — bootstraps renderer, scene, fog, lights, game loop, owns
  the state machine (`TITLE` / `PLAYING` / `WIN`)
- `player.ts` — player position, yaw/pitch, WASD + mouse-look input,
  pointer-lock handling, stamina tick, collision against tree colliders
- `forest.ts` — generates trees (trunk + canopy), boundary walls, and
  the flag mesh; exports the collider list for the player to use
- `ui.ts` — DOM overlays for title screen, stamina bar, and win screen;
  exposes `showTitle()`, `showWin()`, `hideAll()`, and a stamina
  setter

Each module has one job and exports a small surface. `main.ts` wires
them together; nothing else has to import from anywhere except the
three.js library.

## Gameplay systems

### State machine

```
TITLE  ─[Start clicked]→  PLAYING  ─[touched flag]→  WIN
                                                       │
WIN    ─[Play Again clicked]──────────────────────────┘ → TITLE
```

- **TITLE**: title overlay visible, scene rendered behind for atmosphere
  but player input is ignored.
- **PLAYING**: pointer locked, all input active, stamina bar visible.
- **WIN**: pointer unlocked, stamina bar hidden, win overlay shown with
  a "Play Again" button that resets player position/stamina and returns
  to `TITLE`.

### Player

- Eye height ~1.7 m, no collider beyond a 0.3 m radius for tree
  collision.
- **Movement**: WASD relative to camera yaw.
  - W = forward, S = backward, A = strafe left, D = strafe right.
  - Walk speed 4 m/s. Sprint speed 7 m/s.
- **Camera**:
  - Mouse delta drives yaw (left/right) and pitch (up/down) while
    pointer-locked.
  - Pitch clamped to ±85° to prevent flipping.
  - Sensitivity tunable (default 0.002 rad per pixel).
- **Sprint**: hold Q while moving to sprint. Sprint drains stamina
  −25/s. Sprint has no effect at 0 stamina.
- **Stamina**: 100 max, regenerates +15/s any time the player is not
  actively sprinting (whether moving normally or standing still).
- **Collision**: per-frame distance check between player position and
  each tree collider (cylinder, ~0.5 m radius). Player has its own
  ~0.3 m radius, so the threshold is the sum (~0.8 m). On collision,
  project the player out along the surface normal so they slide along
  trees rather than getting stuck. Same logic for the four boundary
  walls.

### Pointer lock

- Click "Start Game" on the title screen → request pointer lock on the
  canvas → transition to PLAYING.
- Esc unlocks (browser default). When pointer is unlocked during
  PLAYING, freeze input and show a "Click to resume" hint; clicking the
  canvas re-locks and resumes.
- Lock loss while in WIN state is a no-op.

### Forest

- 200 × 200 m playable area centered on origin. Player spawns at
  (0, 1.7, 0) facing +Z.
- ~250 trees placed by rejection sampling: random (x, z) within the
  area, rejected if within 1.5 m of any already-placed tree, the
  spawn point, or the flag.
- Each tree: brown `CylinderGeometry` trunk (~0.4 m radius, 6 m tall) +
  dark-green `ConeGeometry` canopy (~2 m radius, 4 m tall) sitting on
  top of the trunk. Both use `MeshStandardMaterial` so the flashlight
  affects them.
- **Boundary**: four invisible plane colliders at ±100 m on x and z so
  the player can't escape the area. (No visible wall mesh — fog hides
  the edge.)
- **Flag**: thin vertical `CylinderGeometry` pole + a small
  rectangular `BoxGeometry` cloth in bright emissive green. Placed at
  (~63, 0, ~63) — that's ~90 m from spawn.

### Atmosphere

- Renderer clear color near-black (`#050a08`).
- `THREE.FogExp2` with density tuned so visibility falls off around
  20-25 m even with the flashlight on.
- `AmbientLight` at intensity ~0.08 (just enough to avoid pure-black
  silhouettes outside the flashlight cone).
- Very-dim `HemisphereLight` (sky `#0a0a14`, ground `#020402`,
  intensity ~0.05) for a moonlit feel.
- No directional sun.

### Flashlight

- `THREE.SpotLight` parented to the camera (positioned slightly below
  eye level so it looks held).
- Color warm white (`#fff2cc`), intensity ~3, distance ~25, angle
  ~25°, penumbra 0.4, decay 1.5.
- Always on while in PLAYING. (Toggle is a future PR.)

### HUD (DOM overlay)

- **Stamina bar**: top-left, ~200 px wide, fills/empties with the
  stamina value. Color shifts toward red as it depletes.
- **Title screen**: full-viewport semi-transparent dark gradient,
  centered title text "The Woodland Virus" using the system serif
  stack (Georgia, "Times New Roman", serif) so we ship no font asset,
  "Start Game" button below.
- **Win screen**: full-viewport semi-transparent overlay, centered
  "You Survived" text, "Play Again" button.

All overlays are absolutely positioned `<div>`s above the canvas, so
pointer events on buttons work cleanly without interfering with
pointer-lock.

## Out of scope for the vertical slice (deferred to monster PR)

Explicitly **not** in this build:

- Monster (deer-skull primitive build, follow AI, contact = jumpscare)
- Hollow logs + E-to-hide / E-to-exit interaction
- Heavy-breathing audio (Web Audio synthesis, distance-based gain)
- Jumpscare animation/screen
- LOSE state with "New Game" / "Title Screen" buttons
- Flashlight battery / toggle
- Sound effects for footsteps, ambient wind, etc.
- Mobile/touch controls (desktop only for v1)

Each of these plugs into the slice's skeleton without redesign:
the monster gets its own module that reads `playerPosition` and pushes
into the same state machine; logs become another collider type with an
"interact when within X" check; audio attaches to the monster module.

## Success criteria

Vertical slice is done when, on a fresh run:

1. Game loads in the browser via `pnpm dev` inside
   `nova-games/grant-woodland-virus/`.
2. Title screen appears with "The Woodland Virus" + Start button over
   the dark forest scene.
3. Clicking Start locks the pointer and transitions to PLAYING.
4. WASD moves the player relative to camera facing; mouse look turns
   yaw/pitch with pitch clamped.
5. Holding Q while moving sprints, drains the stamina bar; releasing
   Q (or hitting 0 stamina) returns to walk speed; stamina regenerates
   any time Q is not held.
6. The flashlight illuminates a cone in front of the camera; outside
   that cone the forest fades into fog.
7. The player cannot walk through trees or beyond the boundary.
8. Touching the green flag triggers the WIN state with a "Play Again"
   button.
9. Clicking "Play Again" returns to the title screen with player
   position and stamina reset.
10. `pnpm test` passes at the repo root (no type or lint errors).
11. `pnpm build` at the repo root succeeds and copies the kid's
    `dist/` into `dist/nova-games/grant-woodland-virus/`.

## Build sequence (high-level — writing-plans skill will break into discrete steps)

1. Replace the placeholder `src/main.ts` cube/floor scene with the
   slice's atmosphere setup: clear color, fog, ambient + hemisphere
   lights, empty scene.
2. Add `forest.ts`: tree generation (rejection-sampled), boundary
   walls, flag mesh; export collider list. Render the forest in
   `main.ts`.
3. Add `player.ts`: player state object, WASD intent flags, pointer-lock
   request/release, mouse-look math, frame update that integrates
   movement and writes back to camera. Hook into `main.ts` game loop.
4. Add tree/boundary collision to `player.ts` (slide-on-collision).
5. Add stamina state, sprint logic (Q hold), and the SpotLight on the
   camera.
6. Add `ui.ts`: stamina bar DOM, title overlay, win overlay; wire to
   the state machine in `main.ts`.
7. Add the win check (player-to-flag distance) and the title↔playing↔win
   transitions.
8. Polish: tune fog density, flashlight cone, and movement feel; verify
   `pnpm test` + `pnpm build` from the repo root.

---

This design is a living document for the vertical slice only. As soon
as the slice ships and is playable end-to-end, we'll write the
follow-up design for the monster + logs + audio + jumpscare PR.
