import * as THREE from "three";

const COLORS = {
	right: 0xc41e3a,
	left: 0xff5800,
	top: 0xffffff,
	bottom: 0xffd500,
	front: 0x009e60,
	back: 0x0051ba,
	black: 0x111111,
};

const CUBIE_SIZE = 0.95;
const CUBIE_SPACING = 1.0;
const DRAG_THRESHOLD = 14;
const TURN_MS = 180;
const SCRAMBLE_MS = 70;
const SCRAMBLE_MOVES = 22;
const BEST_TIMES_KEY = "cube-challenge:best-times";
const BEST_TIMES_LIMIT = 10;

type Axis = "x" | "y" | "z";
type Dir = 1 | -1;
type Layer = -1 | 0 | 1;

interface Cubie {
	mesh: THREE.Mesh;
	logical: THREE.Vector3;
	home: THREE.Vector3;
}

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const menuEl = document.getElementById("menu") as HTMLDivElement;
const timesEl = document.getElementById("times") as HTMLDivElement;
const timesListEl = document.getElementById("times-list") as HTMLOListElement;
const solvedEl = document.getElementById("solved") as HTMLDivElement;
const solvedTimeEl = document.getElementById("solved-time") as HTMLDivElement;
const hudEl = document.getElementById("hud") as HTMLDivElement;
const hintEl = document.getElementById("controls-hint") as HTMLDivElement;
const timerEl = document.getElementById("timer") as HTMLDivElement;

const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const timesBtn = document.getElementById("times-btn") as HTMLButtonElement;
const timesBack = document.getElementById("times-back") as HTMLButtonElement;
const solvedMenu = document.getElementById("solved-menu") as HTMLButtonElement;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
const cameraRadius = 9;
let cameraYaw = Math.PI / 5;
let cameraPitch = Math.PI / 2 - Math.PI / 6;
positionCamera();

scene.add(new THREE.AmbientLight(0xffffff, 0.65));
const keyLight = new THREE.DirectionalLight(0xffffff, 0.75);
keyLight.position.set(6, 10, 8);
scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x88aaff, 0.25);
rimLight.position.set(-6, -4, -8);
scene.add(rimLight);

const cubeRoot = new THREE.Group();
scene.add(cubeRoot);

const cubies: Cubie[] = [];
buildCube();

function buildCube() {
	for (let x = -1; x <= 1; x++) {
		for (let y = -1; y <= 1; y++) {
			for (let z = -1; z <= 1; z++) {
				const geo = new THREE.BoxGeometry(CUBIE_SIZE, CUBIE_SIZE, CUBIE_SIZE);
				const materials = [
					new THREE.MeshStandardMaterial({
						color: x === 1 ? COLORS.right : COLORS.black,
						roughness: 0.55,
					}),
					new THREE.MeshStandardMaterial({
						color: x === -1 ? COLORS.left : COLORS.black,
						roughness: 0.55,
					}),
					new THREE.MeshStandardMaterial({
						color: y === 1 ? COLORS.top : COLORS.black,
						roughness: 0.55,
					}),
					new THREE.MeshStandardMaterial({
						color: y === -1 ? COLORS.bottom : COLORS.black,
						roughness: 0.55,
					}),
					new THREE.MeshStandardMaterial({
						color: z === 1 ? COLORS.front : COLORS.black,
						roughness: 0.55,
					}),
					new THREE.MeshStandardMaterial({
						color: z === -1 ? COLORS.back : COLORS.black,
						roughness: 0.55,
					}),
				];
				const mesh = new THREE.Mesh(geo, materials);
				mesh.position.set(
					x * CUBIE_SPACING,
					y * CUBIE_SPACING,
					z * CUBIE_SPACING,
				);
				cubeRoot.add(mesh);
				cubies.push({
					mesh,
					logical: new THREE.Vector3(x, y, z),
					home: new THREE.Vector3(x, y, z),
				});
			}
		}
	}
}

function positionCamera() {
	const sp = Math.sin(cameraPitch);
	camera.position.set(
		cameraRadius * sp * Math.sin(cameraYaw),
		cameraRadius * Math.cos(cameraPitch),
		cameraRadius * sp * Math.cos(cameraYaw),
	);
	camera.lookAt(0, 0, 0);
}

function resize() {
	const w = window.innerWidth;
	const h = window.innerHeight;
	renderer.setSize(w, h, false);
	camera.aspect = w / h;
	camera.updateProjectionMatrix();
}
resize();
window.addEventListener("resize", resize);

function rotateLogical(p: THREE.Vector3, axis: Axis, dir: Dir): THREE.Vector3 {
	const { x, y, z } = p;
	if (axis === "x")
		return dir === 1
			? new THREE.Vector3(x, -z, y)
			: new THREE.Vector3(x, z, -y);
	if (axis === "y")
		return dir === 1
			? new THREE.Vector3(z, y, -x)
			: new THREE.Vector3(-z, y, x);
	return dir === 1 ? new THREE.Vector3(-y, x, z) : new THREE.Vector3(y, -x, z);
}

let animating = false;

function rotateLayer(
	axis: Axis,
	layer: Layer,
	dir: Dir,
	durationMs = TURN_MS,
): Promise<void> {
	if (animating) return Promise.resolve();
	animating = true;

	const layerCubies = cubies.filter(
		(c) => Math.round(c.logical[axis]) === layer,
	);
	const pivot = new THREE.Group();
	scene.add(pivot);
	for (const c of layerCubies) pivot.attach(c.mesh);

	const axisVec = new THREE.Vector3(
		axis === "x" ? 1 : 0,
		axis === "y" ? 1 : 0,
		axis === "z" ? 1 : 0,
	);
	const target = dir * (Math.PI / 2);

	return new Promise<void>((resolve) => {
		const start = performance.now();
		const tick = () => {
			const t = Math.min(1, (performance.now() - start) / durationMs);
			const eased = 1 - (1 - t) ** 3;
			pivot.setRotationFromAxisAngle(axisVec, eased * target);
			if (t < 1) {
				requestAnimationFrame(tick);
			} else {
				pivot.setRotationFromAxisAngle(axisVec, target);
				for (const c of layerCubies) {
					cubeRoot.attach(c.mesh);
					const next = rotateLogical(c.logical, axis, dir);
					c.logical.copy(next);
					c.mesh.position.set(
						next.x * CUBIE_SPACING,
						next.y * CUBIE_SPACING,
						next.z * CUBIE_SPACING,
					);
				}
				scene.remove(pivot);
				animating = false;
				resolve();
			}
		};
		tick();
	});
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

interface DragState {
	startX: number;
	startY: number;
	cubie: Cubie;
	faceNormal: THREE.Vector3;
	committed: boolean;
}

let drag: DragState | null = null;
let cameraDrag: {
	startX: number;
	startY: number;
	yaw: number;
	pitch: number;
} | null = null;

function screenToNdc(cx: number, cy: number) {
	ndc.x = (cx / window.innerWidth) * 2 - 1;
	ndc.y = -((cy / window.innerHeight) * 2 - 1);
}

canvas.addEventListener("pointerdown", (e) => {
	if (state.screen !== "playing" || animating) return;
	screenToNdc(e.clientX, e.clientY);
	raycaster.setFromCamera(ndc, camera);
	const hits = raycaster.intersectObjects(cubeRoot.children, false);
	if (hits.length === 0) {
		cameraDrag = {
			startX: e.clientX,
			startY: e.clientY,
			yaw: cameraYaw,
			pitch: cameraPitch,
		};
		canvas.setPointerCapture(e.pointerId);
		return;
	}
	const hit = hits[0];
	if (!hit.face) return;
	const mesh = hit.object as THREE.Mesh;
	const cubie = cubies.find((c) => c.mesh === mesh);
	if (!cubie) return;
	const worldNormal = hit.face.normal
		.clone()
		.transformDirection(mesh.matrixWorld);
	snapToCardinal(worldNormal);
	drag = {
		startX: e.clientX,
		startY: e.clientY,
		cubie,
		faceNormal: worldNormal,
		committed: false,
	};
	canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", (e) => {
	if (cameraDrag) {
		const dx = e.clientX - cameraDrag.startX;
		const dy = e.clientY - cameraDrag.startY;
		cameraYaw = cameraDrag.yaw - dx * 0.006;
		cameraPitch = clamp(cameraDrag.pitch - dy * 0.006, 0.15, Math.PI - 0.15);
		positionCamera();
		return;
	}
	if (!drag || drag.committed) return;
	const dx = e.clientX - drag.startX;
	const dy = e.clientY - drag.startY;
	if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

	const camRight = new THREE.Vector3(1, 0, 0).applyQuaternion(
		camera.quaternion,
	);
	const camUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
	const worldDelta = new THREE.Vector3()
		.addScaledVector(camRight, dx)
		.addScaledVector(camUp, -dy);
	worldDelta.addScaledVector(drag.faceNormal, -worldDelta.dot(drag.faceNormal));

	const dragAxis = bestCardinal(worldDelta, drag.faceNormal);
	if (!dragAxis) return;
	const rotAxis = new THREE.Vector3().crossVectors(drag.faceNormal, dragAxis);
	const { axis, dir } = dominantAxis(rotAxis);
	const layer = Math.round(drag.cubie.logical[axis]) as Layer;

	drag.committed = true;
	rotateLayer(axis, layer, dir).then(() => {
		if (!isScrambling && state.screen === "playing" && isSolved()) {
			onSolved();
		}
	});
	drag = null;
});

function endPointer(e: PointerEvent) {
	if (canvas.hasPointerCapture(e.pointerId))
		canvas.releasePointerCapture(e.pointerId);
	cameraDrag = null;
	drag = null;
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);

function snapToCardinal(v: THREE.Vector3) {
	const ax = Math.abs(v.x);
	const ay = Math.abs(v.y);
	const az = Math.abs(v.z);
	if (ax >= ay && ax >= az) v.set(Math.sign(v.x), 0, 0);
	else if (ay >= az) v.set(0, Math.sign(v.y), 0);
	else v.set(0, 0, Math.sign(v.z));
}

const CARDINAL_AXES: THREE.Vector3[] = [
	new THREE.Vector3(1, 0, 0),
	new THREE.Vector3(-1, 0, 0),
	new THREE.Vector3(0, 1, 0),
	new THREE.Vector3(0, -1, 0),
	new THREE.Vector3(0, 0, 1),
	new THREE.Vector3(0, 0, -1),
];

function bestCardinal(
	delta: THREE.Vector3,
	exclude: THREE.Vector3,
): THREE.Vector3 | null {
	let best: THREE.Vector3 | null = null;
	let bestDot = 0;
	for (const c of CARDINAL_AXES) {
		if (Math.abs(c.dot(exclude)) > 0.5) continue;
		const d = c.dot(delta);
		if (d > bestDot) {
			bestDot = d;
			best = c;
		}
	}
	return best;
}

function dominantAxis(v: THREE.Vector3): { axis: Axis; dir: Dir } {
	const ax = Math.abs(v.x);
	const ay = Math.abs(v.y);
	const az = Math.abs(v.z);
	if (ax >= ay && ax >= az) return { axis: "x", dir: v.x > 0 ? 1 : -1 };
	if (ay >= az) return { axis: "y", dir: v.y > 0 ? 1 : -1 };
	return { axis: "z", dir: v.z > 0 ? 1 : -1 };
}

function clamp(v: number, lo: number, hi: number) {
	return Math.max(lo, Math.min(hi, v));
}

const keys: Record<string, boolean> = {};
window.addEventListener("keydown", (e) => {
	keys[e.key.toLowerCase()] = true;
});
window.addEventListener("keyup", (e) => {
	keys[e.key.toLowerCase()] = false;
});

function updateCamera(dtSec: number) {
	if (state.screen !== "playing") return;
	const speed = 1.6 * dtSec;
	let changed = false;
	if (keys.a) {
		cameraYaw += speed;
		changed = true;
	}
	if (keys.d) {
		cameraYaw -= speed;
		changed = true;
	}
	if (keys.w) {
		cameraPitch = clamp(cameraPitch - speed, 0.15, Math.PI - 0.15);
		changed = true;
	}
	if (keys.s) {
		cameraPitch = clamp(cameraPitch + speed, 0.15, Math.PI - 0.15);
		changed = true;
	}
	if (changed) positionCamera();
}

function isSolved(): boolean {
	for (const c of cubies) {
		if (!c.logical.equals(c.home)) return false;
		const q = c.mesh.quaternion;
		const identity =
			Math.abs(q.x) < 0.02 &&
			Math.abs(q.y) < 0.02 &&
			Math.abs(q.z) < 0.02 &&
			Math.abs(Math.abs(q.w) - 1) < 0.02;
		if (!identity) return false;
	}
	return true;
}

let isScrambling = false;
async function scramble() {
	isScrambling = true;
	const axes: Axis[] = ["x", "y", "z"];
	let lastAxis: Axis | null = null;
	for (let i = 0; i < SCRAMBLE_MOVES; i++) {
		let axis: Axis;
		do {
			axis = axes[Math.floor(Math.random() * 3)];
		} while (axis === lastAxis);
		lastAxis = axis;
		const layer = (Math.floor(Math.random() * 3) - 1) as Layer;
		const dir: Dir = Math.random() < 0.5 ? 1 : -1;
		await rotateLayer(axis, layer, dir, SCRAMBLE_MS);
	}
	isScrambling = false;
}

const state = {
	screen: "menu" as "menu" | "playing" | "solved",
	startMs: 0,
	elapsedMs: 0,
};

function formatTime(ms: number): string {
	const totalSec = Math.max(0, ms) / 1000;
	const mins = Math.floor(totalSec / 60);
	const secs = totalSec % 60;
	if (mins > 0) return `${mins}:${secs.toFixed(2).padStart(5, "0")}`;
	return secs.toFixed(2);
}

function loadBestTimes(): number[] {
	try {
		const raw = localStorage.getItem(BEST_TIMES_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((n) => typeof n === "number" && Number.isFinite(n));
	} catch {
		return [];
	}
}

function saveBestTime(ms: number) {
	const times = loadBestTimes();
	times.push(ms);
	times.sort((a, b) => a - b);
	const trimmed = times.slice(0, BEST_TIMES_LIMIT);
	try {
		localStorage.setItem(BEST_TIMES_KEY, JSON.stringify(trimmed));
	} catch {
		// storage unavailable — skip persisting
	}
}

function renderBestTimes() {
	const times = loadBestTimes();
	timesListEl.replaceChildren();
	if (times.length === 0) {
		const li = document.createElement("li");
		li.className = "empty";
		li.textContent = "No solves yet — go for it.";
		timesListEl.appendChild(li);
		return;
	}
	for (let i = 0; i < times.length; i++) {
		const li = document.createElement("li");
		const rank = document.createElement("span");
		rank.className = "rank";
		rank.textContent = `#${i + 1}`;
		const val = document.createElement("span");
		val.textContent = formatTime(times[i]);
		li.append(rank, val);
		timesListEl.appendChild(li);
	}
}

function showMenu() {
	state.screen = "menu";
	menuEl.classList.remove("hidden");
	hudEl.classList.add("hidden");
	hintEl.classList.add("hidden");
	solvedEl.classList.add("hidden");
	timesEl.classList.add("hidden");
}

async function startGame() {
	menuEl.classList.add("hidden");
	timesEl.classList.add("hidden");
	solvedEl.classList.add("hidden");
	hudEl.classList.remove("hidden");
	hintEl.classList.remove("hidden");
	timerEl.textContent = "0.00";
	await scramble();
	state.screen = "playing";
	state.startMs = performance.now();
}

function onSolved() {
	state.screen = "solved";
	state.elapsedMs = performance.now() - state.startMs;
	saveBestTime(state.elapsedMs);
	solvedTimeEl.textContent = formatTime(state.elapsedMs);
	hudEl.classList.add("hidden");
	hintEl.classList.add("hidden");
	solvedEl.classList.remove("hidden");
}

startBtn.addEventListener("click", () => {
	void startGame();
});
timesBtn.addEventListener("click", () => {
	renderBestTimes();
	timesEl.classList.remove("hidden");
});
timesBack.addEventListener("click", () => {
	timesEl.classList.add("hidden");
});
solvedMenu.addEventListener("click", () => {
	showMenu();
});

let lastFrame = performance.now();
function frame(now: number) {
	const dt = (now - lastFrame) / 1000;
	lastFrame = now;
	updateCamera(dt);
	if (state.screen === "playing") {
		state.elapsedMs = performance.now() - state.startMs;
		timerEl.textContent = formatTime(state.elapsedMs);
	}
	renderer.render(scene, camera);
	requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
