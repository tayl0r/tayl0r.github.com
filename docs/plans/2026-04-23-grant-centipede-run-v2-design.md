# Centipede Run v2 — Design

Date: 2026-04-23
Project: `nova-games/grant-centipede-run`
Branch: `grant-centipede-run`

## Context

The existing `grant-centipede-run` already ships a Pixi.js v8 side-scroller
with a menu (New Run + High Score), a yellow-and-brown-shell centipede,
camera-follow, infinite chunk-based level generation, step counter, Space-jump,
hit-invincibility flash, game-over, and high-score persistence.

Grant's updated prompt changes the terrain, the centipede's look, the hazards,
and adds powerups. This design captures the exact diff from the current game
to the new spec, with decisions pinned down in brainstorming.

## Goals

- Uneven but smooth, continuous terrain (no pits, no gaps) that the body
  conforms to.
- A noticeably cuter centipede (big symmetric eyes, cheeks + smile, wiggly
  antennae, bouncy body ripple, boots on the legs).
- Exactly two enemy types: a ground sphere and a homing fireball.
- Exactly two powerup mushrooms: blue (+1 or +3 segments, 50/50) and red
  (5-second invincibility with a rainbow shimmer).

## Out of scope

- Tests / test harness. Manual verification via `pnpm dev` is the bar.
- Module splitting. Everything stays in `src/main.ts` to match the other kids'
  games and the `_template` style.
- Additional hazard types beyond the two spec'd enemies.

## Decisions (from brainstorming)

| Question | Choice |
|----------|--------|
| Terrain style | Smooth rolling hills, no pits or gaps |
| Blue mushroom | 50/50 random: +1 or +3 segments |
| Fireball motion | Homing toward the centipede at a slow speed |
| Red mushroom duration | 5 seconds |
| Code organization | Single `main.ts`, edit in place |
| Centipede cuteness | All four upgrades (big eyes, cheeks+smile, antennae, body ripple) |

## Changes to current game

### Terrain (replace flat ground)

Replace the static green ground rectangle with a per-pixel height function
`groundHeightAt(worldX)` sampled from layered sine waves (low-frequency
rolling hills + a smaller bump). Deterministic in `x` so the world is stable
under chunk unload/reload. Amplitude ramps from ~0 near the start to ~60px
peak-to-peak by x ≈ 2000, giving the player a clean launch area.

Each chunk owns a `Graphics` that draws a filled polygon tracing
`groundHeightAt` at 8px steps along its 400px span. Chunks are created and
destroyed by the existing sliding-window logic.

Physics: the head's floor-y is `groundHeightAt(head.x) - CENTIPEDE_RADIUS`
instead of a constant. Trailing segments each sample the terrain at their
own x, so the body rolls over hills rather than copying the head's y.

### Centipede (cute-up pass)

Keep: 4 starting segments, yellow body, brown shell dome, leg swing, per-seg
phase offset, camera follow.

Add:
- **Big symmetric eyes with glints.** Two matching large white circles +
  smaller black pupils + tiny white highlight dot in the upper-right of each
  pupil. Replaces the current mismatched stacked pair.
- **Rosy cheeks and a small smile.** Two pink circles below the eyes and a
  short black arc mouth.
- **Wiggly antennae.** Two thin curved lines sticking up from the head with a
  dot on top of each; swing left-right using the existing phase variable.
- **Bouncy body ripple.** Each segment gets a small vertical bob offset by
  its phase, so the body ripples like a wave while walking.
- **Boots on the legs.** At each leg tip, a small filled rounded rectangle
  (≈8×5px, dark brown) rotated to the leg's swing angle. Redrawn per frame
  inside the existing `drawLegs`.

### Enemies (replace spike + bug)

Delete `makeSpike` and `makeBug` and the `Hazard.kind === "spike" | "bug"`
paths entirely. Replace with two enemy types spawned by the chunk generator.

**Sphere enemy.**
- World-fixed on the ground curve; scrolls past with the world.
- Angry purple circle (~28px), angled eyebrows, two small round eyes, two of
  the same boots the centipede wears.
- No motion.
- Contact with any centipede segment: segment loss + sphere destroyed.

**Fireball.**
- Spawns in the air (y = ground − [180..260px]) at worldX roughly 600–900px
  ahead of the head when the chunk loads.
- Orange-red circle (~24px) with a flickering yellow inner core and one
  central angry eye with an eyebrow above.
- Moves toward the current head position at ~120 px/s (homing).
- Despawns on: contact with centipede (segment loss), passing the centipede's
  x by more than ~150px, or its chunk unloading.

### Powerups (new)

Both are mushrooms: rounded cap on a short cream-white stem with a few
lighter spots on the cap, colored blue or red. Ground-placed alongside
enemies by the chunk generator.

**Blue mushroom.** On contact: destroy the mushroom and add 1 or 3 segments
(50/50 random roll) to the tail. New segments spawn visually at the tail's
current position and the existing trailing-follow code pulls them into line.

**Red mushroom.** On contact: destroy the mushroom and grant 5 seconds of
invincibility. Uses a separate flag/timer from the brief hit-flash so the
visual can be a **rainbow shimmer** (segment tint cycles through hues)
instead of the existing alpha flicker. During this window the centipede
passes through enemies and destroys them on touch with no segment loss.

### Spawn tuning (starting values)

Per 400px chunk, after the 2-chunk safe zone:
- Enemies: 60% one enemy, 25% two enemies, 15% zero.
- Enemy type: 65% sphere, 35% fireball.
- Independent 35% chance of one powerup per chunk.
- Powerup type: 70% blue, 30% red.
- Minimum spacing 120px between any two spawned objects in the chunk.

Numbers are top-of-file constants so they're easy to tune.

## Error handling

- Race-safe destroys: anywhere a fireball, mushroom, or sphere might be
  destroyed, guard with a `destroyed`/null check so collision + chunk unload
  can't double-destroy.
- `localStorage` guards stay as they are in the current code.
- Segment gain during game-over edge case: the `+segments` path checks
  `state === "playing"` before appending.

## Testing

Manual only:
- `pnpm run test` at repo root (tsc + biome) must pass after each commit.
- `pnpm dev` in the kid folder and verify by play:
  - Menu: buttons respond to mouse; high-score toggles open/closed.
  - Run: Space jumps; step counter increments; terrain is visibly uneven.
  - Each enemy type spawns and behaves as spec'd.
  - Blue mushroom yields +1 and +3 on different pickups (coin flip).
  - Red mushroom grants 5s rainbow shimmer invincibility.
  - Game over writes and persists the high score; high-score button on the
    menu shows it.

## Non-goals / explicit nos

- No new hazards beyond sphere + fireball.
- No terrain gaps, pits, or platforming.
- No module splitting.
- No automated tests.
- No changes to the menu or game-over scenes beyond what's needed for the new
  scoring/high-score flow (which is already correct).
