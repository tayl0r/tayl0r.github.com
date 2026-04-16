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

const ROOM_SIZE = 16;
const WALL_THICKNESS = 1;
const DOORWAY_WIDTH = 4;

export function generate3x3Grid(): WorldGrid {
	const rooms: Room[] = [];
	for (let row = 0; row < 3; row++) {
		for (let col = 0; col < 3; col++) {
			rooms.push({
				col,
				row,
				centerX: (col - 1) * ROOM_SIZE,
				centerZ: (row - 1) * ROOM_SIZE,
			});
		}
	}

	const walls: Aabb[] = [];
	const half = ROOM_SIZE / 2;
	const halfDoor = DOORWAY_WIDTH / 2;
	const t = WALL_THICKNESS / 2;

	// Horizontal walls (split by vertical doorways to cross between rows)
	for (let row = 0; row <= 3; row++) {
		const z = (row - 1.5) * ROOM_SIZE;
		for (let col = 0; col < 3; col++) {
			const centerX = (col - 1) * ROOM_SIZE;
			const left = centerX - half;
			const right = centerX + half;
			const interior = row !== 0 && row !== 3;
			if (interior) {
				walls.push({
					minX: left,
					maxX: centerX - halfDoor,
					minZ: z - t,
					maxZ: z + t,
				});
				walls.push({
					minX: centerX + halfDoor,
					maxX: right,
					minZ: z - t,
					maxZ: z + t,
				});
			} else {
				walls.push({ minX: left, maxX: right, minZ: z - t, maxZ: z + t });
			}
		}
	}

	// Vertical walls
	for (let col = 0; col <= 3; col++) {
		const x = (col - 1.5) * ROOM_SIZE;
		for (let row = 0; row < 3; row++) {
			const centerZ = (row - 1) * ROOM_SIZE;
			const top = centerZ - half;
			const bottom = centerZ + half;
			const interior = col !== 0 && col !== 3;
			if (interior) {
				walls.push({
					minX: x - t,
					maxX: x + t,
					minZ: top,
					maxZ: centerZ - halfDoor,
				});
				walls.push({
					minX: x - t,
					maxX: x + t,
					minZ: centerZ + halfDoor,
					maxZ: bottom,
				});
			} else {
				walls.push({ minX: x - t, maxX: x + t, minZ: top, maxZ: bottom });
			}
		}
	}

	return { rooms, walls };
}
