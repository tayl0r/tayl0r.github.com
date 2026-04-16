import { describe, expect, it } from "vitest";
import { computeVelocity } from "./player";

describe("computeVelocity", () => {
	it("is zero with no keys held", () => {
		const v = computeVelocity(
			{ w: false, a: false, s: false, d: false },
			false,
			0,
		);
		expect(v.x).toBe(0);
		expect(v.z).toBe(0);
	});
	it("moves forward along -Z when w is held", () => {
		const v = computeVelocity(
			{ w: true, a: false, s: false, d: false },
			false,
			0,
		);
		expect(v.z).toBeLessThan(0);
		expect(v.x).toBe(0);
	});
	it("sprint (shift) doubles speed", () => {
		const walk = computeVelocity(
			{ w: true, a: false, s: false, d: false },
			false,
			0,
		);
		const run = computeVelocity(
			{ w: true, a: false, s: false, d: false },
			true,
			0,
		);
		expect(Math.abs(run.z)).toBeCloseTo(Math.abs(walk.z) * 2, 5);
	});
	it("is rotated by camera yaw", () => {
		const v = computeVelocity(
			{ w: true, a: false, s: false, d: false },
			false,
			Math.PI / 2,
		);
		expect(v.x).toBeLessThan(-0.5);
		expect(Math.abs(v.z)).toBeLessThan(0.01);
	});
});
