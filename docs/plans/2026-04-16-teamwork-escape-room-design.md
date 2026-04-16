# Teamwork Escape Room — Design

Game: `nova-games/amelie-teamwork-escape-room/`
Stack: Pixi.js v8 + TypeScript (from the `_template`).
Goal: simple working prototype proving the core co-op loop end-to-end.

---

## Core concept

Two characters, one keyboard. Only one character is "active" at a time;
the other freezes in place. Both must be standing on their own color-matched
floor button *at the same time* to unlock the door and escape.

## Scope (prototype v1)

- One level, one room.
- Both buttons visible in the open (no hidden buttons, safes, or push-blocks).
- Menu → Game → Level Complete → Menu / replay loop.

Explicitly out of scope: sprites, sound, multiple levels, safes/codes,
push-blocks, hidden buttons, mobile/touch controls.

## File layout

```
nova-games/amelie-teamwork-escape-room/src/
  main.ts      Pixi app init + scene switcher + global key state
  menu.ts      Menu scene (title + triangle start button)
  game.ts      Game scene (room, players, buttons, door, movement)
  ui.ts        Shared UI helpers (clickable buttons, level-complete overlay)
```

Each scene module exports a factory like `createMenu(app, onStart)` that
returns `{ container, destroy }`. `main.ts` owns `currentScene` and swaps
scenes by destroying the old and mounting the new.

## Scenes and flow

**Menu** — dark background, title "Teamwork Escape Room!" near the top,
a large purple triangle in the center. Clicking the triangle starts the game.

**Game** — a bordered room (~900×600) centered on screen:
- Four gray walls on the edges; a door rectangle cut into one wall (red =
  locked, green = unlocked).
- Two player circles with halo rings: purple and yellow.
- Two floor buttons (colored squares): purple and yellow.
- UI overlay: "Exit" top-right, "Switch Character" middle-left.
- Active player's halo is bright; inactive is dimmed.

**Level Complete** — semi-transparent overlay with "Level Complete!",
"Next Level" (restarts the room) and "Menu" buttons.

```
Menu --click triangle--> Game
Game --Exit / Escape--> Menu
Game --walk through open door--> Level Complete
Level Complete --Next Level--> Game (fresh)
Level Complete --Menu--> Menu
```

## Game mechanics

**Movement** — WASD or arrow keys move the active player only. Diagonals
allowed. Speed ~3 px/frame. AABB collision against walls; player clamps to
wall edge. Players may overlap each other.

**Switching** — Tab, Space, or the "Switch Character" UI button toggles
the active player. The inactive player freezes in place, so if they're
standing on a button, that button stays pressed.

**Buttons** — each floor button checks whether its correctly-colored
player's center is inside its bounds *right now*. Button visually
brightens when pressed. Wrong-color player has no effect.

**Door** — locked (red) while either button is un-pressed. Unlocks
(green) the moment both are simultaneously pressed. If a player walks
off a button, the door re-locks. Active player walking onto the door
rect *while unlocked* triggers level-complete.

**Controls**
- WASD / arrow keys → move active player
- Tab or Space → switch character
- Escape → back to menu
- Click "Exit" → back to menu
- Click "Switch Character" → switch character

## Implementation details

- Input: one global `keys: Set<string>` in `main.ts`, fed by
  `keydown`/`keyup` listeners. Scenes read from it each tick.
- Each scene subscribes to `app.ticker` on mount, unsubscribes on destroy.
- Game-scene tick: read keys → move active player → clamp to walls →
  recompute button pressed states → update door color → check win.
- UI buttons: Pixi `Container` with `Graphics` + `Text`,
  `eventMode = "static"`, hover brightens fill.
- Tuneables at the top of `game.ts`: `ROOM_W`, `ROOM_H`,
  `PLAYER_RADIUS`, `PLAYER_SPEED`, `BUTTON_SIZE`, `DOOR_W`, `DOOR_H`,
  and the purple/yellow color constants.

## Testing

- `pnpm test` at the repo root must pass (tsc + biome).
- Manual smoke test end-to-end:
  1. `pnpm dev` in the game folder → menu shows with title + triangle.
  2. Click triangle → room appears with two players, two buttons,
     locked red door.
  3. Move purple player onto purple button → button brightens. Door
     still red.
  4. Press Tab → yellow player becomes active. Walk onto yellow button
     → door turns green.
  5. Walk through door → "Level Complete!" overlay appears.
  6. "Next Level" resets the room. "Menu" returns to the menu.
  7. From the game, Escape key → back to menu.
