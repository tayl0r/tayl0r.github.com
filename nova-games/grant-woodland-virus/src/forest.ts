import {
	BackSide,
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

export type LogTransform = {
	x: number;
	z: number;
	angle: number;
};

export type Forest = {
	colliders: TreeCollider[];
	flagPosition: Vector3;
	bounds: { halfX: number; halfZ: number };
	logs: LogTransform[];
};

const AREA_HALF = 100;
const TREE_COUNT_TARGET = 250;
const TREE_RADIUS = 0.5;
const TREE_MIN_SPACING = 1.5;
const SPAWN_KEEP_CLEAR = 4;
const FLAG_KEEP_CLEAR = 3;
const FLAG_X = 63;
const FLAG_Z = 63;
const LOG_COUNT_TARGET = 12;
const LOG_LENGTH = 3;
const LOG_RADIUS = 1.2;
const LOG_MIN_SPACING = 4;
const LOG_TREE_CLEARANCE = 1.5;
const LOG_SPAWN_CLEARANCE = 3;
const LOG_FLAG_CLEARANCE = 4;

const trunkMaterial = new MeshStandardMaterial({ color: 0x3a2814 });
const canopyMaterial = new MeshStandardMaterial({ color: 0x0a2a0a });
const poleMaterial = new MeshStandardMaterial({ color: 0xcccccc });
const clothMaterial = new MeshStandardMaterial({
	color: 0x00ff44,
	emissive: 0x00ff44,
	emissiveIntensity: 0.6,
});
const logOuterMaterial = new MeshStandardMaterial({ color: 0x2c1c10 });
const logInnerMaterial = new MeshStandardMaterial({
	color: 0x080404,
	side: BackSide,
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

function makeLog(t: LogTransform): Object3D {
	const group = new Group();

	const outer = new Mesh(
		new CylinderGeometry(LOG_RADIUS, LOG_RADIUS, LOG_LENGTH, 12, 1, true),
		logOuterMaterial,
	);
	outer.rotation.z = Math.PI / 2;
	group.add(outer);

	const inner = new Mesh(
		new CylinderGeometry(
			LOG_RADIUS - 0.02,
			LOG_RADIUS - 0.02,
			LOG_LENGTH - 0.05,
			12,
			1,
			true,
		),
		logInnerMaterial,
	);
	inner.rotation.z = Math.PI / 2;
	group.add(inner);

	group.position.set(t.x, LOG_RADIUS, t.z);
	group.rotation.y = t.angle;
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

	const logs: LogTransform[] = [];
	let logAttempts = 0;
	const maxLogAttempts = 4000;
	while (logs.length < LOG_COUNT_TARGET && logAttempts < maxLogAttempts) {
		logAttempts++;
		const x = (Math.random() * 2 - 1) * AREA_HALF * 0.95;
		const z = (Math.random() * 2 - 1) * AREA_HALF * 0.95;

		if (Math.hypot(x, z) < LOG_SPAWN_CLEARANCE) continue;
		if (Math.hypot(x - FLAG_X, z - FLAG_Z) < LOG_FLAG_CLEARANCE) continue;

		let tooCloseToTree = false;
		for (const c of colliders) {
			if (Math.hypot(x - c.x, z - c.z) < LOG_TREE_CLEARANCE) {
				tooCloseToTree = true;
				break;
			}
		}
		if (tooCloseToTree) continue;

		let tooCloseToLog = false;
		for (const other of logs) {
			if (Math.hypot(x - other.x, z - other.z) < LOG_MIN_SPACING) {
				tooCloseToLog = true;
				break;
			}
		}
		if (tooCloseToLog) continue;

		const angle = Math.random() * Math.PI * 2;
		logs.push({ x, z, angle });
	}

	for (const t of logs) {
		scene.add(makeLog(t));
	}

	return {
		colliders,
		flagPosition: new Vector3(FLAG_X, 0, FLAG_Z),
		bounds: { halfX: AREA_HALF, halfZ: AREA_HALF },
		logs,
	};
}
