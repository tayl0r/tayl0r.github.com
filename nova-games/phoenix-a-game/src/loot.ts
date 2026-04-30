import { BoxGeometry, Mesh, MeshStandardMaterial, SphereGeometry } from "three";
import type { GameState } from "./state";

export type DropKind = "food" | "sword";

export function rollDrop(rng: () => number, boss = false): DropKind {
	if (boss) return "sword";
	return rng() < 0.6 ? "food" : "sword";
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
}

export function createChest(x: number, z: number, boss = false): Chest {
	const mesh = new Mesh(
		new BoxGeometry(0.8, 0.6, 0.8),
		new MeshStandardMaterial({ color: boss ? 0xffd700 : 0xaa7733 }),
	);
	mesh.position.set(x, 0.3, z);
	return { x, z, opened: false, boss, mesh };
}

function createDropMesh(drop: DropKind): Mesh {
	if (drop === "food") {
		return new Mesh(
			new SphereGeometry(0.18, 12, 8),
			new MeshStandardMaterial({ color: 0xcc2222, emissive: 0x441111 }),
		);
	}
	return new Mesh(
		new BoxGeometry(0.1, 0.6, 0.1),
		new MeshStandardMaterial({ color: 0xdddddd, emissive: 0x333333 }),
	);
}

export function openChest(
	chest: Chest,
	state: GameState,
	rng: () => number,
	now: number,
): Mesh | undefined {
	if (chest.opened) return undefined;
	chest.opened = true;
	chest.openedAt = now;
	const drop = rollDrop(rng, chest.boss);
	chest.drop = drop;
	if (drop === "food") {
		state.player.hunger = Math.min(
			state.player.maxHunger,
			state.player.hunger + 3,
		);
	} else {
		state.player.swordDamage += chest.boss ? 2 : 1;
	}
	const mat = chest.mesh.material;
	if (mat instanceof MeshStandardMaterial) mat.color.setHex(0x333333);
	const dropMesh = createDropMesh(drop);
	dropMesh.position.set(chest.x, 0.6, chest.z);
	chest.dropMesh = dropMesh;
	return dropMesh;
}

export function updateChestDrop(chest: Chest, now: number): void {
	if (!chest.dropMesh || chest.openedAt === undefined) return;
	const t = now - chest.openedAt;
	const rise = Math.min(t * 4, 1.0);
	chest.dropMesh.position.y = 0.6 + rise + Math.sin(t * 2) * 0.05;
	chest.dropMesh.rotation.y = t * 1.5;
}
