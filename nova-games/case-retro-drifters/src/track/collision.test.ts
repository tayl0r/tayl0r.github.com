import { describe, expect, it } from "vitest";
import type { Waypoint } from "../types";
import { v2 } from "../types";
import { nearestSegment, offTrack, pointToSegment } from "./collision";

const loop: Waypoint[] = [
	{ pos: v2(0, 0), width: 4 },
	{ pos: v2(10, 0), width: 4 },
	{ pos: v2(10, 10), width: 4 },
	{ pos: v2(0, 10), width: 4 },
];

describe("pointToSegment", () => {
	it("distance to a point on the segment is 0", () => {
		const d = pointToSegment(v2(5, 0), v2(0, 0), v2(10, 0));
		expect(d.distance).toBeCloseTo(0);
		expect(d.t).toBeCloseTo(0.5);
	});

	it("perpendicular distance", () => {
		const d = pointToSegment(v2(5, 3), v2(0, 0), v2(10, 0));
		expect(d.distance).toBeCloseTo(3);
	});

	it("clamps before segment start", () => {
		const d = pointToSegment(v2(-2, 0), v2(0, 0), v2(10, 0));
		expect(d.distance).toBeCloseTo(2);
		expect(d.t).toBe(0);
	});
});

describe("nearestSegment", () => {
	it("finds closest segment of closed loop", () => {
		const n = nearestSegment(v2(5, 1), loop);
		expect(n.segmentIndex).toBe(0);
		expect(n.distance).toBeCloseTo(1);
	});
});

describe("offTrack", () => {
	it("point on centerline is on track", () => {
		expect(offTrack(v2(5, 0), loop)).toBe(false);
	});

	it("point well outside is off track", () => {
		expect(offTrack(v2(20, 5), loop)).toBe(true);
	});

	it("point just inside width is on track", () => {
		expect(offTrack(v2(5, 1.9), loop)).toBe(false);
	});
});
