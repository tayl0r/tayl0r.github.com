import {
	BufferAttribute,
	BufferGeometry,
	CanvasTexture,
	NormalBlending,
	Points,
	PointsMaterial,
	type Scene,
} from "three";

const MAX_PARTICLES = 80;
const LIFETIME = 0.8;

export type SmokeFx = {
	emit(
		x: number,
		y: number,
		z: number,
		vx: number,
		vy: number,
		vz: number,
	): void;
	update(dt: number): void;
	dispose(): void;
};

function makePuffTexture(): CanvasTexture {
	const size = 64;
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (ctx) {
		const grad = ctx.createRadialGradient(
			size / 2,
			size / 2,
			2,
			size / 2,
			size / 2,
			size / 2,
		);
		grad.addColorStop(0, "rgba(255,255,255,1)");
		grad.addColorStop(0.4, "rgba(255,255,255,0.5)");
		grad.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = grad;
		ctx.fillRect(0, 0, size, size);
	}
	return new CanvasTexture(canvas);
}

export function createSmoke(scene: Scene): SmokeFx {
	const positions = new Float32Array(MAX_PARTICLES * 3);
	const velocities = new Float32Array(MAX_PARTICLES * 3);
	const ages = new Float32Array(MAX_PARTICLES);
	const alive = new Uint8Array(MAX_PARTICLES);

	for (let i = 0; i < MAX_PARTICLES; i++) {
		positions[i * 3 + 0] = 0;
		positions[i * 3 + 1] = -1000;
		positions[i * 3 + 2] = 0;
	}

	const geo = new BufferGeometry();
	geo.setAttribute("position", new BufferAttribute(positions, 3));

	const texture = makePuffTexture();
	// PointsMaterial.size is a single uniform for the whole draw call — we
	// can't vary it per particle without a custom shader. Fix it at a size
	// that reads as a mid-life puff; fresh particles pop in and old ones
	// fade by disappearing rather than shrinking.
	const mat = new PointsMaterial({
		size: 2.5,
		map: texture,
		color: 0xc8c8c8,
		transparent: true,
		depthWrite: false,
		blending: NormalBlending,
		sizeAttenuation: true,
	});
	const points = new Points(geo, mat);
	points.frustumCulled = false;
	scene.add(points);

	let nextSearch = 0;
	const findSlot = (): number => {
		for (let j = 0; j < MAX_PARTICLES; j++) {
			const i = (nextSearch + j) % MAX_PARTICLES;
			if (!alive[i]) {
				nextSearch = (i + 1) % MAX_PARTICLES;
				return i;
			}
		}
		return -1;
	};

	const emit: SmokeFx["emit"] = (x, y, z, vx, vy, vz) => {
		const i = findSlot();
		if (i < 0) return;
		alive[i] = 1;
		ages[i] = 0;
		positions[i * 3 + 0] = x;
		positions[i * 3 + 1] = y;
		positions[i * 3 + 2] = z;
		velocities[i * 3 + 0] = vx;
		velocities[i * 3 + 1] = vy;
		velocities[i * 3 + 2] = vz;
	};

	const update: SmokeFx["update"] = (dt) => {
		for (let i = 0; i < MAX_PARTICLES; i++) {
			if (!alive[i]) continue;
			ages[i] += dt;
			if (ages[i] >= LIFETIME) {
				alive[i] = 0;
				positions[i * 3 + 1] = -1000;
				continue;
			}
			velocities[i * 3 + 1] += 0.6 * dt;
			positions[i * 3 + 0] += velocities[i * 3 + 0] * dt;
			positions[i * 3 + 1] += velocities[i * 3 + 1] * dt;
			positions[i * 3 + 2] += velocities[i * 3 + 2] * dt;
		}
		const posAttr = geo.getAttribute("position") as BufferAttribute;
		posAttr.needsUpdate = true;
	};

	const dispose = (): void => {
		scene.remove(points);
		geo.dispose();
		mat.dispose();
		texture.dispose();
	};

	return { emit, update, dispose };
}
