import { Group } from "three";
import { describe, expect, it } from "vitest";
import type { Door } from "./doors";
import {
	findNearestInteractable,
	INTERACT_RANGE,
	type InteractCtx,
} from "./interact";
import type { Chest } from "./loot";
import { createInitialState, type Item } from "./state";
import type { RoomSwitch, WinSwitch } from "./switches";
import type { WorldDrop } from "./world_drops";

function makeDoor(x: number, z: number, open = false): Door {
	return {
		roomIndices: [0, 1],
		open,
		aabb: { minX: x - 1, maxX: x + 1, minZ: z - 1, maxZ: z + 1 },
		centerX: x,
		centerZ: z,
		// biome-ignore lint/suspicious/noExplicitAny: stub mesh
		mesh: {} as any,
	};
}

function makeSwitch(x: number, z: number, activated = false): RoomSwitch {
	return {
		roomIndex: 0,
		activated,
		x,
		z,
		// biome-ignore lint/suspicious/noExplicitAny: stub mesh
		mesh: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: stub material
		buttonMaterial: {} as any,
	};
}

function makeChest(x: number, z: number, opened = false): Chest {
	return {
		x,
		z,
		opened,
		boss: false,
		// biome-ignore lint/suspicious/noExplicitAny: stub
		mesh: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: stub
		bodyMaterial: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: stub
		lid: {} as any,
	};
}

function makeWinSwitch(
	x: number,
	z: number,
	unlocked = true,
	activated = false,
): WinSwitch {
	return {
		activated,
		unlocked,
		x,
		z,
		// biome-ignore lint/suspicious/noExplicitAny: stub
		mesh: {} as any,
		// biome-ignore lint/suspicious/noExplicitAny: stub
		plateMaterial: {} as any,
	};
}

const ITEM: Item = { kind: "sword", quality: 1 };

function makeDrop(
	x: number,
	z: number,
	settled = true,
	pickedUp = false,
): WorldDrop {
	return {
		item: ITEM,
		x,
		y: 0.3,
		z,
		vx: 0,
		vy: 0,
		vz: 0,
		mesh: new Group(),
		spawnedAt: 0,
		settled,
		pickedUpAt: pickedUp ? 0 : undefined,
	};
}

function makeCtx(overrides: Partial<InteractCtx> = {}): InteractCtx {
	return {
		state: createInitialState(),
		doors: [],
		roomSwitches: [],
		chests: [],
		winSwitch: makeWinSwitch(1000, 1000, false),
		drops: [],
		rng: () => 0,
		// biome-ignore lint/suspicious/noExplicitAny: stub scene
		scene: { add: () => {}, remove: () => {} } as any,
		wakeRooms: () => {},
		descendFloor: () => {},
		throwForward: () => {},
		...overrides,
	};
}

describe("findNearestInteractable", () => {
	it("returns null when nothing is in range", () => {
		const ctx = makeCtx({ doors: [makeDoor(100, 100)] });
		expect(findNearestInteractable(0, 0, ctx)).toBeNull();
	});
	it("returns the nearest in-range target across kinds", () => {
		const near = makeDoor(0, 1.5);
		const far = makeChest(0, 2.4);
		const ctx = makeCtx({ doors: [near], chests: [far] });
		const t = findNearestInteractable(0, 0, ctx);
		expect(t?.kind).toBe("door");
	});
	it("excludes opened chests / activated switches / locked winSwitch", () => {
		const ctx = makeCtx({
			chests: [makeChest(0, 1, true)],
			roomSwitches: [makeSwitch(0, 1.2, true)],
			winSwitch: makeWinSwitch(0, 1.4, false), // locked
		});
		expect(findNearestInteractable(0, 0, ctx)).toBeNull();
	});
	it("excludes opened doors", () => {
		const ctx = makeCtx({ doors: [makeDoor(0, 1, true)] });
		expect(findNearestInteractable(0, 0, ctx)).toBeNull();
	});
	it("excludes unsettled or already-picked drops", () => {
		const ctx = makeCtx({
			drops: [
				makeDrop(0, 1, false, false), // not settled
				makeDrop(0, 1.5, true, true), // already picked
			],
		});
		expect(findNearestInteractable(0, 0, ctx)).toBeNull();
	});
	it("includes a settled drop in range", () => {
		const ctx = makeCtx({ drops: [makeDrop(0, 1, true, false)] });
		const t = findNearestInteractable(0, 0, ctx);
		expect(t?.kind).toBe("pickup");
	});
	it(`enforces INTERACT_RANGE (${INTERACT_RANGE})`, () => {
		const ctx = makeCtx({ doors: [makeDoor(0, INTERACT_RANGE + 0.1)] });
		expect(findNearestInteractable(0, 0, ctx)).toBeNull();
	});
});
