import { describe, expect, it } from "vitest";
import { initialCarState } from "../car/physics";
import { type CarState, v2, type Waypoint } from "../types";
import { resolveWallCollision } from "./walls";

const segment: Waypoint[] = [
	{ pos: v2(0, 0), width: 10 },
	{ pos: v2(0, 100), width: 10 },
];

describe("resolveWallCollision", () => {
	it("is a no-op when car is within track", () => {
		const s: CarState = {
			...initialCarState(),
			position: v2(1, 50),
			velocity: v2(0, 20),
			speed: 20,
		};
		const r = resolveWallCollision(s, segment);
		expect(r.position.x).toBeCloseTo(1);
		expect(r.velocity.z).toBeCloseTo(20);
	});

	it("clamps position when car crosses wall buffer", () => {
		const s: CarState = {
			...initialCarState(),
			position: v2(6, 50),
			velocity: v2(5, 10),
			speed: 11,
		};
		const r = resolveWallCollision(s, segment);
		expect(r.position.x).toBeLessThanOrEqual(4.7);
	});

	it("reflects velocity going into wall", () => {
		const s: CarState = {
			...initialCarState(),
			position: v2(6, 50),
			velocity: v2(10, 5),
			speed: Math.hypot(10, 5),
		};
		const r = resolveWallCollision(s, segment);
		expect(r.velocity.x).toBeLessThan(0);
	});

	it("preserves along-wall velocity (mostly)", () => {
		const s: CarState = {
			...initialCarState(),
			position: v2(6, 50),
			velocity: v2(0, 20),
			speed: 20,
		};
		const r = resolveWallCollision(s, segment);
		expect(r.velocity.z).toBeGreaterThan(15);
	});

	it("kills drift state on impact", () => {
		const s: CarState = {
			...initialCarState(),
			position: v2(6, 50),
			velocity: v2(5, 10),
			speed: 11,
			isDrifting: true,
			grip: 0.3,
		};
		const r = resolveWallCollision(s, segment);
		expect(r.isDrifting).toBe(false);
		expect(r.grip).toBe(1);
	});
});
