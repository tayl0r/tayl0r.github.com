import { describe, expect, it } from "vitest";
import { LEVELS } from "./levels";
import {
	buildEdgeSet,
	COLS,
	generateGrid,
	hasHallway,
	ROOM_SIZE,
	ROWS,
	roomAt,
	roomCenter,
	roomIndex,
} from "./world";

describe("generateGrid (level 1)", () => {
	const level = LEVELS[0];
	const grid = generateGrid(level.hallwayEdges);
	const edgeSet = buildEdgeSet(level.hallwayEdges);

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

	it("blocks adjacent rooms NOT in hallwayEdges with a solid wall", () => {
		expect(hasHallway(edgeSet, 0, 3)).toBe(false);
		const r0 = roomCenter(0, 0);
		const wallZ = r0.z + ROOM_SIZE / 2;
		const at = (x: number, z: number) =>
			grid.walls.some(
				(w) => x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ,
			);
		expect(at(r0.x, wallZ)).toBe(true);
	});

	it("opens a doorway between rooms in hallwayEdges", () => {
		expect(hasHallway(edgeSet, 1, 4)).toBe(true);
		const r1 = roomCenter(0, 1);
		const wallZ = r1.z + ROOM_SIZE / 2;
		const at = (x: number, z: number) =>
			grid.walls.some(
				(w) => x >= w.minX && x <= w.maxX && z >= w.minZ && z <= w.maxZ,
			);
		expect(at(r1.x, wallZ)).toBe(false);
	});
});

describe("roomAt", () => {
	it("returns the room index when standing in the room center", () => {
		for (let row = 0; row < ROWS; row++) {
			for (let col = 0; col < COLS; col++) {
				const c = roomCenter(row, col);
				expect(roomAt(c.x, c.z)).toBe(roomIndex(row, col));
			}
		}
	});
	it("returns null when standing in the hallway between two rooms", () => {
		const a = roomCenter(0, 0);
		const b = roomCenter(0, 1);
		const midX = (a.x + b.x) / 2;
		expect(roomAt(midX, a.z)).toBeNull();
	});
	it("returns null when standing outside the grid", () => {
		expect(roomAt(1000, 0)).toBeNull();
		expect(roomAt(0, 1000)).toBeNull();
	});
});

describe("LEVELS reachability", () => {
	for (const level of LEVELS) {
		it(`every room in "${level.name}" is reachable from the spawn`, () => {
			const adj = new Map<number, number[]>();
			const ensure = (k: number): number[] => {
				const list = adj.get(k);
				if (list) return list;
				const fresh: number[] = [];
				adj.set(k, fresh);
				return fresh;
			};
			for (const [a, b] of level.hallwayEdges) {
				ensure(a).push(b);
				ensure(b).push(a);
			}
			const visited = new Set<number>([level.spawn]);
			const queue: number[] = [level.spawn];
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
	}
});
