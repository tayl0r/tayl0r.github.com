import { Container, Graphics } from "pixi.js";

export type ParticleSpawn = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	ttl: number;
};

export type Particles = {
	view: Container;
	spawn(p: ParticleSpawn): void;
	update(dt: number): void;
	aliveCount(): number;
};

export function createParticles(size = 256): Particles {
	const x = new Float32Array(size);
	const y = new Float32Array(size);
	const vx = new Float32Array(size);
	const vy = new Float32Array(size);
	const age = new Float32Array(size);
	const ttl = new Float32Array(size).fill(0);
	let head = 0;

	const view = new Container();
	const g = new Graphics();
	view.addChild(g);

	return {
		view,
		spawn(p) {
			x[head] = p.x;
			y[head] = p.y;
			vx[head] = p.vx;
			vy[head] = p.vy;
			age[head] = 0;
			ttl[head] = p.ttl;
			head = (head + 1) % size;
		},
		update(dt) {
			g.clear();
			for (let i = 0; i < size; i++) {
				if (ttl[i] <= 0) continue;
				age[i] += dt;
				if (age[i] >= ttl[i]) {
					ttl[i] = 0;
					continue;
				}
				x[i] += vx[i] * dt;
				y[i] += vy[i] * dt;
				const t = age[i] / ttl[i]; // 0..1
				const r = 4 + t * 12;
				const a = (1 - t) * 0.6;
				g.circle(x[i], y[i], r).fill({ color: 0xcccccc, alpha: a });
			}
		},
		aliveCount() {
			let n = 0;
			for (let i = 0; i < size; i++) if (ttl[i] > 0) n++;
			return n;
		},
	};
}
