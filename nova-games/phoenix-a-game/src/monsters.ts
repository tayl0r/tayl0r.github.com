import {
	BoxGeometry,
	ConeGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	SphereGeometry,
	TorusGeometry,
} from "three";
import { type Item, QUALITY_COLORS } from "./state";

export type MonsterKind =
	| "skeleton"
	| "zombie"
	| "grimReaper"
	| "goblin"
	| "orc"
	| "minotaur"
	| "slime"
	| "fireElemental"
	| "lich";

interface MonsterStats {
	hp: number;
	speed: number;
	radius: number;
	contact: number;
	damage: number;
	isBoss: boolean;
}

const STATS: Record<MonsterKind, MonsterStats> = {
	skeleton: {
		hp: 2,
		speed: 3,
		radius: 0.4,
		contact: 0.9,
		damage: 0.5,
		isBoss: false,
	},
	zombie: {
		hp: 4,
		speed: 1.5,
		radius: 0.6,
		contact: 1.2,
		damage: 1,
		isBoss: false,
	},
	grimReaper: {
		hp: 10,
		speed: 2.5,
		radius: 0.9,
		contact: 1.8,
		damage: 1.5,
		isBoss: true,
	},
	goblin: {
		hp: 2,
		speed: 3,
		radius: 0.4,
		contact: 0.9,
		damage: 0.5,
		isBoss: false,
	},
	orc: {
		hp: 4,
		speed: 2,
		radius: 0.6,
		contact: 1.2,
		damage: 1,
		isBoss: false,
	},
	minotaur: {
		hp: 12,
		speed: 2.2,
		radius: 0.9,
		contact: 2.0,
		damage: 1.5,
		isBoss: true,
	},
	slime: {
		hp: 2,
		speed: 2,
		radius: 0.5,
		contact: 0.9,
		damage: 0.5,
		isBoss: false,
	},
	fireElemental: {
		hp: 4,
		speed: 2.5,
		radius: 0.5,
		contact: 1.0,
		damage: 1,
		isBoss: false,
	},
	lich: {
		hp: 14,
		speed: 2,
		radius: 0.9,
		contact: 1.8,
		damage: 2,
		isBoss: true,
	},
};

const WEAPON_ANCHOR: Record<MonsterKind, [number, number, number]> = {
	skeleton: [0.35, 1.1, 0.0],
	zombie: [0.4, 1.0, 0.0],
	grimReaper: [0.45, 1.4, 0.0],
	goblin: [0.3, 0.8, 0.0],
	orc: [0.45, 1.1, 0.0],
	minotaur: [0.5, 1.5, 0.0],
	slime: [0.25, 0.5, 0.0],
	fireElemental: [0.35, 0.9, 0.0],
	lich: [0.4, 1.3, 0.0],
};

export interface Monster {
	kind: MonsterKind;
	roomIndex: number;
	x: number;
	z: number;
	hp: number;
	speed: number;
	radius: number;
	contact: number;
	damage: number;
	dormant: boolean;
	walkPhase: number;
	hitSquashUntil?: number;
	flashUntil?: number;
	mesh?: Group;
	flashMaterial?: MeshStandardMaterial;
	weapon: Item;
	nextShotAt?: number;
}

export function isBossKind(kind: MonsterKind): boolean {
	return STATS[kind].isBoss;
}

export function createMonster(
	kind: MonsterKind,
	x: number,
	z: number,
	roomIndex: number,
	weapon: Item,
): Monster {
	const s = STATS[kind];
	const monster: Monster = {
		kind,
		roomIndex,
		x,
		z,
		hp: s.hp,
		speed: s.speed,
		radius: s.radius,
		contact: s.contact,
		damage: s.damage,
		dormant: !s.isBoss,
		walkPhase: 0,
		weapon,
	};
	if (weapon.kind === "bow") monster.nextShotAt = 0;
	return monster;
}

export function moveMonsterTowards(
	m: Monster,
	targetX: number,
	targetZ: number,
	dt: number,
): void {
	if (m.dormant) return;
	const dx = targetX - m.x;
	const dz = targetZ - m.z;
	const d = Math.hypot(dx, dz);
	if (d < 0.01) return;
	const step = Math.min(d, m.speed * dt);
	m.x += (dx / d) * step;
	m.z += (dz / d) * step;
}

export function overlapsPlayer(
	m: Monster,
	px: number,
	pz: number,
	pr: number,
): boolean {
	const d = Math.hypot(m.x - px, m.z - pz);
	return d < m.contact + pr;
}

export interface MonsterModel {
	group: Group;
	flashMaterial: MeshStandardMaterial;
	weaponAnchor: Group;
}

export function createMonsterModel(
	kind: MonsterKind,
	item: Item,
): MonsterModel {
	const model = ((): MonsterModel => {
		switch (kind) {
			case "skeleton":
				return buildSkeleton();
			case "zombie":
				return buildZombie();
			case "grimReaper":
				return buildGrimReaper();
			case "goblin":
				return buildGoblin();
			case "orc":
				return buildOrc();
			case "minotaur":
				return buildMinotaur();
			case "slime":
				return buildSlime();
			case "fireElemental":
				return buildFireElemental();
			case "lich":
				return buildLich();
		}
	})();
	const [ax, ay, az] = WEAPON_ANCHOR[kind];
	model.weaponAnchor.position.set(ax, ay, az);
	const held = buildHeldWeaponMesh(item);
	model.weaponAnchor.add(held);
	return model;
}

function buildSkeleton(): MonsterModel {
	const group = new Group();
	const bone = new MeshStandardMaterial({ color: 0xf2ead2 });
	const dark = new MeshStandardMaterial({ color: 0x080806 });

	const skull = new Mesh(new SphereGeometry(0.18, 14, 10), bone);
	skull.position.y = 1.18;
	skull.scale.y = 0.95;
	group.add(skull);

	for (const ex of [-0.07, 0.07]) {
		const socket = new Mesh(new SphereGeometry(0.045, 8, 6), dark);
		socket.position.set(ex, 1.2, 0.14);
		group.add(socket);
	}
	const noseHole = new Mesh(new SphereGeometry(0.025, 6, 6), dark);
	noseHole.position.set(0, 1.13, 0.17);
	group.add(noseHole);

	const jaw = new Mesh(new BoxGeometry(0.2, 0.06, 0.14), bone);
	jaw.position.set(0, 1.02, 0.04);
	group.add(jaw);
	for (let i = 0; i < 5; i++) {
		const tooth = new Mesh(new BoxGeometry(0.025, 0.04, 0.02), bone);
		tooth.position.set(-0.06 + i * 0.03, 1.06, 0.11);
		group.add(tooth);
	}

	const neck = new Mesh(new CylinderGeometry(0.04, 0.04, 0.08, 6), bone);
	neck.position.y = 0.96;
	group.add(neck);

	const spine = new Mesh(new CylinderGeometry(0.03, 0.03, 0.4, 6), bone);
	spine.position.y = 0.72;
	group.add(spine);

	for (const y of [0.88, 0.78, 0.68, 0.58]) {
		const rib = new Mesh(new TorusGeometry(0.16, 0.022, 6, 16), bone);
		rib.position.y = y;
		rib.rotation.x = Math.PI / 2;
		rib.scale.z = 0.7;
		group.add(rib);
	}

	const pelvis = new Mesh(new BoxGeometry(0.28, 0.09, 0.15), bone);
	pelvis.position.y = 0.5;
	group.add(pelvis);

	for (const sx of [-0.22, 0.22]) {
		const shoulder = new Mesh(new SphereGeometry(0.05, 8, 6), bone);
		shoulder.position.set(sx, 0.92, 0);
		group.add(shoulder);

		const upper = new Mesh(new CylinderGeometry(0.035, 0.035, 0.26, 6), bone);
		upper.position.set(sx, 0.79, 0);
		group.add(upper);

		const elbow = new Mesh(new SphereGeometry(0.045, 8, 6), bone);
		elbow.position.set(sx, 0.66, 0);
		group.add(elbow);

		const lower = new Mesh(new CylinderGeometry(0.03, 0.03, 0.26, 6), bone);
		lower.position.set(sx, 0.53, 0);
		group.add(lower);

		const hand = new Mesh(new SphereGeometry(0.05, 8, 6), bone);
		hand.position.set(sx, 0.4, 0);
		group.add(hand);
	}

	for (const lx of [-0.09, 0.09]) {
		const hip = new Mesh(new SphereGeometry(0.05, 8, 6), bone);
		hip.position.set(lx, 0.45, 0);
		group.add(hip);

		const thigh = new Mesh(new CylinderGeometry(0.04, 0.04, 0.26, 6), bone);
		thigh.position.set(lx, 0.32, 0);
		group.add(thigh);

		const knee = new Mesh(new SphereGeometry(0.045, 8, 6), bone);
		knee.position.set(lx, 0.19, 0);
		group.add(knee);

		const shin = new Mesh(new CylinderGeometry(0.035, 0.035, 0.18, 6), bone);
		shin.position.set(lx, 0.09, 0);
		group.add(shin);
	}

	const weaponAnchor = new Group();
	group.add(weaponAnchor);
	return { group, flashMaterial: bone, weaponAnchor };
}

function buildZombie(): MonsterModel {
	const group = new Group();
	const flesh = new MeshStandardMaterial({ color: 0x6b8a4a });
	const cloth = new MeshStandardMaterial({ color: 0x554433 });
	const torso = new Mesh(new BoxGeometry(0.55, 0.6, 0.35), cloth);
	torso.position.y = 0.7;
	group.add(torso);
	const head = new Mesh(new SphereGeometry(0.22, 12, 8), flesh);
	head.position.y = 1.15;
	group.add(head);
	const eyeMat = new MeshStandardMaterial({
		color: 0xff3322,
		emissive: 0x441100,
	});
	for (const ex of [-0.07, 0.07]) {
		const eye = new Mesh(new SphereGeometry(0.04, 6, 6), eyeMat);
		eye.position.set(ex, 1.18, 0.18);
		group.add(eye);
	}
	for (const ax of [-0.32, 0.32]) {
		const arm = new Mesh(new CylinderGeometry(0.08, 0.08, 0.55, 6), flesh);
		arm.position.set(ax, 0.7, 0.15);
		arm.rotation.x = -0.4;
		group.add(arm);
	}
	for (const lx of [-0.14, 0.14]) {
		const leg = new Mesh(new BoxGeometry(0.16, 0.4, 0.16), cloth);
		leg.position.set(lx, 0.2, 0);
		group.add(leg);
	}
	const weaponAnchor = new Group();
	group.add(weaponAnchor);
	return { group, flashMaterial: flesh, weaponAnchor };
}

function buildGrimReaper(): MonsterModel {
	const group = new Group();
	const robe = new MeshStandardMaterial({ color: 0x14141a });
	const robeBody = new Mesh(new ConeGeometry(0.7, 1.7, 12, 1, true), robe);
	robeBody.position.y = 0.85;
	group.add(robeBody);
	const skullMat = new MeshStandardMaterial({ color: 0xeeeedd });
	const skull = new Mesh(new SphereGeometry(0.22, 12, 10), skullMat);
	skull.position.y = 1.6;
	group.add(skull);
	const eyeMat = new MeshStandardMaterial({
		color: 0x33ccff,
		emissive: 0x118899,
	});
	for (const ex of [-0.08, 0.08]) {
		const eye = new Mesh(new SphereGeometry(0.04, 6, 6), eyeMat);
		eye.position.set(ex, 1.62, 0.2);
		group.add(eye);
	}
	const handle = new Mesh(
		new CylinderGeometry(0.04, 0.04, 1.6, 6),
		new MeshStandardMaterial({ color: 0x3a2810 }),
	);
	handle.position.set(0.4, 0.85, 0.1);
	handle.rotation.z = -0.1;
	group.add(handle);
	const blade = new Mesh(
		new TorusGeometry(0.3, 0.05, 6, 12, Math.PI),
		new MeshStandardMaterial({ color: 0xcccccc, emissive: 0x222222 }),
	);
	blade.position.set(0.55, 1.55, 0.1);
	blade.rotation.set(Math.PI / 2, 0, Math.PI / 2);
	group.add(blade);
	const weaponAnchor = new Group();
	group.add(weaponAnchor);
	return { group, flashMaterial: robe, weaponAnchor };
}

function buildGoblin(): MonsterModel {
	const group = new Group();
	const skin = new MeshStandardMaterial({ color: 0x4faa44 });
	const tunic = new MeshStandardMaterial({ color: 0x884422 });
	const torso = new Mesh(new BoxGeometry(0.45, 0.4, 0.3), tunic);
	torso.position.y = 0.6;
	group.add(torso);
	const head = new Mesh(new SphereGeometry(0.22, 12, 8), skin);
	head.position.y = 0.95;
	group.add(head);
	for (const ex of [-0.22, 0.22]) {
		const ear = new Mesh(new ConeGeometry(0.06, 0.25, 5), skin);
		ear.position.set(ex, 1.05, 0);
		ear.rotation.z = ex < 0 ? Math.PI / 4 : -Math.PI / 4;
		group.add(ear);
	}
	const eyeMat = new MeshStandardMaterial({
		color: 0xffee44,
		emissive: 0x886600,
	});
	for (const ex of [-0.07, 0.07]) {
		const eye = new Mesh(new SphereGeometry(0.035, 6, 6), eyeMat);
		eye.position.set(ex, 0.97, 0.2);
		group.add(eye);
	}
	for (const ax of [-0.27, 0.27]) {
		const arm = new Mesh(new CylinderGeometry(0.06, 0.06, 0.4, 6), skin);
		arm.position.set(ax, 0.6, 0);
		group.add(arm);
	}
	for (const lx of [-0.11, 0.11]) {
		const leg = new Mesh(new CylinderGeometry(0.07, 0.07, 0.35, 6), skin);
		leg.position.set(lx, 0.175, 0);
		group.add(leg);
	}
	const weaponAnchor = new Group();
	group.add(weaponAnchor);
	return { group, flashMaterial: skin, weaponAnchor };
}

function buildOrc(): MonsterModel {
	const group = new Group();
	const skin = new MeshStandardMaterial({ color: 0x885a2e });
	const armor = new MeshStandardMaterial({ color: 0x444444 });
	const torso = new Mesh(new BoxGeometry(0.7, 0.6, 0.4), armor);
	torso.position.y = 0.75;
	group.add(torso);
	const head = new Mesh(new BoxGeometry(0.4, 0.32, 0.34), skin);
	head.position.y = 1.2;
	group.add(head);
	const tuskMat = new MeshStandardMaterial({ color: 0xeeeecc });
	for (const tx of [-0.08, 0.08]) {
		const tusk = new Mesh(new ConeGeometry(0.03, 0.12, 5), tuskMat);
		tusk.position.set(tx, 1.13, 0.18);
		tusk.rotation.x = Math.PI;
		group.add(tusk);
	}
	const eyeMat = new MeshStandardMaterial({
		color: 0xff3322,
		emissive: 0x441100,
	});
	for (const ex of [-0.1, 0.1]) {
		const eye = new Mesh(new SphereGeometry(0.04, 6, 6), eyeMat);
		eye.position.set(ex, 1.24, 0.18);
		group.add(eye);
	}
	for (const ax of [-0.42, 0.42]) {
		const arm = new Mesh(new CylinderGeometry(0.1, 0.1, 0.55, 6), skin);
		arm.position.set(ax, 0.7, 0);
		group.add(arm);
	}
	for (const lx of [-0.18, 0.18]) {
		const leg = new Mesh(new BoxGeometry(0.2, 0.42, 0.2), armor);
		leg.position.set(lx, 0.21, 0);
		group.add(leg);
	}
	const weaponAnchor = new Group();
	group.add(weaponAnchor);
	return { group, flashMaterial: skin, weaponAnchor };
}

function buildMinotaur(): MonsterModel {
	const group = new Group();
	const fur = new MeshStandardMaterial({ color: 0x5a3014 });
	const hide = new MeshStandardMaterial({ color: 0x3a1f0a });
	const horn = new MeshStandardMaterial({ color: 0xeee2c4 });
	const metal = new MeshStandardMaterial({
		color: 0x888080,
		emissive: 0x111111,
	});
	const black = new MeshStandardMaterial({ color: 0x100804 });

	const torso = new Mesh(new BoxGeometry(0.95, 1.0, 0.55), fur);
	torso.position.y = 1.1;
	group.add(torso);

	const chest = new Mesh(new BoxGeometry(0.85, 0.3, 0.5), fur);
	chest.position.y = 1.45;
	group.add(chest);

	const belt = new Mesh(new BoxGeometry(1.0, 0.14, 0.6), hide);
	belt.position.y = 0.65;
	group.add(belt);

	const head = new Mesh(new BoxGeometry(0.55, 0.42, 0.5), fur);
	head.position.set(0, 1.88, 0.05);
	group.add(head);

	const snout = new Mesh(new BoxGeometry(0.35, 0.28, 0.3), hide);
	snout.position.set(0, 1.78, 0.4);
	group.add(snout);

	for (const nx of [-0.07, 0.07]) {
		const nostril = new Mesh(new SphereGeometry(0.03, 6, 6), black);
		nostril.position.set(nx, 1.82, 0.55);
		group.add(nostril);
	}

	const ring = new Mesh(
		new TorusGeometry(0.06, 0.014, 6, 12),
		new MeshStandardMaterial({ color: 0xddaa44 }),
	);
	ring.position.set(0, 1.7, 0.56);
	ring.rotation.x = Math.PI / 2;
	group.add(ring);

	for (const side of [-1, 1]) {
		const hornMesh = new Mesh(new ConeGeometry(0.07, 0.55, 8), horn);
		hornMesh.position.set(side * 0.3, 2.05, 0.05);
		hornMesh.rotation.z = side * (-Math.PI / 2.4);
		hornMesh.rotation.x = -0.25;
		group.add(hornMesh);
	}

	const eyeMat = new MeshStandardMaterial({
		color: 0xff3322,
		emissive: 0x661100,
	});
	for (const ex of [-0.13, 0.13]) {
		const eye = new Mesh(new SphereGeometry(0.05, 8, 6), eyeMat);
		eye.position.set(ex, 1.95, 0.27);
		group.add(eye);
	}

	for (const sx of [-0.34, 0.34]) {
		const ear = new Mesh(new ConeGeometry(0.08, 0.18, 5), fur);
		ear.position.set(sx, 1.92, 0.05);
		ear.rotation.z = sx < 0 ? Math.PI / 2 : -Math.PI / 2;
		group.add(ear);
	}

	for (const ax of [-0.62, 0.62]) {
		const shoulder = new Mesh(new SphereGeometry(0.2, 10, 8), fur);
		shoulder.position.set(ax, 1.5, 0);
		group.add(shoulder);
		const arm = new Mesh(new CylinderGeometry(0.16, 0.14, 0.95, 8), fur);
		arm.position.set(ax, 1.0, 0);
		group.add(arm);
		const fist = new Mesh(new SphereGeometry(0.18, 10, 8), fur);
		fist.position.set(ax, 0.48, 0);
		group.add(fist);
	}

	for (const lx of [-0.25, 0.25]) {
		const thigh = new Mesh(new CylinderGeometry(0.2, 0.16, 0.55, 8), fur);
		thigh.position.set(lx, 0.32, 0);
		group.add(thigh);
		const hoof = new Mesh(new CylinderGeometry(0.18, 0.18, 0.1, 8), black);
		hoof.position.set(lx, 0.05, 0.05);
		group.add(hoof);
	}

	const axeHandle = new Mesh(
		new CylinderGeometry(0.05, 0.05, 1.4, 8),
		new MeshStandardMaterial({ color: 0x3a2010 }),
	);
	axeHandle.position.set(0.78, 1.0, 0.18);
	axeHandle.rotation.z = -0.15;
	group.add(axeHandle);

	const axeHead = new Mesh(new BoxGeometry(0.36, 0.4, 0.06), metal);
	axeHead.position.set(0.95, 1.55, 0.18);
	axeHead.rotation.z = -0.15;
	group.add(axeHead);
	const axeEdge = new Mesh(new ConeGeometry(0.08, 0.3, 4), metal);
	axeEdge.position.set(1.18, 1.55, 0.18);
	axeEdge.rotation.z = -Math.PI / 2;
	group.add(axeEdge);

	const weaponAnchor = new Group();
	group.add(weaponAnchor);
	return { group, flashMaterial: fur, weaponAnchor };
}

function buildSlime(): MonsterModel {
	const group = new Group();
	const slime = new MeshStandardMaterial({
		color: 0x33dd66,
		transparent: true,
		opacity: 0.85,
		emissive: 0x114422,
	});
	const blob = new Mesh(new SphereGeometry(0.5, 16, 12), slime);
	blob.position.y = 0.42;
	blob.scale.set(1, 0.7, 1);
	group.add(blob);
	const top = new Mesh(new SphereGeometry(0.34, 12, 10), slime);
	top.position.y = 0.7;
	top.scale.set(1, 0.6, 1);
	group.add(top);
	const eyeMat = new MeshStandardMaterial({ color: 0x111111 });
	for (const ex of [-0.16, 0.16]) {
		const eye = new Mesh(new SphereGeometry(0.06, 8, 6), eyeMat);
		eye.position.set(ex, 0.5, 0.4);
		group.add(eye);
	}
	const weaponAnchor = new Group();
	group.add(weaponAnchor);
	return { group, flashMaterial: slime, weaponAnchor };
}

function buildFireElemental(): MonsterModel {
	const group = new Group();
	const core = new MeshStandardMaterial({
		color: 0xff7722,
		emissive: 0xcc3300,
	});
	const flame = new MeshStandardMaterial({
		color: 0xffcc44,
		emissive: 0xff7700,
	});
	const heart = new Mesh(new SphereGeometry(0.32, 14, 10), core);
	heart.position.y = 0.55;
	group.add(heart);
	for (let i = 0; i < 4; i++) {
		const angle = (i / 4) * Math.PI * 2;
		const tongue = new Mesh(new ConeGeometry(0.14, 0.55, 6), flame);
		tongue.position.set(Math.cos(angle) * 0.2, 0.85, Math.sin(angle) * 0.2);
		tongue.rotation.set(
			(Math.random() - 0.5) * 0.4,
			angle,
			(Math.random() - 0.5) * 0.4,
		);
		group.add(tongue);
	}
	const tip = new Mesh(new ConeGeometry(0.18, 0.7, 6), flame);
	tip.position.y = 1.25;
	group.add(tip);
	const weaponAnchor = new Group();
	group.add(weaponAnchor);
	return { group, flashMaterial: core, weaponAnchor };
}

function buildLich(): MonsterModel {
	const group = new Group();
	const robe = new MeshStandardMaterial({ color: 0x331a55 });
	const robeBody = new Mesh(new ConeGeometry(0.75, 1.6, 14, 1, true), robe);
	robeBody.position.y = 0.8;
	group.add(robeBody);
	const skullMat = new MeshStandardMaterial({ color: 0xeeeedd });
	const skull = new Mesh(new SphereGeometry(0.26, 12, 10), skullMat);
	skull.position.y = 1.55;
	group.add(skull);
	const crown = new Mesh(
		new TorusGeometry(0.22, 0.04, 8, 16),
		new MeshStandardMaterial({ color: 0xffcc33, emissive: 0x554400 }),
	);
	crown.position.y = 1.78;
	crown.rotation.x = Math.PI / 2;
	group.add(crown);
	const eyeMat = new MeshStandardMaterial({
		color: 0x77ff77,
		emissive: 0x33aa33,
	});
	for (const ex of [-0.09, 0.09]) {
		const eye = new Mesh(new SphereGeometry(0.05, 6, 6), eyeMat);
		eye.position.set(ex, 1.58, 0.23);
		group.add(eye);
	}
	const staff = new Mesh(
		new CylinderGeometry(0.04, 0.04, 1.7, 6),
		new MeshStandardMaterial({ color: 0x2a1a0a }),
	);
	staff.position.set(0.5, 0.85, 0.1);
	group.add(staff);
	const orb = new Mesh(
		new SphereGeometry(0.12, 12, 10),
		new MeshStandardMaterial({ color: 0x66ddff, emissive: 0x227799 }),
	);
	orb.position.set(0.5, 1.75, 0.1);
	group.add(orb);
	const weaponAnchor = new Group();
	group.add(weaponAnchor);
	return { group, flashMaterial: robe, weaponAnchor };
}

function buildHeldWeaponMesh(item: Item): Group {
	const group = new Group();
	const tint = QUALITY_COLORS[item.quality - 1];
	if (item.kind === "sword") {
		const blade = new Mesh(
			new BoxGeometry(0.05, 0.4, 0.02),
			new MeshStandardMaterial({ color: tint, emissive: 0x222222 }),
		);
		blade.position.y = 0.2;
		group.add(blade);
		const guard = new Mesh(
			new BoxGeometry(0.16, 0.04, 0.04),
			new MeshStandardMaterial({ color: 0xddaa44 }),
		);
		group.add(guard);
		const grip = new Mesh(
			new CylinderGeometry(0.02, 0.02, 0.12, 6),
			new MeshStandardMaterial({ color: 0x442211 }),
		);
		grip.position.y = -0.08;
		group.add(grip);
		return group;
	}
	// bow
	const limb = new Mesh(
		new TorusGeometry(0.18, 0.02, 6, 12, Math.PI),
		new MeshStandardMaterial({ color: tint, emissive: 0x331a0d }),
	);
	limb.rotation.x = Math.PI / 2;
	group.add(limb);
	const string = new Mesh(
		new CylinderGeometry(0.004, 0.004, 0.36, 4),
		new MeshStandardMaterial({ color: 0xeeeeee }),
	);
	string.rotation.z = Math.PI / 2;
	group.add(string);
	return group;
}
