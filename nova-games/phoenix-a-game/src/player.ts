import {
	BoxGeometry,
	CapsuleGeometry,
	Mesh,
	MeshStandardMaterial,
} from "three";

export const WALK_SPEED = 4;
export const RUN_SPEED = 8;
export const PLAYER_RADIUS = 0.5;

export interface MoveKeys {
	w: boolean;
	a: boolean;
	s: boolean;
	d: boolean;
}

export function computeVelocity(
	keys: MoveKeys,
	sprinting: boolean,
	cameraYaw: number,
): { x: number; z: number } {
	let fx = 0;
	let fz = 0;
	if (keys.w) fz -= 1;
	if (keys.s) fz += 1;
	if (keys.a) fx -= 1;
	if (keys.d) fx += 1;
	const len = Math.hypot(fx, fz);
	if (len === 0) return { x: 0, z: 0 };
	fx /= len;
	fz /= len;
	const speed = sprinting ? RUN_SPEED : WALK_SPEED;
	const cos = Math.cos(cameraYaw);
	const sin = Math.sin(cameraYaw);
	return {
		x: (fx * cos + fz * sin) * speed,
		z: (-fx * sin + fz * cos) * speed,
	};
}

export function createPlayerMesh(): { root: Mesh; sword: Mesh } {
	const root = new Mesh(
		new CapsuleGeometry(0.5, 1, 4, 8),
		new MeshStandardMaterial({ color: 0x66ccff }),
	);
	root.position.y = 1;
	const sword = new Mesh(
		new BoxGeometry(0.1, 0.1, 1.0),
		new MeshStandardMaterial({ color: 0xcccccc }),
	);
	sword.position.set(0.5, 0, -0.5);
	root.add(sword);
	return { root, sword };
}
