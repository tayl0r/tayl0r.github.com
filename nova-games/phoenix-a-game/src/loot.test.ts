import { describe, expect, it } from "vitest";
import { rollDrop } from "./loot";

describe("rollDrop", () => {
	it("rolls food, sword, and bow in roughly 40/30/30 proportion", () => {
		let food = 0;
		let sword = 0;
		let bow = 0;
		let rng = 0;
		const fakeRandom = () => {
			rng += 0.01;
			return rng % 1;
		};
		for (let i = 0; i < 100; i++) {
			const d = rollDrop(fakeRandom);
			if (d === "food") food++;
			else if (d === "sword") sword++;
			else if (d === "bow") bow++;
		}
		expect(food).toBeGreaterThan(30);
		expect(sword).toBeGreaterThan(20);
		expect(bow).toBeGreaterThan(20);
	});
	it("gives sword and bow the same chance", () => {
		let sword = 0;
		let bow = 0;
		let rng = 0;
		const fakeRandom = () => {
			rng += 0.01;
			return rng % 1;
		};
		for (let i = 0; i < 1000; i++) {
			const d = rollDrop(fakeRandom);
			if (d === "sword") sword++;
			else if (d === "bow") bow++;
		}
		expect(Math.abs(sword - bow)).toBeLessThanOrEqual(20);
	});
	it("boss chest is always a sword", () => {
		for (let i = 0; i < 10; i++) {
			expect(rollDrop(Math.random, true)).toBe("sword");
		}
	});
});
