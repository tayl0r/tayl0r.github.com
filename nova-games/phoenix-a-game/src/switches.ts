import {
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	TorusGeometry,
} from "three";
import type { Room } from "./world";

export interface RoomSwitch {
	roomIndex: number;
	activated: boolean;
	x: number;
	z: number;
	mesh: Group;
	buttonMaterial: MeshStandardMaterial;
}

export function createRoomSwitch(room: Room, roomIndex: number): RoomSwitch {
	const x = room.centerX + 4;
	const z = room.centerZ - 4;
	const mesh = new Group();
	const stone = new MeshStandardMaterial({ color: 0x4f4f5a });
	const buttonMaterial = new MeshStandardMaterial({
		color: 0x4444aa,
		emissive: 0x111144,
	});

	const pedestal = new Mesh(new CylinderGeometry(0.55, 0.65, 0.35, 12), stone);
	pedestal.position.y = 0.18;
	mesh.add(pedestal);

	const plate = new Mesh(new CylinderGeometry(0.45, 0.45, 0.06, 16), stone);
	plate.position.y = 0.39;
	mesh.add(plate);

	const ring = new Mesh(
		new TorusGeometry(0.35, 0.04, 8, 20),
		new MeshStandardMaterial({ color: 0x222233 }),
	);
	ring.position.y = 0.43;
	ring.rotation.x = Math.PI / 2;
	mesh.add(ring);

	const button = new Mesh(
		new CylinderGeometry(0.28, 0.28, 0.18, 16),
		buttonMaterial,
	);
	button.position.y = 0.52;
	mesh.add(button);

	const gem = new Mesh(new SphereGeometry(0.1, 12, 8), buttonMaterial);
	gem.position.y = 0.65;
	mesh.add(gem);

	mesh.position.set(x, 0, z);
	return { roomIndex, activated: false, x, z, mesh, buttonMaterial };
}

export function activateSwitch(s: RoomSwitch): boolean {
	if (s.activated) return false;
	s.activated = true;
	s.buttonMaterial.color.setHex(0x44ddaa);
	s.buttonMaterial.emissive.setHex(0x117755);
	return true;
}

export interface WinSwitch {
	activated: boolean;
	unlocked: boolean;
	x: number;
	z: number;
	mesh: Group;
	plateMaterial: MeshStandardMaterial;
}

export function createWinSwitch(x: number, z: number): WinSwitch {
	const mesh = new Group();
	const plateMaterial = new MeshStandardMaterial({
		color: 0x222222,
		emissive: 0x000000,
	});

	const ring = new Mesh(
		new CylinderGeometry(1.2, 1.4, 0.18, 24),
		new MeshStandardMaterial({ color: 0x3a3a44 }),
	);
	ring.position.y = 0.09;
	mesh.add(ring);

	const plate = new Mesh(
		new CylinderGeometry(1.0, 1.0, 0.24, 24),
		plateMaterial,
	);
	plate.position.y = 0.21;
	mesh.add(plate);

	const accent = new Mesh(
		new TorusGeometry(0.85, 0.06, 8, 24),
		new MeshStandardMaterial({ color: 0x666677 }),
	);
	accent.position.y = 0.34;
	accent.rotation.x = Math.PI / 2;
	mesh.add(accent);

	mesh.position.set(x, 0, z);
	return { activated: false, unlocked: false, x, z, mesh, plateMaterial };
}

export function unlockWinSwitch(s: WinSwitch): void {
	if (s.unlocked) return;
	s.unlocked = true;
	s.plateMaterial.color.setHex(0xffff00);
	s.plateMaterial.emissive.setHex(0x886600);
}

export function activateWinSwitch(s: WinSwitch): boolean {
	if (s.activated || !s.unlocked) return false;
	s.activated = true;
	return true;
}
