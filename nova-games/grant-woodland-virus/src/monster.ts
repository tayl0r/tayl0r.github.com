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
	Vector3,
} from "three";
import type { PlayerState } from "./player";

export type MonsterState = {
	root: Group;
	position: Vector3;
	yaw: number;
	chest: Group;
	legL: Group;
	legR: Group;
	armL: Group;
	armR: Group;
	jaw: Group;
};

const SPAWN_X = 60;
const SPAWN_Z = 60;

const MONSTER_SPEED = 3;
const MONSTER_YAW_RATE = 2;
const MONSTER_BOUNDS_HALF = 100;
const BREATH_AMPLITUDE = 0.04;
const BREATH_PERIOD = 3;

const WANDER_SPEED = 1;
const WANDER_MIN_DURATION = 3;
const WANDER_MAX_DURATION = 5;
const WANDER_YAW_SPREAD = Math.PI * 0.66;

const WINDUP_DURATION = 0.32;
const LUNGE_DURATION = 0.55;
const LUNGE_DISTANCE = 3;

const WINDUP_LEAN = 0.12;
const WINDUP_SCALE_Y = 0.78;
const WINDUP_ARM_PULL = 0.4;
const WINDUP_LEG_COIL = -0.1;
const LUNGE_LEAN = 0.55;
const LUNGE_SCALE_Y = 1.08;
const LUNGE_ARM_REACH = -1.4;
const LUNGE_ARM_SPREAD = 0.22;
const LUNGE_LEG_TRAIL = 0.5;
const JAW_OPEN = 0.75;

let elapsed = 0;
let walkPhase = 0;
let wanderYaw: number | null = null;
let wanderUntil = 0;

let lungeActive = false;
let lungeElapsed = 0;
const lungeStart = new Vector3();
const lungeEnd = new Vector3();

const furMaterial = new MeshStandardMaterial({ color: 0x2a1810 });
const torsoMaterial = new MeshStandardMaterial({ color: 0x1a0e08 });
const beigeFurMaterial = new MeshStandardMaterial({ color: 0xc8b894 });
const bloodMaterial = new MeshStandardMaterial({
	color: 0x5a0a0a,
	emissive: 0x2a0404,
	emissiveIntensity: 0.15,
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

function makeHead(): { group: Group; jaw: Group } {
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

	const jaw = new Group();
	jaw.position.set(0, -0.16, -0.04);
	const jawBone = new Mesh(new BoxGeometry(0.32, 0.1, 0.42), boneMaterial);
	jawBone.position.set(0, -0.03, 0.2);
	jaw.add(jawBone);
	const jawTip = new Mesh(new ConeGeometry(0.06, 0.1, 6), boneMaterial);
	jawTip.position.set(0, -0.03, 0.42);
	jawTip.rotation.x = Math.PI / 2;
	jaw.add(jawTip);
	head.add(jaw);

	const mouthVoid = new Mesh(new BoxGeometry(0.26, 0.06, 0.32), socketMaterial);
	mouthVoid.position.set(0, -0.12, 0.14);
	head.add(mouthVoid);

	return { group: head, jaw };
}

function makeChest(): Group {
	const g = new Group();
	g.position.set(0, 2.05, 0.42);

	const fur = new Mesh(new BoxGeometry(0.78, 0.85, 0.18), beigeFurMaterial);
	g.add(fur);

	const smearA = new Mesh(new BoxGeometry(0.32, 0.22, 0.06), bloodMaterial);
	smearA.position.set(0.08, 0.18, 0.08);
	smearA.rotation.z = 0.15;
	g.add(smearA);

	const smearB = new Mesh(new BoxGeometry(0.22, 0.16, 0.06), bloodMaterial);
	smearB.position.set(-0.18, 0.0, 0.08);
	smearB.rotation.z = -0.2;
	g.add(smearB);

	const drip = new Mesh(new BoxGeometry(0.08, 0.42, 0.05), bloodMaterial);
	drip.position.set(0.02, -0.24, 0.08);
	g.add(drip);

	const splatter = new Mesh(new BoxGeometry(0.16, 0.1, 0.05), bloodMaterial);
	splatter.position.set(-0.25, -0.28, 0.08);
	splatter.rotation.z = 0.4;
	g.add(splatter);

	return g;
}

function makeBackSpots(): Group {
	const g = new Group();
	const spots = [
		{ x: -0.18, y: 0.35, z: -0.4 },
		{ x: 0.22, y: 0.3, z: -0.42 },
		{ x: -0.28, y: 0.1, z: -0.38 },
		{ x: 0.06, y: 0.0, z: -0.48 },
		{ x: -0.1, y: -0.2, z: -0.45 },
		{ x: 0.25, y: -0.18, z: -0.38 },
		{ x: -0.45, y: 0.15, z: -0.18 },
		{ x: 0.45, y: 0.0, z: -0.15 },
	];
	for (const s of spots) {
		const spot = new Mesh(new SphereGeometry(0.1, 8, 6), beigeFurMaterial);
		spot.scale.set(1.2, 0.7, 0.2);
		spot.position.set(s.x, s.y, s.z);
		g.add(spot);
	}
	g.position.y = 1.95;
	return g;
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

	const chest = makeChest();
	root.add(chest);

	root.add(makeBackSpots());

	const armL = makeArm(-1);
	const armR = makeArm(1);
	const legL = makeLeg(-1);
	const legR = makeLeg(1);
	root.add(armL);
	root.add(armR);
	root.add(legL);
	root.add(legR);
	const { group: head, jaw } = makeHead();
	root.add(head);

	return {
		root,
		position: root.position,
		yaw: 0,
		chest,
		legL,
		legR,
		armL,
		armR,
		jaw,
	};
}

export function resetMonster(monster: MonsterState): void {
	monster.position.set(SPAWN_X, 0, SPAWN_Z);
	monster.yaw = 0;
	monster.root.rotation.set(0, 0, 0);
	monster.root.scale.set(1, 1, 1);
	monster.legL.rotation.set(0, 0, 0);
	monster.legR.rotation.set(0, 0, 0);
	monster.armL.rotation.set(0, 0, 0);
	monster.armR.rotation.set(0, 0, 0);
	monster.jaw.rotation.set(0, 0, 0);
	wanderYaw = null;
	wanderUntil = 0;
	lungeActive = false;
	lungeElapsed = 0;
	walkPhase = 0;
}

function wrapAngle(a: number): number {
	let v = a;
	while (v > Math.PI) v -= 2 * Math.PI;
	while (v < -Math.PI) v += 2 * Math.PI;
	return v;
}

function stepYaw(monster: MonsterState, targetYaw: number, dt: number): void {
	const yawDelta = wrapAngle(targetYaw - monster.yaw);
	const maxYawStep = MONSTER_YAW_RATE * dt;
	const yawStep =
		Math.abs(yawDelta) < maxYawStep
			? yawDelta
			: Math.sign(yawDelta) * maxYawStep;
	monster.yaw += yawStep;
	monster.root.rotation.y = monster.yaw;
}

function clampToBounds(position: Vector3): void {
	if (position.x > MONSTER_BOUNDS_HALF) position.x = MONSTER_BOUNDS_HALF;
	if (position.x < -MONSTER_BOUNDS_HALF) position.x = -MONSTER_BOUNDS_HALF;
	if (position.z > MONSTER_BOUNDS_HALF) position.z = MONSTER_BOUNDS_HALF;
	if (position.z < -MONSTER_BOUNDS_HALF) position.z = -MONSTER_BOUNDS_HALF;
}

function applyWalkAnimation(
	monster: MonsterState,
	moveSpeed: number,
	dt: number,
): void {
	if (moveSpeed > 0.01) {
		walkPhase += dt * Math.PI * 2 * Math.max(0.6, moveSpeed * 0.5);
	}
	const swing = Math.sin(walkPhase) * 0.45;
	const armSwing = Math.sin(walkPhase) * 0.3;
	monster.legL.rotation.x = swing;
	monster.legR.rotation.x = -swing;
	monster.armL.rotation.x = -armSwing;
	monster.armR.rotation.x = armSwing;
}

function applyBreath(monster: MonsterState): void {
	const breath =
		1 + BREATH_AMPLITUDE * Math.sin((elapsed * 2 * Math.PI) / BREATH_PERIOD);
	monster.chest.scale.y = breath;
}

function lerp(a: number, b: number, t: number): number {
	return a + (b - a) * t;
}

export function startLunge(monster: MonsterState, player: PlayerState): void {
	const dx = monster.position.x - player.position.x;
	const dz = monster.position.z - player.position.z;
	const dist = Math.hypot(dx, dz);
	const ux = dist > 0.001 ? dx / dist : 0;
	const uz = dist > 0.001 ? dz / dist : -1;

	monster.position.x = player.position.x + ux * LUNGE_DISTANCE;
	monster.position.z = player.position.z + uz * LUNGE_DISTANCE;
	// Face player: model forward is +Z, so yaw such that R_y(yaw)*+Z points to player
	monster.yaw = Math.atan2(-ux, -uz);
	monster.root.rotation.y = monster.yaw;
	monster.root.rotation.x = 0;
	monster.root.scale.set(1, 1, 1);
	monster.armL.rotation.set(0, 0, 0);
	monster.armR.rotation.set(0, 0, 0);
	monster.legL.rotation.set(0, 0, 0);
	monster.legR.rotation.set(0, 0, 0);
	monster.jaw.rotation.set(0, 0, 0);

	lungeStart.copy(monster.position);
	lungeEnd.set(player.position.x, monster.position.y, player.position.z);
	lungeActive = true;
	lungeElapsed = 0;
}

export function updateLunge(monster: MonsterState, dt: number): boolean {
	if (!lungeActive) return true;
	elapsed += dt;
	lungeElapsed += dt;
	applyBreath(monster);

	if (lungeElapsed < WINDUP_DURATION) {
		const u = lungeElapsed / WINDUP_DURATION;
		const e = u * u; // ease-in for the coil
		monster.root.rotation.x = lerp(0, WINDUP_LEAN, e);
		monster.root.scale.y = lerp(1, WINDUP_SCALE_Y, e);
		monster.armL.rotation.x = lerp(0, WINDUP_ARM_PULL, e);
		monster.armR.rotation.x = lerp(0, WINDUP_ARM_PULL, e);
		monster.legL.rotation.x = lerp(0, WINDUP_LEG_COIL, e);
		monster.legR.rotation.x = lerp(0, WINDUP_LEG_COIL, e);
		monster.jaw.rotation.x = 0;
		return false;
	}

	const u = (lungeElapsed - WINDUP_DURATION) / LUNGE_DURATION;
	const t = Math.min(1, u);
	const eased = t * t;
	monster.position.x = lerp(lungeStart.x, lungeEnd.x, eased);
	monster.position.z = lerp(lungeStart.z, lungeEnd.z, eased);
	monster.root.rotation.x = lerp(WINDUP_LEAN, LUNGE_LEAN, t);
	monster.root.scale.y = lerp(WINDUP_SCALE_Y, LUNGE_SCALE_Y, t);
	monster.armL.rotation.x = lerp(WINDUP_ARM_PULL, LUNGE_ARM_REACH, t);
	monster.armR.rotation.x = lerp(WINDUP_ARM_PULL, LUNGE_ARM_REACH, t);
	monster.armL.rotation.z = lerp(0, -LUNGE_ARM_SPREAD, t);
	monster.armR.rotation.z = lerp(0, LUNGE_ARM_SPREAD, t);
	monster.legL.rotation.x = lerp(WINDUP_LEG_COIL, LUNGE_LEG_TRAIL, t);
	monster.legR.rotation.x = lerp(WINDUP_LEG_COIL, LUNGE_LEG_TRAIL, t);
	monster.jaw.rotation.x = lerp(0, JAW_OPEN, t);

	if (t >= 1) {
		lungeActive = false;
		return true;
	}
	return false;
}

export function updateMonster(
	monster: MonsterState,
	player: PlayerState,
	dt: number,
): void {
	elapsed += dt;
	applyBreath(monster);

	if (player.hidden) {
		if (wanderYaw === null || elapsed > wanderUntil) {
			const ax = monster.position.x - player.position.x;
			const az = monster.position.z - player.position.z;
			const aDist = Math.hypot(ax, az);
			const awayYaw =
				aDist > 0.001
					? Math.atan2(ax / aDist, az / aDist)
					: Math.random() * 2 * Math.PI - Math.PI;
			wanderYaw = awayYaw + (Math.random() - 0.5) * WANDER_YAW_SPREAD;
			wanderUntil =
				elapsed +
				WANDER_MIN_DURATION +
				Math.random() * (WANDER_MAX_DURATION - WANDER_MIN_DURATION);
		}
		stepYaw(monster, wanderYaw, dt);
		monster.position.x += Math.sin(monster.yaw) * WANDER_SPEED * dt;
		monster.position.z += Math.cos(monster.yaw) * WANDER_SPEED * dt;
		clampToBounds(monster.position);
		applyWalkAnimation(monster, WANDER_SPEED, dt);
		return;
	}

	wanderYaw = null;

	const dx = player.position.x - monster.position.x;
	const dz = player.position.z - monster.position.z;
	const dist = Math.hypot(dx, dz);
	if (dist > 0.0001) {
		stepYaw(monster, Math.atan2(dx / dist, dz / dist), dt);
		const step = MONSTER_SPEED * dt;
		monster.position.x += (dx / dist) * step;
		monster.position.z += (dz / dist) * step;
	}
	clampToBounds(monster.position);
	applyWalkAnimation(monster, MONSTER_SPEED, dt);
}
