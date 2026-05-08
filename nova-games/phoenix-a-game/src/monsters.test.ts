import { describe, expect, it } from "vitest";
import {
	createMonster,
	createMonsterModel,
	isBossKind,
	type MonsterKind,
	moveMonsterTowards,
} from "./monsters";

describe("createMonster", () => {
	it("returns kind-appropriate stats", () => {
		const sk = createMonster("skeleton", 0, 0, 0);
		expect(sk.kind).toBe("skeleton");
		expect(sk.dormant).toBe(true);
		const reaper = createMonster("grimReaper", 0, 0, 0);
		expect(reaper.dormant).toBe(false);
	});
	it("identifies boss kinds", () => {
		expect(isBossKind("grimReaper")).toBe(true);
		expect(isBossKind("troll")).toBe(true);
		expect(isBossKind("lich")).toBe(true);
		expect(isBossKind("skeleton")).toBe(false);
		expect(isBossKind("slime")).toBe(false);
	});
});

describe("moveMonsterTowards", () => {
	it("walks toward the target at its speed", () => {
		const m = createMonster("goblin", 0, 0, 0);
		m.dormant = false;
		moveMonsterTowards(m, 10, 0, 1);
		expect(m.x).toBeCloseTo(m.speed, 5);
	});
	it("does not overshoot the target", () => {
		const m = createMonster("goblin", 0, 0, 0);
		m.dormant = false;
		m.speed = 100;
		moveMonsterTowards(m, 1, 0, 1);
		expect(m.x).toBeLessThanOrEqual(1);
	});
	it("does not move when dormant", () => {
		const m = createMonster("goblin", 0, 0, 0);
		moveMonsterTowards(m, 10, 0, 1);
		expect(m.x).toBe(0);
	});
});

describe("createMonsterModel", () => {
	const kinds: MonsterKind[] = [
		"skeleton",
		"zombie",
		"grimReaper",
		"goblin",
		"orc",
		"troll",
		"slime",
		"fireElemental",
		"lich",
	];
	for (const kind of kinds) {
		it(`builds a model with at least one mesh for ${kind}`, () => {
			const { group, flashMaterial } = createMonsterModel(kind);
			expect(group.children.length).toBeGreaterThan(0);
			expect(flashMaterial).toBeDefined();
		});
	}
});
