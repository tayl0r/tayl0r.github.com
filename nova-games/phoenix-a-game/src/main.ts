import {
	AmbientLight,
	BoxGeometry,
	Clock,
	CylinderGeometry,
	DirectionalLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	WebGLRenderer,
} from "three";
import { createFollowCamera } from "./camera";
import { resolveAll } from "./collision";
import { createSwing, SWING_DURATION, startSwing, updateSwing } from "./combat";
import { renderHud } from "./hud";
import { createInput, wireInput } from "./input";
import { type Chest, createChest, tryOpenChest } from "./loot";
import {
	createBoss,
	createGoblin,
	createMonsterMesh,
	createOgre,
	type Monster,
	moveMonsterTowards,
} from "./monsters";
import { computeVelocity, createPlayerMesh, PLAYER_RADIUS } from "./player";
import { createInitialState } from "./state";
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

const { root: player, sword } = createPlayerMesh();
scene.add(player);
scene.add(camera);
camera.add(sword);

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

const monsters: Monster[] = [];
const goblinRooms = [0, 1, 2, 3, 5, 7];
const ogreRooms = [0, 6, 8];
function spawnMonster(
	roomIndex: number,
	factory: (x: number, z: number) => Monster,
) {
	const room = grid.rooms[roomIndex];
	const jitterX = (Math.random() - 0.5) * 4;
	const jitterZ = (Math.random() - 0.5) * 4;
	const m = factory(room.centerX + jitterX, room.centerZ + jitterZ);
	m.mesh = createMonsterMesh(m);
	scene.add(m.mesh);
	monsters.push(m);
}
for (const roomIndex of goblinRooms) spawnMonster(roomIndex, createGoblin);
for (const roomIndex of ogreRooms) spawnMonster(roomIndex, createOgre);

const bossRoom = grid.rooms[4];
const boss = createBoss(bossRoom.centerX, bossRoom.centerZ);
boss.mesh = createMonsterMesh(boss);
scene.add(boss.mesh);
monsters.push(boss);

const stairs = new Mesh(
	new CylinderGeometry(1, 1, 0.5, 24),
	new MeshStandardMaterial({ color: 0x222222 }),
);
stairs.position.set(bossRoom.centerX, 0.25, bossRoom.centerZ);
scene.add(stairs);
let bossDead = false;

const chests: Chest[] = [];
const chestRooms = [0, 1, 3, 5, 7];
for (const roomIndex of chestRooms) {
	const room = grid.rooms[roomIndex];
	const chest = createChest(room.centerX, room.centerZ);
	chests.push(chest);
	scene.add(chest.mesh);
}

const input = createInput();
wireInput(input);
const follow = createFollowCamera(camera);
const clock = new Clock();
const state = createInitialState();
const swing = createSwing();
let prevClick = false;

const spawnRoom = grid.rooms[1];

function respawnPlayer() {
	state.player.health = state.player.maxHealth;
	state.player.stamina = state.player.maxStamina;
	state.player.hunger = state.player.maxHunger;
	state.player.iframesUntil = 0;
	player.position.x = spawnRoom.centerX;
	player.position.z = spawnRoom.centerZ;
	state.phase = "playing";
}

function animate() {
	requestAnimationFrame(animate);
	const dt = clock.getDelta();
	follow.update(player, input.mouseDX, input.mouseDY);
	input.mouseDX = 0;
	input.mouseDY = 0;
	const v = computeVelocity(input, input.shift, follow.yaw);
	const moving = Math.hypot(v.x, v.z) > 0.01;
	tickPlayer(state, dt, moving, moving && input.shift);
	if (state.phase === "playing") {
		const candidateX = player.position.x + v.x * dt;
		const candidateZ = player.position.z + v.z * dt;
		const resolved = resolveAll(
			candidateX,
			candidateZ,
			PLAYER_RADIUS,
			grid.walls,
		);
		player.position.x = resolved.x;
		player.position.z = resolved.z;
		for (const m of monsters) {
			if (m.hp <= 0) continue;
			moveMonsterTowards(m, player.position.x, player.position.z, dt);
			const resolvedM = resolveAll(m.x, m.z, m.radius, grid.walls);
			m.x = resolvedM.x;
			m.z = resolvedM.z;
			if (m.mesh) {
				m.mesh.position.x = m.x;
				m.mesh.position.z = m.z;
				const mat = m.mesh.material;
				if (mat instanceof MeshStandardMaterial) {
					const flashing =
						m.flashUntil !== undefined && m.flashUntil > state.now;
					mat.emissive.setHex(flashing ? 0xff0000 : 0x000000);
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
		for (const chest of chests) {
			tryOpenChest(
				chest,
				player.position.x,
				player.position.z,
				state,
				Math.random,
			);
		}
	}
	if (input.click && !prevClick) {
		if (state.phase === "playing") {
			startSwing(swing, state.now);
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
		if (swing.active) {
			const elapsed = state.now - swing.startedAt;
			sword.rotation.y = -Math.PI / 2 + (Math.PI * elapsed) / SWING_DURATION;
		} else {
			sword.rotation.y = 0;
		}
		for (const m of monsters) {
			if (m.hp <= 0 && m.mesh) {
				scene.remove(m.mesh);
				m.mesh.geometry.dispose();
				const mat = m.mesh.material;
				if (Array.isArray(mat)) {
					for (const sub of mat) sub.dispose();
				} else {
					mat.dispose();
				}
				m.mesh = undefined;
			}
		}
		if (!bossDead && boss.hp <= 0) {
			bossDead = true;
			const bossChest = createChest(boss.x, boss.z, true);
			chests.push(bossChest);
			scene.add(bossChest.mesh);
			if (stairs.material instanceof MeshStandardMaterial) {
				stairs.material.color.setHex(0xffff00);
			}
		}
		if (bossDead) {
			const dx = player.position.x - bossRoom.centerX;
			const dz = player.position.z - bossRoom.centerZ;
			if (Math.hypot(dx, dz) < 1.0) {
				state.phase = "won";
			}
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
