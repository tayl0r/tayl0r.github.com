import {
	AmbientLight,
	BoxGeometry,
	Clock,
	DirectionalLight,
	Mesh,
	MeshStandardMaterial,
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
	arrowHitsCircleXZ,
	arrowHitsMonster,
	createArrow,
	updateArrow,
} from "./arrows";
import { createFollowCamera } from "./camera";
import { type Aabb, resolveAll } from "./collision";
import {
	checkSwingHit,
	createSwing,
	SWING_DURATION,
	startSwing,
	updateSwing,
} from "./combat";
import { createDoors, type Door, openDoor } from "./doors";
import { renderHud } from "./hud";
import { createInput, wireInput } from "./input";
import {
	type Chest,
	createChest,
	openChest,
	pickupDrop,
	updateChestDrop,
} from "./loot";
import {
	createBoss,
	createGoblin,
	createMonsterMesh,
	createOgre,
	type Monster,
	moveMonsterTowards,
} from "./monsters";
import {
	computeVelocity,
	createPlayerMesh,
	PLAYER_RADIUS,
	weaponColorFor,
} from "./player";
import { createInitialState } from "./state";
import {
	activateSwitch,
	activateWinSwitch,
	createRoomSwitch,
	createWinSwitch,
	type RoomSwitch,
	unlockWinSwitch,
	type WinSwitch,
} from "./switches";
import { applyContactDamage, tickPlayer } from "./tick";
import { generate3x3Grid } from "./world";

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

const floor = new Mesh(
	new PlaneGeometry(48, 48),
	new MeshStandardMaterial({ color: 0x555555 }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const { root: player, sword, bow } = createPlayerMesh();
scene.add(player);
scene.add(camera);
camera.add(sword);
camera.add(bow);

const grid = generate3x3Grid();
const wallMaterial = new MeshStandardMaterial({ color: 0x666666 });
for (const w of grid.walls) {
	const width = w.maxX - w.minX;
	const depth = w.maxZ - w.minZ;
	const mesh = new Mesh(new BoxGeometry(width, 3, depth), wallMaterial);
	mesh.position.set((w.minX + w.maxX) / 2, 1.5, (w.minZ + w.maxZ) / 2);
	scene.add(mesh);
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

const spawnRoom = grid.rooms[1];
const bossRoom = grid.rooms[4];
const MONSTER_GOBLIN_ROOMS = [0, 2, 3, 5, 7];
const MONSTER_OGRE_ROOMS = [0, 6, 8];
const SWITCH_ROOMS = [0, 2, 3, 5, 6, 7, 8];
const CHEST_ROOMS = [0, 2, 3, 5, 7];

let monsters: Monster[] = [];
let chests: Chest[] = [];
let doors: Door[] = [];
let roomSwitches: RoomSwitch[] = [];
let winSwitch!: WinSwitch;
let boss: Monster | undefined;
let bossDead = false;

function disposeMesh(mesh: Mesh) {
	scene.remove(mesh);
	mesh.geometry.dispose();
	const mat = mesh.material;
	if (Array.isArray(mat)) {
		for (const sub of mat) sub.dispose();
	} else {
		mat.dispose();
	}
}

function spawnMonster(
	roomIndex: number,
	factory: (x: number, z: number, ri: number) => Monster,
) {
	const room = grid.rooms[roomIndex];
	const jitterX = (Math.random() - 0.5) * 4;
	const jitterZ = (Math.random() - 0.5) * 4;
	const m = factory(room.centerX + jitterX, room.centerZ + jitterZ, roomIndex);
	m.mesh = createMonsterMesh(m);
	scene.add(m.mesh);
	monsters.push(m);
}

function spawnBoss() {
	if (boss) return;
	boss = createBoss(bossRoom.centerX, bossRoom.centerZ, 4);
	boss.mesh = createMonsterMesh(boss);
	scene.add(boss.mesh);
	monsters.push(boss);
}

function teardownDungeon() {
	for (const m of monsters) if (m.mesh) disposeMesh(m.mesh);
	for (const c of chests) {
		disposeMesh(c.mesh);
		if (c.dropMesh) disposeMesh(c.dropMesh);
	}
	for (const d of doors) disposeMesh(d.mesh);
	for (const s of roomSwitches) disposeMesh(s.mesh);
	if (winSwitch) disposeMesh(winSwitch.mesh);
	for (const a of arrows) disposeMesh(a.mesh);
	monsters = [];
	chests = [];
	doors = [];
	roomSwitches = [];
	arrows = [];
	boss = undefined;
	bossDead = false;
}

function buildDungeon() {
	for (const ri of MONSTER_GOBLIN_ROOMS) spawnMonster(ri, createGoblin);
	for (const ri of MONSTER_OGRE_ROOMS) spawnMonster(ri, createOgre);
	for (const ri of CHEST_ROOMS) {
		const room = grid.rooms[ri];
		const chest = createChest(room.centerX, room.centerZ);
		chests.push(chest);
		scene.add(chest.mesh);
	}
	doors = createDoors();
	for (const d of doors) scene.add(d.mesh);
	for (const ri of SWITCH_ROOMS) {
		const sw = createRoomSwitch(grid.rooms[ri], ri);
		roomSwitches.push(sw);
		scene.add(sw.mesh);
	}
	winSwitch = createWinSwitch(bossRoom.centerX, bossRoom.centerZ);
	scene.add(winSwitch.mesh);
}

function resetPlayerStats() {
	state.player.health = state.player.maxHealth;
	state.player.stamina = state.player.maxStamina;
	state.player.hunger = state.player.maxHunger;
	state.player.swordDamage = 1;
	state.player.bowDamage = 1;
	state.player.weapon = "sword";
	state.player.iframesUntil = 0;
	state.player.hitFlashUntil = 0;
	input.weapon = "sword";
}

function respawnPlayer() {
	teardownDungeon();
	buildDungeon();
	resetPlayerStats();
	player.position.x = spawnRoom.centerX;
	player.position.z = spawnRoom.centerZ;
	state.phase = "playing";
}

buildDungeon();
player.position.x = spawnRoom.centerX;
player.position.z = spawnRoom.centerZ;

function activeWalls(): Aabb[] {
	const walls: Aabb[] = grid.walls.slice();
	for (const d of doors) if (!d.open) walls.push(d.aabb);
	return walls;
}

function handleSwingTargets(
	facingX: number,
	facingZ: number,
	px: number,
	pz: number,
) {
	for (const door of doors) {
		if (door.open) continue;
		if (
			checkSwingHit(
				swing,
				state.now,
				facingX,
				facingZ,
				px,
				pz,
				door.centerX,
				door.centerZ,
			)
		) {
			openDoor(door);
			wakeRooms(door.roomIndices);
		}
	}
	for (const sw of roomSwitches) {
		if (sw.activated) continue;
		if (checkSwingHit(swing, state.now, facingX, facingZ, px, pz, sw.x, sw.z)) {
			activateSwitch(sw);
		}
	}
	for (const chest of chests) {
		if (chest.opened) continue;
		if (
			checkSwingHit(
				swing,
				state.now,
				facingX,
				facingZ,
				px,
				pz,
				chest.x,
				chest.z,
			)
		) {
			const dropMesh = openChest(chest, Math.random, state.now);
			if (dropMesh) scene.add(dropMesh);
		}
	}
	for (const chest of chests) {
		if (
			!chest.dropMesh ||
			chest.dropPickedUp ||
			chest.openedAt === undefined ||
			state.now - chest.openedAt < SWING_DURATION
		)
			continue;
		if (
			checkSwingHit(
				swing,
				state.now,
				facingX,
				facingZ,
				px,
				pz,
				chest.x,
				chest.z,
			)
		) {
			pickupDrop(chest, state, state.now);
		}
	}
	if (winSwitch.unlocked && !winSwitch.activated) {
		if (
			checkSwingHit(
				swing,
				state.now,
				facingX,
				facingZ,
				px,
				pz,
				winSwitch.x,
				winSwitch.z,
			)
		) {
			activateWinSwitch(winSwitch);
			state.phase = "won";
		}
	}
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
			a.alive = false;
			return;
		}
	}
	for (const door of doors) {
		if (door.open) continue;
		if (arrowHitsCircleXZ(a, door.centerX, door.centerZ, 1.0)) {
			openDoor(door);
			wakeRooms(door.roomIndices);
			a.alive = false;
			return;
		}
	}
	for (const sw of roomSwitches) {
		if (sw.activated) continue;
		if (arrowHitsCircleXZ(a, sw.x, sw.z, 0.6)) {
			activateSwitch(sw);
			a.alive = false;
			return;
		}
	}
	for (const chest of chests) {
		if (chest.opened) continue;
		if (arrowHitsCircleXZ(a, chest.x, chest.z, 0.6, 1.5)) {
			const dropMesh = openChest(chest, Math.random, state.now);
			if (dropMesh) scene.add(dropMesh);
			a.alive = false;
			return;
		}
	}
	for (const chest of chests) {
		if (
			!chest.dropMesh ||
			chest.dropPickedUp ||
			chest.openedAt === undefined ||
			state.now - chest.openedAt < 0.2
		)
			continue;
		if (arrowHitsCircleXZ(a, chest.x, chest.z, 0.6, 2.5)) {
			pickupDrop(chest, state, state.now);
			a.alive = false;
			return;
		}
	}
	if (winSwitch.unlocked && !winSwitch.activated) {
		if (arrowHitsCircleXZ(a, winSwitch.x, winSwitch.z, 0.6)) {
			activateWinSwitch(winSwitch);
			state.phase = "won";
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
			disposeMesh(a.mesh);
		} else {
			survivors.push(a);
		}
	}
	arrows = survivors;
}

function animate() {
	requestAnimationFrame(animate);
	const dt = clock.getDelta();
	follow.update(player, input.mouseDX, input.mouseDY);
	input.mouseDX = 0;
	input.mouseDY = 0;
	state.player.weapon = input.weapon;
	const swordVisible = state.player.weapon === "sword";
	sword.visible = swordVisible;
	bow.visible = !swordVisible;
	(sword.material as MeshStandardMaterial).color.setHex(
		weaponColorFor(state.player.swordDamage),
	);
	(bow.material as MeshStandardMaterial).color.setHex(
		weaponColorFor(state.player.bowDamage),
	);
	const v = computeVelocity(input, input.shift, follow.yaw);
	const moving = Math.hypot(v.x, v.z) > 0.01;
	tickPlayer(state, dt, moving, moving && input.shift);
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
				const mat = m.mesh.material as MeshStandardMaterial;
				const flashing = m.flashUntil !== undefined && m.flashUntil > state.now;
				mat.emissive.setHex(flashing ? 0xff0000 : 0x000000);
			}
		}
		applyContactDamage(
			state,
			monsters,
			player.position.x,
			player.position.z,
			PLAYER_RADIUS,
		);
		for (const chest of chests) {
			const done = updateChestDrop(chest, state.now);
			if (done && chest.dropMesh) {
				disposeMesh(chest.dropMesh);
				chest.dropMesh = undefined;
			}
		}
		for (const a of arrows) {
			updateArrow(a, dt);
			if (a.alive) handleArrowHit(a);
		}
		pruneArrows();
	}
	if (input.click && !prevClick) {
		if (state.phase === "playing") {
			if (state.player.weapon === "sword") {
				startSwing(swing, state.now);
			} else {
				fireArrow();
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
		if (state.player.weapon === "sword") {
			handleSwingTargets(
				facingX,
				facingZ,
				player.position.x,
				player.position.z,
			);
		}
		if (swing.active) {
			const elapsed = state.now - swing.startedAt;
			sword.rotation.y = -Math.PI / 2 + (Math.PI * elapsed) / SWING_DURATION;
		} else {
			sword.rotation.y = 0;
		}
		for (const m of monsters) {
			if (m.hp <= 0 && m.mesh) {
				disposeMesh(m.mesh);
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
	renderHud(state);
	renderer.render(scene, camera);
}
animate();

window.addEventListener("resize", () => {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
});
