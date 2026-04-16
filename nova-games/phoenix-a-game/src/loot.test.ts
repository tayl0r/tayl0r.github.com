import { describe, expect, it } from "vitest";
import { rollDrop } from "./loot";

describe("rollDrop", () => {
	it("returns 'food' most of the time and 'sword' otherwise", () => {
		let food = 0;
		let sword = 0;
		let rng = 0;
		const fakeRandom = () => {
			rng += 0.01;
			return rng % 1;
		};
		for (let i = 0; i < 100; i++) {
			const d = rollDrop(fakeRandom);
			if (d === "food") food++;
			if (d === "sword") sword++;
		}
		expect(food).toBeGreaterThan(50);
		expect(sword).toBeGreaterThan(20);
	});
	it("boss chest is always a sword", () => {
		for (let i = 0; i < 10; i++) {
			expect(rollDrop(Math.random, true)).toBe("sword");
		}
	});
});
