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
