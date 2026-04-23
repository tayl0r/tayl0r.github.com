import {
	Application,
	Container,
	type FederatedPointerEvent,
	Graphics,
	Text,
} from "pixi.js";

const app = new Application();
await app.init({
	background: "#6ec6ff",
	resizeTo: window,
	antialias: true,
});
document.body.appendChild(app.canvas);

// --- Constants ----------------------------------------------------------

const GROUND_Y_FROM_BOTTOM = 120;
const CENTIPEDE_SEG_COUNT = 4;
const CENTIPEDE_SEG_SPACING = 34;
const CENTIPEDE_RADIUS = 22;
const BASE_SPEED = 180; // px/s
const SPEED_ACCEL = 6; // px/s per second
const MAX_SPEED = 520; // px/s
const GRAVITY = 1800; // px/s^2
const JUMP_IMPULSE = 720; // px/s upward
const CHUNK_WIDTH = 400;
const TERRAIN_AMPLITUDE = 60;
const TERRAIN_RAMP_START = 0;
const TERRAIN_RAMP_END = 2000;
const INVINCIBILITY_SECONDS = 1;
const HIGH_SCORE_KEY = "centipede-run:highscore";

function loadHighScore(): number {
	try {
		const raw = localStorage.getItem(HIGH_SCORE_KEY);
		const n = raw == null ? 0 : Number.parseInt(raw, 10);
		return Number.isFinite(n) && n >= 0 ? n : 0;
	} catch {
		return 0;
	}
}

function saveHighScore(score: number): void {
	try {
		localStorage.setItem(
			HIGH_SCORE_KEY,
			String(Math.max(0, Math.floor(score))),
		);
	} catch {
		// localStorage may be unavailable (private mode); ignore.
	}
}

// --- World layers -------------------------------------------------------

const world = new Container(); // scrolls with camera
const ui = new Container(); // fixed on screen
app.stage.addChild(world);
app.stage.addChild(ui);

function groundY(): number {
	return app.screen.height - GROUND_Y_FROM_BOTTOM;
}

function groundHeightAt(worldX: number): number {
	const base = groundY();
	if (TERRAIN_AMPLITUDE <= 0) return base;
	const rampT = Math.min(
		1,
		Math.max(
			0,
			(worldX - TERRAIN_RAMP_START) / (TERRAIN_RAMP_END - TERRAIN_RAMP_START),
		),
	);
	const amp = TERRAIN_AMPLITUDE * rampT;
	const h =
		Math.sin(worldX * 0.004) * amp * 0.7 +
		Math.sin(worldX * 0.011 + 1.3) * amp * 0.3;
	return base - h;
}

type State = "menu" | "playing" | "gameover";
let state: State = "menu";

const menuScene = new Container();
const gameScene = new Container();
const gameoverScene = new Container();
ui.addChild(menuScene, gameoverScene);
world.addChild(gameScene);

function setState(next: State): void {
	state = next;
	menuScene.visible = next === "menu";
	gameScene.visible = next === "playing";
	gameoverScene.visible = next === "gameover";
}

setState("menu");

function makeButton(
	label: string,
	width: number,
	height: number,
	onClick: () => void,
): Container {
	const c = new Container();
	const bg = new Graphics()
		.roundRect(-width / 2, -height / 2, width, height, 12)
		.fill(0xffffff)
		.stroke({ color: 0x222222, width: 3 });
	const text = new Text({
		text: label,
		style: {
			fill: 0x222222,
			fontSize: 28,
			fontFamily: "sans-serif",
			fontWeight: "bold",
		},
	});
	text.anchor.set(0.5);
	c.addChild(bg, text);
	c.eventMode = "static";
	c.cursor = "pointer";
	c.on("pointertap", (_e: FederatedPointerEvent) => onClick());
	c.on("pointerover", () => (bg.tint = 0xdddddd));
	c.on("pointerout", () => (bg.tint = 0xffffff));
	return c;
}

const groundLayer = new Container();
world.addChild(groundLayer);

function buildChunkGround(index: number): Graphics {
	const g = new Graphics();
	const startX = index * CHUNK_WIDTH;
	const endX = startX + CHUNK_WIDTH;
	const step = 8;
	const bottom = app.screen.height;
	g.moveTo(startX, bottom);
	g.lineTo(startX, groundHeightAt(startX));
	for (let x = startX + step; x <= endX; x += step) {
		g.lineTo(x, groundHeightAt(x));
	}
	g.lineTo(endX, bottom);
	g.closePath();
	g.fill(0x3a7d2c);
	return g;
}

const title = new Text({
	text: "Centipede Run!",
	style: {
		fill: 0xffffff,
		fontSize: 72,
		fontFamily: "sans-serif",
		fontWeight: "bold",
		stroke: { color: 0x222222, width: 6 },
	},
});
title.anchor.set(0.5);
menuScene.addChild(title);

const newRunBtn = makeButton("New Run", 220, 64, () => startRun());
menuScene.addChild(newRunBtn);

const highScoreBtn = makeButton("High Score", 220, 64, () =>
	toggleHighScorePanel(),
);
menuScene.addChild(highScoreBtn);

const highScorePanel = new Container();
const highScoreBg = new Graphics()
	.roundRect(-140, -30, 280, 60, 10)
	.fill(0xffffff)
	.stroke({ color: 0x222222, width: 3 });
const highScoreText = new Text({
	text: "High Score: 0",
	style: {
		fill: 0x222222,
		fontSize: 24,
		fontFamily: "sans-serif",
		fontWeight: "bold",
	},
});
highScoreText.anchor.set(0.5);
highScorePanel.addChild(highScoreBg, highScoreText);
highScorePanel.visible = false;
menuScene.addChild(highScorePanel);

function layoutMenu(): void {
	const cx = app.screen.width / 2;
	const cy = app.screen.height / 2;
	title.position.set(cx, cy - 140);
	newRunBtn.position.set(cx, cy - 20);
	highScoreBtn.position.set(cx, cy + 60);
	highScorePanel.position.set(cx, cy + 140);
}
layoutMenu();
window.addEventListener("resize", layoutMenu);

function toggleHighScorePanel(): void {
	highScoreText.text = `High Score: ${loadHighScore()}`;
	highScorePanel.visible = !highScorePanel.visible;
}

const gameoverTitle = new Text({
	text: "Game Over",
	style: {
		fill: 0xffffff,
		fontSize: 64,
		fontFamily: "sans-serif",
		fontWeight: "bold",
		stroke: { color: 0x222222, width: 6 },
	},
});
gameoverTitle.anchor.set(0.5);
const gameoverScore = new Text({
	text: "",
	style: {
		fill: 0xffffff,
		fontSize: 32,
		fontFamily: "sans-serif",
		stroke: { color: 0x222222, width: 4 },
	},
});
gameoverScore.anchor.set(0.5);
const gameoverHint = new Text({
	text: "Click to return to menu",
	style: { fill: 0xffffff, fontSize: 20, fontFamily: "sans-serif" },
});
gameoverHint.anchor.set(0.5);
gameoverScene.addChild(gameoverTitle, gameoverScore, gameoverHint);

function layoutGameover(): void {
	const cx = app.screen.width / 2;
	const cy = app.screen.height / 2;
	gameoverTitle.position.set(cx, cy - 80);
	gameoverScore.position.set(cx, cy);
	gameoverHint.position.set(cx, cy + 80);
}
layoutGameover();
window.addEventListener("resize", layoutGameover);

gameoverScene.eventMode = "static";
gameoverScene.on("pointertap", () => {
	setState("menu");
});

const stepCounterText = new Text({
	text: "0",
	style: {
		fill: 0xffffff,
		fontSize: 48,
		fontFamily: "sans-serif",
		fontWeight: "bold",
		stroke: { color: 0x222222, width: 5 },
	},
});
stepCounterText.anchor.set(1, 0);
ui.addChild(stepCounterText);

function layoutHUD(): void {
	stepCounterText.position.set(app.screen.width - 24, 16);
}
layoutHUD();
window.addEventListener("resize", layoutHUD);

window.addEventListener("resize", () => {
	for (const chunk of chunks.values()) {
		chunk.ground.destroy();
		chunk.ground = buildChunkGround(chunk.index);
		groundLayer.addChild(chunk.ground);
	}
});

stepCounterText.visible = false;

interface Segment {
	g: Graphics;
	legs: Graphics;
	x: number;
	y: number;
}

const centipede: { segments: Segment[]; vy: number; onGround: boolean } = {
	segments: [],
	vy: 0,
	onGround: true,
};

function drawSegment(isHead: boolean): Graphics {
	const g = new Graphics();
	// Shell (brown) on top half
	g.ellipse(0, 0, CENTIPEDE_RADIUS, CENTIPEDE_RADIUS * 0.7).fill(0xffd64a); // yellow body
	g.arc(0, 0, CENTIPEDE_RADIUS, Math.PI, 0).fill(0x7a4a1e); // brown shell dome
	if (isHead) {
		g.circle(CENTIPEDE_RADIUS * 0.55, -4, 4).fill(0xffffff);
		g.circle(CENTIPEDE_RADIUS * 0.55, -4, 2).fill(0x000000);
		g.circle(CENTIPEDE_RADIUS * 0.3, -10, 4).fill(0xffffff);
		g.circle(CENTIPEDE_RADIUS * 0.3, -10, 2).fill(0x000000);
	}
	return g;
}

function drawLegs(legs: Graphics, phase: number): void {
	const swing = Math.sin(phase) * 10;
	legs
		.clear()
		.moveTo(-8, 0)
		.lineTo(-8 - swing, 18)
		.stroke({ color: 0x222222, width: 3 })
		.moveTo(8, 0)
		.lineTo(8 + swing, 18)
		.stroke({ color: 0x222222, width: 3 });
}

function spawnCentipede(): void {
	for (const s of centipede.segments) s.g.destroy();
	centipede.segments = [];
	const startX = 120;
	for (let i = 0; i < CENTIPEDE_SEG_COUNT; i++) {
		const g = drawSegment(i === 0);
		const x = startX - i * CENTIPEDE_SEG_SPACING;
		const y = groundHeightAt(x) - CENTIPEDE_RADIUS;
		g.position.set(x, y);
		gameScene.addChild(g);
		const legs = new Graphics();
		gameScene.addChild(legs);
		centipede.segments.push({ g, legs, x, y });
	}
	centipede.vy = 0;
	centipede.onGround = true;
}

let speed = BASE_SPEED;
let cameraX = 0;
let distance = 0; // px traveled this run
let stepCount = 0;
let lastStepPhase = 0;
const STEP_PHASE = Math.PI * 2; // one full leg cycle per 120px of travel
const PHASE_PER_PX = STEP_PHASE / 120;
let invincibleUntil = 0; // seconds elapsed
let runTime = 0;

interface Hazard {
	kind: "spike" | "bug";
	g: Graphics;
	x: number;
	y: number;
	width: number;
	height: number;
}

interface Chunk {
	index: number;
	hazards: Hazard[];
	ground: Graphics;
}

const chunks = new Map<number, Chunk>();

function generateChunk(index: number): Chunk {
	const ground = buildChunkGround(index);
	groundLayer.addChild(ground);
	const chunk: Chunk = { index, hazards: [], ground };
	if (index <= 2) return chunk; // first few chunks are safe
	const count = Math.random() < 0.5 ? 1 : Math.random() < 0.85 ? 2 : 0;
	let cursor = 60;
	for (let i = 0; i < count; i++) {
		const gap = 120 + Math.floor(Math.random() * 180);
		cursor += gap;
		if (cursor > CHUNK_WIDTH - 40) break;
		const worldX = index * CHUNK_WIDTH + cursor;
		const isBug = Math.random() < 0.4;
		if (isBug) {
			chunk.hazards.push(makeBug(worldX));
		} else {
			chunk.hazards.push(makeSpike(worldX));
		}
	}
	return chunk;
}

function makeBug(worldX: number): Hazard {
	const w = 34;
	const h = 24;
	const g = new Graphics()
		.ellipse(0, 0, w / 2, h / 2)
		.fill(0x9b30ff)
		.stroke({ color: 0x111111, width: 2 });
	// Little wings
	g.ellipse(-8, -10, 10, 5).fill(0xd8b4fe);
	g.ellipse(8, -10, 10, 5).fill(0xd8b4fe);
	// Fly at the peak of the jump arc — catches you only if you jump.
	const jumpPeakY = groundY() - CENTIPEDE_RADIUS - 140;
	g.position.set(worldX, jumpPeakY);
	gameScene.addChild(g);
	return { kind: "bug", g, x: worldX, y: jumpPeakY, width: w, height: h };
}

function makeSpike(worldX: number): Hazard {
	const w = 30;
	const h = 36;
	const g = new Graphics()
		.moveTo(-w / 2, 0)
		.lineTo(w / 2, 0)
		.lineTo(0, -h)
		.closePath()
		.fill(0x333333)
		.stroke({ color: 0x111111, width: 2 });
	const y = groundY();
	g.position.set(worldX, y);
	gameScene.addChild(g);
	return { kind: "spike", g, x: worldX, y: y - h / 2, width: w, height: h };
}

function destroyChunk(chunk: Chunk): void {
	for (const h of chunk.hazards) h.g.destroy();
	chunk.ground.destroy();
}

function ensureChunks(): void {
	const leftEdgeWorldX = cameraX - CHUNK_WIDTH;
	const rightEdgeWorldX = cameraX + app.screen.width + CHUNK_WIDTH;
	const firstIdx = Math.floor(leftEdgeWorldX / CHUNK_WIDTH);
	const lastIdx = Math.floor(rightEdgeWorldX / CHUNK_WIDTH);
	for (let i = firstIdx; i <= lastIdx; i++) {
		if (!chunks.has(i)) chunks.set(i, generateChunk(i));
	}
	for (const [i, chunk] of chunks) {
		if (i < firstIdx - 1) {
			destroyChunk(chunk);
			chunks.delete(i);
		}
	}
}

function startRun(): void {
	speed = BASE_SPEED;
	cameraX = 0;
	distance = 0;
	stepCount = 0;
	lastStepPhase = 0;
	invincibleUntil = 0;
	runTime = 0;
	for (const c of chunks.values()) destroyChunk(c);
	chunks.clear();
	spawnCentipede();
	stepCounterText.visible = true;
	stepCounterText.text = "0";
	setState("playing");
}

function segmentsCollideHazard(segX: number, segY: number, h: Hazard): boolean {
	const dx = Math.abs(segX - h.x);
	const dy = Math.abs(segY - h.y);
	return (
		dx < h.width / 2 + CENTIPEDE_RADIUS * 0.7 &&
		dy < h.height / 2 + CENTIPEDE_RADIUS * 0.7
	);
}

function loseSegment(): void {
	const tail = centipede.segments.pop();
	if (tail) {
		tail.g.destroy();
		tail.legs.destroy();
	}
	invincibleUntil = runTime + INVINCIBILITY_SECONDS;
	if (centipede.segments.length === 0) {
		endRun();
	}
}

function endRun(): void {
	const best = loadHighScore();
	const isNew = stepCount > best;
	if (isNew) saveHighScore(stepCount);
	gameoverScore.text = isNew
		? `New High Score: ${stepCount}!`
		: `Steps: ${stepCount} (best: ${best})`;
	stepCounterText.visible = false;
	setState("gameover");
}

window.addEventListener("keydown", (e) => {
	if (e.code === "Space" && state === "playing" && centipede.onGround) {
		centipede.vy = -JUMP_IMPULSE;
		centipede.onGround = false;
		e.preventDefault();
	}
});

app.ticker.add((time) => {
	const dt = time.deltaMS / 1000;
	if (state !== "playing") return;

	runTime += dt;
	speed = Math.min(MAX_SPEED, BASE_SPEED + SPEED_ACCEL * runTime);
	const invincible = runTime < invincibleUntil;
	// Flash during invincibility
	for (const s of centipede.segments) {
		s.g.alpha = invincible ? 0.4 + 0.3 * Math.sin(runTime * 30) : 1;
	}

	// Move head forward
	const head = centipede.segments[0];
	head.x += speed * dt;

	centipede.vy += GRAVITY * dt;
	const newY = head.y + centipede.vy * dt;
	const floorY = groundHeightAt(head.x) - CENTIPEDE_RADIUS;
	if (newY >= floorY) {
		head.y = floorY;
		centipede.vy = 0;
		centipede.onGround = true;
	} else {
		head.y = newY;
	}

	const moved = speed * dt;
	distance += moved;
	const phase = distance * PHASE_PER_PX;
	const fullCycles = Math.floor(phase / STEP_PHASE);
	if (fullCycles > lastStepPhase) {
		stepCount += fullCycles - lastStepPhase;
		lastStepPhase = fullCycles;
	}

	// Trailing segments follow with fixed spacing behind the head.
	for (let i = 1; i < centipede.segments.length; i++) {
		const prev = centipede.segments[i - 1];
		const seg = centipede.segments[i];
		seg.x = prev.x - CENTIPEDE_SEG_SPACING;
		seg.y = groundHeightAt(seg.x) - CENTIPEDE_RADIUS;
	}

	// Render: draw back-to-front so the head is on top.
	for (let i = centipede.segments.length - 1; i >= 0; i--) {
		const s = centipede.segments[i];
		s.g.position.set(s.x, s.y);
		gameScene.setChildIndex(s.g, centipede.segments.length - 1 - i);
	}

	// Draw legs for every segment, with a small per-segment phase offset.
	for (let i = 0; i < centipede.segments.length; i++) {
		const s = centipede.segments[i];
		s.legs.position.set(s.x, s.y + CENTIPEDE_RADIUS * 0.4);
		drawLegs(s.legs, phase + i * 0.8);
	}

	stepCounterText.text = String(stepCount);

	// Camera tracks the head at ~1/3 screen width.
	cameraX = head.x - app.screen.width / 3;
	world.position.x = -cameraX;

	ensureChunks();

	if (!invincible) {
		const head = centipede.segments[0];
		outer: for (const chunk of chunks.values()) {
			for (const h of chunk.hazards) {
				if (segmentsCollideHazard(head.x, head.y, h)) {
					loseSegment();
					break outer;
				}
			}
		}
	}
});
