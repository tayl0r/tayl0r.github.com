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
import type { GameState } from "./state";

export type DropKind = "food" | "sword" | "bow";

const FADE_DURATION = 0.6;

export function rollDrop(rng: () => number, boss = false): DropKind {
	if (boss) return "sword";
	const r = rng();
	if (r < 0.4) return "food";
	if (r < 0.7) return "sword";
	return "bow";
}

export interface Chest {
	x: number;
	z: number;
	opened: boolean;
	boss: boolean;
	mesh: Group;
	bodyMaterial: MeshStandardMaterial;
	lid: Group;
	drop?: DropKind;
	dropMesh?: Group;
	openedAt?: number;
	dropPickedUp: boolean;
	pickedUpAt?: number;
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
		dropPickedUp: false,
	};
}

function createDropMesh(drop: DropKind): Group {
	const group = new Group();
	if (drop === "food") {
		const apple = new Mesh(
			new SphereGeometry(0.18, 14, 10),
			new MeshStandardMaterial({
				color: 0xcc2222,
				emissive: 0x441111,
				transparent: true,
			}),
		);
		apple.position.y = 0;
		group.add(apple);
		const stem = new Mesh(
			new CylinderGeometry(0.015, 0.015, 0.08, 4),
			new MeshStandardMaterial({
				color: 0x553311,
				transparent: true,
			}),
		);
		stem.position.y = 0.2;
		group.add(stem);
		const leaf = new Mesh(
			new ConeGeometry(0.05, 0.08, 4),
			new MeshStandardMaterial({
				color: 0x44aa44,
				transparent: true,
			}),
		);
		leaf.position.set(0.06, 0.22, 0);
		leaf.rotation.z = Math.PI / 4;
		group.add(leaf);
		return group;
	}
	if (drop === "bow") {
		const limb = new Mesh(
			new TorusGeometry(0.22, 0.025, 6, 12, Math.PI),
			new MeshStandardMaterial({
				color: 0x8b5a2b,
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
	const blade = new Mesh(
		new BoxGeometry(0.06, 0.55, 0.025),
		new MeshStandardMaterial({
			color: 0xdddddd,
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
		new MeshStandardMaterial({
			color: 0x442211,
			transparent: true,
		}),
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

export function openChest(
	chest: Chest,
	rng: () => number,
	now: number,
): Group | undefined {
	if (chest.opened) return undefined;
	chest.opened = true;
	chest.openedAt = now;
	const drop = rollDrop(rng, chest.boss);
	chest.drop = drop;
	chest.bodyMaterial.color.setHex(chest.boss ? 0x665500 : 0x3a2a1a);
	chest.lid.rotation.x = -1.0;
	chest.lid.position.set(0, 0.5, -0.25);
	const dropMesh = createDropMesh(drop);
	dropMesh.position.set(chest.x, 0.7, chest.z);
	chest.dropMesh = dropMesh;
	return dropMesh;
}

export function pickupDrop(
	chest: Chest,
	state: GameState,
	now: number,
): boolean {
	if (chest.dropPickedUp || !chest.drop || !chest.dropMesh) return false;
	chest.dropPickedUp = true;
	chest.pickedUpAt = now;
	if (chest.drop === "food") {
		state.player.health = Math.min(
			state.player.maxHealth,
			state.player.health + 1,
		);
	} else if (chest.drop === "bow") {
		state.player.bowDamage += chest.boss ? 2 : 1;
	} else {
		state.player.swordDamage += chest.boss ? 2 : 1;
	}
	return true;
}

export function updateChestDrop(chest: Chest, now: number): boolean {
	if (!chest.dropMesh || chest.openedAt === undefined) return false;
	const t = now - chest.openedAt;
	const rise = Math.min(t * 4, 1.0);
	chest.dropMesh.position.y = 0.7 + rise + Math.sin(t * 2) * 0.05;
	chest.dropMesh.rotation.y = t * 1.5;
	if (chest.dropPickedUp && chest.pickedUpAt !== undefined) {
		const fadeT = now - chest.pickedUpAt;
		const opacity = Math.max(0, 1 - fadeT / FADE_DURATION);
		chest.dropMesh.traverse((child) => {
			if (child instanceof Mesh) {
				const mats = Array.isArray(child.material)
					? child.material
					: [child.material];
				for (const m of mats) {
					if (m instanceof MeshStandardMaterial && m.transparent) {
						m.opacity = opacity;
					}
				}
			}
		});
		chest.dropMesh.position.y += fadeT * 0.6;
		if (fadeT >= FADE_DURATION) return true;
	}
	return false;
}
