import { describe, expect, it } from "vitest";
import { type Aabb, resolveAll, resolveCircleVsAabb } from "./collision";

describe("resolveCircleVsAabb", () => {
	const wall = { minX: 0, maxX: 2, minZ: 0, maxZ: 10 };
	it("no push when circle is clear of the box", () => {
		const p = resolveCircleVsAabb(-5, 5, 0.5, wall);
		expect(p.x).toBe(-5);
		expect(p.z).toBe(5);
	});
	it("pushes out to the left when overlapping the left edge", () => {
		const p = resolveCircleVsAabb(-0.1, 5, 0.5, wall);
		expect(p.x).toBeCloseTo(-0.5, 5);
		expect(p.z).toBe(5);
	});
	it("pushes out along the nearest axis", () => {
		const p = resolveCircleVsAabb(1.9, 5, 0.5, wall);
		expect(p.x).toBeCloseTo(2.5, 5);
	});
});

describe("resolveAll", () => {
	it("settles at an L-corner without leaving the player inside either wall", () => {
		// Two perpendicular walls forming an inner corner at (10, 10).
		// Horizontal wall: spans x [0,10], z [10,11]
		// Vertical wall:   spans x [10,11], z [0,11]
		const walls: Aabb[] = [
			{ minX: 0, maxX: 10, minZ: 10, maxZ: 11 },
			{ minX: 10, maxX: 11, minZ: 0, maxZ: 11 },
		];
		// Player overlapping both walls in the corner.
		const p = resolveAll(9.7, 10.3, 0.5, walls);
		const insideHorizontal =
			p.x > walls[0].minX - 0.5 &&
			p.x < walls[0].maxX + 0.5 &&
			p.z > walls[0].minZ - 0.5 &&
			p.z < walls[0].maxZ + 0.5;
		const insideVertical =
			p.x > walls[1].minX - 0.5 &&
			p.x < walls[1].maxX + 0.5 &&
			p.z > walls[1].minZ - 0.5 &&
			p.z < walls[1].maxZ + 0.5;
		expect(insideHorizontal && insideVertical).toBe(false);
	});
});
