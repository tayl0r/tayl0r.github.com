import { describe, expect, it } from "vitest";
import { type Monster, moveMonsterTowards } from "./monsters";

function makeGoblin(speed = 2): Monster {
	return {
		kind: "goblin",
		roomIndex: 0,
		x: 0,
		z: 0,
		hp: 2,
		speed,
		radius: 0.4,
		contact: 0.5,
		damage: 0,
		dormant: false,
	};
}

describe("moveMonsterTowards", () => {
	it("walks toward the player at its speed", () => {
		const m = makeGoblin(2);
		moveMonsterTowards(m, 10, 0, 1);
		expect(m.x).toBeCloseTo(2, 5);
	});
	it("does not overshoot the player", () => {
		const m = makeGoblin(100);
		moveMonsterTowards(m, 1, 0, 1);
		expect(m.x).toBeLessThanOrEqual(1);
	});
	it("does not move when dormant", () => {
		const m = makeGoblin(2);
		m.dormant = true;
		moveMonsterTowards(m, 10, 0, 1);
		expect(m.x).toBe(0);
	});
});
