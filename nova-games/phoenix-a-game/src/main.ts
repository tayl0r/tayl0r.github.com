import {
	AmbientLight,
	BoxGeometry,
	Clock,
	DirectionalLight,
	type Material,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	Vector3,
	WebGLRenderer,
} from "three";
import {
	type Arrow,
	arrowExpired,
	arrowHitsAabb,
	arrowHitsMonster,
	createArrow,
	updateArrow,
} from "./arrows";
import { createFollowCamera } from "./camera";
import { type Aabb, resolveAll } from "./collision";
import { createSwing, SWING_DURATION, startSwing, updateSwing } from "./combat";
import { createDoors, type Door } from "./doors";
import { renderHud } from "./hud";
import { createInput, wireInput } from "./input";
import {
	describeInteractable,
	findNearestInteractable,
	type Interactable,
	type InteractCtx,
	performInteract,
} from "./interact";
import { LEVELS } from "./levels";
import { type Chest, createChest } from "./loot";
import { renderMinimap } from "./minimap";
import {
	createMonster,
	createMonsterModel,
	type Monster,
	type MonsterKind,
	moveMonsterTowards,
} from "./monsters";
import {
	computeVelocity,
	createPlayerMesh,
	PLAYER_RADIUS,
	weaponColorFor,
} from "./player";
import {
	canAttack,
	consumeAttackStamina,
	createInitialState,
	equippedItem,
	type Item,
	QUALITY_COLORS,
} from "./state";
import {
	createRoomSwitch,
	createWinSwitch,
	type RoomSwitch,
	unlockWinSwitch,
	type WinSwitch,
} from "./switches";
import { applyContactDamage, tickPlayer } from "./tick";
import {
	COLS,
	generateGrid,
	PITCH,
	ROWS,
	roomAt,
	type WorldGrid,
} from "./world";
import {
	createWorldDrop,
	updateWorldDrop,
	type WorldDrop,
} from "./world_drops";

const scene = new Scene();
const camera = new PerspectiveCamera(
	60,
	window.innerWidth / window.innerHeight,
	0.1,
	1000,
);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x101820);
document.body.appendChild(renderer.domElement);

renderer.domElement.addEventListener("click", () => {
	renderer.domElement.requestPointerLock();
});

const startOverlay = document.getElementById("start-overlay");
if (startOverlay) {
	startOverlay.addEventListener("click", () => {
		startOverlay.style.display = "none";
		renderer.domElement.requestPointerLock();
	});
}

const FLOOR_W = COLS * PITCH + 16;
const FLOOR_D = ROWS * PITCH + 16;
const floor = new Mesh(
	new PlaneGeometry(FLOOR_W, FLOOR_D),
	new MeshStandardMaterial({ color: 0x555555 }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const playerMesh = createPlayerMesh();
const player = playerMesh.root;
const sword = playerMesh.sword;
const bow = playerMesh.bow;
scene.add(player);
scene.add(camera);
camera.add(sword);
camera.add(bow);

const wallMaterial = new MeshStandardMaterial({ color: 0x666666 });
let grid: WorldGrid = generateGrid(LEVELS[0].hallwayEdges);
let wallMeshes: Mesh[] = [];

function buildWalls(g: WorldGrid) {
	for (const w of g.walls) {
		const width = w.maxX - w.minX;
		const depth = w.maxZ - w.minZ;
		const mesh = new Mesh(new BoxGeometry(width, 3, depth), wallMaterial);
		mesh.position.set((w.minX + w.maxX) / 2, 1.5, (w.minZ + w.maxZ) / 2);
		scene.add(mesh);
		wallMeshes.push(mesh);
	}
}

function teardownWalls() {
	for (const m of wallMeshes) {
		scene.remove(m);
		m.geometry.dispose();
	}
	wallMeshes = [];
}

scene.add(new AmbientLight(0xffffff, 0.5));
const sun = new DirectionalLight(0xffffff, 0.8);
sun.position.set(5, 10, 5);
scene.add(sun);

const input = createInput();
wireInput(input);
const follow = createFollowCamera(camera);
const clock = new Clock();
const state = createInitialState();
const swing = createSwing();
let prevClick = false;
let arrows: Arrow[] = [];

let level = LEVELS[0];
let spawnRoom = grid.rooms[level.spawn];
let bossRoom = grid.rooms[level.boss];
let visitedRooms = new Set<number>([level.spawn]);
const minimapCanvas = document.getElementById(
	"hud-minimap",
) as HTMLCanvasElement | null;

let monsters: Monster[] = [];
let chests: Chest[] = [];
let drops: WorldDrop[] = [];
let doors: Door[] = [];
let roomSwitches: RoomSwitch[] = [];
let winSwitch!: WinSwitch;
let boss: Monster | undefined;
let bossDead = false;

function disposeObject(obj: Object3D) {
	scene.remove(obj);
	const seen = new Set<Material>();
	obj.traverse((child) => {
		if (child instanceof Mesh) {
			child.geometry.dispose();
			const mats = Array.isArray(child.material)
				? child.material
				: [child.material];
			for (const m of mats) {
				if (!seen.has(m)) {
					seen.add(m);
					m.dispose();
				}
			}
		}
	});
}

function spawnMonster(roomIndex: number, kind: MonsterKind) {
	const room = grid.rooms[roomIndex];
	const jitterX = (Math.random() - 0.5) * 4;
	const jitterZ = (Math.random() - 0.5) * 4;
	const m = createMonster(
		kind,
		room.centerX + jitterX,
		room.centerZ + jitterZ,
		roomIndex,
	);
	const model = createMonsterModel(kind);
	m.mesh = model.group;
	m.flashMaterial = model.flashMaterial;
	scene.add(m.mesh);
	monsters.push(m);
}

function spawnBoss() {
	if (boss) return;
	const m = createMonster(
		level.bossEnemy,
		bossRoom.centerX,
		bossRoom.centerZ,
		level.boss,
	);
	const model = createMonsterModel(level.bossEnemy);
	m.mesh = model.group;
	m.flashMaterial = model.flashMaterial;
	scene.add(m.mesh);
	boss = m;
	monsters.push(boss);
}

function teardownDungeon() {
	for (const m of monsters) if (m.mesh) disposeObject(m.mesh);
	for (const c of chests) {
		disposeObject(c.mesh);
		if (c.dropMesh) disposeObject(c.dropMesh);
	}
	for (const d of doors) disposeObject(d.mesh);
	for (const s of roomSwitches) disposeObject(s.mesh);
	if (winSwitch) disposeObject(winSwitch.mesh);
	for (const a of arrows) disposeObject(a.mesh);
	for (const d of drops) disposeObject(d.mesh);
	monsters = [];
	chests = [];
	drops = [];
	doors = [];
	roomSwitches = [];
	arrows = [];
	boss = undefined;
	bossDead = false;
}

function buildDungeon() {
	for (const ri of level.lightRooms) spawnMonster(ri, level.lightEnemy);
	for (const ri of level.mediumRooms) spawnMonster(ri, level.mediumEnemy);
	for (const ri of level.chestRooms) {
		const room = grid.rooms[ri];
		const chest = createChest(room.centerX, room.centerZ);
		chests.push(chest);
		scene.add(chest.mesh);
	}
	doors = createDoors(level.hallwayEdges);
	for (const d of doors) scene.add(d.mesh);
	for (const ri of level.switchRooms) {
		const sw = createRoomSwitch(grid.rooms[ri], ri);
		roomSwitches.push(sw);
		scene.add(sw.mesh);
	}
	winSwitch = createWinSwitch(bossRoom.centerX, bossRoom.centerZ);
	scene.add(winSwitch.mesh);
}

function loadLevel(floorIdx: number) {
	teardownWalls();
	level = LEVELS[floorIdx];
	state.floor = floorIdx;
	grid = generateGrid(level.hallwayEdges);
	spawnRoom = grid.rooms[level.spawn];
	bossRoom = grid.rooms[level.boss];
	visitedRooms = new Set<number>([level.spawn]);
	buildWalls(grid);
	buildDungeon();
	player.position.x = spawnRoom.centerX;
	player.position.z = spawnRoom.centerZ;
}

function descendFloor() {
	const next = state.floor + 1;
	if (next >= LEVELS.length) {
		state.phase = "won";
		return;
	}
	teardownDungeon();
	state.player.health = state.player.maxHealth;
	state.player.stamina = state.player.maxStamina;
	state.player.iframesUntil = 0;
	state.player.hitFlashUntil = 0;
	state.player.lastAttackAt = -Infinity;
	loadLevel(next);
}

function resetPlayerStats() {
	state.player.health = state.player.maxHealth;
	state.player.stamina = state.player.maxStamina;
	state.player.swordDamage = 1;
	state.player.bowDamage = 1;
	state.player.weapon = "sword";
	state.player.iframesUntil = 0;
	state.player.hitFlashUntil = 0;
	state.player.lastAttackAt = -Infinity;
	input.weapon = "sword";
}

function respawnPlayer() {
	teardownDungeon();
	resetPlayerStats();
	loadLevel(0);
	state.phase = "playing";
}

buildWalls(grid);
buildDungeon();
player.position.x = spawnRoom.centerX;
player.position.z = spawnRoom.centerZ;

function activeWalls(): Aabb[] {
	const walls: Aabb[] = grid.walls.slice();
	for (const d of doors) if (!d.open) walls.push(d.aabb);
	return walls;
}

function wakeRooms(roomIndices: readonly number[]) {
	for (const m of monsters) {
		if (roomIndices.includes(m.roomIndex)) m.dormant = false;
	}
}

function fireArrow() {
	const dir = new Vector3();
	camera.getWorldDirection(dir);
	const arrow = createArrow(
		camera.position.x + dir.x * 0.6,
		camera.position.y + dir.y * 0.6 - 0.1,
		camera.position.z + dir.z * 0.6,
		dir.x,
		dir.y,
		dir.z,
		state.player.bowDamage,
		weaponColorFor(state.player.bowDamage),
		state.now,
	);
	arrows.push(arrow);
	scene.add(arrow.mesh);
}

function handleArrowHit(a: Arrow) {
	for (const m of monsters) {
		if (m.hp <= 0) continue;
		if (arrowHitsMonster(a, m)) {
			m.hp -= a.damage;
			m.flashUntil = state.now + 0.15;
			m.hitSquashUntil = state.now + 0.18;
			a.alive = false;
			return;
		}
	}
	if (arrowHitsAabb(a, activeWalls())) {
		a.alive = false;
	}
}

function pruneArrows() {
	const survivors: Arrow[] = [];
	for (const a of arrows) {
		if (!a.alive || arrowExpired(a, state.now)) {
			disposeObject(a.mesh);
		} else {
			survivors.push(a);
		}
	}
	arrows = survivors;
}

function throwForward(item: Item): void {
	const facingX = -Math.sin(follow.yaw);
	const facingZ = -Math.cos(follow.yaw);
	const drop = createWorldDrop(
		item,
		player.position.x + facingX * 0.6,
		1.2,
		player.position.z + facingZ * 0.6,
		facingX * 6,
		2,
		facingZ * 6,
		state.now,
	);
	drops.push(drop);
	scene.add(drop.mesh);
}

function buildInteractCtx(): InteractCtx {
	return {
		state,
		doors,
		roomSwitches,
		chests,
		winSwitch,
		drops,
		rng: Math.random,
		scene,
		wakeRooms,
		descendFloor,
		throwForward,
	};
}

function animate() {
	requestAnimationFrame(animate);
	let nearest: Interactable | null = null;
	const dt = clock.getDelta();
	follow.update(player, input.mouseDX, input.mouseDY);
	input.mouseDX = 0;
	input.mouseDY = 0;
	const equipped = equippedItem(state);
	const showSword = equipped?.kind === "sword";
	const showBow = equipped?.kind === "bow";
	sword.visible = showSword;
	bow.visible = showBow;
	if (showSword && equipped) {
		const tint = QUALITY_COLORS[equipped.quality - 1];
		playerMesh.swordBladeMaterial.color.setHex(tint);
		state.player.swordDamage = equipped.quality;
	}
	if (showBow && equipped) {
		const tint = QUALITY_COLORS[equipped.quality - 1];
		playerMesh.bowAccentMaterial.color.setHex(tint);
		state.player.bowDamage = equipped.quality;
	}
	// Keep legacy weapon field in sync — removed in cleanup task
	state.player.weapon = showBow ? "bow" : "sword";
	const v = computeVelocity(input, input.shift, follow.yaw);
	tickPlayer(state, dt);
	const walls = activeWalls();
	if (state.phase === "playing") {
		const candidateX = player.position.x + v.x * dt;
		const candidateZ = player.position.z + v.z * dt;
		const resolved = resolveAll(candidateX, candidateZ, PLAYER_RADIUS, walls);
		player.position.x = resolved.x;
		player.position.z = resolved.z;
		for (const m of monsters) {
			if (m.hp <= 0) continue;
			moveMonsterTowards(m, player.position.x, player.position.z, dt);
			const resolvedM = resolveAll(m.x, m.z, m.radius, walls);
			m.x = resolvedM.x;
			m.z = resolvedM.z;
			if (m.mesh) {
				m.mesh.position.x = m.x;
				m.mesh.position.z = m.z;
				const dx = player.position.x - m.x;
				const dz = player.position.z - m.z;
				if (dx * dx + dz * dz > 1e-4) {
					m.mesh.rotation.y = Math.atan2(dx, dz);
				}
				if (!m.dormant) m.walkPhase += dt * 8;
				let scaleY = 1 + Math.sin(m.walkPhase) * 0.06;
				let scaleXZ = 1 - Math.sin(m.walkPhase) * 0.04;
				if (m.hitSquashUntil !== undefined && state.now < m.hitSquashUntil) {
					const k = (m.hitSquashUntil - state.now) / 0.18;
					scaleY *= 1 - 0.35 * k;
					scaleXZ *= 1 + 0.3 * k;
				}
				m.mesh.scale.set(scaleXZ, scaleY, scaleXZ);
				const flashing = m.flashUntil !== undefined && m.flashUntil > state.now;
				if (m.flashMaterial) {
					m.flashMaterial.emissive.setHex(flashing ? 0xff4444 : 0x000000);
				}
			}
		}
		applyContactDamage(
			state,
			monsters,
			player.position.x,
			player.position.z,
			PLAYER_RADIUS,
		);
		const survivors: WorldDrop[] = [];
		for (const d of drops) {
			const done = updateWorldDrop(d, dt, state.now);
			if (done) {
				disposeObject(d.mesh);
			} else {
				survivors.push(d);
			}
		}
		drops = survivors;
		for (const a of arrows) {
			updateArrow(a, dt);
			if (a.alive) handleArrowHit(a);
		}
		pruneArrows();
	}
	if (input.click && !prevClick) {
		if (state.phase === "playing") {
			if (canAttack(state) && equipped) {
				if (equipped.kind === "sword") {
					startSwing(swing, state.now);
					consumeAttackStamina(state);
				} else if (equipped.kind === "bow") {
					fireArrow();
					consumeAttackStamina(state);
				}
				// food handled in Task 13
			}
		} else if (state.phase === "dead") {
			respawnPlayer();
		} else if (state.phase === "won") {
			window.location.reload();
		}
	}
	prevClick = input.click;
	if (state.phase === "playing") {
		const facingX = -Math.sin(follow.yaw);
		const facingZ = -Math.cos(follow.yaw);
		updateSwing(
			swing,
			state.now,
			state.player.swordDamage,
			facingX,
			facingZ,
			player.position.x,
			player.position.z,
			monsters,
		);
		const ctx = buildInteractCtx();
		nearest = findNearestInteractable(
			player.position.x,
			player.position.z,
			ctx,
		);
		if (input.interact && nearest) {
			performInteract(nearest, ctx, state.now);
		}
		if (swing.active) {
			const elapsed = state.now - swing.startedAt;
			sword.rotation.y = -Math.PI / 2 + (Math.PI * elapsed) / SWING_DURATION;
		} else {
			sword.rotation.y = 0;
		}
		for (const m of monsters) {
			if (m.hp <= 0 && m.mesh) {
				disposeObject(m.mesh);
				m.mesh = undefined;
			}
		}
		if (!boss && roomSwitches.every((s) => s.activated)) {
			spawnBoss();
		}
		if (boss && !bossDead && boss.hp <= 0) {
			bossDead = true;
			const bossChest = createChest(boss.x, boss.z, true);
			chests.push(bossChest);
			scene.add(bossChest.mesh);
			unlockWinSwitch(winSwitch);
		}
		if (state.player.health <= 0) {
			state.phase = "dead";
		}
	}
	const currentRoom = roomAt(player.position.x, player.position.z);
	if (currentRoom !== null) visitedRooms.add(currentRoom);
	renderHud(state, nearest ? describeInteractable(nearest) : null);
	if (minimapCanvas) {
		renderMinimap(minimapCanvas, level, visitedRooms, currentRoom);
	}
	renderer.render(scene, camera);
	input.interact = false;
	input.cycleLeft = false;
	input.cycleRight = false;
	input.dropSelected = false;
	input.slotDigit = null;
}
animate();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
