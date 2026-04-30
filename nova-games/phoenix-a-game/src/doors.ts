import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import type { Aabb } from "./collision";

const ROOM = 16;
const DOORWAY_WIDTH = 4;
const WALL_THICKNESS = 1;
const DOOR_HEIGHT = 3;

export interface Door {
	roomIndex: number;
	open: boolean;
	aabb: Aabb;
	centerX: number;
	centerZ: number;
	mesh: Mesh;
}

interface DoorSpec {
	roomIndex: number;
	centerX: number;
	centerZ: number;
	horizontal: boolean;
}

const SPECS: DoorSpec[] = [
	{ roomIndex: 0, centerX: -ROOM / 2, centerZ: -ROOM, horizontal: false },
	{ roomIndex: 2, centerX: ROOM / 2, centerZ: -ROOM, horizontal: false },
	{ roomIndex: 4, centerX: 0, centerZ: -ROOM / 2, horizontal: true },
	{ roomIndex: 3, centerX: -ROOM, centerZ: -ROOM / 2, horizontal: true },
	{ roomIndex: 5, centerX: ROOM, centerZ: -ROOM / 2, horizontal: true },
	{ roomIndex: 6, centerX: -ROOM, centerZ: ROOM / 2, horizontal: true },
	{ roomIndex: 7, centerX: 0, centerZ: ROOM / 2, horizontal: true },
	{ roomIndex: 8, centerX: ROOM, centerZ: ROOM / 2, horizontal: true },
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
		roomIndex: s.roomIndex,
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
