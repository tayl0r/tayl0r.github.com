import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";

export type MonsterKind = "goblin" | "ogre" | "boss";

export interface Monster {
	kind: MonsterKind;
	x: number;
	z: number;
	hp: number;
	speed: number;
	radius: number;
	contact: number;
	damage: number;
	mesh?: Mesh;
	flashUntil?: number;
}

export function createGoblin(x: number, z: number): Monster {
	return {
		kind: "goblin",
		x,
		z,
		hp: 2,
		speed: 3,
		radius: 0.4,
		contact: 0.9,
		damage: 0.5,
	};
}

export function createOgre(x: number, z: number): Monster {
	return {
		kind: "ogre",
		x,
		z,
		hp: 4,
		speed: 1.5,
		radius: 0.6,
		contact: 1.2,
		damage: 1,
	};
}

export function createBoss(x: number, z: number): Monster {
	return {
		kind: "boss",
		x,
		z,
		hp: 10,
		speed: 2,
		radius: 0.9,
		contact: 1.8,
		damage: 1,
	};
}

export function createMonsterMesh(m: Monster): Mesh {
	const size = m.kind === "boss" ? 1.5 : m.kind === "ogre" ? 1 : 0.6;
	const color =
		m.kind === "boss" ? 0xaa0000 : m.kind === "ogre" ? 0x885500 : 0x22aa22;
	const mesh = new Mesh(
		new BoxGeometry(size, size, size),
		new MeshStandardMaterial({ color }),
	);
	mesh.position.set(m.x, size / 2, m.z);
	return mesh;
}

export function moveMonsterTowards(
	m: Monster,
	targetX: number,
	targetZ: number,
	dt: number,
): void {
	const dx = targetX - m.x;
	const dz = targetZ - m.z;
	const d = Math.hypot(dx, dz);
	if (d < 0.01) return;
	const step = Math.min(d, m.speed * dt);
	m.x += (dx / d) * step;
	m.z += (dz / d) * step;
}

export function overlapsPlayer(
	m: Monster,
	px: number,
	pz: number,
	pr: number,
): boolean {
	const d = Math.hypot(m.x - px, m.z - pz);
	return d < m.contact + pr;
}
