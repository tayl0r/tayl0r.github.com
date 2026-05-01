import { Container, Graphics } from "pixi.js";
import type { TrackData, Vec2 } from "./track-data";

export type Track = {
	view: Container;
	data: TrackData;
	startPos: Vec2;
	startTangent: Vec2; // unit vector along the road at start
};

function unit(dx: number, dy: number): Vec2 {
	const m = Math.hypot(dx, dy) || 1;
	return { x: dx / m, y: dy / m };
}

export function buildTrack(data: TrackData): Track {
	const view = new Container();

	const ground = new Graphics();
	// Lake first (under road if they overlap)
	if (data.lake) {
		ground
			.ellipse(data.lake.cx, data.lake.cy, data.lake.rx, data.lake.ry)
			.fill(0x1a4060)
			.stroke({ color: 0x0a2030, width: 4 });
		// Park grass ring
		ground
			.ellipse(data.lake.cx, data.lake.cy, data.lake.rx + 40, data.lake.ry + 30)
			.stroke({ color: 0x244c2c, width: 6, alpha: 0.6 });
	}
	// Yellow boundary FIRST as a wider stroke; asphalt drawn on top so only
	// the outer 2px on each side stays visibly yellow. (Drawing asphalt
	// before yellow would let the second pass cover the yellow entirely.)
	ground.poly(closedPath(data.centerline), true).stroke({
		color: 0xf2c000,
		width: data.width + 4,
		alpha: 0.85,
		cap: "round",
		join: "round",
	});
	ground.poly(closedPath(data.centerline), true).stroke({
		color: 0x222a36,
		width: data.width,
		cap: "round",
		join: "round",
	});
	// Center dashed line (thin, on top of asphalt)
	ground
		.poly(closedPath(data.centerline), true)
		.stroke({ color: 0xffe680, width: 2, alpha: 0.55 });
	// Shibuya crosswalk (a few white parallel stripes near waypoint 14)
	const cw = data.centerline[14];
	for (let i = -3; i <= 3; i++) {
		ground
			.rect(cw.x - 60 + i * 14, cw.y - 30, 8, 60)
			.fill({ color: 0xffffff, alpha: 0.7 });
	}
	view.addChild(ground);

	// Start/finish line (a perpendicular stripe)
	const a = data.centerline[data.startIndex];
	const b = data.centerline[(data.startIndex + 1) % data.centerline.length];
	const t = unit(b.x - a.x, b.y - a.y);
	const n = { x: -t.y, y: t.x };
	const sf = new Graphics();
	const half = data.width / 2 + 4;
	sf.moveTo(a.x + n.x * half, a.y + n.y * half)
		.lineTo(a.x - n.x * half, a.y - n.y * half)
		.stroke({ color: 0xffffff, width: 6 });
	view.addChild(sf);

	return {
		view,
		data,
		startPos: { x: a.x, y: a.y },
		startTangent: t,
	};
}

function closedPath(points: Vec2[]): number[] {
	const out: number[] = [];
	for (const p of points) out.push(p.x, p.y);
	return out;
}
