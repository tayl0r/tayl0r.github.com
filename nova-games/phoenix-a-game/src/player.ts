import {
	BoxGeometry,
	CapsuleGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	TorusGeometry,
} from "three";

export const WALK_SPEED = 4;
export const RUN_SPEED = 8;
export const PLAYER_RADIUS = 0.5;

export interface MoveKeys {
	w: boolean;
	a: boolean;
	s: boolean;
	d: boolean;
}

export function computeVelocity(
	keys: MoveKeys,
	sprinting: boolean,
	cameraYaw: number,
): { x: number; z: number } {
	let fx = 0;
	let fz = 0;
	if (keys.w) fz -= 1;
	if (keys.s) fz += 1;
	if (keys.a) fx -= 1;
	if (keys.d) fx += 1;
	const len = Math.hypot(fx, fz);
	if (len === 0) return { x: 0, z: 0 };
	fx /= len;
	fz /= len;
	const speed = sprinting ? RUN_SPEED : WALK_SPEED;
	const cos = Math.cos(cameraYaw);
	const sin = Math.sin(cameraYaw);
	return {
		x: (fx * cos + fz * sin) * speed,
		z: (-fx * sin + fz * cos) * speed,
	};
}

export interface PlayerMesh {
	root: Group;
	sword: Group;
	swordBladeMaterial: MeshStandardMaterial;
	bow: Group;
	bowAccentMaterial: MeshStandardMaterial;
}

export function createPlayerMesh(): PlayerMesh {
	const root = new Group();
	const body = new Mesh(
		new CapsuleGeometry(0.5, 1, 4, 8),
		new MeshStandardMaterial({ color: 0x66ccff }),
	);
	body.position.y = 1;
	body.visible = false;
	root.add(body);

	const sword = buildSword();
	const bow = buildBow();
	bow.group.visible = false;

	return {
		root,
		sword: sword.group,
		swordBladeMaterial: sword.bladeMaterial,
		bow: bow.group,
		bowAccentMaterial: bow.accentMaterial,
	};
}

function buildSword(): {
	group: Group;
	bladeMaterial: MeshStandardMaterial;
} {
	const group = new Group();
	const gold = new MeshStandardMaterial({ color: 0xddaa44 });
	const wood = new MeshStandardMaterial({ color: 0x442211 });
	const bladeMaterial = new MeshStandardMaterial({
		color: 0xcccccc,
		emissive: 0x111111,
	});

	const pommel = new Mesh(new SphereGeometry(0.06, 10, 8), gold);
	pommel.position.set(0, 0, 0.5);
	group.add(pommel);

	const grip = new Mesh(new CylinderGeometry(0.04, 0.04, 0.22, 8), wood);
	grip.position.set(0, 0, 0.34);
	grip.rotation.x = Math.PI / 2;
	group.add(grip);

	const guard = new Mesh(new BoxGeometry(0.28, 0.06, 0.08), gold);
	guard.position.set(0, 0, 0.21);
	group.add(guard);

	const blade = new Mesh(new BoxGeometry(0.06, 0.04, 0.7), bladeMaterial);
	blade.position.set(0, 0, -0.15);
	group.add(blade);

	const tip = new Mesh(new BoxGeometry(0.04, 0.03, 0.1), bladeMaterial);
	tip.position.set(0, 0, -0.55);
	tip.rotation.x = Math.PI / 4;
	group.add(tip);

	group.position.set(0.45, -0.35, -0.5);
	return { group, bladeMaterial };
}

function buildBow(): {
	group: Group;
	accentMaterial: MeshStandardMaterial;
} {
	const group = new Group();
	const wood = new MeshStandardMaterial({ color: 0x6b3a13 });
	const accentMaterial = new MeshStandardMaterial({
		color: 0xcccccc,
		emissive: 0x222222,
	});

	const limb = new Mesh(new TorusGeometry(0.42, 0.04, 8, 16, Math.PI), wood);
	limb.rotation.x = Math.PI / 2;
	limb.rotation.z = Math.PI / 2;
	limb.position.y = 0;
	group.add(limb);

	const grip = new Mesh(new BoxGeometry(0.06, 0.18, 0.06), accentMaterial);
	grip.position.set(0.42, 0, 0);
	group.add(grip);

	const string = new Mesh(
		new CylinderGeometry(0.005, 0.005, 0.84, 4),
		new MeshStandardMaterial({ color: 0xeeeeee }),
	);
	string.position.set(0.42, 0, 0);
	group.add(string);

	group.position.set(0.4, -0.3, -0.55);
	group.rotation.y = -Math.PI / 2;
	return { group, accentMaterial };
}
