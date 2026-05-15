import type { Scene } from "three";
import { type Door, openDoor } from "./doors";
import { addItem } from "./hotbar";
import { type Chest, rollItemDrop } from "./loot";
import { type GameState, type Item, QUALITY_NAMES } from "./state";
import {
	activateSwitch,
	activateWinSwitch,
	type RoomSwitch,
	type WinSwitch,
} from "./switches";
import { createWorldDrop, markPickedUp, type WorldDrop } from "./world_drops";

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

export function performInteract(
	target: Interactable,
	ctx: InteractCtx,
	now: number,
): void {
	switch (target.kind) {
		case "door": {
			openDoor(target.door);
			ctx.wakeRooms(target.door.roomIndices);
			return;
		}
		case "switch": {
			activateSwitch(target.sw);
			return;
		}
		case "chest": {
			const chest = target.chest;
			chest.opened = true;
			chest.bodyMaterial.color.setHex(chest.boss ? 0x665500 : 0x3a2a1a);
			chest.lid.rotation.x = -1.0;
			chest.lid.position.set(0, 0.5, -0.25);
			const item = rollItemDrop(ctx.rng, ctx.state.floor, chest.boss);
			const drop = createWorldDrop(item, chest.x, 0.7, chest.z, 0, 0, 0, now);
			drop.settled = true;
			ctx.drops.push(drop);
			ctx.scene.add(drop.mesh);
			return;
		}
		case "winSwitch": {
			activateWinSwitch(target.ws);
			ctx.descendFloor();
			return;
		}
		case "pickup": {
			const { displaced } = addItem(ctx.state, target.drop.item);
			markPickedUp(target.drop, now);
			if (displaced) ctx.throwForward(displaced);
			return;
		}
	}
}

export function describeInteractable(target: Interactable): string {
	switch (target.kind) {
		case "door":
			return "Open door";
		case "switch":
			return "Activate switch";
		case "chest":
			return target.chest.boss ? "Open boss chest" : "Open chest";
		case "winSwitch":
			return "Descend";
		case "pickup": {
			const item = target.drop.item;
			if (item.kind === "food") return "Pick up food";
			const tier = QUALITY_NAMES[item.quality - 1];
			const kind = item.kind === "sword" ? "Sword" : "Bow";
			return `Pick up ${tier.charAt(0).toUpperCase() + tier.slice(1)} ${kind}`;
		}
	}
}
