import { CylinderGeometry, Mesh, MeshStandardMaterial } from "three";
import type { Room } from "./world";

export interface RoomSwitch {
	roomIndex: number;
	activated: boolean;
	x: number;
	z: number;
	mesh: Mesh;
}

export function createRoomSwitch(room: Room, roomIndex: number): RoomSwitch {
	const x = room.centerX + 4;
	const z = room.centerZ - 4;
	const mesh = new Mesh(
		new CylinderGeometry(0.4, 0.4, 1.0, 12),
		new MeshStandardMaterial({ color: 0x4444aa, emissive: 0x111144 }),
	);
	mesh.position.set(x, 0.5, z);
	return { roomIndex, activated: false, x, z, mesh };
}

export function activateSwitch(s: RoomSwitch): boolean {
	if (s.activated) return false;
	s.activated = true;
	const mat = s.mesh.material;
	if (mat instanceof MeshStandardMaterial) {
		mat.color.setHex(0x44ddaa);
		mat.emissive.setHex(0x117755);
	}
	return true;
}

export interface WinSwitch {
	activated: boolean;
	unlocked: boolean;
	x: number;
	z: number;
	mesh: Mesh;
}

export function createWinSwitch(x: number, z: number): WinSwitch {
	const mesh = new Mesh(
		new CylinderGeometry(1, 1, 0.5, 24),
		new MeshStandardMaterial({ color: 0x222222 }),
	);
	mesh.position.set(x, 0.25, z);
	return { activated: false, unlocked: false, x, z, mesh };
}

export function unlockWinSwitch(s: WinSwitch): void {
	if (s.unlocked) return;
	s.unlocked = true;
	const mat = s.mesh.material;
	if (mat instanceof MeshStandardMaterial) {
		mat.color.setHex(0xffff00);
		mat.emissive.setHex(0x886600);
	}
}

export function activateWinSwitch(s: WinSwitch): boolean {
	if (s.activated || !s.unlocked) return false;
	s.activated = true;
	return true;
}
