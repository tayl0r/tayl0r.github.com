import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import type { Aabb } from "./collision";

const ROOM = 16;
const DOORWAY_WIDTH = 4;
const WALL_THICKNESS = 1;
const DOOR_HEIGHT = 3;

export interface Door {
	roomIndices: readonly [number, number];
	open: boolean;
	aabb: Aabb;
	centerX: number;
	centerZ: number;
	mesh: Mesh;
}

interface DoorSpec {
	roomA: number;
	roomB: number;
	centerX: number;
	centerZ: number;
	horizontal: boolean;
}

const SPECS: DoorSpec[] = [
	// Doors in vertical-running walls (block east-west passage)
	{ roomA: 0, roomB: 1, centerX: -ROOM / 2, centerZ: -ROOM, horizontal: false },
	{ roomA: 1, roomB: 2, centerX: ROOM / 2, centerZ: -ROOM, horizontal: false },
	{ roomA: 3, roomB: 4, centerX: -ROOM / 2, centerZ: 0, horizontal: false },
	{ roomA: 4, roomB: 5, centerX: ROOM / 2, centerZ: 0, horizontal: false },
	{ roomA: 6, roomB: 7, centerX: -ROOM / 2, centerZ: ROOM, horizontal: false },
	{ roomA: 7, roomB: 8, centerX: ROOM / 2, centerZ: ROOM, horizontal: false },
	// Doors in horizontal-running walls (block north-south passage)
	{ roomA: 0, roomB: 3, centerX: -ROOM, centerZ: -ROOM / 2, horizontal: true },
	{ roomA: 1, roomB: 4, centerX: 0, centerZ: -ROOM / 2, horizontal: true },
	{ roomA: 2, roomB: 5, centerX: ROOM, centerZ: -ROOM / 2, horizontal: true },
	{ roomA: 3, roomB: 6, centerX: -ROOM, centerZ: ROOM / 2, horizontal: true },
	{ roomA: 4, roomB: 7, centerX: 0, centerZ: ROOM / 2, horizontal: true },
	{ roomA: 5, roomB: 8, centerX: ROOM, centerZ: ROOM / 2, horizontal: true },
];

export function createDoors(): Door[] {
	return SPECS.map(doorFromSpec);
}

function doorFromSpec(s: DoorSpec): Door {
	const halfDoor = DOORWAY_WIDTH / 2;
	const t = WALL_THICKNESS / 2;
	const aabb: Aabb = s.horizontal
		? {
				minX: s.centerX - halfDoor,
				maxX: s.centerX + halfDoor,
				minZ: s.centerZ - t,
				maxZ: s.centerZ + t,
			}
		: {
				minX: s.centerX - t,
				maxX: s.centerX + t,
				minZ: s.centerZ - halfDoor,
				maxZ: s.centerZ + halfDoor,
			};
	const geomW = s.horizontal ? DOORWAY_WIDTH : WALL_THICKNESS;
	const geomD = s.horizontal ? WALL_THICKNESS : DOORWAY_WIDTH;
	const mesh = new Mesh(
		new BoxGeometry(geomW, DOOR_HEIGHT, geomD),
		new MeshStandardMaterial({ color: 0x8b4513 }),
	);
	mesh.position.set(s.centerX, DOOR_HEIGHT / 2, s.centerZ);
	return {
		roomIndices: [s.roomA, s.roomB],
		open: false,
		aabb,
		centerX: s.centerX,
		centerZ: s.centerZ,
		mesh,
	};
}

export function openDoor(door: Door): void {
	if (door.open) return;
	door.open = true;
	door.mesh.visible = false;
}
