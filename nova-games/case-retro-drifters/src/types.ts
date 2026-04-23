export type Vec2 = { x: number; z: number };

export type CarInput = {
	throttle: number; // 0..1
	brake: number; // 0..1 (S)
	steer: number; // -1..1
	driftPress: boolean; // rising edge of Shift
};

export type CarState = {
	position: Vec2;
	velocity: Vec2;
	heading: number; // radians; 0 = +Z
	angularVelocity: number;
	speed: number; // |velocity|
	grip: number; // 1.0 full, 0.3 drift min
	isDrifting: boolean;
	spinOutTimer: number; // seconds > 0 = locked out
	driftExitTimer: number; // seconds near-straight while drifting (for auto-release)
};

export type Waypoint = {
	pos: Vec2;
	width: number;
	tag?: "shibuya" | "start";
};

export const v2 = (x: number, z: number): Vec2 => ({ x, z });
export const v2add = (a: Vec2, b: Vec2): Vec2 => ({
	x: a.x + b.x,
	z: a.z + b.z,
});
export const v2sub = (a: Vec2, b: Vec2): Vec2 => ({
	x: a.x - b.x,
	z: a.z - b.z,
});
export const v2scale = (a: Vec2, s: number): Vec2 => ({
	x: a.x * s,
	z: a.z * s,
});
export const v2len = (a: Vec2): number => Math.hypot(a.x, a.z);
export const v2dot = (a: Vec2, b: Vec2): number => a.x * b.x + a.z * b.z;
