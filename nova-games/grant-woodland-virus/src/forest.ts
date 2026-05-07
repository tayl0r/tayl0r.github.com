import {
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	type Object3D,
	type Scene,
	Vector3,
} from "three";

export type TreeCollider = {
	x: number;
	z: number;
	radius: number;
};

export type Forest = {
	colliders: TreeCollider[];
	flagPosition: Vector3;
	bounds: { halfX: number; halfZ: number };
};

const AREA_HALF = 100;
const TREE_COUNT_TARGET = 250;
const TREE_RADIUS = 0.5;
const TREE_MIN_SPACING = 1.5;
const SPAWN_KEEP_CLEAR = 4;
const FLAG_KEEP_CLEAR = 3;
const FLAG_X = 63;
const FLAG_Z = 63;

const trunkMaterial = new MeshStandardMaterial({ color: 0x3a2814 });
const canopyMaterial = new MeshStandardMaterial({ color: 0x0a2a0a });
const poleMaterial = new MeshStandardMaterial({ color: 0xcccccc });
const clothMaterial = new MeshStandardMaterial({
	color: 0x00ff44,
	emissive: 0x00ff44,
	emissiveIntensity: 0.6,
});

function makeTree(x: number, z: number): Object3D {
	const tree = new Group();

	const trunk = new Mesh(
		new CylinderGeometry(TREE_RADIUS, TREE_RADIUS, 6, 8),
		trunkMaterial,
	);
	trunk.position.y = 3;
	tree.add(trunk);

	const canopy = new Mesh(new ConeGeometry(2, 4, 8), canopyMaterial);
	canopy.position.y = 8;
	tree.add(canopy);

	tree.position.set(x, 0, z);
	return tree;
}

function makeFlag(x: number, z: number): Object3D {
	const group = new Group();

	const pole = new Mesh(new CylinderGeometry(0.05, 0.05, 4, 8), poleMaterial);
	pole.position.y = 2;
	group.add(pole);

	const cloth = new Mesh(new BoxGeometry(1.2, 0.6, 0.05), clothMaterial);
	cloth.position.set(0.6, 3.4, 0);
	group.add(cloth);

	group.position.set(x, 0, z);
	return group;
}

export function buildForest(scene: Scene): Forest {
	const colliders: TreeCollider[] = [];
	const positions: { x: number; z: number }[] = [];

	const maxAttempts = 5000;
	let attempts = 0;
	while (positions.length < TREE_COUNT_TARGET && attempts < maxAttempts) {
		attempts++;
		const x = (Math.random() * 2 - 1) * AREA_HALF * 0.95;
		const z = (Math.random() * 2 - 1) * AREA_HALF * 0.95;

		if (Math.hypot(x, z) < SPAWN_KEEP_CLEAR) continue;
		if (Math.hypot(x - FLAG_X, z - FLAG_Z) < FLAG_KEEP_CLEAR) continue;

		let tooClose = false;
		for (const p of positions) {
			if (Math.hypot(x - p.x, z - p.z) < TREE_MIN_SPACING) {
				tooClose = true;
				break;
			}
		}
		if (tooClose) continue;

		positions.push({ x, z });
	}

	for (const { x, z } of positions) {
		scene.add(makeTree(x, z));
		colliders.push({ x, z, radius: TREE_RADIUS });
	}

	scene.add(makeFlag(FLAG_X, FLAG_Z));

	return {
		colliders,
		flagPosition: new Vector3(FLAG_X, 0, FLAG_Z),
		bounds: { halfX: AREA_HALF, halfZ: AREA_HALF },
	};
}
