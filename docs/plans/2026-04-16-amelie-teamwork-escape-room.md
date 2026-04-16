# Teamwork Escape Room Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a working one-room co-op escape-room prototype at `nova-games/amelie-teamwork-escape-room/` where two characters share one keyboard, only one is active at a time, and both must stand on matching color buttons to unlock the door.

**Architecture:** Pixi.js v8 single-page app. Four source files — `main.ts` (Pixi app + scene switcher + global key state), `menu.ts` (menu scene), `game.ts` (game scene), `ui.ts` (shared button + overlay helpers). Scenes are factory functions returning `{ container, destroy }` and `main.ts` swaps them.

**Tech Stack:** Pixi.js v8, TypeScript, Vite. Template already scaffolded at `nova-games/amelie-teamwork-escape-room/` (copy of `_template/`).

**Testing note:** There's no unit-test framework in this template. Verification at each step is (a) `pnpm test` at the repo root (tsc + biome must pass) and (b) a manual browser smoke check via `pnpm dev` from the game folder. Each task lists an explicit "Verify" step.

**Design doc:** `docs/plans/2026-04-16-teamwork-escape-room-design.md`

---

## Working directory

All paths below are relative to the repo root `/Users/taylor/dev/tayl0r.github.com/`. Commands to run the game:

```bash
cd nova-games/amelie-teamwork-escape-room
pnpm dev           # starts Vite on http://localhost:5173
```

Commands to verify lint/types (always run from repo root):

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm test          # tsc --noEmit && biome check .
```

Commit cadence: **commit after every task.** All commits use the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.

---

### Task 1: Set up scene-switcher scaffold in `main.ts`

**Files:**
- Modify: `nova-games/amelie-teamwork-escape-room/src/main.ts` (full rewrite)

**Step 1: Replace `main.ts` with the scaffold**

```ts
import { Application, Container } from "pixi.js";

export type Scene = { container: Container; destroy: () => void };
export type SceneFactory = (app: Application, keys: Set<string>) => Scene;

const app = new Application();
await app.init({
	background: "#101820",
	resizeTo: window,
	antialias: true,
});
document.body.appendChild(app.canvas);

const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.key));
window.addEventListener("keyup", (e) => keys.delete(e.key));

let current: Scene | null = null;

export function setScene(factory: SceneFactory): void {
	if (current) {
		app.stage.removeChild(current.container);
		current.destroy();
	}
	current = factory(app, keys);
	app.stage.addChild(current.container);
}

// Temporary placeholder until menu scene exists
setScene(() => {
	const container = new Container();
	return { container, destroy: () => {} };
});
```

**Step 2: Run lint/type check**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm test
```

Expected: PASS (no errors).

**Step 3: Run the dev server and verify**

```bash
cd nova-games/amelie-teamwork-escape-room && pnpm dev
```

Open `http://localhost:5173` in a browser. Expected: a dark (#101820) fullscreen canvas with nothing drawn on it. No console errors.

**Step 4: Commit**

```bash
cd /Users/taylor/dev/tayl0r.github.com
git add nova-games/amelie-teamwork-escape-room/src/main.ts
git commit -m "$(cat <<'EOF'
feat(escape-room): scene-switcher scaffold

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Create `ui.ts` with clickable button helper

**Files:**
- Create: `nova-games/amelie-teamwork-escape-room/src/ui.ts`

**Step 1: Write `ui.ts`**

```ts
import { Container, Graphics, Text } from "pixi.js";

export type UiButton = {
	container: Container;
	setLabel: (text: string) => void;
};

export function makeButton(opts: {
	label: string;
	width: number;
	height: number;
	fill: number;
	hoverFill: number;
	textColor: number;
	onClick: () => void;
}): UiButton {
	const container = new Container();
	container.eventMode = "static";
	container.cursor = "pointer";

	const bg = new Graphics().roundRect(0, 0, opts.width, opts.height, 8).fill(opts.fill);
	container.addChild(bg);

	const label = new Text({
		text: opts.label,
		style: { fill: opts.textColor, fontSize: 18, fontFamily: "sans-serif" },
	});
	label.anchor.set(0.5);
	label.position.set(opts.width / 2, opts.height / 2);
	container.addChild(label);

	container.on("pointerover", () => {
		bg.clear().roundRect(0, 0, opts.width, opts.height, 8).fill(opts.hoverFill);
	});
	container.on("pointerout", () => {
		bg.clear().roundRect(0, 0, opts.width, opts.height, 8).fill(opts.fill);
	});
	container.on("pointertap", opts.onClick);

	return {
		container,
		setLabel: (t) => {
			label.text = t;
		},
	};
}
```

**Step 2: Run lint/type check**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm test
```

Expected: PASS.

**Step 3: Commit**

```bash
git add nova-games/amelie-teamwork-escape-room/src/ui.ts
git commit -m "$(cat <<'EOF'
feat(escape-room): shared ui button helper

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Build the menu scene

**Files:**
- Create: `nova-games/amelie-teamwork-escape-room/src/menu.ts`
- Modify: `nova-games/amelie-teamwork-escape-room/src/main.ts`

**Step 1: Create `menu.ts`**

```ts
import { type Application, Container, Graphics, Text } from "pixi.js";

export function createMenu(app: Application, onStart: () => void): {
	container: Container;
	destroy: () => void;
} {
	const container = new Container();

	const title = new Text({
		text: "Teamwork Escape Room!",
		style: { fill: 0xffffff, fontSize: 48, fontFamily: "sans-serif", fontWeight: "bold" },
	});
	title.anchor.set(0.5);
	container.addChild(title);

	const triangle = new Graphics()
		.poly([0, -60, 70, 50, -70, 50])
		.fill(0xa56cf0);
	triangle.eventMode = "static";
	triangle.cursor = "pointer";
	triangle.on("pointertap", onStart);
	container.addChild(triangle);

	const startLabel = new Text({
		text: "START",
		style: { fill: 0xffffff, fontSize: 20, fontFamily: "sans-serif", fontWeight: "bold" },
	});
	startLabel.anchor.set(0.5);
	container.addChild(startLabel);

	const layout = () => {
		title.position.set(app.screen.width / 2, 120);
		triangle.position.set(app.screen.width / 2, app.screen.height / 2);
		startLabel.position.set(app.screen.width / 2, app.screen.height / 2 + 15);
	};
	layout();
	const onResize = () => layout();
	window.addEventListener("resize", onResize);

	return {
		container,
		destroy: () => {
			window.removeEventListener("resize", onResize);
			container.destroy({ children: true });
		},
	};
}
```

**Step 2: Wire menu into `main.ts`**

Replace the temporary placeholder at the bottom of `main.ts`:

```ts
import { createMenu } from "./menu.js";

setScene((app) => {
	return createMenu(app, () => {
		console.log("start clicked"); // TODO: transition to game in Task 4
	});
});
```

(Remove the previous placeholder `setScene(...)` call.)

**Step 3: Lint/type check**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm test
```

Expected: PASS.

**Step 4: Manual verify**

Run `pnpm dev`. Expected:
- Title "Teamwork Escape Room!" near top center.
- Purple triangle in center of screen with "START" text on it.
- Clicking the triangle logs `"start clicked"` to the browser console.
- Resizing the window keeps both centered.

**Step 5: Commit**

```bash
git add nova-games/amelie-teamwork-escape-room/src/menu.ts nova-games/amelie-teamwork-escape-room/src/main.ts
git commit -m "$(cat <<'EOF'
feat(escape-room): menu scene with triangle start

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Game scene skeleton — room walls and door (no players yet)

**Files:**
- Create: `nova-games/amelie-teamwork-escape-room/src/game.ts`
- Modify: `nova-games/amelie-teamwork-escape-room/src/main.ts`

**Step 1: Create `game.ts`**

```ts
import { type Application, Container, Graphics } from "pixi.js";

export const ROOM_W = 900;
export const ROOM_H = 600;
export const WALL_THICKNESS = 20;
export const DOOR_W = 80;
export const DOOR_H = WALL_THICKNESS;
export const COLOR_WALL = 0x4a5560;
export const COLOR_DOOR_LOCKED = 0xcc3344;
export const COLOR_DOOR_OPEN = 0x44cc66;

export function createGame(
	app: Application,
	_keys: Set<string>,
	_onExit: () => void,
	_onComplete: () => void,
): { container: Container; destroy: () => void } {
	const container = new Container();

	const room = new Container();
	container.addChild(room);

	// Floor
	const floor = new Graphics()
		.rect(0, 0, ROOM_W, ROOM_H)
		.fill(0x1a2028);
	room.addChild(floor);

	// Walls: top, bottom, left, right
	const walls = new Graphics();
	walls.rect(0, 0, ROOM_W, WALL_THICKNESS).fill(COLOR_WALL); // top
	walls.rect(0, ROOM_H - WALL_THICKNESS, ROOM_W, WALL_THICKNESS).fill(COLOR_WALL); // bottom
	walls.rect(0, 0, WALL_THICKNESS, ROOM_H).fill(COLOR_WALL); // left
	walls.rect(ROOM_W - WALL_THICKNESS, 0, WALL_THICKNESS, ROOM_H).fill(COLOR_WALL); // right
	room.addChild(walls);

	// Door cut into top wall, centered horizontally
	const doorX = (ROOM_W - DOOR_W) / 2;
	const doorY = 0;
	const door = new Graphics().rect(doorX, doorY, DOOR_W, DOOR_H).fill(COLOR_DOOR_LOCKED);
	room.addChild(door);

	const layout = () => {
		room.position.set((app.screen.width - ROOM_W) / 2, (app.screen.height - ROOM_H) / 2);
	};
	layout();
	const onResize = () => layout();
	window.addEventListener("resize", onResize);

	return {
		container,
		destroy: () => {
			window.removeEventListener("resize", onResize);
			container.destroy({ children: true });
		},
	};
}
```

**Step 2: Wire menu → game transition in `main.ts`**

Add import:

```ts
import { createGame } from "./game.js";
```

Replace the `setScene((app) => createMenu(...))` block with a helper pattern:

```ts
function goToMenu(): void {
	setScene((app) => createMenu(app, goToGame));
}

function goToGame(): void {
	setScene((app, keys) =>
		createGame(
			app,
			keys,
			goToMenu, // onExit
			goToMenu, // onComplete (temporary — overlay comes in Task 10)
		),
	);
}

goToMenu();
```

**Step 3: Lint/type check**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm test
```

Expected: PASS.

**Step 4: Manual verify**

Run `pnpm dev`. Expected:
- Menu loads.
- Click triangle → game scene shows: a 900×600 dark room centered, gray walls on all four sides, a red door rectangle centered in the top wall.
- No interactivity yet, no players, no buttons.

**Step 5: Commit**

```bash
git add nova-games/amelie-teamwork-escape-room/src/game.ts nova-games/amelie-teamwork-escape-room/src/main.ts
git commit -m "$(cat <<'EOF'
feat(escape-room): game scene room walls and door

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Add two players with halos and active-player visual distinction

**Files:**
- Modify: `nova-games/amelie-teamwork-escape-room/src/game.ts`

**Step 1: Extend `game.ts`**

Add these constants near the top (below existing constants):

```ts
export const PLAYER_RADIUS = 18;
export const HALO_OUTER_R = 26;
export const HALO_INNER_R = 22;
export const COLOR_PURPLE = 0xa56cf0;
export const COLOR_YELLOW = 0xf5d442;
export const COLOR_PLAYER_BODY = 0xf0e6d6;
```

Add a player factory above `createGame`:

```ts
type Player = {
	container: Container;
	halo: Graphics;
	color: number;
	x: number;
	y: number;
};

function makePlayer(color: number, x: number, y: number): Player {
	const container = new Container();
	const halo = new Graphics()
		.circle(0, -PLAYER_RADIUS - 12, HALO_OUTER_R)
		.fill({ color, alpha: 0.9 })
		.circle(0, -PLAYER_RADIUS - 12, HALO_INNER_R)
		.cut();
	container.addChild(halo);
	const body = new Graphics().circle(0, 0, PLAYER_RADIUS).fill(COLOR_PLAYER_BODY);
	container.addChild(body);
	container.position.set(x, y);
	return { container, halo, color, x, y };
}

function setActive(p: Player, isActive: boolean): void {
	p.halo.alpha = isActive ? 1 : 0.35;
}
```

Inside `createGame`, after the door is added, spawn both players roughly center-left and center-right:

```ts
const purple = makePlayer(COLOR_PURPLE, ROOM_W * 0.35, ROOM_H * 0.55);
const yellow = makePlayer(COLOR_YELLOW, ROOM_W * 0.65, ROOM_H * 0.55);
room.addChild(purple.container);
room.addChild(yellow.container);

let active: Player = purple;
setActive(purple, true);
setActive(yellow, false);
```

(The `active` variable + `setActive` helper are prep for Task 7; leave them here so the visual distinction is already correct.)

**Step 2: Lint/type check**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm test
```

Expected: PASS.

**Step 3: Manual verify**

`pnpm dev` → click triangle → room shows with two round players: one on the left with a bright purple ring above it, one on the right with a dim yellow ring above it.

**Step 4: Commit**

```bash
git add nova-games/amelie-teamwork-escape-room/src/game.ts
git commit -m "$(cat <<'EOF'
feat(escape-room): two players with halos

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Movement and wall collision for the active player

**Files:**
- Modify: `nova-games/amelie-teamwork-escape-room/src/game.ts`

**Step 1: Add speed constant**

```ts
export const PLAYER_SPEED = 3;
```

**Step 2: Add a ticker callback inside `createGame`** (after players are spawned):

```ts
const minX = WALL_THICKNESS + PLAYER_RADIUS;
const maxX = ROOM_W - WALL_THICKNESS - PLAYER_RADIUS;
const minY = WALL_THICKNESS + PLAYER_RADIUS;
const maxY = ROOM_H - WALL_THICKNESS - PLAYER_RADIUS;

const tick = () => {
	let dx = 0;
	let dy = 0;
	if (_keys.has("ArrowLeft") || _keys.has("a") || _keys.has("A")) dx -= 1;
	if (_keys.has("ArrowRight") || _keys.has("d") || _keys.has("D")) dx += 1;
	if (_keys.has("ArrowUp") || _keys.has("w") || _keys.has("W")) dy -= 1;
	if (_keys.has("ArrowDown") || _keys.has("s") || _keys.has("S")) dy += 1;

	if (dx !== 0 || dy !== 0) {
		const len = Math.hypot(dx, dy);
		dx = (dx / len) * PLAYER_SPEED;
		dy = (dy / len) * PLAYER_SPEED;
		active.x = Math.max(minX, Math.min(maxX, active.x + dx));
		active.y = Math.max(minY, Math.min(maxY, active.y + dy));
		active.container.position.set(active.x, active.y);
	}
};
app.ticker.add(tick);
```

**Step 3: Unsubscribe the ticker in the destroy handler**

Change the `destroy` return to:

```ts
destroy: () => {
	app.ticker.remove(tick);
	window.removeEventListener("resize", onResize);
	container.destroy({ children: true });
},
```

**Step 4: Remove the `_keys` underscore prefix**

Rename the `_keys` parameter of `createGame` to `keys` and update the tick function accordingly (underscore prefix was placeholder; it's now used).

**Step 5: Lint/type check**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm test
```

Expected: PASS.

**Step 6: Manual verify**

Click triangle → game loads. Press WASD or arrow keys. Expected:
- Purple player (the active one) moves in the pressed direction.
- Diagonal movement works (holding two keys).
- Player stops cleanly at each wall — can't pass through.
- Yellow player does not move.

**Step 7: Commit**

```bash
git add nova-games/amelie-teamwork-escape-room/src/game.ts
git commit -m "$(cat <<'EOF'
feat(escape-room): movement and wall collision for active player

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Switch-character key (Tab / Space)

**Files:**
- Modify: `nova-games/amelie-teamwork-escape-room/src/game.ts`

**Step 1: Add a switch handler**

Inside `createGame`, after `active` is declared, add:

```ts
const onSwitch = (e: KeyboardEvent) => {
	if (e.key === "Tab" || e.key === " ") {
		e.preventDefault();
		setActive(active, false);
		active = active === purple ? yellow : purple;
		setActive(active, true);
	}
};
window.addEventListener("keydown", onSwitch);
```

**Step 2: Unsubscribe in destroy**

```ts
destroy: () => {
	window.removeEventListener("keydown", onSwitch);
	app.ticker.remove(tick);
	window.removeEventListener("resize", onResize);
	container.destroy({ children: true });
},
```

**Step 3: Lint/type check**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm test
```

Expected: PASS.

**Step 4: Manual verify**

Click triangle. Move purple player. Press Tab → now the yellow halo brightens and purple dims. WASD now moves yellow; purple stays put. Press Space → switches back to purple. Repeat several times, confirm frozen player never moves.

**Step 5: Commit**

```bash
git add nova-games/amelie-teamwork-escape-room/src/game.ts
git commit -m "$(cat <<'EOF'
feat(escape-room): Tab/Space to switch active character

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Floor buttons with press detection

**Files:**
- Modify: `nova-games/amelie-teamwork-escape-room/src/game.ts`

**Step 1: Add button constants**

```ts
export const BUTTON_SIZE = 60;
```

**Step 2: Add button factory above `createGame`**

```ts
type FloorButton = {
	graphics: Graphics;
	x: number;
	y: number;
	color: number;
	pressed: boolean;
};

function makeFloorButton(color: number, x: number, y: number): FloorButton {
	const btn: FloorButton = {
		graphics: new Graphics(),
		x,
		y,
		color,
		pressed: false,
	};
	drawButton(btn);
	btn.graphics.position.set(x, y);
	return btn;
}

function drawButton(b: FloorButton): void {
	b.graphics
		.clear()
		.rect(-BUTTON_SIZE / 2, -BUTTON_SIZE / 2, BUTTON_SIZE, BUTTON_SIZE)
		.fill({ color: b.color, alpha: b.pressed ? 1 : 0.4 });
}
```

**Step 3: Inside `createGame`, spawn two buttons in opposite corners (add before `const tick = ...`)**

```ts
const purpleBtn = makeFloorButton(
	COLOR_PURPLE,
	WALL_THICKNESS + BUTTON_SIZE,
	ROOM_H - WALL_THICKNESS - BUTTON_SIZE,
);
const yellowBtn = makeFloorButton(
	COLOR_YELLOW,
	ROOM_W - WALL_THICKNESS - BUTTON_SIZE,
	ROOM_H - WALL_THICKNESS - BUTTON_SIZE,
);
room.addChildAt(purpleBtn.graphics, 1); // above floor, below players
room.addChildAt(yellowBtn.graphics, 2);
```

**Step 4: Add press-check to `tick` (after the movement block)**

```ts
const updateButton = (b: FloorButton, p: Player) => {
	const dx = p.x - b.x;
	const dy = p.y - b.y;
	const inside =
		Math.abs(dx) <= BUTTON_SIZE / 2 && Math.abs(dy) <= BUTTON_SIZE / 2;
	if (inside !== b.pressed) {
		b.pressed = inside;
		drawButton(b);
	}
};
updateButton(purpleBtn, purple);
updateButton(yellowBtn, yellow);
```

**Step 5: Lint/type check**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm test
```

Expected: PASS.

**Step 6: Manual verify**

- Two dim colored squares appear on the floor (purple bottom-left, yellow bottom-right).
- Walk purple player onto the purple square → it brightens.
- Step off → it dims.
- Walk purple player onto the yellow square → yellow stays dim (wrong color).
- Switch to yellow, walk onto yellow square → brightens.

**Step 7: Commit**

```bash
git add nova-games/amelie-teamwork-escape-room/src/game.ts
git commit -m "$(cat <<'EOF'
feat(escape-room): floor buttons with color-matched press detection

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Door unlocks when both buttons pressed, win on walk-through

**Files:**
- Modify: `nova-games/amelie-teamwork-escape-room/src/game.ts`

**Step 1: Track door state and redraw**

In `createGame`, replace the door creation so we can redraw it:

```ts
const doorX = (ROOM_W - DOOR_W) / 2;
const doorY = 0;
const door = new Graphics();
const drawDoor = (unlocked: boolean) => {
	door
		.clear()
		.rect(doorX, doorY, DOOR_W, DOOR_H)
		.fill(unlocked ? COLOR_DOOR_OPEN : COLOR_DOOR_LOCKED);
};
drawDoor(false);
room.addChild(door);
```

**Step 2: Update door state and check win at the end of `tick`**

```ts
const unlocked = purpleBtn.pressed && yellowBtn.pressed;
drawDoor(unlocked);

if (unlocked) {
	const playerAtDoor =
		active.y <= WALL_THICKNESS + PLAYER_RADIUS + 2 &&
		active.x >= doorX &&
		active.x <= doorX + DOOR_W;
	if (playerAtDoor) {
		_onComplete();
	}
}
```

**Step 3: Remove `_` prefix from `onComplete` and `onExit` parameters**

Rename `_onExit` → `onExit` and `_onComplete` → `onComplete` in the `createGame` signature. (Only `onComplete` is used now; `onExit` is consumed in Task 10.)

**Step 4: Lint/type check**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm test
```

Expected: PASS.

**Step 5: Manual verify**

- Walk purple onto purple button → door still red.
- Switch to yellow, walk onto yellow button → door turns green.
- Step yellow off the button → door turns red again.
- Step yellow back on. Switch to purple (purple already on its button). Now move purple up to the top wall and into the door rectangle → scene transitions back to the menu (temporary behavior until Task 11 adds the overlay).

**Step 6: Commit**

```bash
git add nova-games/amelie-teamwork-escape-room/src/game.ts
git commit -m "$(cat <<'EOF'
feat(escape-room): door unlocks on both buttons, walk-through wins

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: UI overlay — Exit button, Switch Character button, Escape key

**Files:**
- Modify: `nova-games/amelie-teamwork-escape-room/src/game.ts`

**Step 1: Import `makeButton`**

At top of `game.ts`:

```ts
import { makeButton } from "./ui.js";
```

**Step 2: Build the overlay inside `createGame` (after players, before tick)**

```ts
const ui = new Container();
container.addChild(ui);

const exitBtn = makeButton({
	label: "Exit",
	width: 80,
	height: 36,
	fill: 0x333b47,
	hoverFill: 0x4b5666,
	textColor: 0xffffff,
	onClick: onExit,
});
ui.addChild(exitBtn.container);

const switchBtn = makeButton({
	label: "Switch Character",
	width: 160,
	height: 36,
	fill: 0x333b47,
	hoverFill: 0x4b5666,
	textColor: 0xffffff,
	onClick: () => {
		setActive(active, false);
		active = active === purple ? yellow : purple;
		setActive(active, true);
	},
});
ui.addChild(switchBtn.container);

const layoutUi = () => {
	exitBtn.container.position.set(app.screen.width - 80 - 16, 16);
	switchBtn.container.position.set(16, app.screen.height / 2 - 18);
};
layoutUi();
```

**Step 3: Call `layoutUi` on resize**

In the existing `layout` function (for the room), also call `layoutUi()`, or add a separate resize listener. Simplest: replace the existing `onResize` with:

```ts
const onResize = () => {
	layout();
	layoutUi();
};
window.addEventListener("resize", onResize);
```

**Step 4: Hook Escape key**

Add to the existing `onSwitch` keydown handler — or create a sibling. Simplest, add to existing handler:

```ts
const onKey = (e: KeyboardEvent) => {
	if (e.key === "Tab" || e.key === " ") {
		e.preventDefault();
		setActive(active, false);
		active = active === purple ? yellow : purple;
		setActive(active, true);
	} else if (e.key === "Escape") {
		onExit();
	}
};
window.addEventListener("keydown", onKey);
```

(Rename the previous `onSwitch` references to `onKey`, including in the `destroy` block.)

**Step 5: Lint/type check**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm test
```

Expected: PASS.

**Step 6: Manual verify**

- Enter game. "Exit" button visible top-right; "Switch Character" button visible middle-left.
- Both buttons brighten on hover.
- Click "Switch Character" → active player toggles (halo brightness swaps).
- Click "Exit" → returns to menu.
- From game, press Escape → returns to menu.

**Step 7: Commit**

```bash
git add nova-games/amelie-teamwork-escape-room/src/game.ts
git commit -m "$(cat <<'EOF'
feat(escape-room): in-game UI with exit and switch-character controls

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Level-complete overlay

**Files:**
- Modify: `nova-games/amelie-teamwork-escape-room/src/ui.ts`
- Modify: `nova-games/amelie-teamwork-escape-room/src/main.ts`

**Step 1: Add a `createLevelComplete` factory in `ui.ts`**

```ts
import { type Application } from "pixi.js";

export function createLevelComplete(
	app: Application,
	onNext: () => void,
	onMenu: () => void,
): { container: Container; destroy: () => void } {
	const container = new Container();

	const bg = new Graphics()
		.rect(0, 0, app.screen.width, app.screen.height)
		.fill({ color: 0x000000, alpha: 0.6 });
	container.addChild(bg);

	const title = new Text({
		text: "Level Complete!",
		style: { fill: 0xffffff, fontSize: 56, fontFamily: "sans-serif", fontWeight: "bold" },
	});
	title.anchor.set(0.5);
	container.addChild(title);

	const nextBtn = makeButton({
		label: "Next Level",
		width: 160,
		height: 44,
		fill: 0x44cc66,
		hoverFill: 0x5fe07f,
		textColor: 0x102010,
		onClick: onNext,
	});
	container.addChild(nextBtn.container);

	const menuBtn = makeButton({
		label: "Menu",
		width: 120,
		height: 44,
		fill: 0x333b47,
		hoverFill: 0x4b5666,
		textColor: 0xffffff,
		onClick: onMenu,
	});
	container.addChild(menuBtn.container);

	const layout = () => {
		bg.clear().rect(0, 0, app.screen.width, app.screen.height).fill({ color: 0x000000, alpha: 0.6 });
		title.position.set(app.screen.width / 2, app.screen.height / 2 - 60);
		nextBtn.container.position.set(app.screen.width / 2 - 170, app.screen.height / 2 + 20);
		menuBtn.container.position.set(app.screen.width / 2 + 10, app.screen.height / 2 + 20);
	};
	layout();
	const onResize = () => layout();
	window.addEventListener("resize", onResize);

	return {
		container,
		destroy: () => {
			window.removeEventListener("resize", onResize);
			container.destroy({ children: true });
		},
	};
}
```

Note: you also need to import `Container`, `Graphics`, `Text` into the top of `ui.ts` (already imported) and add `Application` to the imports.

**Step 2: Wire level-complete into `main.ts`**

Replace the `goToGame` function with:

```ts
import { createLevelComplete } from "./ui.js";

function goToGame(): void {
	setScene((app, keys) =>
		createGame(app, keys, goToMenu, goToLevelComplete),
	);
}

function goToLevelComplete(): void {
	setScene((app) => createLevelComplete(app, goToGame, goToMenu));
}
```

**Step 3: Lint/type check**

```bash
cd /Users/taylor/dev/tayl0r.github.com && pnpm test
```

Expected: PASS.

**Step 4: Manual verify (full end-to-end smoke test)**

1. `pnpm dev` → menu appears with title + triangle.
2. Click triangle → room with two players, two dim floor buttons, red door.
3. Move purple onto purple button → button brightens.
4. Tab to switch → yellow is active.
5. Move yellow onto yellow button → door turns green.
6. Move yellow into the door opening → "Level Complete!" overlay with two buttons appears over the room.
7. Click "Next Level" → fresh room, players reset to starting positions, buttons dim, door red.
8. Repeat win condition → click "Menu" this time → back to menu.
9. From game, click "Exit" → back to menu.
10. From game, press Escape → back to menu.

**Step 5: Commit**

```bash
git add nova-games/amelie-teamwork-escape-room/src/ui.ts nova-games/amelie-teamwork-escape-room/src/main.ts
git commit -m "$(cat <<'EOF'
feat(escape-room): level-complete overlay with next/menu

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Root build + landing page card

**Files:**
- Modify: `nova-games/index.html`

**Step 1: Add a card for the new game**

Inside `<div class="game-grid">`, add:

```html
<a href="./amelie-teamwork-escape-room/" class="game-card">
  <span class="game-title">Teamwork Escape Room</span>
  <span class="game-author">by Amelie</span>
  <span class="game-engine">Pixi.js</span>
</a>
```

(Match the structure of any existing cards — if the grid is empty, just add this one.)

**Step 2: Full root build**

```bash
cd /Users/taylor/dev/tayl0r.github.com
pnpm test
pnpm run build
```

Expected:
- `pnpm test` passes.
- `pnpm run build` succeeds. The build-games script output should include `amelie-teamwork-escape-room` in the "succeeded" summary.
- `dist/nova-games/amelie-teamwork-escape-room/index.html` exists.

**Step 3: Commit**

```bash
git add nova-games/index.html
git commit -m "$(cat <<'EOF'
feat(escape-room): list on nova-games landing page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Done criteria

- All 12 tasks committed.
- `pnpm test` passes at repo root.
- `pnpm run build` succeeds and includes the game in `dist/`.
- The end-to-end smoke test in Task 11 passes in the browser.
- `nova-games/index.html` has a card linking to the new game.

## Deferred to future iterations (not in this plan)

- Hidden buttons behind push-blocks.
- Safes with code puzzles.
- Multiple levels with different layouts.
- Sprites, animations, sound.
- Mobile / touch controls.
