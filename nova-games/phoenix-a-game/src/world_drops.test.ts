import { describe, expect, it } from "vitest";
import type { Item } from "./state";
import {
	createDropMesh,
	createWorldDrop,
	markPickedUp,
	updateWorldDrop,
} from "./world_drops";

const SWORD_EPIC: Item = { kind: "sword", quality: 4 };
const BOW_GODLY: Item = { kind: "bow", quality: 6 };
const FOOD: Item = { kind: "food", quality: 1 };

describe("createDropMesh", () => {
	it("returns a Group for each kind", () => {
		expect(createDropMesh(SWORD_EPIC).type).toBe("Group");
		expect(createDropMesh(BOW_GODLY).type).toBe("Group");
		expect(createDropMesh(FOOD).type).toBe("Group");
	});
});

describe("createWorldDrop", () => {
	it("captures position, velocity, and item", () => {
		const d = createWorldDrop(SWORD_EPIC, 1, 2, 3, 4, 5, 6, 100);
		expect(d.item).toBe(SWORD_EPIC);
		expect(d.x).toBe(1);
		expect(d.y).toBe(2);
		expect(d.z).toBe(3);
		expect(d.vx).toBe(4);
		expect(d.vy).toBe(5);
		expect(d.vz).toBe(6);
		expect(d.spawnedAt).toBe(100);
		expect(d.settled).toBe(false);
		expect(d.pickedUpAt).toBeUndefined();
	});
});

describe("markPickedUp / updateWorldDrop", () => {
	it("are exported as functions", () => {
		expect(typeof markPickedUp).toBe("function");
		expect(typeof updateWorldDrop).toBe("function");
	});
});

const ITEM: Item = { kind: "sword", quality: 1 };

describe("updateWorldDrop physics", () => {
	it("a stationary drop stays put and does not settle off of zero velocity", () => {
		const d = createWorldDrop(ITEM, 5, 0.7, 5, 0, 0, 0, 0);
		d.settled = true;
		const done = updateWorldDrop(d, 1 / 60, 0);
		expect(done).toBe(false);
		expect(d.x).toBe(5);
		expect(d.z).toBe(5);
	});
	it("an arced drop lands on the floor and settles", () => {
		const d = createWorldDrop(ITEM, 0, 1.2, 0, 6, 2, 0, 0);
		let t = 0;
		for (let i = 0; i < 600; i++) {
			updateWorldDrop(d, 1 / 60, t);
			t += 1 / 60;
			if (d.settled) break;
		}
		expect(d.settled).toBe(true);
		expect(d.y).toBeCloseTo(0.3, 1);
		expect(d.x).toBeGreaterThan(1); // moved forward
	});
	it("syncs mesh position to drop position each tick", () => {
		const d = createWorldDrop(ITEM, 0, 1.2, 0, 0, 5, 0, 0);
		updateWorldDrop(d, 0.1, 0);
		expect(d.mesh.position.y).toBeCloseTo(d.y, 5);
	});
});

describe("updateWorldDrop fade", () => {
	it("returns true only after fade completes", () => {
		const d = createWorldDrop(ITEM, 0, 0.7, 0, 0, 0, 0, 0);
		d.settled = true;
		markPickedUp(d, 10);
		expect(updateWorldDrop(d, 1 / 60, 10.1)).toBe(false);
		expect(updateWorldDrop(d, 1 / 60, 10.7)).toBe(true);
	});
});
