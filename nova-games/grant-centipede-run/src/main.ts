import {
	Application,
	Container,
	type FederatedPointerEvent,
	Graphics,
	Text,
} from "pixi.js";

// Dynamic import forces the full pixi.js module (including renderer extension
// registrations with side effects) to evaluate before we touch Application.
// Removing this makes app.init() hang silently in the production bundle.
await import("pixi.js");

const app = new Application();
await app.init({
	background: "#6ec6ff",
	resizeTo: window,
	antialias: true,
	// Also force WebGL; Pixi v8's WebGPU auto-select has caused hangs in the
	// past and WebGL is plenty for this game.
	preference: "webgl",
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
const SEGMENT_JUMP_DELAY = 0.07; // seconds between each segment in the jump wave
const CHUNK_WIDTH = 400;
const TERRAIN_AMPLITUDE = 60;
const TERRAIN_RAMP_START = 0;
const TERRAIN_RAMP_END = 2000;
const INVINCIBILITY_SECONDS = 1;
const POWERUP_INVINCIBILITY_SECONDS = 5;
const SPHERE_RADIUS = 28;
const FIREBALL_RADIUS = 24;
const FIREBALL_SPEED = 120; // px/s
const FIREBALL_DESPAWN_BEHIND_PX = 150;
const MUSHROOM_HEIGHT = 34;
const MUSHROOM_WIDTH = 30;
const PIT_WIDTH = 90;
const PIT_DEPTH = 36;
const MIN_SPAWN_SPACING = 200; // px between consecutive spawns (enemies + powerups)
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

function hslToHex(h: number, s: number, l: number): number {
	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;
	let r = 0;
	let g = 0;
	let b = 0;
	if (h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (h < 300) {
		r = x;
		g = 0;
		b = c;
	} else {
		r = c;
		g = 0;
		b = x;
	}
	const to = (v: number) => Math.round((v + m) * 255);
	return (to(r) << 16) | (to(g) << 8) | to(b);
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
	antennae: Graphics | null;
	x: number;
	y: number;
	vy: number;
	onGround: boolean;
	pendingJumpAt: number | null;
}

const centipede: { segments: Segment[] } = {
	segments: [],
};

function drawSegment(isHead: boolean): Graphics {
	const g = new Graphics();
	// Slightly rounder body
	g.ellipse(0, 0, CENTIPEDE_RADIUS, CENTIPEDE_RADIUS * 0.8).fill(0xffd64a);
	// Brown shell dome
	g.arc(0, 0, CENTIPEDE_RADIUS, Math.PI, 0).fill(0x7a4a1e);
	if (isHead) {
		// Symmetric big eyes
		const eyeY = -2;
		const eyeX = CENTIPEDE_RADIUS * 0.45;
		// Sclera
		g.circle(eyeX, eyeY, 6).fill(0xffffff);
		g.circle(-eyeX, eyeY, 6).fill(0xffffff);
		// Pupils
		g.circle(eyeX, eyeY, 3).fill(0x000000);
		g.circle(-eyeX, eyeY, 3).fill(0x000000);
		// Highlight glints
		g.circle(eyeX + 1.2, eyeY - 1.5, 1).fill(0xffffff);
		g.circle(-eyeX + 1.2, eyeY - 1.5, 1).fill(0xffffff);
		// Rosy cheeks
		g.circle(eyeX + 2, eyeY + 5, 2.5).fill(0xff9ab0);
		g.circle(-eyeX + 2, eyeY + 5, 2.5).fill(0xff9ab0);
		// Cute wide smile — explicit moveTo + curve so no stray line is drawn.
		g.moveTo(-8, eyeY + 4)
			.quadraticCurveTo(0, eyeY + 12, 8, eyeY + 4)
			.stroke({ color: 0x3a2516, width: 2.5 });
	}
	return g;
}

function drawLegs(legs: Graphics, phase: number): void {
	const swing = Math.sin(phase) * 10;
	legs.clear();
	for (const side of [-1, 1]) {
		const hipX = 8 * side;
		const footX = (8 + swing * side) * side;
		const footY = 18;
		legs
			.moveTo(hipX, 0)
			.lineTo(footX, footY)
			.stroke({ color: 0x222222, width: 3 });
		// Boot: dark rounded rect centered on the foot
		legs.roundRect(footX - 3.5, footY - 1, 7, 5, 2).fill(0x3a2516);
	}
}

function drawAntennae(a: Graphics, phase: number): void {
	const swing = Math.sin(phase * 0.8) * 4;
	a.clear()
		.moveTo(-6, -CENTIPEDE_RADIUS + 2)
		.quadraticCurveTo(
			-9 + swing,
			-CENTIPEDE_RADIUS - 6,
			-7 + swing,
			-CENTIPEDE_RADIUS - 10,
		)
		.stroke({ color: 0x3a2516, width: 2 })
		.circle(-7 + swing, -CENTIPEDE_RADIUS - 11, 2)
		.fill(0x3a2516)
		.moveTo(6, -CENTIPEDE_RADIUS + 2)
		.quadraticCurveTo(
			9 - swing,
			-CENTIPEDE_RADIUS - 6,
			7 - swing,
			-CENTIPEDE_RADIUS - 10,
		)
		.stroke({ color: 0x3a2516, width: 2 })
		.circle(7 - swing, -CENTIPEDE_RADIUS - 11, 2)
		.fill(0x3a2516);
}

function spawnCentipede(): void {
	for (const s of centipede.segments) {
		s.g.destroy();
		s.legs.destroy();
		s.antennae?.destroy();
	}
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
		let antennae: Graphics | null = null;
		if (i === 0) {
			antennae = new Graphics();
			gameScene.addChild(antennae);
		}
		centipede.segments.push({
			g,
			legs,
			antennae,
			x,
			y,
			vy: 0,
			onGround: true,
			pendingJumpAt: null,
		});
	}
}

let speed = BASE_SPEED;
let cameraX = 0;
let distance = 0; // px traveled this run
let stepCount = 0;
let lastStepPhase = 0;
const STEP_PHASE = Math.PI * 2; // one full leg cycle per 120px of travel
const PHASE_PER_PX = STEP_PHASE / 120;
let invincibleUntil = 0; // seconds elapsed
let powerupInvincibleUntil = 0;
let runTime = 0;

type SpawnableKind =
	| "sphere"
	| "fireball"
	| "blueMushroom"
	| "redMushroom"
	| "pit";

interface Spawnable {
	kind: SpawnableKind;
	g: Graphics;
	x: number;
	y: number;
	vx?: number; // for fireball
	vy?: number; // for fireball
	width: number;
	height: number;
	alive: boolean;
}

interface Chunk {
	index: number;
	spawns: Spawnable[];
	ground: Graphics;
}

const chunks = new Map<number, Chunk>();
let lastSpawnWorldX = Number.NEGATIVE_INFINITY;

function drawMushroom(capColor: number): Graphics {
	const g = new Graphics();
	// Cap
	g.arc(0, 0, MUSHROOM_WIDTH / 2, Math.PI, 0)
		.fill(capColor)
		.stroke({ color: 0x222222, width: 2 });
	// Cap spots (lighter)
	const spot = 0xffffff;
	g.circle(-6, -6, 3).fill(spot);
	g.circle(5, -3, 2).fill(spot);
	g.circle(2, -10, 2).fill(spot);
	// Stem
	g.roundRect(-7, 0, 14, MUSHROOM_HEIGHT / 2, 3)
		.fill(0xfff3d1)
		.stroke({ color: 0x222222, width: 2 });
	return g;
}

function makeBlueMushroom(worldX: number): Spawnable {
	const g = drawMushroom(0x3aa0ff);
	const y = groundHeightAt(worldX) - MUSHROOM_HEIGHT / 2;
	g.position.set(worldX, y);
	gameScene.addChild(g);
	return {
		kind: "blueMushroom",
		g,
		x: worldX,
		y,
		width: MUSHROOM_WIDTH,
		height: MUSHROOM_HEIGHT,
		alive: true,
	};
}

function makeRedMushroom(worldX: number): Spawnable {
	const g = drawMushroom(0xff3a3a);
	const y = groundHeightAt(worldX) - MUSHROOM_HEIGHT / 2;
	g.position.set(worldX, y);
	gameScene.addChild(g);
	return {
		kind: "redMushroom",
		g,
		x: worldX,
		y,
		width: MUSHROOM_WIDTH,
		height: MUSHROOM_HEIGHT,
		alive: true,
	};
}

function makeSphere(worldX: number): Spawnable {
	const g = new Graphics();
	g.circle(0, 0, SPHERE_RADIUS)
		.fill(0x8a2be2)
		.stroke({ color: 0x3a0d5a, width: 2 });
	// Angry eyes
	g.circle(-10, -4, 4).fill(0xffffff);
	g.circle(10, -4, 4).fill(0xffffff);
	g.circle(-10, -3, 2).fill(0x000000);
	g.circle(10, -3, 2).fill(0x000000);
	// Angled eyebrows
	g.moveTo(-16, -12).lineTo(-4, -8).stroke({ color: 0x1a0030, width: 3 });
	g.moveTo(16, -12).lineTo(4, -8).stroke({ color: 0x1a0030, width: 3 });
	// Two boots at the bottom
	g.roundRect(-13, SPHERE_RADIUS - 4, 10, 6, 2).fill(0x3a2516);
	g.roundRect(3, SPHERE_RADIUS - 4, 10, 6, 2).fill(0x3a2516);
	const y = groundHeightAt(worldX) - SPHERE_RADIUS;
	g.position.set(worldX, y);
	gameScene.addChild(g);
	return {
		kind: "sphere",
		g,
		x: worldX,
		y,
		width: SPHERE_RADIUS * 2,
		height: SPHERE_RADIUS * 2,
		alive: true,
	};
}

function makeFireball(worldX: number): Spawnable {
	const g = new Graphics();
	// Outer flame
	g.circle(0, 0, FIREBALL_RADIUS)
		.fill(0xff5a1f)
		.stroke({ color: 0x801800, width: 2 });
	// Inner flicker
	g.circle(-2, 2, FIREBALL_RADIUS * 0.6).fill(0xffc400);
	// One big angry eye
	g.circle(0, 0, 11).fill(0xffffff);
	g.circle(0, 1, 5).fill(0x000000);
	// Two furrowed brows angling inward and down for a "pissed" look
	g.moveTo(-15, -20).lineTo(-3, -13).stroke({ color: 0x200800, width: 4 });
	g.moveTo(15, -20).lineTo(3, -13).stroke({ color: 0x200800, width: 4 });
	const y = groundHeightAt(worldX) - (180 + Math.random() * 80);
	g.position.set(worldX, y);
	gameScene.addChild(g);
	return {
		kind: "fireball",
		g,
		x: worldX,
		y,
		vx: 0,
		vy: 0,
		width: FIREBALL_RADIUS * 2,
		height: FIREBALL_RADIUS * 2,
		alive: true,
	};
}

function makePit(worldX: number): Spawnable {
	const g = new Graphics();
	const ground = groundHeightAt(worldX);
	const w = PIT_WIDTH;
	const d = PIT_DEPTH;
	// Dark hole extending downward from ground level.
	g.rect(-w / 2, 0, w, d).fill(0x14070b);
	// Inner shadow at the rim so the lip reads as a hole.
	g.rect(-w / 2, 0, w, 4).fill(0x000000);
	// Spike teeth pointing up from the bottom.
	const spikeCount = 5;
	const spikeStep = w / spikeCount;
	for (let i = 0; i < spikeCount; i++) {
		const sx = -w / 2 + spikeStep * (i + 0.5);
		g.moveTo(sx - 5, d - 2)
			.lineTo(sx, 8)
			.lineTo(sx + 5, d - 2)
			.closePath()
			.fill(0xc8c8c8)
			.stroke({ color: 0x444444, width: 1 });
	}
	g.position.set(worldX, ground);
	// Add to groundLayer so it draws over the ground polygon (which is filled
	// from screen bottom up to the ground line).
	groundLayer.addChild(g);
	return {
		kind: "pit",
		g,
		x: worldX,
		y: ground,
		width: w,
		height: d,
		alive: true,
	};
}

function generateChunk(index: number): Chunk {
	const ground = buildChunkGround(index);
	groundLayer.addChild(ground);
	const chunk: Chunk = { index, spawns: [], ground };
	if (index <= 2) return chunk; // first few chunks are safe

	const chunkStart = index * CHUNK_WIDTH;
	const chunkEnd = chunkStart + CHUNK_WIDTH - 40;
	let candidateX = Math.max(
		lastSpawnWorldX + MIN_SPAWN_SPACING,
		chunkStart + 60,
	);

	while (candidateX <= chunkEnd) {
		const roll = Math.random();
		if (roll < 0.7) {
			// Hazard: sphere, fireball, or pit
			const t = Math.random();
			if (t < 0.5) chunk.spawns.push(makeSphere(candidateX));
			else if (t < 0.8) chunk.spawns.push(makeFireball(candidateX));
			else chunk.spawns.push(makePit(candidateX));
			lastSpawnWorldX = candidateX;
		} else if (roll < 0.85) {
			// Powerup
			if (Math.random() < 0.7) chunk.spawns.push(makeBlueMushroom(candidateX));
			else chunk.spawns.push(makeRedMushroom(candidateX));
			lastSpawnWorldX = candidateX;
		}
		// else: empty stretch (15%) — still advance the cursor so we don't bunch up
		candidateX += MIN_SPAWN_SPACING + Math.random() * 80;
	}
	return chunk;
}

function destroyChunk(chunk: Chunk): void {
	for (const s of chunk.spawns) s.g.destroy();
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
	powerupInvincibleUntil = 0;
	runTime = 0;
	for (const c of chunks.values()) destroyChunk(c);
	chunks.clear();
	lastSpawnWorldX = Number.NEGATIVE_INFINITY;
	spawnCentipede();
	stepCounterText.visible = true;
	stepCounterText.text = "0";
	setState("playing");
}

function loseSegment(): void {
	const tail = centipede.segments.pop();
	if (tail) {
		tail.g.destroy();
		tail.legs.destroy();
		tail.antennae?.destroy();
	}
	invincibleUntil = runTime + INVINCIBILITY_SECONDS;
	if (centipede.segments.length === 0) {
		endRun();
	}
}

function gainSegments(n: number): void {
	if (state !== "playing") return;
	const tail = centipede.segments[centipede.segments.length - 1];
	const baseX = tail ? tail.x : 120;
	for (let i = 0; i < n; i++) {
		const g = drawSegment(false);
		const x = baseX - (i + 1) * CENTIPEDE_SEG_SPACING;
		const y = groundHeightAt(x) - CENTIPEDE_RADIUS;
		g.position.set(x, y);
		gameScene.addChild(g);
		const legs = new Graphics();
		gameScene.addChild(legs);
		centipede.segments.push({
			g,
			legs,
			antennae: null,
			x,
			y,
			vy: 0,
			onGround: true,
			pendingJumpAt: null,
		});
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
	if (e.code === "Space" && state === "playing") {
		const head = centipede.segments[0];
		if (head?.onGround) {
			for (let i = 0; i < centipede.segments.length; i++) {
				centipede.segments[i].pendingJumpAt = runTime + i * SEGMENT_JUMP_DELAY;
			}
		}
		e.preventDefault();
	}
});

app.ticker.add((time) => {
	const dt = time.deltaMS / 1000;
	if (state !== "playing") return;

	runTime += dt;
	speed = Math.min(MAX_SPEED, BASE_SPEED + SPEED_ACCEL * runTime);
	const invincible =
		runTime < invincibleUntil || runTime < powerupInvincibleUntil;
	const powerupActive = runTime < powerupInvincibleUntil;
	for (let i = 0; i < centipede.segments.length; i++) {
		const s = centipede.segments[i];
		if (powerupActive) {
			const hue = (runTime * 300 + i * 40) % 360;
			s.g.tint = hslToHex(hue, 0.9, 0.6);
			s.g.alpha = 1;
		} else if (invincible) {
			s.g.tint = 0xffffff;
			s.g.alpha = 0.4 + 0.3 * Math.sin(runTime * 30);
		} else {
			s.g.tint = 0xffffff;
			s.g.alpha = 1;
		}
	}

	// Move head forward
	const head = centipede.segments[0];
	head.x += speed * dt;

	const moved = speed * dt;
	distance += moved;
	const phase = distance * PHASE_PER_PX;
	const fullCycles = Math.floor(phase / STEP_PHASE);
	if (fullCycles > lastStepPhase) {
		stepCount += fullCycles - lastStepPhase;
		lastStepPhase = fullCycles;
	}

	// Trailing segments follow with fixed x-spacing behind the head.
	for (let i = 1; i < centipede.segments.length; i++) {
		const prev = centipede.segments[i - 1];
		const seg = centipede.segments[i];
		seg.x = prev.x - CENTIPEDE_SEG_SPACING;
	}

	// Per-segment jump physics: each segment fires its delayed jump, falls under
	// gravity, and lands on the terrain at its own x.
	for (const seg of centipede.segments) {
		if (
			seg.pendingJumpAt !== null &&
			runTime >= seg.pendingJumpAt &&
			seg.onGround
		) {
			seg.vy = -JUMP_IMPULSE;
			seg.onGround = false;
			seg.pendingJumpAt = null;
		}
		seg.vy += GRAVITY * dt;
		const newY = seg.y + seg.vy * dt;
		const segFloorY = groundHeightAt(seg.x) - CENTIPEDE_RADIUS;
		if (newY >= segFloorY) {
			seg.y = segFloorY;
			seg.vy = 0;
			seg.onGround = true;
		} else {
			seg.y = newY;
		}
	}

	// Body ripple: subtle vertical bob only while the segment is grounded.
	for (let i = 0; i < centipede.segments.length; i++) {
		const s = centipede.segments[i];
		if (!s.onGround) continue;
		const bob = Math.sin(phase + i * 0.9) * 2;
		s.y += bob;
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

	// Draw antennae for the head.
	const headSeg = centipede.segments[0];
	if (headSeg?.antennae) {
		headSeg.antennae.position.set(headSeg.x, headSeg.y);
		drawAntennae(headSeg.antennae, phase);
	}

	stepCounterText.text = String(stepCount);

	// Camera tracks the head at ~1/3 screen width.
	cameraX = head.x - app.screen.width / 3;
	world.position.x = -cameraX;

	ensureChunks();

	// Update fireballs: home toward the head at a slow fixed speed.
	for (const chunk of chunks.values()) {
		for (const s of chunk.spawns) {
			if (!s.alive) continue;
			if (s.kind === "fireball") {
				const head = centipede.segments[0];
				const dxh = head.x - s.x;
				const dyh = head.y - s.y;
				const dist = Math.max(1, Math.hypot(dxh, dyh));
				s.x += (dxh / dist) * FIREBALL_SPEED * dt;
				s.y += (dyh / dist) * FIREBALL_SPEED * dt;
				s.g.position.set(s.x, s.y);
				if (s.x < head.x - FIREBALL_DESPAWN_BEHIND_PX) {
					s.alive = false;
					s.g.destroy();
				}
			}
		}
	}

	const h = centipede.segments[0];
	for (const chunk of chunks.values()) {
		for (const s of chunk.spawns) {
			if (!s.alive) continue;
			if (s.kind === "pit") {
				// Pits only hurt when the head is at ground level inside their range.
				// Jumping over them is safe.
				if (!h.onGround) continue;
				if (Math.abs(h.x - s.x) >= s.width / 2) continue;
				if (!invincible) loseSegment();
				continue;
			}
			const dx = Math.abs(h.x - s.x);
			const dy = Math.abs(h.y - s.y);
			const hit =
				dx < s.width / 2 + CENTIPEDE_RADIUS * 0.7 &&
				dy < s.height / 2 + CENTIPEDE_RADIUS * 0.7;
			if (!hit) continue;
			if (s.kind === "blueMushroom") {
				s.alive = false;
				s.g.destroy();
				gainSegments(Math.random() < 0.5 ? 1 : 3);
			} else if (s.kind === "redMushroom") {
				s.alive = false;
				s.g.destroy();
				powerupInvincibleUntil = runTime + POWERUP_INVINCIBILITY_SECONDS;
			} else if (s.kind === "sphere") {
				s.alive = false;
				s.g.destroy();
				if (!invincible) loseSegment();
			} else if (s.kind === "fireball") {
				s.alive = false;
				s.g.destroy();
				if (!invincible) loseSegment();
			}
		}
	}
});
