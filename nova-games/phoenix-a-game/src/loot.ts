import { BoxGeometry, Group, Mesh, MeshStandardMaterial } from "three";
import type { Item, ItemKind, Quality } from "./state";

export interface Chest {
	x: number;
	z: number;
	opened: boolean;
	boss: boolean;
	mesh: Group;
	bodyMaterial: MeshStandardMaterial;
	lid: Group;
}

export function createChest(x: number, z: number, boss = false): Chest {
	const mesh = new Group();
	const wood = boss ? 0xffd700 : 0x8b5a2b;
	const dark = boss ? 0xaa7700 : 0x4a2e16;
	const bodyMaterial = new MeshStandardMaterial({ color: wood });
	const trim = new MeshStandardMaterial({ color: dark });

	const base = new Mesh(new BoxGeometry(0.9, 0.5, 0.6), bodyMaterial);
	base.position.y = 0.25;
	mesh.add(base);

	for (const dz of [-0.295, 0.295]) {
		const band = new Mesh(new BoxGeometry(0.92, 0.08, 0.02), trim);
		band.position.set(0, 0.4, dz);
		mesh.add(band);
	}
	for (const dx of [-0.45, 0.45]) {
		const band = new Mesh(new BoxGeometry(0.02, 0.08, 0.62), trim);
		band.position.set(dx, 0.4, 0);
		mesh.add(band);
	}

	const lid = new Group();
	const lidTop = new Mesh(new BoxGeometry(0.92, 0.18, 0.62), bodyMaterial);
	lidTop.position.y = 0.09;
	lid.add(lidTop);
	const lidTrim = new Mesh(new BoxGeometry(0.94, 0.04, 0.04), trim);
	lidTrim.position.set(0, 0.18, 0.3);
	lid.add(lidTrim);
	const lock = new Mesh(
		new BoxGeometry(0.16, 0.16, 0.05),
		new MeshStandardMaterial({ color: 0xddaa00, emissive: 0x553300 }),
	);
	lock.position.set(0, 0.06, 0.32);
	lid.add(lock);
	lid.position.y = 0.5;
	mesh.add(lid);

	mesh.position.set(x, 0, z);
	return {
		x,
		z,
		opened: false,
		boss,
		mesh,
		bodyMaterial,
		lid,
	};
}

const QUALITY_WEIGHTS: readonly (readonly number[])[] = [
	[55, 30, 12, 3, 0, 0], // floor 0
	[35, 35, 20, 8, 2, 0], // floor 1
	[20, 30, 28, 15, 6, 1], // floor 2
	[10, 22, 28, 22, 13, 5], // floor 3
	[5, 15, 25, 25, 20, 10], // floor 4+
];

function rollQuality(rng: () => number, band: number): Quality {
	const weights = QUALITY_WEIGHTS[Math.min(band, QUALITY_WEIGHTS.length - 1)];
	const total = weights.reduce((a, b) => a + b, 0);
	let r = rng() * total;
	for (let i = 0; i < weights.length; i++) {
		r -= weights[i];
		if (r < 0) return (i + 1) as Quality;
	}
	return weights.length as Quality;
}

function rollKind(rng: () => number, boss: boolean): ItemKind {
	if (boss) {
		return rng() < 0.5 ? "sword" : "bow";
	}
	const r = rng();
	if (r < 0.35) return "food";
	if (r < 0.7) return "sword";
	return "bow";
}

export function rollItemDrop(
	rng: () => number,
	floor: number,
	boss: boolean,
): Item {
	const kind = rollKind(rng, boss);
	if (kind === "food") return { kind, quality: 1 };
	const band = Math.max(0, Math.floor(floor)) + (boss ? 1 : 0);
	const quality = rollQuality(rng, band);
	return { kind, quality };
}
