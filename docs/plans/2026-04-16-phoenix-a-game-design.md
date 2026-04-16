# phoenix-a-game — v1 prototype design

Nova Games entry at `nova-games/phoenix-a-game/`. Long-term vision is a
third-person fantasy dungeon survival game with 10 floors, races, classes,
rarities, emblems/spells, shops, and a full inventory system. This design
scopes **v1** — the first playable build we can iterate on.

## Goal

A playable vertical slice: **walk, fight, loot, clear one floor.** Everything
else (races, inventory menu, bow, shield, emblems, spells, food rarity,
shops, XP/leveling, 10 floors, map building) is deferred to v2+.

## Design decisions (resolved during brainstorming)

| Question                   | Decision                                                            |
| -------------------------- | ------------------------------------------------------------------- |
| Engine                     | **Three.js** (swap out the Pixi.js template)                         |
| View                       | Third-person 3D, follow camera                                      |
| MVP slice                  | Walk + fight + loot + one full floor (option #4)                    |
| Art                        | Primitive shapes (capsules, boxes, cylinders) — dressing comes later |
| Floor size                 | 3×3 rooms with doorways                                             |
| Character creation         | Skipped — default character for v1                                  |
| Combat                     | Sword only (melee), player left-click slashes                       |
| HUD bars                   | Health, stamina, hunger (all three)                                 |
| Inventory menu             | None — items are auto-picked-up and used/equipped                   |
| Monster roster             | Two enemy types + one boss                                          |
| Win condition              | Kill boss → stairs unlock → "You Win" screen                        |
| Death                      | Respawn at floor start; already-killed monsters stay dead           |

## Architecture

Swap Pixi.js for Three.js. Keep the existing Vite + TypeScript setup — the
`nova-games/<name>/` workspace integration already works and needs no
changes.

### Dependencies

- Remove: `pixi.js`
- Add: `three`, `@types/three`

### Module layout (`src/`)

- `main.ts` — bootstraps renderer, scene, game loop (ticker)
- `state.ts` — single shared game-state object (no framework)
- `input.ts` — WASD / Shift / left-click / Enter → intent flags
- `player.ts` — capsule mesh, movement, stamina/hunger/health tick
- `camera.ts` — third-person follow camera (smooth lerp behind player)
- `world.ts` — 3×3 room grid, walls, doorways, stairs placement
- `monsters.ts` — two enemy types + boss, simple chase AI
- `combat.ts` — sword swing hitbox, damage, knockback, i-frames
- `loot.ts` — chest entity, drop tables, auto-pickup
- `hud.ts` — DOM overlay for the three bars and win/lose screens

## Gameplay systems

### Player

- Capsule mesh (default character — no race/class selection in v1).
- Movement: WASD relative to camera facing. Shift = sprint (2× speed,
  drains stamina).
- Stats (starting values):
  - Health: 3 hearts
  - Stamina: 20 pips, regenerates when not sprinting
  - Hunger: 10 pips (chicken icons), decays while moving —
    **half a pip per 60s walking, one pip per 30s sprinting**.
    At 0 hunger, start losing health over time.
- Starts holding a basic sword (damage 1).

### Camera

Third-person follow. Positioned behind and slightly above the player,
smoothly lerps toward a target offset each frame. Rotate with mouse
movement (pointer lock on click-to-play).

### World — one floor, 3×3 grid

- 9 rooms arranged in a 3×3 grid, each roughly 16×16 world units.
- Each adjacent pair of rooms is connected by a doorway opening in the
  shared wall. Walls are simple box meshes.
- Stairs-down placed in the center (boss) room.
- 5 of the 8 non-boss rooms contain a chest. Chest placement is
  deterministic for v1 to keep generation simple; we swap to random
  placement in v2.
- Monsters populate 6 of the 9 rooms (roughly 2-3 per room). Boss room
  contains the boss alone.

### Monsters

- **Type A ("goblin")** — small fast cube, chases player, contact damage
  (½ heart), dies in 2 sword hits.
- **Type B ("ogre")** — bigger slow cylinder, contact damage (1 heart),
  dies in 4 sword hits.
- **Boss** — large cube, contact damage (1 heart), dies in 10 hits,
  occupies the center room alone.

Shared AI: if player is within sight radius, move toward player at type
speed. Otherwise idle. No pathfinding — simple line-of-sight chase is
enough for v1 since rooms are open.

### Combat

- **Player sword swing**: left-click triggers a 0.3s swing animation
  (rotation of a sword mesh). A forward-facing box hitbox is active for
  the middle 0.15s. Monsters inside the hitbox take damage; brief
  knockback.
- **Player damage**: contact with a living monster deals that monster's
  contact damage. Player gets 1s of i-frames after being hit.
- **Death**: player at 0 health respawns at floor-entry position with
  full bars. Monsters that were already killed stay dead; chests stay
  looted.

### Loot & chests

- Chest is a box mesh. Walk into it to open. Auto-picks up and applies
  the drop immediately (no inventory UI):
  - 60% chance: food (restores 3 hunger)
  - 40% chance: better sword (+1 damage over current)
- Boss chest (appears after boss dies): guaranteed "best sword" (+2
  damage) and a food heal.

### HUD (DOM overlay)

- Top-left: health hearts (filled/half/empty).
- Top-center: stamina bar, 20 pips.
- Top-right: hunger pips, 10 chicken icons.
- Center overlay when dead: "You Died — click to respawn."
- Center overlay after boss + stairs descent: "You Win! — click to
  restart."

## Out of scope for v1 (deferred)

Explicitly **not** in this build, to keep the prototype shippable:

- Race / class / hair / appearance selection
- Bow, shield, emblem, armour item types
- Spell generation
- Item rarity tiers (common / uncommon / … / immortal)
- Food rarity & cooking / recipes
- Shops
- XP, leveling, immortal-per-level
- Multiple floors (just floor 1)
- Procedural floor generation (3×3 is deterministic for v1)
- Monster respawn every 5 in-game days
- Map building inside inventory
- The 7-tab Enter-menu inventory screen
- Pin system, "X" death markers, boss symbols on map
- In-game day/night cycle

Each of these is a v2+ task that plugs into the v1 skeleton without
redesign.

## Success criteria

Prototype is done when, on a fresh run:

1. Game loads in the browser via `pnpm dev` inside
   `nova-games/phoenix-a-game/`.
2. Player sees a default capsule character in a room with a
   follow camera.
3. WASD moves; Shift sprints and drains stamina; hunger ticks down;
   health ticks down when hunger is 0.
4. Player can walk through doorways into all 9 rooms.
5. Monsters visibly chase and attack; player can kill them with the
   sword.
6. Chests open on contact and apply their drop.
7. Boss takes 10 hits to kill and spawns a chest with a clearly-better
   sword.
8. Going to stairs triggers the win screen.
9. Dying triggers the respawn flow, and already-dead monsters stay dead.
10. `pnpm test` passes at the repo root (no type or lint errors).

## Build sequence (high-level — writing-plans skill will break into
discrete steps)

1. Swap Pixi.js → Three.js in `package.json`; replace `src/main.ts` with
   a minimal Three.js scene (floor + cube, rotating camera) to verify
   the workspace integration still builds.
2. Player capsule + WASD movement.
3. Third-person follow camera + mouse look.
4. One room with walls; collision against walls.
5. 3×3 room grid with doorways.
6. HUD overlay (all three bars) wired to state; stamina drains on
   sprint; hunger ticks.
7. One monster type with chase AI and contact damage; player i-frames.
8. Sword swing, hitbox, monster death.
9. Second monster type.
10. Chest entity + drop logic (food heals hunger, sword upgrades).
11. Boss + boss room + stairs + "You Win."
12. Death → respawn flow.
13. Polish: camera smoothing, hit-flash on player/monsters, click-to-start.

---

This design is a living document for the v1 scope only. As soon as v1
ships and we playtest, we'll write a new design doc for the v2 scope
(likely: character creation, inventory menu, bow, multiple floors).
