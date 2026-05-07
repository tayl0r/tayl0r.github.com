import { describe, expect, it } from "vitest";
import { canAttack, consumeAttackStamina, createInitialState } from "./state";

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
