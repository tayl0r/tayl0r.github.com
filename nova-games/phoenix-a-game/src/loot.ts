import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";
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
}

export function createChest(x: number, z: number, boss = false): Chest {
	const mesh = new Mesh(
		new BoxGeometry(0.8, 0.6, 0.8),
		new MeshStandardMaterial({ color: boss ? 0xffd700 : 0xaa7733 }),
	);
	mesh.position.set(x, 0.3, z);
	return { x, z, opened: false, boss, mesh };
}

export function tryOpenChest(
	chest: Chest,
	playerX: number,
	playerZ: number,
	state: GameState,
	rng: () => number,
): void {
	if (chest.opened) return;
	if (Math.hypot(chest.x - playerX, chest.z - playerZ) > 1.2) return;
	chest.opened = true;
	const drop = rollDrop(rng, chest.boss);
	if (drop === "food") {
		state.player.hunger = Math.min(
			state.player.maxHunger,
			state.player.hunger + 3,
		);
	} else {
		const bump = chest.boss ? 2 : 1;
		state.player.swordDamage += bump;
	}
	const mat = chest.mesh.material;
	if (mat instanceof MeshStandardMaterial) mat.color.setHex(0x333333);
}
