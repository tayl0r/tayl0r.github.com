import {
	BoxGeometry,
	CylinderGeometry,
	Group,
	Mesh,
	MeshStandardMaterial,
} from "three";

export type CarModel = "skyline";

export function buildCar(model: CarModel = "skyline"): Group {
	const group = new Group();
	if (model !== "skyline") {
		throw new Error(`car model not implemented: ${model}`);
	}

	const bodyMat = new MeshStandardMaterial({
		color: 0xa060ff,
		metalness: 0.6,
		roughness: 0.35,
	});
	const windowMat = new MeshStandardMaterial({
		color: 0x060010,
		metalness: 0.2,
		roughness: 0.1,
	});
	const wheelMat = new MeshStandardMaterial({
		color: 0x0a0a0a,
		roughness: 0.9,
	});
	const tailMat = new MeshStandardMaterial({
		color: 0xff2244,
		emissive: 0xff2244,
		emissiveIntensity: 1.4,
	});
	const headMat = new MeshStandardMaterial({
		color: 0xffffff,
		emissive: 0xffffff,
		emissiveIntensity: 1.1,
	});

	const addBox = (
		w: number,
		h: number,
		d: number,
		mat: MeshStandardMaterial,
		x: number,
		y: number,
		z: number,
	): Mesh => {
		const m = new Mesh(new BoxGeometry(w, h, d), mat);
		m.position.set(x, y, z);
		group.add(m);
		return m;
	};

	addBox(2.0, 0.5, 4.4, bodyMat, 0, 0.35, 0);
	addBox(1.7, 0.4, 2.0, windowMat, 0, 0.8, -0.1);
	addBox(0.6, 0.1, 0.6, bodyMat, 0, 0.62, 1.2);
	addBox(1.8, 0.15, 0.05, tailMat, 0, 0.5, -2.2);
	addBox(0.4, 0.15, 0.05, headMat, -0.55, 0.5, 2.2);
	addBox(0.4, 0.15, 0.05, headMat, 0.55, 0.5, 2.2);

	const wheelGeo = new CylinderGeometry(0.4, 0.4, 0.5, 16);
	const wheelPositions: [number, number][] = [
		[-0.95, 1.6],
		[0.95, 1.6],
		[-0.95, -1.6],
		[0.95, -1.6],
	];
	for (const [x, z] of wheelPositions) {
		const w = new Mesh(wheelGeo, wheelMat);
		w.position.set(x, 0.4, z);
		w.rotation.z = Math.PI / 2;
		group.add(w);
	}

	return group;
}
