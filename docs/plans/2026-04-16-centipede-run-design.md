# Centipede Run! — Prototype Design

**Game:** `nova-games/grant-centipede-run/`
**Author:** Grant (Nova Middle School coding club)
**Date:** 2026-04-16

## Pitch

Side-scrolling infinite runner. You play a 4-segment centipede that
auto-runs forward, getting faster over time. Jump with space to dodge
ground spikes and flying bugs. Each hit knocks off your tail segment;
lose all 4 and it's game over. Title: **Centipede Run!**

## Scope (prototype)

- Menu with "New Run" and "High Score" buttons (mouse only).
- Single playable level type (infinite, procedurally generated).
- One obstacle (ground spike) + one enemy (flying bug).
- High score persisted in `localStorage`.

Anything outside this — multiple enemy types, power-ups, sound, art
assets, animations beyond leg cycle — is out of scope.

## Screens / states

Single-file state machine in `src/main.ts`:

- `menu` — title text, two Pixi-drawn buttons; optional high-score
  panel toggles when "High Score" button is clicked.
- `playing` — camera follows centipede, world scrolls, hazards spawn.
- `gameover` — freeze motion, show "Game Over" + final step count,
  click anywhere to return to `menu`.

Transitions: menu → playing (click New Run), playing → gameover
(segments = 0), gameover → menu (click).

## Centipede

- 4 segments, rendered back-to-front so head draws on top.
- Each segment: yellow body ellipse + brown shell arc on top + two
  legs drawn as line segments below.
- Head segment additionally has two eyes on the front.
- Segments follow the head with a fixed spacing, using a simple
  trailing-position buffer (head records its y positions; each
  following segment samples a delayed index).
- Leg animation: swing legs on a sine wave tied to distance traveled.
  Each full cycle of the leg swing ticks the step counter by 1.

## Movement & physics

- Horizontal speed starts at `BASE_SPEED` (e.g., 180 px/s) and
  accelerates linearly (e.g., +6 px/s per second) capped at a max.
- Gravity is constant. Pressing Space when on the ground applies an
  upward impulse sized to clear a spike comfortably.
- No double jump, no variable jump height.

## Hazards

**Ground spike** — triangle at ground level. Hitbox is the triangle's
bounding rect shrunk a little to be forgiving.

**Flying bug** — a small shape at head-height + jump-arc peak so it
only hits you if you jump into it. If you just keep running, it
passes overhead.

Spawning: world is divided into `CHUNK_WIDTH` (e.g., 400 px) chunks.
When the camera's right edge approaches an un-generated chunk,
generate it: 0-2 hazards per chunk, randomly placed, with a minimum
spacing from the previous hazard so sequences are always survivable.
Chunks that scroll fully off-screen behind the camera are destroyed.

## Collision & segment loss

- Simple AABB collision between head segment and hazard hitboxes.
- On hit: remove the **tail** segment; start a ~1s invincibility
  timer during which hits are ignored and the centipede flashes
  (alpha oscillates).
- When segment count reaches 0 → `gameover`.

## Step counter

- Counter shown in top-right of the screen in fixed UI layer (not in
  the scrolling world), big bold text.
- Increments once per leg swing cycle while state = `playing`.
- On game over, stop incrementing. If `counter > highScore`, save as
  new high score to `localStorage` key `centipede-run:highscore`.

## Menu & high score panel

- Title "Centipede Run!" centered near top.
- Two buttons below: "New Run", "High Score".
- Clicking "High Score" toggles a panel beneath showing
  `High Score: N` (read from `localStorage`, default 0). Clicking
  again hides it.
- Buttons are Pixi `Graphics` + `Text` with `eventMode: 'static'`
  and `cursor: 'pointer'`, listening for `pointertap`.

## Code layout

One file (`src/main.ts`) for the prototype. Structure within:

1. Pixi app setup (from template).
2. Constants (speeds, sizes, colors, chunk width).
3. High score load/save helpers.
4. State machine (`state`, `setState()`).
5. Menu rendering + button wiring.
6. Game objects: centipede, chunks, hazards.
7. Main ticker: update positions, camera, spawning, collisions, UI.

The single-file approach is deliberate — keeps the whole game
visible to a middle-school kid editing it.

## Non-goals

- Sprites / image assets
- Sound / music
- Touch or keyboard-based menu navigation
- Variable jump height, double jump, ducking
- Multiple parallax backgrounds
- Animations beyond leg swing
