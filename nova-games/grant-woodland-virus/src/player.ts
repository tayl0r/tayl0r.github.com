import { type PerspectiveCamera, Vector3 } from "three";
import type { TreeCollider } from "./forest";

const PITCH_LIMIT = (85 / 180) * Math.PI;
const MOUSE_SENSITIVITY = 0.002;
const WALK_SPEED = 4;
const SPRINT_SPEED = 7;
const EYE_HEIGHT = 1.7;
const PLAYER_RADIUS = 0.3;
const STAMINA_MAX = 100;
const STAMINA_DRAIN = 25;
const STAMINA_REGEN = 15;

export type PlayerState = {
	position: Vector3;
	yaw: number;
	pitch: number;
	stamina: number;
};

type Keys = { w: boolean; a: boolean; s: boolean; d: boolean; q: boolean };
const keys: Keys = { w: false, a: false, s: false, d: false, q: false };

export function createPlayer(): PlayerState {
	return {
		position: new Vector3(0, EYE_HEIGHT, 0),
		yaw: 0,
		pitch: 0,
		stamina: STAMINA_MAX,
	};
}

export function resetPlayer(player: PlayerState) {
	player.position.set(0, EYE_HEIGHT, 0);
	player.yaw = 0;
	player.pitch = 0;
	player.stamina = STAMINA_MAX;
}

export function attachPlayerInput(
	canvas: HTMLCanvasElement,
	player: PlayerState,
) {
	window.addEventListener("keydown", (e) => {
		const k = e.key.toLowerCase();
		if (k === "w") keys.w = true;
		else if (k === "a") keys.a = true;
		else if (k === "s") keys.s = true;
		else if (k === "d") keys.d = true;
		else if (k === "q") keys.q = true;
	});
	window.addEventListener("keyup", (e) => {
		const k = e.key.toLowerCase();
		if (k === "w") keys.w = false;
		else if (k === "a") keys.a = false;
		else if (k === "s") keys.s = false;
		else if (k === "d") keys.d = false;
		else if (k === "q") keys.q = false;
	});

	window.addEventListener("mousemove", (e) => {
		if (document.pointerLockElement !== canvas) return;
		player.yaw -= e.movementX * MOUSE_SENSITIVITY;
		player.pitch -= e.movementY * MOUSE_SENSITIVITY;
		if (player.pitch > PITCH_LIMIT) player.pitch = PITCH_LIMIT;
		if (player.pitch < -PITCH_LIMIT) player.pitch = -PITCH_LIMIT;
	});

	canvas.addEventListener("click", () => {
		if (document.pointerLockElement !== canvas) {
			canvas.requestPointerLock();
		}
	});
}

const tmpForward = new Vector3();
const tmpRight = new Vector3();
const tmpMove = new Vector3();

export type World = {
	colliders: TreeCollider[];
	bounds: { halfX: number; halfZ: number };
};

function resolveCollision(position: Vector3, world: World) {
	for (let pass = 0; pass < 3; pass++) {
		let pushed = false;
		for (const c of world.colliders) {
			const dx = position.x - c.x;
			const dz = position.z - c.z;
			const dist = Math.hypot(dx, dz);
			const minDist = c.radius + PLAYER_RADIUS;
			if (dist < minDist && dist > 0.0001) {
				const push = minDist - dist;
				position.x += (dx / dist) * push;
				position.z += (dz / dist) * push;
				pushed = true;
			}
		}
		if (!pushed) break;
	}

	const limitX = world.bounds.halfX - PLAYER_RADIUS;
	const limitZ = world.bounds.halfZ - PLAYER_RADIUS;
	if (position.x > limitX) position.x = limitX;
	if (position.x < -limitX) position.x = -limitX;
	if (position.z > limitZ) position.z = limitZ;
	if (position.z < -limitZ) position.z = -limitZ;
}

export function updatePlayer(
	player: PlayerState,
	camera: PerspectiveCamera,
	dt: number,
	world: World,
) {
	camera.rotation.order = "YXZ";
	camera.rotation.set(player.pitch, player.yaw, 0);

	if (document.pointerLockElement) {
		camera.getWorldDirection(tmpForward);
		tmpForward.y = 0;
		tmpForward.normalize();
		tmpRight.set(-tmpForward.z, 0, tmpForward.x);

		tmpMove.set(0, 0, 0);
		if (keys.w) tmpMove.add(tmpForward);
		if (keys.s) tmpMove.sub(tmpForward);
		if (keys.d) tmpMove.add(tmpRight);
		if (keys.a) tmpMove.sub(tmpRight);

		const moving = tmpMove.lengthSq() > 0;
		const sprinting = moving && keys.q && player.stamina > 0;

		if (sprinting) {
			player.stamina -= STAMINA_DRAIN * dt;
			if (player.stamina < 0) player.stamina = 0;
		} else {
			player.stamina += STAMINA_REGEN * dt;
			if (player.stamina > STAMINA_MAX) player.stamina = STAMINA_MAX;
		}

		if (moving) {
			const speed = sprinting ? SPRINT_SPEED : WALK_SPEED;
			tmpMove.normalize().multiplyScalar(speed * dt);
			player.position.add(tmpMove);
		}

		resolveCollision(player.position, world);
	}

	camera.position.copy(player.position);
}
