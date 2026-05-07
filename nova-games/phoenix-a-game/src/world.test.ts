import { describe, expect, it } from "vitest";
import {
	COLS,
	generateLevel1Grid,
	HALLWAY_EDGES,
	hasHallway,
	ROOM_SIZE,
	ROWS,
	roomCenter,
} from "./world";

describe("generateLevel1Grid", () => {
	const grid = generateLevel1Grid();

	it("produces 18 rooms", () => {
		expect(grid.rooms).toHaveLength(COLS * ROWS);
		expect(COLS * ROWS).toBe(18);
	});

	it("centers the grid on the origin", () => {
		const xs = grid.rooms.map((r) => r.centerX);
		const zs = grid.rooms.map((r) => r.centerZ);
		expect(Math.min(...xs) + Math.max(...xs)).toBeCloseTo(0, 5);
		expect(Math.min(...zs) + Math.max(...zs)).toBeCloseTo(0, 5);
	});

	it("blocks adjacent rooms that are NOT connected by a hallway with a solid wall", () => {
		// Rooms 0 and 3 are at (row 0, col 0) and (row 1, col 0). No edge in
		// HALLWAY_EDGES between them, so the wall between them must be solid.
		expect(hasHallway(0, 3)).toBe(false);
		const r0 = roomCenter(0, 0);
		const wallZ = r0.z + ROOM_SIZE / 2;
		const at = (x: number, z: number) =>
			grid.walls.some(
				(w) => x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ,
			);
		expect(at(r0.x, wallZ)).toBe(true);
	});

	it("opens a doorway between rooms connected by a hallway", () => {
		// Rooms 1 and 4 ARE connected (col 1, row 0 → row 1).
		expect(hasHallway(1, 4)).toBe(true);
		const r1 = roomCenter(0, 1);
		const wallZ = r1.z + ROOM_SIZE / 2;
		const at = (x: number, z: number) =>
			grid.walls.some(
				(w) => x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ,
			);
		expect(at(r1.x, wallZ)).toBe(false);
	});

	it("makes every room reachable from the spawn (room 1) via hallway edges", () => {
		const adj = new Map<number, number[]>();
		const ensure = (k: number): number[] => {
			const list = adj.get(k);
			if (list) return list;
			const fresh: number[] = [];
			adj.set(k, fresh);
			return fresh;
		};
		for (const [a, b] of HALLWAY_EDGES) {
			ensure(a).push(b);
			ensure(b).push(a);
		}
		const visited = new Set<number>([1]);
		const queue: number[] = [1];
		while (queue.length > 0) {
			const v = queue.shift() as number;
			for (const n of adj.get(v) ?? []) {
				if (!visited.has(n)) {
					visited.add(n);
					queue.push(n);
				}
			}
		}
		expect(visited.size).toBe(COLS * ROWS);
	});
});
