export interface Aabb {
	minX: number;
	maxX: number;
	minZ: number;
	maxZ: number;
}

export function resolveCircleVsAabb(
	x: number,
	z: number,
	radius: number,
	box: Aabb,
): { x: number; z: number } {
	const cx = Math.max(box.minX, Math.min(x, box.maxX));
	const cz = Math.max(box.minZ, Math.min(z, box.maxZ));
	const dx = x - cx;
	const dz = z - cz;
	const distSq = dx * dx + dz * dz;
	if (distSq >= radius * radius) return { x, z };
	if (distSq === 0) {
		// Center inside box: push along nearest face.
		const leftDist = x - box.minX;
		const rightDist = box.maxX - x;
		const topDist = z - box.minZ;
		const bottomDist = box.maxZ - z;
		const m = Math.min(leftDist, rightDist, topDist, bottomDist);
		if (m === leftDist) return { x: box.minX - radius, z };
		if (m === rightDist) return { x: box.maxX + radius, z };
		if (m === topDist) return { x, z: box.minZ - radius };
		return { x, z: box.maxZ + radius };
	}
	const dist = Math.sqrt(distSq);
	const push = radius - dist;
	return { x: x + (dx / dist) * push, z: z + (dz / dist) * push };
}

export function resolveAll(
	x: number,
	z: number,
	radius: number,
	walls: Aabb[],
): { x: number; z: number } {
	// Iterate to a fixed point so shared corners (where resolving
	// against wall A pushes into wall B) settle within a few passes.
	let p = { x, z };
	for (let i = 0; i < 4; i++) {
		let changed = false;
		for (const w of walls) {
			const next = resolveCircleVsAabb(p.x, p.z, radius, w);
			if (next.x !== p.x || next.z !== p.z) {
				changed = true;
				p = next;
			}
		}
		if (!changed) break;
	}
	return p;
}
