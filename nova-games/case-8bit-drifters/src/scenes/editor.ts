import { Container, Graphics, RenderTexture, Sprite } from "pixi.js";
import type { Scene, SceneFactory } from "../context";
import { loadGridTrack, saveGridTrack } from "../race/grid-storage";
import {
	CELL_EMPTY,
	CELL_SIZE,
	CELL_START,
	CELL_TRACK,
	cellIndex,
	GRID_COLS,
	GRID_HALF_H,
	GRID_HALF_W,
	GRID_ROWS,
	hasAnyStart,
} from "../race/grid-track";
import { pixelButton } from "../ui/button";
import { pixelText } from "../ui/pixel-text";
import { createGridRaceScene } from "./grid-race";
import { createHomeScene } from "./home";

type Mode = "TRACK" | "START" | "ERASE";
const BRUSH_SIZES = [2, 4, 8, 12, 16, 24] as const;

const BG_COLOR = 0x111122;
const TRACK_COLOR = 0x4a5d7e;
const START_COLOR = 0x00ff88;

const MIN_SCALE = 0.08;
const MAX_SCALE = 2.0;
const PAN_PIXELS_PER_SEC = 900; // pan speed in screen pixels/sec

export const createEditorScene: SceneFactory = (ctx) => {
	const root = new Container();
	const world = new Container();
	root.addChild(world);

	const grid = loadGridTrack();

	// Backdrop covers the whole grid in editor bg color.
	const bg = new Graphics();
	bg.rect(
		-GRID_HALF_W,
		-GRID_HALF_H,
		GRID_COLS * CELL_SIZE,
		GRID_ROWS * CELL_SIZE,
	).fill(BG_COLOR);
	world.addChild(bg);

	// Grid render: 300x300 RenderTexture, sampled with nearest-neighbor and
	// scaled up by CELL_SIZE so each cell is one hard pixel block on screen.
	const tex = RenderTexture.create({ width: GRID_COLS, height: GRID_ROWS });
	tex.source.scaleMode = "nearest";
	const sprite = new Sprite(tex);
	sprite.position.set(-GRID_HALF_W, -GRID_HALF_H);
	sprite.scale.set(CELL_SIZE);
	sprite.eventMode = "none";
	world.addChild(sprite);

	// Border around the grid so the user can see where the world ends.
	const border = new Graphics();
	border
		.rect(
			-GRID_HALF_W,
			-GRID_HALF_H,
			GRID_COLS * CELL_SIZE,
			GRID_ROWS * CELL_SIZE,
		)
		.stroke({ color: 0x556677, width: 6 });
	world.addChild(border);

	// Initial render of any saved cells into the texture.
	function fullRedrawTexture(): void {
		const g = new Graphics();
		g.rect(0, 0, GRID_COLS, GRID_ROWS).fill(BG_COLOR);
		for (let row = 0; row < GRID_ROWS; row++) {
			for (let col = 0; col < GRID_COLS; col++) {
				const c = grid.cells[cellIndex(col, row)];
				if (c === CELL_EMPTY) continue;
				g.rect(col, row, 1, 1).fill(
					c === CELL_START ? START_COLOR : TRACK_COLOR,
				);
			}
		}
		ctx.app.renderer.render({ container: g, target: tex, clear: true });
		g.destroy();
	}
	fullRedrawTexture();

	// Invisible interaction surface covering the grid extent.
	const surface = new Graphics();
	surface
		.rect(
			-GRID_HALF_W,
			-GRID_HALF_H,
			GRID_COLS * CELL_SIZE,
			GRID_ROWS * CELL_SIZE,
		)
		.fill({ color: 0x000000, alpha: 0.001 });
	surface.eventMode = "static";
	surface.cursor = "crosshair";
	world.addChild(surface);

	// Camera state — center of grid (0,0) in world; small scale to see a chunk.
	let camX = 0;
	let camY = 0;
	let camScale = 0.25;

	// Editor state.
	let mode: Mode = "TRACK";
	let brushIdx = 2; // brush size 8 → road width ~120-160 world units
	let painting = false;
	let lastPaintX = 0;
	let lastPaintY = 0;
	let pendingSave = false;

	// Pending paints flushed once per frame to a single Graphics.
	const pendingPaints: { col: number; row: number; color: number }[] = [];
	const paintScratch = new Graphics();

	function valueForMode(): number {
		if (mode === "TRACK") return CELL_TRACK;
		if (mode === "START") return CELL_START;
		return CELL_EMPTY;
	}

	function colorForValue(v: number): number {
		if (v === CELL_TRACK) return TRACK_COLOR;
		if (v === CELL_START) return START_COLOR;
		return BG_COLOR;
	}

	function paintAtWorld(wx: number, wy: number): void {
		const centerCol = Math.floor((wx + GRID_HALF_W) / CELL_SIZE);
		const centerRow = Math.floor((wy + GRID_HALF_H) / CELL_SIZE);
		const r = BRUSH_SIZES[brushIdx];
		const halfR = Math.floor(r / 2);
		const value = valueForMode();
		const color = colorForValue(value);
		for (let dr = 0; dr < r; dr++) {
			for (let dc = 0; dc < r; dc++) {
				const c = centerCol + dc - halfR;
				const rr = centerRow + dr - halfR;
				if (c < 0 || c >= GRID_COLS || rr < 0 || rr >= GRID_ROWS) continue;
				const idx = cellIndex(c, rr);
				if (grid.cells[idx] !== value) {
					grid.cells[idx] = value;
					pendingPaints.push({ col: c, row: rr, color });
					pendingSave = true;
				}
			}
		}
	}

	function paintLine(x0: number, y0: number, x1: number, y1: number): void {
		const dist = Math.hypot(x1 - x0, y1 - y0);
		const steps = Math.max(1, Math.ceil(dist / CELL_SIZE));
		for (let i = 0; i <= steps; i++) {
			const t = i / steps;
			paintAtWorld(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
		}
	}

	surface.on("pointerdown", (e) => {
		const local = world.toLocal(e.global);
		painting = true;
		lastPaintX = local.x;
		lastPaintY = local.y;
		paintAtWorld(local.x, local.y);
	});
	surface.on("pointermove", (e) => {
		if (!painting) return;
		const local = world.toLocal(e.global);
		paintLine(lastPaintX, lastPaintY, local.x, local.y);
		lastPaintX = local.x;
		lastPaintY = local.y;
	});
	const endStroke = (): void => {
		if (!painting) return;
		painting = false;
		if (pendingSave) {
			saveGridTrack(grid);
			pendingSave = false;
			updatePlayEnabled();
		}
	};
	surface.on("pointerup", endStroke);
	surface.on("pointerupoutside", endStroke);

	// Keyboard for pan/zoom and quick mode hotkeys (1/2/3, [/], +/-).
	const keys = new Set<string>();
	const onDown = (e: KeyboardEvent): void => {
		const k = e.key.toLowerCase();
		keys.add(k);
		if (k === "1") setMode("TRACK");
		else if (k === "2") setMode("START");
		else if (k === "3") setMode("ERASE");
		else if (k === "[") setBrushIdx(Math.max(0, brushIdx - 1));
		else if (k === "]")
			setBrushIdx(Math.min(BRUSH_SIZES.length - 1, brushIdx + 1));
		else if (k === "escape") ctx.switchTo(createHomeScene);
	};
	const onUp = (e: KeyboardEvent): void => {
		keys.delete(e.key.toLowerCase());
	};
	window.addEventListener("keydown", onDown);
	window.addEventListener("keyup", onUp);

	// Wheel zoom around the cursor.
	const onWheel = (e: WheelEvent): void => {
		e.preventDefault();
		const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
		camScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, camScale * factor));
	};
	ctx.app.canvas.addEventListener("wheel", onWheel, { passive: false });

	// === HUD ===
	const hud = new Container();
	hud.eventMode = "static";
	root.addChild(hud);

	const menuBtn = pixelButton(
		"← MENU",
		() => ctx.switchTo(createHomeScene),
		14,
	);
	const modeBtn = pixelButton(`MODE: ${mode}`, () => cycleMode(), 14);
	const brushBtn = pixelButton(
		`BRUSH: ${BRUSH_SIZES[brushIdx]}`,
		() => setBrushIdx((brushIdx + 1) % BRUSH_SIZES.length),
		14,
	);
	const clearBtn = pixelButton(
		"CLEAR",
		() => {
			if (!confirm("Clear the whole track?")) return;
			grid.cells.fill(0);
			fullRedrawTexture();
			saveGridTrack(grid);
			updatePlayEnabled();
		},
		14,
	);
	const playBtn = pixelButton(
		"PLAY ▶",
		() => {
			if (!hasAnyStart(grid)) return;
			saveGridTrack(grid);
			ctx.switchTo(createGridRaceScene);
		},
		14,
	);
	const hint = pixelText(
		"Drag to paint • WASD/arrows pan • +/-/wheel zoom • 1 track 2 start 3 erase • [ ] brush",
		{ fontSize: 10, fill: 0x88aacc },
	);
	hud.addChild(
		menuBtn.view,
		modeBtn.view,
		brushBtn.view,
		clearBtn.view,
		playBtn.view,
		hint,
	);

	function setMode(m: Mode): void {
		mode = m;
		modeBtn.setLabel(`MODE: ${mode}`);
	}
	function cycleMode(): void {
		setMode(mode === "TRACK" ? "START" : mode === "START" ? "ERASE" : "TRACK");
	}
	function setBrushIdx(i: number): void {
		brushIdx = i;
		brushBtn.setLabel(`BRUSH: ${BRUSH_SIZES[brushIdx]}`);
	}
	function updatePlayEnabled(): void {
		playBtn.setEnabled(hasAnyStart(grid));
	}
	updatePlayEnabled();

	const place = (): void => {
		const w = ctx.app.screen.width;
		const h = ctx.app.screen.height;
		// Top bar buttons left-to-right.
		let x = 20;
		const y = 18;
		const space = 16;
		const buttons = [menuBtn, modeBtn, brushBtn, clearBtn, playBtn];
		for (const b of buttons) {
			b.view.position.set(x, y);
			x += b.view.width + space;
		}
		hint.position.set(20, h - 26);
		// Keep grid border highlighted by leaving sprite/world centered as
		// camera math handles the rest.
		void w;
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	const scene: Scene = {
		root,
		update(dt) {
			// Keyboard pan. Pan in world units inversely scaled by camScale so
			// movement feels constant in pixels regardless of zoom.
			const panUnits = (PAN_PIXELS_PER_SEC * dt) / camScale;
			if (keys.has("w") || keys.has("arrowup")) camY -= panUnits;
			if (keys.has("s") || keys.has("arrowdown")) camY += panUnits;
			if (keys.has("a") || keys.has("arrowleft")) camX -= panUnits;
			if (keys.has("d") || keys.has("arrowright")) camX += panUnits;
			// Keyboard zoom (+ / =, -).
			if (keys.has("=") || keys.has("+"))
				camScale = Math.min(MAX_SCALE, camScale * (1 + 1.5 * dt));
			if (keys.has("-") || keys.has("_"))
				camScale = Math.max(MIN_SCALE, camScale / (1 + 1.5 * dt));

			// Apply camera.
			const w = ctx.app.screen.width;
			const h = ctx.app.screen.height;
			world.position.set(w / 2 - camX * camScale, h / 2 - camY * camScale);
			world.scale.set(camScale);

			// Flush any pending paints into the texture in one render pass.
			if (pendingPaints.length > 0) {
				paintScratch.clear();
				for (const p of pendingPaints) {
					paintScratch.rect(p.col, p.row, 1, 1).fill(p.color);
				}
				ctx.app.renderer.render({
					container: paintScratch,
					target: tex,
					clear: false,
				});
				pendingPaints.length = 0;
			}
		},
		dispose() {
			window.removeEventListener("keydown", onDown);
			window.removeEventListener("keyup", onUp);
			window.removeEventListener("resize", onResize);
			ctx.app.canvas.removeEventListener("wheel", onWheel);
			tex.destroy(true);
			paintScratch.destroy();
			root.destroy({ children: true });
		},
	};
	return scene;
};
