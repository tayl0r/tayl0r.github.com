import { describe, expect, it } from "vitest";
import { createInitialState } from "./state";

describe("createInitialState", () => {
	it("starts with 3 hearts, 20 stamina, 10 hunger", () => {
		const s = createInitialState();
		expect(s.player.health).toBe(3);
		expect(s.player.maxHealth).toBe(3);
		expect(s.player.stamina).toBe(20);
		expect(s.player.maxStamina).toBe(20);
		expect(s.player.hunger).toBe(10);
		expect(s.player.maxHunger).toBe(10);
	});
});
