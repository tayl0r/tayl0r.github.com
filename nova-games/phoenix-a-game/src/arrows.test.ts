import { describe, expect, it } from "vitest";
import {
	ARROW_GRAVITY,
	ARROW_SPEED,
	arrowExpired,
	arrowHitsAabb,
	arrowHitsCircleXZ,
	createArrow,
	updateArrow,
} from "./arrows";

describe("createArrow", () => {
	it("normalizes the direction and applies ARROW_SPEED", () => {
		const a = createArrow(0, 0, 0, 0, 0, -2, 1, 0xffffff, 0);
		expect(a.vx).toBe(0);
		expect(a.vy).toBe(0);
		expect(a.vz).toBeCloseTo(-ARROW_SPEED, 5);
	});
});

describe("updateArrow", () => {
	it("applies gravity over time, dropping the arrow", () => {
		const a = createArrow(0, 5, 0, 0, 0, -1, 1, 0xffffff, 0);
		updateArrow(a, 0.5);
		expect(a.vy).toBeCloseTo(-ARROW_GRAVITY * 0.5, 5);
		expect(a.y).toBeLessThan(5);
	});
	it("dies when it hits the floor (y<=0)", () => {
		const a = createArrow(0, 0.1, 0, 0, -1, 0, 1, 0xffffff, 0);
		updateArrow(a, 0.5);
		expect(a.alive).toBe(false);
	});
});

describe("arrowHitsAabb", () => {
	it("detects an arrow inside a wall's xz footprint", () => {
		const a = createArrow(0, 1, 0, 1, 0, 0, 1, 0xffffff, 0);
		expect(arrowHitsAabb(a, [{ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }])).toBe(
			true,
		);
	});
	it("ignores walls the arrow has not entered", () => {
		const a = createArrow(0, 1, 0, 1, 0, 0, 1, 0xffffff, 0);
		expect(arrowHitsAabb(a, [{ minX: 5, maxX: 6, minZ: 5, maxZ: 6 }])).toBe(
			false,
		);
	});
});

describe("arrowHitsCircleXZ", () => {
	it("hits when within radius and within vertical bounds", () => {
		const a = createArrow(0, 1, 0, 1, 0, 0, 1, 0xffffff, 0);
		a.x = 0.4;
		expect(arrowHitsCircleXZ(a, 0, 0, 0.5)).toBe(true);
	});
	it("misses when too high above the target", () => {
		const a = createArrow(0, 10, 0, 1, 0, 0, 1, 0xffffff, 0);
		expect(arrowHitsCircleXZ(a, 0, 0, 0.5)).toBe(false);
	});
});

describe("arrowExpired", () => {
	it("expires after ARROW_LIFETIME seconds", () => {
		const a = createArrow(0, 1, 0, 1, 0, 0, 1, 0xffffff, 0);
		expect(arrowExpired(a, 1)).toBe(false);
		expect(arrowExpired(a, 5)).toBe(true);
	});
});
