import { Container, Graphics } from "pixi.js";

export type Tire = {
	view: Container;
	update(dt: number): void;
};

export function createTire(radius: number): Tire {
	const view = new Container();

	// Black tire base + silver rim + hub
	const base = new Graphics()
		.circle(0, 0, radius)
		.fill(0x111111)
		.circle(0, 0, radius * 0.55)
		.fill(0xc0c4cc)
		.circle(0, 0, radius * 0.18)
		.fill(0x6a6e76);

	// Tread ring (24 ticks around the outside, baked into base — they spin
	// with the tire). Compute each tick's two endpoints with sin/cos rather
	// than relying on per-shape rotation (Graphics has one rotation, not per
	// path).
	for (let i = 0; i < 24; i++) {
		const a = (i / 24) * Math.PI * 2;
		const ca = Math.cos(a);
		const sa = Math.sin(a);
		const r0 = radius * 0.92;
		const r1 = radius * 1.0;
		const w = radius * 0.05;
		// Tangent vector for the tick's "thickness"
		const tx = -sa;
		const ty = ca;
		const x0 = ca * r0;
		const y0 = sa * r0;
		const x1 = ca * r1;
		const y1 = sa * r1;
		base
			.poly(
				[
					x0 + tx * w,
					y0 + ty * w,
					x1 + tx * w,
					y1 + ty * w,
					x1 - tx * w,
					y1 - ty * w,
					x0 - tx * w,
					y0 - ty * w,
				],
				true,
			)
			.fill(0x222222);
	}

	// Five rim spokes — each is a Graphics rotated by its own angle.
	const rim = new Container();
	for (let i = 0; i < 5; i++) {
		const spoke = new Graphics()
			.rect(-radius * 0.05, -radius * 0.5, radius * 0.1, radius * 0.36)
			.fill(0xc0c4cc);
		spoke.rotation = (i / 5) * Math.PI * 2;
		rim.addChild(spoke);
	}
	base.addChild(rim);

	view.addChild(base);

	let spin = 0;
	return {
		view,
		update(dt) {
			spin += dt * Math.PI * 4; // ~2 rev/sec
			base.rotation = spin;
		},
	};
}
