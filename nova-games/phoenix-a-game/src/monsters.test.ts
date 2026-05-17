import { describe, expect, it } from "vitest";
import {
	createMonster,
	createMonsterModel,
	isBossKind,
	type MonsterKind,
	moveMonsterTowards,
} from "./monsters";
import type { Item } from "./state";

const STUB_SWORD: Item = { kind: "sword", quality: 1 };
const STUB_BOW: Item = { kind: "bow", quality: 1 };

describe("createMonster", () => {
	it("returns kind-appropriate stats and stores the weapon", () => {
		const sk = createMonster("skeleton", 0, 0, 0, STUB_SWORD);
		expect(sk.kind).toBe("skeleton");
		expect(sk.dormant).toBe(true);
		expect(sk.weapon).toEqual(STUB_SWORD);
		const reaper = createMonster("grimReaper", 0, 0, 0, STUB_SWORD);
		expect(reaper.dormant).toBe(false);
	});
	it("seeds nextShotAt to 0 for bow wielders", () => {
		const archer = createMonster("goblin", 0, 0, 0, STUB_BOW);
		expect(archer.nextShotAt).toBe(0);
	});
	it("does not seed nextShotAt for sword wielders", () => {
		const slasher = createMonster("orc", 0, 0, 0, STUB_SWORD);
		expect(slasher.nextShotAt).toBeUndefined();
	});
	it("identifies boss kinds", () => {
		expect(isBossKind("grimReaper")).toBe(true);
		expect(isBossKind("minotaur")).toBe(true);
		expect(isBossKind("lich")).toBe(true);
		expect(isBossKind("skeleton")).toBe(false);
		expect(isBossKind("slime")).toBe(false);
	});
});

describe("moveMonsterTowards", () => {
	it("walks toward the target at its speed", () => {
		const m = createMonster("goblin", 0, 0, 0, STUB_SWORD);
		m.dormant = false;
		moveMonsterTowards(m, 10, 0, 1);
		expect(m.x).toBeCloseTo(m.speed, 5);
	});
	it("does not overshoot the target", () => {
		const m = createMonster("goblin", 0, 0, 0, STUB_SWORD);
		m.dormant = false;
		m.speed = 100;
		moveMonsterTowards(m, 1, 0, 1);
		expect(m.x).toBeLessThanOrEqual(1);
	});
	it("does not move when dormant", () => {
		const m = createMonster("goblin", 0, 0, 0, STUB_SWORD);
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
		"minotaur",
		"slime",
		"fireElemental",
		"lich",
	];
	for (const kind of kinds) {
		it(`builds a model with at least one mesh for ${kind}`, () => {
			const { group, flashMaterial } = createMonsterModel(kind, STUB_SWORD);
			expect(group.children.length).toBeGreaterThan(0);
			expect(flashMaterial).toBeDefined();
		});
	}
});
