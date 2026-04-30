import { describe, expect, it } from "vitest";
import { createSwing, SWING_DURATION, startSwing, updateSwing } from "./combat";
import type { Monster } from "./monsters";

function makeGoblin(x: number, z: number): Monster {
	return {
		kind: "goblin",
		roomIndex: 0,
		x,
		z,
		hp: 2,
		speed: 3,
		radius: 0.4,
		contact: 0.9,
		damage: 0.5,
		dormant: false,
	};
}

describe("updateSwing", () => {
	const midSwing = SWING_DURATION * 0.5;

	it("damages a monster directly in front of the player", () => {
		const swing = createSwing();
		startSwing(swing, 0);
		const m = makeGoblin(0, -1);
		updateSwing(swing, midSwing, 1, 0, -1, 0, 0, [m]);
		expect(m.hp).toBe(1);
	});

	it("does not damage a monster behind the player", () => {
		const swing = createSwing();
		startSwing(swing, 0);
		const m = makeGoblin(0, 1);
		updateSwing(swing, midSwing, 1, 0, -1, 0, 0, [m]);
		expect(m.hp).toBe(2);
	});

	it("does not damage a monster outside the lateral hitbox", () => {
		const swing = createSwing();
		startSwing(swing, 0);
		const m = makeGoblin(2, -1);
		updateSwing(swing, midSwing, 1, 0, -1, 0, 0, [m]);
		expect(m.hp).toBe(2);
	});

	it("only hits a monster once per swing", () => {
		const swing = createSwing();
		startSwing(swing, 0);
		const m = makeGoblin(0, -1);
		updateSwing(swing, SWING_DURATION * 0.3, 1, 0, -1, 0, 0, [m]);
		updateSwing(swing, SWING_DURATION * 0.5, 1, 0, -1, 0, 0, [m]);
		updateSwing(swing, SWING_DURATION * 0.7, 1, 0, -1, 0, 0, [m]);
		expect(m.hp).toBe(1);
	});

	it("deactivates the swing once duration elapses", () => {
		const swing = createSwing();
		startSwing(swing, 0);
		updateSwing(swing, SWING_DURATION + 0.01, 1, 0, -1, 0, 0, []);
		expect(swing.active).toBe(false);
	});
});
