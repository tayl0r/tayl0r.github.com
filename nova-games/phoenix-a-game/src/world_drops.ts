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
	_dt: number,
	now: number,
): boolean {
	// Stub until Task 5
	if (
		drop.pickedUpAt !== undefined &&
		now - drop.pickedUpAt >= DROP_FADE_DURATION
	) {
		return true;
	}
	return false;
}
