import { type Application, Container, Graphics } from "pixi.js";
import { makeButton } from "./ui.js";

export const ROOM_W = 900;
export const ROOM_H = 600;
export const WALL_THICKNESS = 20;
export const DOOR_W = 80;
export const DOOR_H = WALL_THICKNESS;
export const COLOR_WALL = 0x4a5560;
export const COLOR_DOOR_LOCKED = 0xcc3344;
export const COLOR_DOOR_OPEN = 0x44cc66;
export const PLAYER_RADIUS = 18;
export const PLAYER_SPEED = 3;
export const BUTTON_SIZE = 60;
export const HALO_OUTER_R = 26;
export const HALO_INNER_R = 22;
export const COLOR_PURPLE = 0xa56cf0;
export const COLOR_YELLOW = 0xf5d442;
export const COLOR_PLAYER_BODY = 0xf0e6d6;

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
	const body = new Graphics()
		.circle(0, 0, PLAYER_RADIUS)
		.fill(COLOR_PLAYER_BODY);
	container.addChild(body);
	container.position.set(x, y);
	return { container, halo, color, x, y };
}

function setActive(p: Player, isActive: boolean): void {
	p.halo.alpha = isActive ? 1 : 0.35;
}

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

export function createGame(
	app: Application,
	keys: Set<string>,
	onExit: () => void,
	onComplete: () => void,
): { container: Container; destroy: () => void } {
	const container = new Container();

	const room = new Container();
	container.addChild(room);

	// Floor
	const floor = new Graphics().rect(0, 0, ROOM_W, ROOM_H).fill(0x1a2028);
	room.addChild(floor);

	// Walls: top, bottom, left, right
	const walls = new Graphics();
	walls.rect(0, 0, ROOM_W, WALL_THICKNESS).fill(COLOR_WALL); // top
	walls
		.rect(0, ROOM_H - WALL_THICKNESS, ROOM_W, WALL_THICKNESS)
		.fill(COLOR_WALL); // bottom
	walls.rect(0, 0, WALL_THICKNESS, ROOM_H).fill(COLOR_WALL); // left
	walls
		.rect(ROOM_W - WALL_THICKNESS, 0, WALL_THICKNESS, ROOM_H)
		.fill(COLOR_WALL); // right
	room.addChild(walls);

	// Door cut into top wall, centered horizontally
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

	const purple = makePlayer(COLOR_PURPLE, ROOM_W * 0.35, ROOM_H * 0.55);
	const yellow = makePlayer(COLOR_YELLOW, ROOM_W * 0.65, ROOM_H * 0.55);
	room.addChild(purple.container);
	room.addChild(yellow.container);

	let active: Player = purple;
	setActive(purple, true);
	setActive(yellow, false);

	const switchActive = () => {
		setActive(active, false);
		active = active === purple ? yellow : purple;
		setActive(active, true);
	};

	const onKey = (e: KeyboardEvent) => {
		if (e.key === "Tab" || e.key === " ") {
			e.preventDefault();
			switchActive();
		} else if (e.key === "Escape") {
			onExit();
		}
	};
	window.addEventListener("keydown", onKey);

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
		onClick: switchActive,
	});
	ui.addChild(switchBtn.container);

	const layoutUi = () => {
		exitBtn.container.position.set(app.screen.width - 80 - 16, 16);
		switchBtn.container.position.set(16, app.screen.height / 2 - 18);
	};
	layoutUi();

	const layout = () => {
		room.position.set(
			(app.screen.width - ROOM_W) / 2,
			(app.screen.height - ROOM_H) / 2,
		);
	};
	layout();
	const onResize = () => {
		layout();
		layoutUi();
	};
	window.addEventListener("resize", onResize);

	const minX = WALL_THICKNESS + PLAYER_RADIUS;
	const maxX = ROOM_W - WALL_THICKNESS - PLAYER_RADIUS;
	const minY = WALL_THICKNESS + PLAYER_RADIUS;
	const maxY = ROOM_H - WALL_THICKNESS - PLAYER_RADIUS;

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

	let unlocked = false;
	let completed = false;

	const tick = () => {
		let dx = 0;
		let dy = 0;
		if (keys.has("ArrowLeft") || keys.has("a") || keys.has("A")) dx -= 1;
		if (keys.has("ArrowRight") || keys.has("d") || keys.has("D")) dx += 1;
		if (keys.has("ArrowUp") || keys.has("w") || keys.has("W")) dy -= 1;
		if (keys.has("ArrowDown") || keys.has("s") || keys.has("S")) dy += 1;

		if (dx !== 0 || dy !== 0) {
			const len = Math.hypot(dx, dy);
			dx = (dx / len) * PLAYER_SPEED;
			dy = (dy / len) * PLAYER_SPEED;
			active.x = Math.max(minX, Math.min(maxX, active.x + dx));
			active.y = Math.max(minY, Math.min(maxY, active.y + dy));
			active.container.position.set(active.x, active.y);
		}

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

		if (!unlocked && purpleBtn.pressed && yellowBtn.pressed) {
			unlocked = true;
			drawDoor(true);
		}

		if (unlocked && !completed) {
			const playerAtDoor =
				active.y <= WALL_THICKNESS + PLAYER_RADIUS + 2 &&
				active.x >= doorX &&
				active.x <= doorX + DOOR_W;
			if (playerAtDoor) {
				completed = true;
				onComplete();
			}
		}
	};
	app.ticker.add(tick);

	return {
		container,
		destroy: () => {
			window.removeEventListener("keydown", onKey);
			app.ticker.remove(tick);
			window.removeEventListener("resize", onResize);
			container.destroy({ children: true });
		},
	};
}
