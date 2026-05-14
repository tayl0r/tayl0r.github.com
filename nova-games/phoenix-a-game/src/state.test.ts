import { describe, expect, it } from "vitest";
import {
	canAttack,
	consumeAttackStamina,
	createInitialState,
	damageOf,
	equippedItem,
	HOTBAR_SIZE,
	QUALITY_COLORS,
	QUALITY_NAMES,
} from "./state";

describe("createInitialState", () => {
	it("starts with 3 hearts and 100 stamina", () => {
		const s = createInitialState();
		expect(s.player.health).toBe(3);
		expect(s.player.maxHealth).toBe(3);
		expect(s.player.stamina).toBe(100);
		expect(s.player.maxStamina).toBe(100);
	});
	it("does not have a hunger field", () => {
		const s = createInitialState();
		expect("hunger" in s.player).toBe(false);
		expect("maxHunger" in s.player).toBe(false);
	});
});

describe("attack stamina", () => {
	it("permits attacks when stamina >= 1", () => {
		const s = createInitialState();
		expect(canAttack(s)).toBe(true);
	});
	it("blocks attacks when stamina < 1", () => {
		const s = createInitialState();
		s.player.stamina = 0;
		expect(canAttack(s)).toBe(false);
	});
	it("subtracts 1 stamina and records lastAttackAt", () => {
		const s = createInitialState();
		s.now = 5;
		consumeAttackStamina(s);
		expect(s.player.stamina).toBe(99);
		expect(s.player.lastAttackAt).toBe(5);
	});
	it("clamps stamina to 0 if drained below", () => {
		const s = createInitialState();
		s.player.stamina = 0.5;
		consumeAttackStamina(s);
		expect(s.player.stamina).toBe(0);
	});
});

describe("Item / Quality constants", () => {
	it("exposes 6 quality names in ascending order", () => {
		expect(QUALITY_NAMES).toEqual([
			"common",
			"uncommon",
			"rare",
			"epic",
			"legendary",
			"godly",
		]);
	});
	it("has a color per quality tier", () => {
		expect(QUALITY_COLORS).toHaveLength(6);
		for (const c of QUALITY_COLORS) {
			expect(typeof c).toBe("number");
		}
	});
	it("damageOf returns the quality number", () => {
		expect(damageOf(1)).toBe(1);
		expect(damageOf(6)).toBe(6);
	});
	it("HOTBAR_SIZE is 10", () => {
		expect(HOTBAR_SIZE).toBe(10);
	});
});

describe("initial hotbar", () => {
	it("starts with a common sword in slot 0 and nine empty slots", () => {
		const s = createInitialState();
		expect(s.player.hotbar).toHaveLength(10);
		expect(s.player.hotbar[0]).toEqual({ kind: "sword", quality: 1 });
		for (let i = 1; i < 10; i++) {
			expect(s.player.hotbar[i]).toBeNull();
		}
		expect(s.player.selectedSlot).toBe(0);
	});
	it("equippedItem returns the contents of the selected slot", () => {
		const s = createInitialState();
		expect(equippedItem(s)).toEqual({ kind: "sword", quality: 1 });
		s.player.hotbar[0] = null;
		expect(equippedItem(s)).toBeNull();
		s.player.hotbar[3] = { kind: "bow", quality: 4 };
		s.player.selectedSlot = 3;
		expect(equippedItem(s)).toEqual({ kind: "bow", quality: 4 });
	});
});
