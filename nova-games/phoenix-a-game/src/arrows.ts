import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import type { Aabb } from "./collision";
import type { Monster } from "./monsters";

export const ARROW_SPEED = 28;
export const ARROW_GRAVITY = 18;
export const ARROW_LIFETIME = 4;
export const ARROW_RADIUS = 0.15;

export interface Arrow {
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	damage: number;
	alive: boolean;
	bornAt: number;
	mesh: Mesh;
}

export function createArrow(
	px: number,
	py: number,
	pz: number,
	dx: number,
	dy: number,
	dz: number,
	damage: number,
	color: number,
	now: number,
): Arrow {
	const len = Math.hypot(dx, dy, dz) || 1;
	const ux = dx / len;
	const uy = dy / len;
	const uz = dz / len;
	const mesh = new Mesh(
		new BoxGeometry(0.05, 0.05, 0.7),
		new MeshStandardMaterial({ color, emissive: 0x222222 }),
	);
	mesh.position.set(px, py, pz);
	mesh.lookAt(px + ux, py + uy, pz + uz);
	return {
		x: px,
		y: py,
		z: pz,
		vx: ux * ARROW_SPEED,
		vy: uy * ARROW_SPEED,
		vz: uz * ARROW_SPEED,
		damage,
		alive: true,
		bornAt: now,
		mesh,
	};
}

export function updateArrow(a: Arrow, dt: number): void {
	if (!a.alive) return;
	a.vy -= ARROW_GRAVITY * dt;
	a.x += a.vx * dt;
	a.y += a.vy * dt;
	a.z += a.vz * dt;
	a.mesh.position.set(a.x, a.y, a.z);
	a.mesh.lookAt(a.x + a.vx, a.y + a.vy, a.z + a.vz);
	if (a.y <= 0) a.alive = false;
}

export function arrowExpired(a: Arrow, now: number): boolean {
	return now - a.bornAt > ARROW_LIFETIME;
}

export function arrowHitsAabb(a: Arrow, walls: Aabb[]): boolean {
	for (const w of walls) {
		if (a.x >= w.minX && a.x <= w.maxX && a.z >= w.minZ && a.z <= w.maxZ) {
			return true;
		}
	}
	return false;
}

export function arrowHitsCircleXZ(
	a: Arrow,
	x: number,
	z: number,
	radius: number,
	maxY = 3,
): boolean {
	if (a.y < 0 || a.y > maxY) return false;
	const dx = a.x - x;
	const dz = a.z - z;
	const r = radius + ARROW_RADIUS;
	return dx * dx + dz * dz <= r * r;
}

export function arrowHitsMonster(a: Arrow, m: Monster): boolean {
	return arrowHitsCircleXZ(a, m.x, m.z, m.radius, 2.5);
}
