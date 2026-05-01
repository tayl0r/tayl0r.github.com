import { BoxGeometry, Mesh, MeshStandardMaterial, SphereGeometry } from "three";
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
	mesh: Mesh;
	drop?: DropKind;
	dropMesh?: Mesh;
	openedAt?: number;
	dropPickedUp: boolean;
	pickedUpAt?: number;
}

export function createChest(x: number, z: number, boss = false): Chest {
	const mesh = new Mesh(
		new BoxGeometry(0.8, 0.6, 0.8),
		new MeshStandardMaterial({ color: boss ? 0xffd700 : 0xaa7733 }),
	);
	mesh.position.set(x, 0.3, z);
	return { x, z, opened: false, boss, mesh, dropPickedUp: false };
}

function createDropMesh(drop: DropKind): Mesh {
	if (drop === "food") {
		return new Mesh(
			new SphereGeometry(0.18, 12, 8),
			new MeshStandardMaterial({
				color: 0xcc2222,
				emissive: 0x441111,
				transparent: true,
			}),
		);
	}
	if (drop === "bow") {
		return new Mesh(
			new BoxGeometry(0.5, 0.12, 0.06),
			new MeshStandardMaterial({
				color: 0xaa6633,
				emissive: 0x331a0d,
				transparent: true,
			}),
		);
	}
	return new Mesh(
		new BoxGeometry(0.1, 0.6, 0.1),
		new MeshStandardMaterial({
			color: 0xdddddd,
			emissive: 0x333333,
			transparent: true,
		}),
	);
}

export function openChest(
	chest: Chest,
	rng: () => number,
	now: number,
): Mesh | undefined {
	if (chest.opened) return undefined;
	chest.opened = true;
	chest.openedAt = now;
	const drop = rollDrop(rng, chest.boss);
	chest.drop = drop;
	const mat = chest.mesh.material;
	if (mat instanceof MeshStandardMaterial) mat.color.setHex(0x333333);
	const dropMesh = createDropMesh(drop);
	dropMesh.position.set(chest.x, 0.6, chest.z);
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
		state.player.hunger = Math.min(
			state.player.maxHunger,
			state.player.hunger + 3,
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
	chest.dropMesh.position.y = 0.6 + rise + Math.sin(t * 2) * 0.05;
	chest.dropMesh.rotation.y = t * 1.5;
	if (chest.dropPickedUp && chest.pickedUpAt !== undefined) {
		const fadeT = now - chest.pickedUpAt;
		const opacity = Math.max(0, 1 - fadeT / FADE_DURATION);
		const mat = chest.dropMesh.material;
		if (mat instanceof MeshStandardMaterial) mat.opacity = opacity;
		chest.dropMesh.position.y += fadeT * 0.6;
		if (fadeT >= FADE_DURATION) return true;
	}
	return false;
}
