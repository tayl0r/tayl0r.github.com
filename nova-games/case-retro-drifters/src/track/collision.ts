import type { Vec2, Waypoint } from "../types";

export type SegmentHit = {
	segmentIndex: number;
	distance: number;
	t: number;
	closestPoint: Vec2;
};

export function pointToSegment(p: Vec2, a: Vec2, b: Vec2): SegmentHit {
	const dx = b.x - a.x;
	const dz = b.z - a.z;
	const lenSq = dx * dx + dz * dz;
	let t = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.z - a.z) * dz) / lenSq;
	t = Math.max(0, Math.min(1, t));
	const cx = a.x + dx * t;
	const cz = a.z + dz * t;
	return {
		segmentIndex: -1,
		distance: Math.hypot(p.x - cx, p.z - cz),
		t,
		closestPoint: { x: cx, z: cz },
	};
}

export function nearestSegment(p: Vec2, waypoints: Waypoint[]): SegmentHit {
	let best: SegmentHit = {
		segmentIndex: -1,
		distance: Number.POSITIVE_INFINITY,
		t: 0,
		closestPoint: { x: 0, z: 0 },
	};
	for (let i = 0; i < waypoints.length; i++) {
		const a = waypoints[i].pos;
		const b = waypoints[(i + 1) % waypoints.length].pos;
		const hit = pointToSegment(p, a, b);
		if (hit.distance < best.distance) best = { ...hit, segmentIndex: i };
	}
	return best;
}

export function offTrack(p: Vec2, waypoints: Waypoint[]): boolean {
	const hit = nearestSegment(p, waypoints);
	if (hit.segmentIndex < 0) return true;
	const a = waypoints[hit.segmentIndex];
	const b = waypoints[(hit.segmentIndex + 1) % waypoints.length];
	const avgHalfWidth = (a.width + b.width) / 4;
	return hit.distance > avgHalfWidth;
}

export function segmentDirection(a: Vec2, b: Vec2): Vec2 {
	const dx = b.x - a.x;
	const dz = b.z - a.z;
	const len = Math.hypot(dx, dz) || 1;
	return { x: dx / len, z: dz / len };
}
