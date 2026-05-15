import type { Scene } from "three";
import type { Door } from "./doors";
import type { Chest } from "./loot";
import type { GameState, Item } from "./state";
import type { RoomSwitch, WinSwitch } from "./switches";
import type { WorldDrop } from "./world_drops";

export const INTERACT_RANGE = 2.5;

export type Interactable =
	| { kind: "door"; door: Door }
	| { kind: "switch"; sw: RoomSwitch }
	| { kind: "chest"; chest: Chest }
	| { kind: "winSwitch"; ws: WinSwitch }
	| { kind: "pickup"; drop: WorldDrop };

export interface InteractCtx {
	state: GameState;
	doors: Door[];
	roomSwitches: RoomSwitch[];
	chests: Chest[];
	winSwitch: WinSwitch;
	drops: WorldDrop[];
	rng: () => number;
	scene: Scene;
	wakeRooms: (roomIndices: readonly number[]) => void;
	descendFloor: () => void;
	throwForward: (item: Item) => void;
}

function dist2(ax: number, az: number, bx: number, bz: number): number {
	const dx = ax - bx;
	const dz = az - bz;
	return dx * dx + dz * dz;
}

export function findNearestInteractable(
	px: number,
	pz: number,
	ctx: InteractCtx,
): Interactable | null {
	const r2 = INTERACT_RANGE * INTERACT_RANGE;
	let best: Interactable | null = null;
	let bestD2 = r2;

	const consider = (d2: number, candidate: Interactable) => {
		if (d2 <= bestD2) {
			best = candidate;
			bestD2 = d2;
		}
	};

	for (const door of ctx.doors) {
		if (door.open) continue;
		consider(dist2(px, pz, door.centerX, door.centerZ), { kind: "door", door });
	}
	for (const sw of ctx.roomSwitches) {
		if (sw.activated) continue;
		consider(dist2(px, pz, sw.x, sw.z), { kind: "switch", sw });
	}
	for (const chest of ctx.chests) {
		if (chest.opened) continue;
		consider(dist2(px, pz, chest.x, chest.z), { kind: "chest", chest });
	}
	if (ctx.winSwitch.unlocked && !ctx.winSwitch.activated) {
		consider(dist2(px, pz, ctx.winSwitch.x, ctx.winSwitch.z), {
			kind: "winSwitch",
			ws: ctx.winSwitch,
		});
	}
	for (const drop of ctx.drops) {
		if (drop.pickedUpAt !== undefined || !drop.settled) continue;
		consider(dist2(px, pz, drop.x, drop.z), { kind: "pickup", drop });
	}
	return best;
}
