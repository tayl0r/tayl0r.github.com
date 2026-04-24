import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
	type Scene,
	SphereGeometry,
} from "three";

export type LightState = "off" | "red1" | "red2" | "red3" | "green";

export type StartLights = {
	group: Group;
	setState(s: LightState): void;
	dispose(): void;
};

export function createStartLights(
	scene: Scene,
	position: { x: number; z: number },
	rightNormal: { x: number; z: number },
	roadHalfWidth: number,
): StartLights {
	const group = new Group();
	const poleX = position.x + rightNormal.x * (roadHalfWidth + 3);
	const poleZ = position.z + rightNormal.z * (roadHalfWidth + 3);
	group.position.set(poleX, 0, poleZ);

	const poleMat = new MeshStandardMaterial({ color: 0x404040, roughness: 0.8 });
	const pole = new Mesh(new CylinderGeometry(0.1, 0.1, 3, 8), poleMat);
	pole.position.y = 1.5;
	group.add(pole);

	const barMat = new MeshStandardMaterial({ color: 0x202020, roughness: 0.7 });
	const bar = new Mesh(new BoxGeometry(1.4, 0.3, 0.3), barMat);
	bar.position.y = 3;
	group.add(bar);

	const bulbMats: MeshStandardMaterial[] = [];
	const bulbs: Mesh[] = [];
	for (let i = 0; i < 3; i++) {
		const mat = new MeshStandardMaterial({
			color: 0x400000,
			emissive: 0x000000,
			emissiveIntensity: 0,
			roughness: 0.3,
		});
		const bulb = new Mesh(new SphereGeometry(0.14, 16, 12), mat);
		bulb.position.set(-0.45 + i * 0.45, 3, 0.2);
		group.add(bulb);
		bulbMats.push(mat);
		bulbs.push(bulb);
	}

	scene.add(group);

	const setBulb = (
		i: number,
		color: number,
		emissive: number,
		intensity: number,
	): void => {
		bulbMats[i].color.setHex(color);
		bulbMats[i].emissive.setHex(emissive);
		bulbMats[i].emissiveIntensity = intensity;
	};

	const setState = (s: LightState): void => {
		const red = (i: number): void => setBulb(i, 0xff1020, 0xff1020, 2);
		const green = (i: number): void => setBulb(i, 0x20ff40, 0x20ff40, 2.2);
		const dark = (i: number): void => setBulb(i, 0x200000, 0x000000, 0);
		const reds = s === "red1" ? 1 : s === "red2" ? 2 : s === "red3" ? 3 : 0;
		const isGreen = s === "green";
		for (let i = 0; i < 3; i++) {
			if (isGreen) green(i);
			else if (i < reds) red(i);
			else dark(i);
		}
	};

	setState("off");

	return {
		group,
		setState,
		dispose: (): void => {
			scene.remove(group);
			for (const bulb of bulbs)
				(bulb.geometry as { dispose(): void }).dispose();
			for (const mat of bulbMats) mat.dispose();
			(pole.geometry as { dispose(): void }).dispose();
			(bar.geometry as { dispose(): void }).dispose();
			poleMat.dispose();
			barMat.dispose();
		},
	};
}
