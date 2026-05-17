# phoenix-a-game: Enemies Carry Tiered Weapons

**Date:** 2026-05-16
**Scope:** `nova-games/phoenix-a-game/`
**Builds on:** `2026-05-14-phoenix-random-weapon-hotbar-design.md`

## Goal

Every spawned monster (grunts and bosses) carries a randomized-tier weapon:

- **Sword** boosts their contact damage.
- **Bow** lets them shoot arrows at the player, with kiting AI.

The weapon's quality tier scales by floor (same curve as chest loot). On death, the
monster drops the weapon as a pickup-able world drop.

## Non-goals

- No food drops from monsters (chests remain the only food source).
- No weapon-swap mid-combat; each monster spawns with one weapon for its lifetime.
- No hand-tuned per-kind weapon visuals (slime with a sword looks goofy; that's fine).
- No friendly fire — monster arrows can't damage other monsters.

## Data model

### `Monster` additions (`monsters.ts`)

```ts
export interface Monster {
  // ... existing fields ...
  weapon: Item;           // every monster has one
  nextShotAt?: number;    // bow only — earliest world-time a new arrow may fire
}
```

`weapon` is rolled at spawn time via `rollMonsterWeapon` (see below). `nextShotAt` is
seeded only when the weapon is a bow.

### Loot helper (`loot.ts`)

```ts
export function rollMonsterWeapon(
  rng: () => number,
  floor: number,
  boss: boolean,
): Item;
```

- **Kind distribution:** 65% sword / 35% bow (independent of floor and boss flag).
- **Quality curve:** reuses the existing `QUALITY_WEIGHTS` table from `rollItemDrop`.
- **Boss shift:** `band = max(0, floor(floor)) + (boss ? 1 : 0)` — same rule as chests.

Internally this can share helpers (`rollQuality`) with `rollItemDrop`. The split-kind
distribution is the only difference; food is never produced.

### `createMonster` signature change

```ts
export function createMonster(
  kind: MonsterKind,
  x: number,
  z: number,
  roomIndex: number,
  weapon: Item,            // NEW
): Monster
```

The function stores `weapon`, and if `weapon.kind === "bow"` it seeds
`nextShotAt = 0` (so the first shot is available immediately).

`main.ts` `spawnMonster` / `spawnBoss` are the only callers; both compute the weapon
via `rollMonsterWeapon(Math.random, state.floor, kind === level.bossEnemy)` before
calling.

## Sword damage

`applyContactDamage` (in `tick.ts`) currently does:

```ts
state.player.health -= m.damage;
```

After this feature:

```ts
const swordBonus = m.weapon.kind === "sword" ? m.weapon.quality : 0;
state.player.health -= m.damage + swordBonus;
```

So a goblin (`damage 0.5`) with a Rare sword (quality 3) hits for 3.5. A minotaur
(`damage 1.5`) with a Godly sword (quality 6) hits for 7.5.

The same formula applies whether the monster is a bow user or sword user — bow users
just have `swordBonus = 0`. (They still do their base contact damage if you walk into
them, since the engine doesn't distinguish "in-melee" states.)

## Bow AI (kite + shoot)

A new module `monster_combat.ts` owns this logic.

### Constants

```ts
export const BOW_FIRE_INTERVAL = 1.5;    // seconds between shots
export const BOW_PREFERRED_RANGE = 7;    // wants to stay around this distance
export const BOW_BACKAWAY_THRESHOLD = 4; // if player closer than this, move backward
export const BOW_MAX_FIRE_RANGE = 12;    // won't shoot beyond this
export const BOW_ARROW_SPEED = 14;       // m/s
```

### AI replacement

`moveMonsterTowards` (current chase logic) stays for sword wielders. Bow wielders use a
new `updateBowMonster(m, px, pz, dt, now, fireCallback, walls)`:

1. Compute distance to player. If dormant or distance > `BOW_MAX_FIRE_RANGE * 1.5`
   (~18m), use normal chase behavior (close the gap to enter shooting range).
2. If distance > `BOW_PREFERRED_RANGE`: walk toward the player at half-speed (so they
   don't sprint into melee).
3. If `BOW_BACKAWAY_THRESHOLD ≤ distance ≤ BOW_PREFERRED_RANGE`: stand still.
4. If distance < `BOW_BACKAWAY_THRESHOLD`: walk **away** from the player at full speed
   ("kite").
5. If distance ≤ `BOW_MAX_FIRE_RANGE` and `now ≥ m.nextShotAt`:
   - Fire one arrow toward the player.
   - Set `m.nextShotAt = now + BOW_FIRE_INTERVAL`.

Wall handling: walking is run through the existing `resolveAll` collision in
`main.ts`'s monster loop; `updateBowMonster` just produces a velocity vector and lets
`main.ts` do the resolve, identical to how `moveMonsterTowards` already plays.

### Dispatch in `main.ts`

The existing monster-update loop branches on `m.weapon.kind`:

```ts
if (m.weapon.kind === "bow") {
  updateBowMonster(m, player.position.x, player.position.z, dt, state.now,
                   fireMonsterArrow, /* may need walls */);
} else {
  moveMonsterTowards(m, player.position.x, player.position.z, dt);
}
```

The bow callback `fireMonsterArrow(m: Monster, dirX: number, dirZ: number)` lives in
`main.ts` and constructs a new `Arrow` aimed at the player, color-tinted by the bow's
quality, with damage = `m.weapon.quality`.

## Monster arrows

The existing `Arrow` type (`arrows.ts`) and update/expiry helpers are reused. To keep
friendly fire impossible and to make collision checks symmetric, add one field:

```ts
export interface Arrow {
  // existing fields ...
  source: "player" | "monster";   // NEW
}
```

`createArrow` gains a `source` parameter (defaulting to `"player"` for the existing
call site in `main.ts` to keep the change small).

### Collision behavior

- **Player arrows:** existing path — damage monsters, vanish on wall hit. (No change.)
- **Monster arrows:** new path in `handleArrowHit` (or a sibling
  `handleMonsterArrowHit`):
  - If arrow hits the **player** (use `arrowHitsCircleXZ(a, px, pz, PLAYER_RADIUS)`):
    deal `a.damage` to player, respect i-frames, set `state.player.iframesUntil`,
    `state.player.hitFlashUntil`.
  - If arrow hits a wall: vanish.
  - Monsters do **not** collide with monster arrows.

`handleArrowHit` becomes a switch on `a.source`. Both paths share the wall-hit check.

### Arrow visuals

Monster arrows use a duller color than player arrows so the player can read incoming
projectiles at a glance — e.g., shaft tinted dark red regardless of bow quality. Bow
quality is communicated by the bow attached to the enemy, not the arrow.

## Drop on death

In `main.ts`'s "monster died this frame" block (currently the
`if (m.hp <= 0 && m.mesh)` cleanup loop):

```ts
if (m.hp <= 0 && m.mesh) {
  const drop = createWorldDrop(m.weapon, m.x, 0.7, m.z, 0, 0, 0, state.now);
  drop.settled = true;
  drops.push(drop);
  scene.add(drop.mesh);
  disposeObject(m.mesh);
  m.mesh = undefined;
}
```

The drop spawns at the monster's death position, floating like a chest drop, and is
picked up via the existing spacebar interact path. No new pickup logic needed.

## Weapon mesh attachment

Each `MonsterModel` gains a `weaponAnchor: Group` field — a child group positioned
where the weapon should sit relative to the body (rough "hand" height, e.g. `y=1.0`
for humanoid kinds, `y=0.6` for short kinds like slime). Each `buildXxx()` function
sets up that anchor when building the body.

```ts
export interface MonsterModel {
  group: Group;
  flashMaterial: MeshStandardMaterial;
  weaponAnchor: Group;        // NEW
}
```

`createMonsterModel(kind, item)` takes the item now. It builds the body as before,
then calls a shared helper to build a small weapon mesh (a thinner variant of
`createDropMesh` — call it `createHeldWeaponMesh(item)`) and adds it to
`weaponAnchor`. The held mesh is non-transparent (drops are transparent so they can
fade; held weapons never fade).

Per-kind anchor offsets (chosen by build function):

| Kind         | Anchor (x, y, z) |
|--------------|-------------------|
| skeleton     | (0.35, 1.1, 0.0) |
| zombie       | (0.4, 1.0, 0.0)  |
| grimReaper   | (0.45, 1.4, 0.0) |
| goblin       | (0.3, 0.8, 0.0)  |
| orc          | (0.45, 1.1, 0.0) |
| minotaur     | (0.5, 1.5, 0.0)  |
| slime        | (0.25, 0.5, 0.0) |
| fireElemental| (0.35, 0.9, 0.0) |
| lich         | (0.4, 1.3, 0.0)  |

The anchor's facing follows the monster's body rotation automatically (since it's a
child). For bows, the held mesh is rotated so the limb faces forward.

## Behavior at the seams

- **Dormancy:** dormant monsters do not fire (the bow update returns early if dormant).
- **Boss arrows:** the lich and grimReaper benefit from high-tier weapons. A lich with
  a Godly bow can be deadly — acceptable difficulty escalation.
- **Pickup loop:** picking up a monster's dropped weapon goes through the same
  `addItem` path. If the hotbar is full, the selected slot's item is thrown forward
  via `ctx.throwForward` (existing behavior).
- **Reset:** death (resetPlayerStats) only clears the player's hotbar; existing
  monsters and dropped weapons get cleared by `teardownDungeon` on respawn (since
  respawn calls `loadLevel(0)`).

## Testing

### New tests

- `loot.test.ts` — add cases for `rollMonsterWeapon`:
  - Never produces food.
  - Kind ratio approximates 65/35 over many rolls.
  - Quality curve matches `rollItemDrop` (floor 0 mostly common, floor 4+ high tiers,
    boss band shift).
- `monster_combat.test.ts` (new) — pure-function tests for `updateBowMonster`:
  - Far from player → walks toward player at half speed.
  - In preferred range → stands still.
  - Closer than backaway threshold → walks away at full speed.
  - Cooldown enforced (`nextShotAt` advances).
  - Dormant monsters don't move or fire.
  - Out of `BOW_MAX_FIRE_RANGE` → no shot fired even if cooldown elapsed.
  - Beyond chase-takeover range → uses normal chase.

### Migrated tests

- `monsters.test.ts` — `createMonster` calls need the new `weapon` arg; supply a stub
  item. Existing assertions about hp/damage/etc. unchanged.
- `arrows.test.ts` — `createArrow` calls need `source: "player"` (default makes this
  easy). Add at least one test covering `source: "monster"` collision-with-player.

### Verification gates

1. `pnpm test` (vitest) and `pnpm run test` (tsc + biome) green.
2. Manual smoke test in `pnpm dev`:
   - Enemies visually carry weapons; color matches quality tier.
   - Sword-wielders hit harder than before; bow-wielders shoot at you and kite.
   - Killing an enemy drops their weapon at their feet; pickup works with spacebar.
   - Full-hotbar pickup throws the displaced item forward as before.
   - Monster arrows can damage the player; respect i-frames; show hit flash.
   - Dormant enemies (un-awakened rooms) don't fire arrows.

## File map

**New files:**
- `nova-games/phoenix-a-game/src/monster_combat.ts`
- `nova-games/phoenix-a-game/src/monster_combat.test.ts`

**Heavy edits:**
- `nova-games/phoenix-a-game/src/monsters.ts` (add fields + weaponAnchor + signature)
- `nova-games/phoenix-a-game/src/loot.ts` (add `rollMonsterWeapon`)
- `nova-games/phoenix-a-game/src/arrows.ts` (add `source` field)
- `nova-games/phoenix-a-game/src/tick.ts` (apply sword bonus in contact damage)
- `nova-games/phoenix-a-game/src/main.ts` (spawn passes weapon; bow dispatch;
  fireMonsterArrow; death drops; arrow source branching)

**Light edits:**
- `nova-games/phoenix-a-game/src/monsters.test.ts` (stub weapon in createMonster
  calls)
- `nova-games/phoenix-a-game/src/arrows.test.ts` (source parameter)
- `nova-games/phoenix-a-game/src/loot.test.ts` (rollMonsterWeapon cases)

**Unchanged:**
- `state.ts`, `hotbar.ts`, `world_drops.ts`, `interact.ts`, `combat.ts`, `input.ts`,
  `hud.ts`, `player.ts`, `doors.ts`, `switches.ts`, `levels.ts`, `world.ts`,
  `camera.ts`, `collision.ts`, `minimap.ts`, and their tests.

## Out of scope (explicitly deferred)

- Enemies dropping food.
- Mid-combat weapon switching for monsters.
- Monster-vs-monster friendly fire.
- Tier-aware per-monster mesh variants (e.g., a "godly skeleton" with a different
  body — quality is communicated by the weapon tint only).
- Special weapon abilities (lifesteal, knockback, splash). Quality is a pure scalar.
- Sound effects.
