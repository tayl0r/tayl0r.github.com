import type { Aabb } from "./collision";

export interface Room {
	col: number;
	row: number;
	centerX: number;
	centerZ: number;
}

export interface WorldGrid {
	rooms: Room[];
	walls: Aabb[];
}

export const ROOM_SIZE = 14;
export const HALL_LENGTH = 8;
export const PITCH = ROOM_SIZE + HALL_LENGTH;
export const DOORWAY_WIDTH = 4;
export const COLS = 3;
export const ROWS = 6;
const WALL_THICKNESS = 1;

export const HALLWAY_EDGES: ReadonlyArray<readonly [number, number]> = [
	[0, 1],
	[1, 2],
	[1, 4],
	[3, 6],
	[4, 5],
	[5, 8],
	[6, 7],
	[6, 9],
	[7, 10],
	[8, 11],
	[9, 12],
	[10, 13],
	[11, 14],
	[12, 15],
	[13, 14],
	[13, 16],
	[14, 17],
	[15, 16],
	[16, 17],
];

const edgeKey = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const EDGE_SET = new Set(HALLWAY_EDGES.map(([a, b]) => edgeKey(a, b)));

export function roomIndex(row: number, col: number): number {
	return row * COLS + col;
}

export function roomCenter(row: number, col: number): { x: number; z: number } {
	return {
		x: (col - (COLS - 1) / 2) * PITCH,
		z: (row - (ROWS - 1) / 2) * PITCH,
	};
}

export function hasHallway(a: number, b: number): boolean {
	return EDGE_SET.has(edgeKey(a, b));
}

export function generateLevel1Grid(): WorldGrid {
	const rooms: Room[] = [];
	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			const { x, z } = roomCenter(row, col);
			rooms.push({ col, row, centerX: x, centerZ: z });
		}
	}

	const walls: Aabb[] = [];
	const half = ROOM_SIZE / 2;
	const halfDoor = DOORWAY_WIDTH / 2;
	const t = WALL_THICKNESS / 2;

	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			const idx = roomIndex(row, col);
			const { x, z } = roomCenter(row, col);
			const left = x - half;
			const right = x + half;
			const top = z - half;
			const bottom = z + half;
			const openNorth = row > 0 && hasHallway(idx, roomIndex(row - 1, col));
			const openSouth =
				row < ROWS - 1 && hasHallway(idx, roomIndex(row + 1, col));
			const openWest = col > 0 && hasHallway(idx, roomIndex(row, col - 1));
			const openEast =
				col < COLS - 1 && hasHallway(idx, roomIndex(row, col + 1));

			if (openNorth) {
				walls.push({
					minX: left,
					maxX: x - halfDoor,
					minZ: top - t,
					maxZ: top + t,
				});
				walls.push({
					minX: x + halfDoor,
					maxX: right,
					minZ: top - t,
					maxZ: top + t,
				});
			} else {
				walls.push({ minX: left, maxX: right, minZ: top - t, maxZ: top + t });
			}

			if (openSouth) {
				walls.push({
					minX: left,
					maxX: x - halfDoor,
					minZ: bottom - t,
					maxZ: bottom + t,
				});
				walls.push({
					minX: x + halfDoor,
					maxX: right,
					minZ: bottom - t,
					maxZ: bottom + t,
				});
			} else {
				walls.push({
					minX: left,
					maxX: right,
					minZ: bottom - t,
					maxZ: bottom + t,
				});
			}

			if (openWest) {
				walls.push({
					minX: left - t,
					maxX: left + t,
					minZ: top,
					maxZ: z - halfDoor,
				});
				walls.push({
					minX: left - t,
					maxX: left + t,
					minZ: z + halfDoor,
					maxZ: bottom,
				});
			} else {
				walls.push({ minX: left - t, maxX: left + t, minZ: top, maxZ: bottom });
			}

			if (openEast) {
				walls.push({
					minX: right - t,
					maxX: right + t,
					minZ: top,
					maxZ: z - halfDoor,
				});
				walls.push({
					minX: right - t,
					maxX: right + t,
					minZ: z + halfDoor,
					maxZ: bottom,
				});
			} else {
				walls.push({
					minX: right - t,
					maxX: right + t,
					minZ: top,
					maxZ: bottom,
				});
			}
		}
	}

	for (const [a, b] of HALLWAY_EDGES) {
		const lo = Math.min(a, b);
		const hi = Math.max(a, b);
		const rA = Math.floor(lo / COLS);
		const cA = lo % COLS;
		const rB = Math.floor(hi / COLS);
		const cB = hi % COLS;
		const cenA = roomCenter(rA, cA);
		const cenB = roomCenter(rB, cB);
		if (rA === rB) {
			const x1 = cenA.x + half;
			const x2 = cenB.x - half;
			walls.push({
				minX: x1,
				maxX: x2,
				minZ: cenA.z - halfDoor - t,
				maxZ: cenA.z - halfDoor + t,
			});
			walls.push({
				minX: x1,
				maxX: x2,
				minZ: cenA.z + halfDoor - t,
				maxZ: cenA.z + halfDoor + t,
			});
		} else {
			const z1 = cenA.z + half;
			const z2 = cenB.z - half;
			walls.push({
				minX: cenA.x - halfDoor - t,
				maxX: cenA.x - halfDoor + t,
				minZ: z1,
				maxZ: z2,
			});
			walls.push({
				minX: cenA.x + halfDoor - t,
				maxX: cenA.x + halfDoor + t,
				minZ: z1,
				maxZ: z2,
			});
		}
	}

	return { rooms, walls };
}
