import { describe, expect, it } from "vitest";
import { generate3x3Grid } from "./world";

describe("generate3x3Grid", () => {
	const grid = generate3x3Grid();
	it("produces exactly 9 rooms centered on a 48x48 area", () => {
		expect(grid.rooms).toHaveLength(9);
		const xs = grid.rooms.map((r) => r.centerX);
		expect(Math.min(...xs)).toBeCloseTo(-16, 5);
		expect(Math.max(...xs)).toBeCloseTo(16, 5);
	});
	it("produces wall AABBs with a doorway gap between adjacent rooms", () => {
		// Walk along y=0, z=0 (middle row): we must be able to get from
		// room (0,1) to room (1,1) through a doorway. This means there
		// must be NO wall AABB covering the point (0, 0) with z=0.
		const at = (x: number, z: number) =>
			grid.walls.some(
				(w) => x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ,
			);
		expect(at(-8, 0)).toBe(false);
		expect(at(0, 0)).toBe(false);
		expect(at(8, 0)).toBe(false);
	});
});
