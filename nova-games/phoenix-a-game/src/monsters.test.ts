import { describe, expect, it } from "vitest";
import { type Monster, moveMonsterTowards } from "./monsters";

describe("moveMonsterTowards", () => {
	it("walks toward the player at its speed", () => {
		const m: Monster = {
			kind: "goblin",
			x: 0,
			z: 0,
			hp: 2,
			speed: 2,
			radius: 0.4,
			contact: 0.5,
			damage: 0,
		};
		moveMonsterTowards(m, 10, 0, 1);
		expect(m.x).toBeCloseTo(2, 5);
	});
	it("does not overshoot the player", () => {
		const m: Monster = {
			kind: "goblin",
			x: 0,
			z: 0,
			hp: 2,
			speed: 100,
			radius: 0.4,
			contact: 0.5,
			damage: 0,
		};
		moveMonsterTowards(m, 1, 0, 1);
		expect(m.x).toBeLessThanOrEqual(1);
	});
});
