import {
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	TorusGeometry,
} from "three";
import { type Item, QUALITY_COLORS } from "./state";

export const DROP_FADE_DURATION = 0.6;
export const DROP_FLOOR_Y = 0.3;

export function createDropMesh(item: Item): Group {
	const group = new Group();
	if (item.kind === "food") {
		const apple = new Mesh(
			new SphereGeometry(0.18, 14, 10),
			new MeshStandardMaterial({
				color: 0xcc2222,
				emissive: 0x441111,
				transparent: true,
			}),
		);
		group.add(apple);
		const stem = new Mesh(
			new CylinderGeometry(0.015, 0.015, 0.08, 4),
			new MeshStandardMaterial({ color: 0x553311, transparent: true }),
		);
		stem.position.y = 0.2;
		group.add(stem);
		const leaf = new Mesh(
			new ConeGeometry(0.05, 0.08, 4),
			new MeshStandardMaterial({ color: 0x44aa44, transparent: true }),
		);
		leaf.position.set(0.06, 0.22, 0);
		leaf.rotation.z = Math.PI / 4;
		group.add(leaf);
		return group;
	}
	const tint = QUALITY_COLORS[item.quality - 1];
	if (item.kind === "bow") {
		const limb = new Mesh(
			new TorusGeometry(0.22, 0.025, 6, 12, Math.PI),
			new MeshStandardMaterial({
				color: tint,
				emissive: 0x331a0d,
				transparent: true,
			}),
		);
		limb.rotation.x = Math.PI / 2;
		group.add(limb);
		const string = new Mesh(
			new CylinderGeometry(0.005, 0.005, 0.44, 4),
			new MeshStandardMaterial({ color: 0xeeeeee, transparent: true }),
		);
		string.position.x = 0.22;
		string.rotation.z = Math.PI / 2;
		group.add(string);
		return group;
	}
	// sword
	const blade = new Mesh(
		new BoxGeometry(0.06, 0.55, 0.025),
		new MeshStandardMaterial({
			color: tint,
			emissive: 0x333333,
			transparent: true,
		}),
	);
	blade.position.y = 0.05;
	group.add(blade);
	const guard = new Mesh(
		new BoxGeometry(0.22, 0.05, 0.05),
		new MeshStandardMaterial({
			color: 0xddaa44,
			emissive: 0x442200,
			transparent: true,
		}),
	);
	guard.position.y = -0.22;
	group.add(guard);
	const grip = new Mesh(
		new CylinderGeometry(0.025, 0.025, 0.16, 6),
		new MeshStandardMaterial({ color: 0x442211, transparent: true }),
	);
	grip.position.y = -0.32;
	group.add(grip);
	const pommel = new Mesh(
		new SphereGeometry(0.04, 8, 6),
		new MeshStandardMaterial({
			color: 0xddaa44,
			emissive: 0x442200,
			transparent: true,
		}),
	);
	pommel.position.y = -0.42;
	group.add(pommel);
	return group;
}

export interface WorldDrop {
	item: Item;
	x: number;
	y: number;
	z: number;
	vx: number;
	vy: number;
	vz: number;
	mesh: Group;
	spawnedAt: number;
	settled: boolean;
	pickedUpAt?: number;
}

export function createWorldDrop(
	item: Item,
	x: number,
	y: number,
	z: number,
	vx: number,
	vy: number,
	vz: number,
	now: number,
): WorldDrop {
	const mesh = createDropMesh(item);
	mesh.position.set(x, y, z);
	return {
		item,
		x,
		y,
		z,
		vx,
		vy,
		vz,
		mesh,
		spawnedAt: now,
		settled: false,
	};
}

export function markPickedUp(drop: WorldDrop, now: number): void {
	if (drop.pickedUpAt !== undefined) return;
	drop.pickedUpAt = now;
}

export function updateWorldDrop(
	drop: WorldDrop,
	dt: number,
	now: number,
): boolean {
	if (!drop.settled) {
		drop.vy -= 9.8 * dt;
		drop.x += drop.vx * dt;
		drop.y += drop.vy * dt;
		drop.z += drop.vz * dt;
		if (drop.y <= DROP_FLOOR_Y) {
			drop.y = DROP_FLOOR_Y;
			drop.vx = 0;
			drop.vy = 0;
			drop.vz = 0;
			drop.settled = true;
		}
	} else {
		const hoverT = now - drop.spawnedAt;
		drop.y = DROP_FLOOR_Y + Math.sin(hoverT * 2) * 0.05;
		drop.mesh.rotation.y = hoverT * 1.5;
	}
	drop.mesh.position.set(drop.x, drop.y, drop.z);

	if (drop.pickedUpAt !== undefined) {
		const fadeT = now - drop.pickedUpAt;
		const opacity = Math.max(0, 1 - fadeT / DROP_FADE_DURATION);
		drop.mesh.traverse((child) => {
			const m = (child as { material?: unknown }).material;
			if (m instanceof MeshStandardMaterial && m.transparent) {
				m.opacity = opacity;
			}
		});
		drop.mesh.position.y += fadeT * 0.6;
		if (fadeT >= DROP_FADE_DURATION) return true;
	}
	return false;
}
