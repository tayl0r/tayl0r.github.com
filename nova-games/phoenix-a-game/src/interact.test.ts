import { Group } from "three";
import { describe, expect, it } from "vitest";
import type { Door } from "./doors";
import {
	describeInteractable,
	findNearestInteractable,
	INTERACT_RANGE,
	type InteractCtx,
	performInteract,
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

describe("performInteract", () => {
	it("opens a door and wakes its rooms", () => {
		const door = makeDoor(0, 1);
		const woke: number[][] = [];
		const ctx = makeCtx({
			doors: [door],
			wakeRooms: (rs) => woke.push([...rs]),
		});
		performInteract({ kind: "door", door }, ctx, 0);
		expect(door.open).toBe(true);
		expect(woke).toEqual([[0, 1]]);
	});
	it("activates a switch", () => {
		const sw = makeSwitch(0, 1);
		// patch material so activateSwitch doesn't crash on setHex
		// biome-ignore lint/suspicious/noExplicitAny: stub material
		(sw.buttonMaterial as any) = {
			color: { setHex: () => {} },
			emissive: { setHex: () => {} },
		};
		const ctx = makeCtx({ roomSwitches: [sw] });
		performInteract({ kind: "switch", sw }, ctx, 0);
		expect(sw.activated).toBe(true);
	});
	it("opens a chest, rolls an item, pushes a settled drop", () => {
		const chest = makeChest(5, 5);
		// patch chest mesh/material so the body color shift doesn't crash
		// biome-ignore lint/suspicious/noExplicitAny: stub material
		(chest.bodyMaterial as any) = { color: { setHex: () => {} } };
		// biome-ignore lint/suspicious/noExplicitAny: stub lid
		(chest.lid as any) = {
			rotation: { x: 0 },
			position: { set: () => {} },
		};
		const ctx = makeCtx({
			chests: [chest],
			rng: () => 0.5,
		});
		performInteract({ kind: "chest", chest }, ctx, 0);
		expect(chest.opened).toBe(true);
		expect(ctx.drops).toHaveLength(1);
		expect(ctx.drops[0].settled).toBe(true);
		expect(ctx.drops[0].x).toBe(5);
	});
	it("picks up a drop into the hotbar", () => {
		const drop = makeDrop(0, 1);
		const ctx = makeCtx({ drops: [drop] });
		ctx.state.player.hotbar[0] = { kind: "sword", quality: 1 };
		performInteract({ kind: "pickup", drop }, ctx, 0);
		expect(drop.pickedUpAt).toBe(0);
		expect(ctx.state.player.hotbar[1]).toEqual(drop.item);
	});
	it("on full hotbar, pickup throws the displaced item", () => {
		const drop = makeDrop(0, 1);
		const thrown: Item[] = [];
		const ctx = makeCtx({
			drops: [drop],
			throwForward: (i) => thrown.push(i),
		});
		for (let i = 0; i < 10; i++) {
			ctx.state.player.hotbar[i] = { kind: "sword", quality: 1 };
		}
		ctx.state.player.selectedSlot = 3;
		performInteract({ kind: "pickup", drop }, ctx, 0);
		expect(thrown).toHaveLength(1);
		expect(thrown[0]).toEqual({ kind: "sword", quality: 1 });
		expect(ctx.state.player.hotbar[3]).toEqual(drop.item);
	});
	it("triggers descendFloor on winSwitch", () => {
		const ws = makeWinSwitch(0, 1, true, false);
		// biome-ignore lint/suspicious/noExplicitAny: stub material
		(ws.plateMaterial as any) = {
			color: { setHex: () => {} },
			emissive: { setHex: () => {} },
		};
		let descended = false;
		const ctx = makeCtx({
			winSwitch: ws,
			descendFloor: () => {
				descended = true;
			},
		});
		performInteract({ kind: "winSwitch", ws }, ctx, 0);
		expect(ws.activated).toBe(true);
		expect(descended).toBe(true);
	});
});

describe("describeInteractable", () => {
	it("returns descriptive strings", () => {
		expect(
			describeInteractable({ kind: "door", door: makeDoor(0, 0) }),
		).toMatch(/door/i);
		expect(
			describeInteractable({
				kind: "pickup",
				drop: {
					item: { kind: "sword", quality: 4 },
					x: 0,
					y: 0,
					z: 0,
					vx: 0,
					vy: 0,
					vz: 0,
					mesh: new Group(),
					spawnedAt: 0,
					settled: true,
				},
			}),
		).toMatch(/epic.*sword/i);
	});
});
