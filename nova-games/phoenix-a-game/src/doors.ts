import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";
import type { Aabb } from "./collision";
import { COLS, DOORWAY_WIDTH, HALLWAY_EDGES, roomCenter } from "./world";

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

function generateDoorSpecs(): DoorSpec[] {
	return HALLWAY_EDGES.map(([a, b]) => {
		const lo = Math.min(a, b);
		const hi = Math.max(a, b);
		const rA = Math.floor(lo / COLS);
		const cA = lo % COLS;
		const rB = Math.floor(hi / COLS);
		const cB = hi % COLS;
		const cenA = roomCenter(rA, cA);
		const cenB = roomCenter(rB, cB);
		const sameRow = rA === rB;
		return {
			roomA: lo,
			roomB: hi,
			centerX: (cenA.x + cenB.x) / 2,
			centerZ: (cenA.z + cenB.z) / 2,
			horizontal: !sameRow,
		};
	});
}

export function createDoors(): Door[] {
	return generateDoorSpecs().map(doorFromSpec);
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
