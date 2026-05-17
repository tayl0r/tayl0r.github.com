# phoenix-a-game: Random Weapon Tiers + Minecraft-Style Hotbar

**Date:** 2026-05-14
**Scope:** `nova-games/phoenix-a-game/`

## Goal

Replace the current "chest = damage upgrade for your one sword/bow" loop with a real
inventory system:

- Chests drop a **new** weapon (sword or bow) at a **randomly rolled quality tier**.
- The player has a **Minecraft-style 10-slot hotbar** for weapons, food, and any future
  items.
- **Q / E** cycle the selected slot; number keys **1-9, 0** pick a slot directly.
- The **selected slot is the equipped weapon** (or food, on left-click).
- **Right-click** throws the equipped item forward into the world as a pickup-able drop.
- **Spacebar** is a new proximity interact verb: opens doors, hits switches, opens
  chests, picks up world drops, activates the win-switch. Sword swings and arrows do
  **damage only**.

## Non-goals

- No durability, no stack counts (food doesn't stack), no menu/full-inventory UI.
- No mouse-hover targeting of hotbar slots — pointer lock makes that awkward; right-click
  always targets the currently *selected* slot.
- No new visual mesh styles per quality tier — quality is communicated via color tint.
- No save/load: hotbar persists across floors but resets on death (matches current
  behavior for `swordDamage`/`bowDamage`).

## Data model

### `state.ts`

```ts
export type ItemKind = "sword" | "bow" | "food";
export type Quality = 1 | 2 | 3 | 4 | 5 | 6;

export interface Item {
  kind: ItemKind;
  quality: Quality;  // food ignores quality, always 1
}

export const HOTBAR_SIZE = 10;

export const QUALITY_NAMES = [
  "common", "uncommon", "rare", "epic", "legendary", "godly",
] as const;

export const QUALITY_COLORS: readonly number[] = [
  0xcccccc, // common  — gray
  0x44dd44, // uncommon — green
  0x4488ff, // rare    — blue
  0xcc44ff, // epic    — purple
  0xffaa22, // legendary — orange
  0xff3333, // godly   — red
];

export function damageOf(quality: Quality): number {
  return quality; // 1..6
}

export interface PlayerState {
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  hotbar: (Item | null)[];   // length 10
  selectedSlot: number;       // 0..9
  iframesUntil: number;
  hitFlashUntil: number;
  lastAttackAt: number;
}

export function equippedItem(state: GameState): Item | null;
```

**Removed fields:** `swordDamage`, `bowDamage`, `weapon`. The `Weapon` type is deleted.

**Initial state:**

```ts
hotbar[0] = { kind: "sword", quality: 1 };  // common sword
// hotbar[1..9] = null
selectedSlot = 0;
```

## Quality rolls

### `loot.ts` rewrite

```ts
export function rollDrop(rng: () => number, floor: number, boss: boolean): Item;
```

**Kind distribution** (independent of floor):

- Normal chest: food 35%, sword 35%, bow 30%
- Boss chest: sword 50%, bow 50% (no food)

**Quality curve** (weights per floor band, normalized internally):

| Floor band | C  | U  | R  | E  | L  | G  |
|-----------:|---:|---:|---:|---:|---:|---:|
| 0          | 55 | 30 | 12 |  3 |  0 |  0 |
| 1          | 35 | 35 | 20 |  8 |  2 |  0 |
| 2          | 20 | 30 | 28 | 15 |  6 |  1 |
| 3          | 10 | 22 | 28 | 22 | 13 |  5 |
| 4+         |  5 | 15 | 25 | 25 | 20 | 10 |

Floors past 4 clamp to row 4. Boss chests shift the band up by 1 (a floor-N boss rolls
on row min(N+1, 4)).

Food drops are always `{ kind: "food", quality: 1 }` (quality unused).

### `Chest` shape

`Chest` keeps `opened` (and its mesh + materials), but loses every drop-related field:
`drop`, `dropMesh`, `dropPickedUp`, `openedAt`, `pickedUpAt` all move to the unified
`WorldDrop` list. Chest body color still shifts to "opened" when popped.

`pickupDrop` is **deleted** — pickup logic lives in `interact.ts`.

## Hotbar module

### `hotbar.ts` (new)

Pure functions operating on `PlayerState`:

```ts
export function cycle(state, dir: -1 | 1): void;        // Q = -1, E = +1, wraps
export function selectSlot(state, slot: number): void;  // clamps to 0..9
export function firstEmptySlot(state): number;          // -1 if none
export function addItem(state, item: Item): {
  slotted: number;
  displaced: Item | null;
};
//   - Empty slot exists → place there, displaced = null.
//   - Otherwise → replace selectedSlot, displaced = the previous occupant.
export function removeSlot(state, slot: number): Item | null;
```

## Input

### `input.ts` rewrite

Edge-triggered flags consumed once per frame (set to false after consumption in `main.ts`,
same pattern as `mouseDX`):

```ts
export interface InputState {
  w: boolean; a: boolean; s: boolean; d: boolean;
  shift: boolean;
  click: boolean;            // left-click — combat (held-state-like, edge-detected in main)
  interact: boolean;         // edge: Space pressed this frame
  cycleLeft: boolean;        // edge: Q
  cycleRight: boolean;       // edge: E
  dropSelected: boolean;     // edge: right-click
  slotDigit: number | null;  // 0..9 if a digit was pressed this frame
  mouseDX: number;
  mouseDY: number;
}
```

Key map:

- `KeyW/A/S/D` → movement (unchanged)
- `ShiftLeft/Right` → run (unchanged)
- `KeyQ` → `cycleLeft = true`
- `KeyE` → `cycleRight = true`
- `Space` → `interact = true`
- `Digit1`..`Digit9` → `slotDigit = n - 1`
- `Digit0` → `slotDigit = 9`
- Mouse left button → `click` (unchanged)
- Mouse right button → `dropSelected = true`; `contextmenu` event preventDefault'd

The `Weapon` type and the `weapon: Weapon` field disappear. `Digit1`/`Digit2` no longer
switch weapons — they're just slot selectors now.

## World drops

### `world_drops.ts` (new)

```ts
export interface WorldDrop {
  item: Item;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;  // 0 for stationary chest drops
  mesh: Group;
  spawnedAt: number;
  settled: boolean;                     // hit floor / never moved
  pickedUpAt?: number;                  // fade-out trigger
}

export function createWorldDrop(
  item: Item, x: number, y: number, z: number,
  vx: number, vy: number, vz: number, now: number,
): WorldDrop;

export function updateWorldDrop(drop: WorldDrop, dt: number, now: number): boolean;
// returns true when the drop is fully faded and should be removed/disposed.

export function markPickedUp(drop: WorldDrop, now: number): void;
```

**Physics:** simple arc — `vy -= 9.8 * dt`, integrate, clamp `y ≥ 0.3` (floor). When
`y` clamps and `|vy|` small, set `settled = true` and zero horizontal velocity.
Wall collision is **not** done — if a thrown item bonks a wall it just lands a bit
short, which is acceptable.

**Fade:** copies the existing chest-drop fade in `loot.ts`: 0.6 s opacity ramp + lift,
then ready to dispose. Same `FADE_DURATION` constant migrates here.

**Mesh factory:** `createDropMesh(item)` moves here from `loot.ts`. It now takes an
`Item` (kind + quality) and tints the weapon mesh from `QUALITY_COLORS[quality-1]`.

**Two spawn paths:**

1. **Chest open** (in `interact.performInteract`):
   ```ts
   const item = rollDrop(rng, state.floor, chest.boss);
   const drop = createWorldDrop(item, chest.x, 0.7, chest.z, 0, 0, 0, now);
   drop.settled = true;  // stationary hover
   ```
2. **Thrown** (right-click drop in `main.ts`):
   ```ts
   const item = state.player.hotbar[state.player.selectedSlot];
   state.player.hotbar[state.player.selectedSlot] = null;
   // camera-forward direction (use existing follow.yaw or camera.getWorldDirection)
   const fwd = { x: -Math.sin(yaw), z: -Math.cos(yaw) };
   createWorldDrop(item, px, 1.2, pz, fwd.x * 6, 2, fwd.z * 6, now);
   ```

Drops live in a `drops: WorldDrop[]` array maintained alongside `chests`/`monsters` in
`main.ts`.

## Interact

### `interact.ts` (new)

```ts
export const INTERACT_RANGE = 2.5;

export type Interactable =
  | { kind: "door";       door: Door }
  | { kind: "switch";     sw: RoomSwitch }
  | { kind: "chest";      chest: Chest }
  | { kind: "winSwitch";  ws: WinSwitch }
  | { kind: "pickup";     drop: WorldDrop };

export interface InteractCtx {
  state: GameState;
  doors: Door[];
  roomSwitches: RoomSwitch[];
  chests: Chest[];
  winSwitch: WinSwitch;
  drops: WorldDrop[];
  rng: () => number;
  scene: Scene;
  wakeRooms: (roomIndices: readonly number[]) => void;
  descendFloor: () => void;
}

export function findNearestInteractable(
  px: number, pz: number, ctx: InteractCtx,
): Interactable | null;

export function performInteract(
  target: Interactable, ctx: InteractCtx, now: number,
): void;

export function describeInteractable(target: Interactable): string;
// e.g. "Open chest", "Pick up Legendary Sword", "Open door", "Activate switch", "Descend"
```

**Validity filters** inside `findNearestInteractable`:

- Door: `!door.open`
- Switch: `!sw.activated`
- Chest: `!chest.opened`
- WinSwitch: `ws.unlocked && !ws.activated`
- Pickup: `!drop.pickedUpAt && drop.settled`

**Actions inside `performInteract`:**

- Door → `openDoor(door); ctx.wakeRooms(door.roomIndices);`
- Switch → `activateSwitch(sw);`
- Chest →
  ```ts
  chest.opened = true;
  // chest body color shift (move from openChest)
  // chest lid rotation (move from openChest)
  const item = rollDrop(ctx.rng, ctx.state.floor, chest.boss);
  const drop = createWorldDrop(item, chest.x, 0.7, chest.z, 0, 0, 0, now);
  drop.settled = true;
  ctx.drops.push(drop);
  ctx.scene.add(drop.mesh);
  ```
- WinSwitch → `activateWinSwitch(ws); ctx.descendFloor();`
- Pickup →
  ```ts
  const { displaced } = addItem(ctx.state, drop.item);
  markPickedUp(drop, now);
  if (displaced) {
    // throw displaced forward (same path as right-click drop, but driven by
    // player facing — main.ts owns this; interact.ts requests it via a callback,
    // or returns the displaced item for main.ts to handle. We'll have ctx
    // expose a throwForward(item) helper to keep it clean.
  }
  ```
  `InteractCtx` therefore also exposes `throwForward(item: Item): void`.

## `main.ts` wiring

**Deletions:**
- `handleSwingTargets` is **gone** — sword swings only damage monsters.
- The door / switch / chest / win-switch / drop-pickup branches inside `handleArrowHit`
  are **gone** — arrows only damage monsters. The wall + monster branches stay.
- `pickupDrop` calls disappear; the `for chest of chests` drop-update loop is replaced
  by a generic `for drop of drops` loop.

**Additions / changes:**
- New `drops: WorldDrop[]` list. `teardownDungeon` disposes its meshes and clears it.
- The `interact.ts` `InteractCtx` is built per-frame as a plain object literal — cheap
  and avoids stale references after level transitions.
- Each frame, after physics resolution but before render:
  1. If `input.cycleLeft` → `cycle(state, -1)`.
  2. If `input.cycleRight` → `cycle(state, +1)`.
  3. If `input.slotDigit !== null` → `selectSlot(state, input.slotDigit)`.
  4. If `input.dropSelected` → pull `hotbar[selected]`; if non-null, throw forward via the
     same helper `interact` uses.
  5. `findNearestInteractable` once → store for HUD prompt.
  6. If `input.interact` and the stored target exists → `performInteract`.
  7. Reset all edge flags (set to false / null) at the end of frame.
- `state.player.weapon` / `weaponColorFor` references replaced by `equippedItem(state)`:
  - `sword.visible` = equipped item's kind is `"sword"`.
  - `bow.visible`   = equipped item's kind is `"bow"`.
  - Both hidden if slot is empty or holds food.
  - Sword blade material / bow accent material tinted from `QUALITY_COLORS`.
- `canAttack` + `consumeAttackStamina` only fire when an equipped weapon exists; an empty
  selected slot ignores left-click. Food in the selected slot + left-click → eat it:
  heals 1, removes the item from the slot, no stamina spent.
- `resetPlayerStats` (death respawn) resets `hotbar` to `[commonSword, null × 9]` and
  `selectedSlot = 0`. Floor transitions do **not** touch the hotbar.

## HUD

### `index.html`

Add a hotbar container inside `#hud`:

```html
<div id="hud-hotbar" style="
  position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
  display: flex; gap: 4px; padding: 4px;
  background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.4);
  border-radius: 4px;
"></div>
<div id="hud-interact" style="
  position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
  color: #fff; font-family: sans-serif; font-size: 18px;
  background: rgba(0,0,0,0.55); padding: 4px 10px; border-radius: 4px;
  display: none;
"></div>
```

10 slot DOM nodes are created once on first `renderHud` and cached. Each slot:

- Fixed ~40×40 px box, dark fill, 2 px border.
- Top-left key hint (`1`..`9`, `0`).
- Centered icon glyph: `⚔` / `🏹` / `🍎` (fall back to `S`/`B`/`F` text if emoji rendering
  looks bad — easy swap).
- Bottom-right quality letter: `C`/`U`/`R`/`E`/`L`/`G`.
- Border color = `QUALITY_COLORS[item.quality-1]` (hex → CSS).
- Empty slot → faded border, no glyph/letter.
- Selected slot → solid white border + slightly brighter fill.

### `hud.ts`

Extend `renderHud(state)`:

- Read `state.player.hotbar` + `selectedSlot`; update slot text/style.
- Read the cached `nearestInteractable` (set by `main.ts` before calling `renderHud`)
  and toggle `#hud-interact` between `display: none` and `display: block` with text
  `"[Space] " + describeInteractable(target)`.

`renderHud` signature gains a second arg: the prompt string (or `null`). `main.ts` passes
`nearest ? "[Space] " + describeInteractable(nearest) : null`.

### `player.ts`

`weaponColorFor` and the `WEAPON_COLORS` table are **deleted**. All quality tints come
from `QUALITY_COLORS` in `state.ts`.

## Testing

### New tests

- `loot.test.ts` — rewrite:
  - Quality curve sanity: 10k rolls at floor 0 → common is dominant; at floor 4 → epic/
    legendary together exceed common.
  - Boss shift: floor-0 boss rolls match floor-1 distribution band, never food.
  - Output validity: every roll is `{ kind in {sword,bow,food}, quality in 1..6 }`; boss
    chests never return food.
- `hotbar.test.ts` — `cycle` wraps, `selectSlot` clamps, `firstEmptySlot` returns -1 when
  full, `addItem` fills empty slot first, `addItem` on full hotbar swaps selected and
  returns displaced, `removeSlot` clears and returns prior contents.
- `world_drops.test.ts` — thrown drop arc lands and flips `settled`; stationary drop stays
  put; pickup fade timer completes; `updateWorldDrop` returns true only after fade.
- `interact.test.ts` — nearest-within-range picks the right target; range cutoff excludes
  far targets; validity filters hide opened chests, activated switches, locked win-switch,
  unsettled drops; `performInteract` mutates the right thing per kind; pickup with full
  hotbar invokes `throwForward` exactly once.

### Migrated tests

- `state.test.ts` — drop `swordDamage`/`bowDamage`/`weapon` assertions; assert
  `hotbar[0]` is a common sword, rest null, `selectedSlot === 0`.
- `combat.test.ts`, `arrows.test.ts` — keep monster-hit branches only; the door/switch/
  chest cases were never tested directly (they live in main.ts) so nothing to remove.
- `player.test.ts` — if it tests `weaponColorFor`, those tests go away. `computeVelocity`
  tests stay.

### Verification gates before commit

1. `pnpm run test` at repo root (tsc + biome) passes.
2. `pnpm dev` smoke test in browser:
   - Open chest → drop appears at chest → walk close → spacebar puts it in hotbar.
   - Q / E cycle slots, held mesh swaps to match equipped item, color matches quality.
   - Number keys 1-9, 0 select slots directly.
   - Right-click throws current slot forward; lands; spacebar picks it back up.
   - Full hotbar + new pickup → selected slot's old item flies forward, new item takes its
     place.
   - Doors, room switches, chests, win-switch all interact only via spacebar.
   - Left-click swings the sword / fires the bow only — no longer pops doors or chests.
   - Food in selected slot + left-click → eat (heal 1, slot empties).
   - Die → respawn at floor 1 with just the common sword.

## File map

**New files:**
- `src/hotbar.ts`
- `src/hotbar.test.ts`
- `src/world_drops.ts`
- `src/world_drops.test.ts`
- `src/interact.ts`
- `src/interact.test.ts`

**Heavy edits:**
- `src/state.ts`         (new types, new fields, helpers)
- `src/loot.ts`           (rollDrop signature, chest shape, mesh factory moves out)
- `src/input.ts`          (edge-triggered flags, no `Weapon`)
- `src/hud.ts`            (hotbar render, interact prompt)
- `src/main.ts`           (drops list, interact loop, weapon equip from slot)
- `src/player.ts`         (delete `weaponColorFor` + `WEAPON_COLORS`)
- `index.html`            (hotbar + interact prompt containers)

**Light edits:**
- `src/state.test.ts`
- `src/loot.test.ts`
- `src/player.test.ts`

**Unchanged:**
- `arrows.ts`, `camera.ts`, `collision.ts`, `combat.ts`, `doors.ts`, `levels.ts`,
  `minimap.ts`, `monsters.ts`, `switches.ts`, `tick.ts`, `world.ts`, plus their tests.

## Out of scope (explicitly deferred)

- Per-tier weapon mesh variants (e.g. distinctive godly sword shape).
- Stack counts for food.
- Multi-row inventory / full inventory screen.
- Hover-to-target hotbar slots (pointer lock conflict — would need lock release UX).
- Serializing the hotbar across page reloads.
- Sound effects for pickup / drop / interact.
