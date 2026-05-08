import {
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshBasicMaterial,
	MeshStandardMaterial,
	PointLight,
	SphereGeometry,
	type Vector3,
} from "three";

export type MonsterState = {
	root: Group;
	position: Vector3;
	yaw: number;
	chest: Mesh;
};

const SPAWN_X = 60;
const SPAWN_Z = 60;

const furMaterial = new MeshStandardMaterial({ color: 0x2a1810 });
const torsoMaterial = new MeshStandardMaterial({ color: 0x1a0e08 });
const bloodMaterial = new MeshStandardMaterial({
	color: 0x4a0808,
	emissive: 0x4a0808,
	emissiveIntensity: 0.2,
});
const boneMaterial = new MeshStandardMaterial({ color: 0xe8e2d0 });
const clawMaterial = new MeshStandardMaterial({ color: 0xc8c0b0 });
const socketMaterial = new MeshStandardMaterial({ color: 0x000000 });
const greenEyeMaterial = new MeshBasicMaterial({ color: 0x00ff44 });

function makeAntler(side: 1 | -1): Group {
	const antler = new Group();

	const main = new Mesh(new CylinderGeometry(0.04, 0.06, 0.5, 6), boneMaterial);
	main.position.y = 0.25;
	main.rotation.z = side * -0.3;
	antler.add(main);

	const branchA = new Mesh(
		new CylinderGeometry(0.025, 0.04, 0.3, 6),
		boneMaterial,
	);
	branchA.position.set(side * 0.18, 0.5, 0);
	branchA.rotation.z = side * -0.7;
	antler.add(branchA);

	const branchB = new Mesh(
		new CylinderGeometry(0.025, 0.035, 0.25, 6),
		boneMaterial,
	);
	branchB.position.set(side * 0.05, 0.55, 0);
	branchB.rotation.z = side * -0.2;
	antler.add(branchB);

	const tipA = new Mesh(new ConeGeometry(0.025, 0.1, 6), boneMaterial);
	tipA.position.set(side * 0.32, 0.62, 0);
	tipA.rotation.z = side * -0.7;
	antler.add(tipA);

	const tipB = new Mesh(new ConeGeometry(0.025, 0.1, 6), boneMaterial);
	tipB.position.set(side * 0.08, 0.7, 0);
	tipB.rotation.z = side * -0.2;
	antler.add(tipB);

	return antler;
}

function makeArm(side: 1 | -1): Group {
	const arm = new Group();
	arm.position.set(side * 0.45, 1.85, 0);

	const upper = new Mesh(new CylinderGeometry(0.1, 0.09, 0.5, 8), furMaterial);
	upper.position.y = -0.25;
	arm.add(upper);

	const forearm = new Mesh(
		new CylinderGeometry(0.08, 0.07, 0.5, 8),
		furMaterial,
	);
	forearm.position.y = -0.75;
	arm.add(forearm);

	const hand = new Group();
	hand.position.y = -1;
	for (let i = 0; i < 3; i++) {
		const claw = new Mesh(new ConeGeometry(0.04, 0.18, 6), clawMaterial);
		claw.position.set((i - 1) * 0.06, -0.1, 0);
		claw.rotation.x = Math.PI;
		hand.add(claw);
	}
	arm.add(hand);

	return arm;
}

function makeLeg(side: 1 | -1): Group {
	const leg = new Group();
	leg.position.set(side * 0.18, 0.95, 0);

	const thigh = new Mesh(
		new CylinderGeometry(0.13, 0.11, 0.55, 8),
		furMaterial,
	);
	thigh.position.y = -0.275;
	thigh.rotation.x = 0.2;
	leg.add(thigh);

	const shin = new Mesh(new CylinderGeometry(0.1, 0.08, 0.55, 8), furMaterial);
	shin.position.set(0, -0.75, 0.08);
	shin.rotation.x = -0.3;
	leg.add(shin);

	const foot = new Mesh(new BoxGeometry(0.18, 0.08, 0.3), furMaterial);
	foot.position.set(0, -1, 0.12);
	leg.add(foot);

	return leg;
}

function makeHead(): Group {
	const head = new Group();
	head.position.y = 2.5;

	const skull = new Mesh(new SphereGeometry(0.3, 16, 12), boneMaterial);
	skull.scale.set(1, 1.1, 1.3);
	head.add(skull);

	const socketL = new Mesh(new BoxGeometry(0.07, 0.07, 0.07), socketMaterial);
	socketL.position.set(-0.13, 0.05, 0.28);
	head.add(socketL);

	const socketR = new Mesh(new BoxGeometry(0.07, 0.07, 0.07), socketMaterial);
	socketR.position.set(0.13, 0.05, 0.28);
	head.add(socketR);

	const greenEye = new Mesh(new SphereGeometry(0.04, 8, 6), greenEyeMaterial);
	greenEye.position.set(-0.13, 0.05, 0.32);
	head.add(greenEye);

	const eyeLight = new PointLight(0x00ff44, 1, 3);
	eyeLight.position.set(-0.13, 0.05, 0.32);
	head.add(eyeLight);

	const antlerL = makeAntler(-1);
	antlerL.position.set(-0.18, 0.25, 0);
	head.add(antlerL);

	const antlerR = makeAntler(1);
	antlerR.position.set(0.18, 0.25, 0);
	head.add(antlerR);

	return head;
}

export function createMonster(): MonsterState {
	const root = new Group();
	root.position.set(SPAWN_X, 0, SPAWN_Z);

	const torso = new Mesh(
		new CylinderGeometry(0.5, 0.45, 1.2, 12),
		torsoMaterial,
	);
	torso.position.y = 1.95;
	root.add(torso);

	const chest = new Mesh(new BoxGeometry(0.7, 0.5, 0.25), bloodMaterial);
	chest.position.set(0, 2.1, 0.4);
	root.add(chest);

	root.add(makeArm(-1));
	root.add(makeArm(1));
	root.add(makeLeg(-1));
	root.add(makeLeg(1));
	root.add(makeHead());

	return {
		root,
		position: root.position,
		yaw: 0,
		chest,
	};
}
