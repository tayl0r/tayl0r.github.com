import { describe, expect, it } from "vitest";
import { rollItemDrop } from "./loot";

function deterministicRng(seed = 0): () => number {
	let x = seed;
	return () => {
		x = (x * 1103515245 + 12345) & 0x7fffffff;
		return (x / 0x80000000) % 1;
	};
}

describe("rollItemDrop kind distribution (normal chest)", () => {
	it("produces only sword/bow/food", () => {
		const rng = deterministicRng(1);
		for (let i = 0; i < 200; i++) {
			const item = rollItemDrop(rng, 0, false);
			expect(["sword", "bow", "food"]).toContain(item.kind);
		}
	});
	it("never returns food for a boss chest", () => {
		const rng = deterministicRng(2);
		for (let i = 0; i < 200; i++) {
			const item = rollItemDrop(rng, 0, true);
			expect(item.kind === "food").toBe(false);
		}
	});
});

describe("rollItemDrop quality curve", () => {
	it("floor 0 produces mostly common", () => {
		const rng = deterministicRng(3);
		let common = 0;
		let total = 0;
		for (let i = 0; i < 2000; i++) {
			const item = rollItemDrop(rng, 0, false);
			if (item.kind === "food") continue;
			total++;
			if (item.quality === 1) common++;
		}
		expect(common / total).toBeGreaterThan(0.4);
	});
	it("floor 4+ produces meaningful rare/epic/legendary", () => {
		const rng = deterministicRng(4);
		let highTier = 0;
		let total = 0;
		for (let i = 0; i < 2000; i++) {
			const item = rollItemDrop(rng, 4, false);
			if (item.kind === "food") continue;
			total++;
			if (item.quality >= 3) highTier++;
		}
		expect(highTier / total).toBeGreaterThan(0.5);
	});
	it("never produces godly on floor 0", () => {
		const rng = deterministicRng(5);
		for (let i = 0; i < 500; i++) {
			const item = rollItemDrop(rng, 0, false);
			if (item.kind !== "food") {
				expect(item.quality).toBeLessThan(6);
			}
		}
	});
	it("clamps to last band past floor 4", () => {
		const rng1 = deterministicRng(6);
		const rng2 = deterministicRng(6);
		const a = rollItemDrop(rng1, 4, false);
		const b = rollItemDrop(rng2, 99, false);
		expect(a).toEqual(b);
	});
	it("returns a valid Quality between 1 and 6", () => {
		const rng = deterministicRng(7);
		for (let i = 0; i < 200; i++) {
			const item = rollItemDrop(rng, 2, false);
			if (item.kind === "food") {
				expect(item.quality).toBe(1);
			} else {
				expect(item.quality).toBeGreaterThanOrEqual(1);
				expect(item.quality).toBeLessThanOrEqual(6);
			}
		}
	});
	it("boss chest on floor N rolls quality like floor N+1", () => {
		// Boss at floor 0 should sometimes roll legendary; floor 0 non-boss never does
		const rng = deterministicRng(8);
		let legendaryOrAbove = 0;
		for (let i = 0; i < 3000; i++) {
			const item = rollItemDrop(rng, 0, true);
			if (item.quality >= 5) legendaryOrAbove++;
		}
		expect(legendaryOrAbove).toBeGreaterThan(0);
	});
});
