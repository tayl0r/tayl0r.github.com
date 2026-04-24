import type { CarState, Waypoint } from "../types";
import { nearestSegment } from "./collision";

const WALL_BUFFER = 0.3;
const WALL_INSET = 0.4;
const SCRAPE_RETAIN = 0.92;
const REBOUND = 0.4;
const NUDGE = 0.5;

export function resolveWallCollision(
	car: CarState,
	waypoints: Waypoint[],
): CarState {
	const hit = nearestSegment(car.position, waypoints);
	if (hit.segmentIndex < 0) return car;
	const a = waypoints[hit.segmentIndex].pos;
	const b = waypoints[(hit.segmentIndex + 1) % waypoints.length].pos;
	const halfW = waypoints[hit.segmentIndex].width / 2;
	if (hit.distance <= halfW - WALL_BUFFER) return car;

	const dx = b.x - a.x;
	const dz = b.z - a.z;
	const segLen = Math.hypot(dx, dz) || 1;
	const dirX = dx / segLen;
	const dirZ = dz / segLen;

	const toCarX = car.position.x - hit.closestPoint.x;
	const toCarZ = car.position.z - hit.closestPoint.z;
	const side = Math.sign(toCarX * -dirZ + toCarZ * dirX) || 1;
	const nX = -dirZ * side;
	const nZ = dirX * side;

	const clamp = halfW - WALL_INSET;
	const newPos = {
		x: hit.closestPoint.x + nX * clamp,
		z: hit.closestPoint.z + nZ * clamp,
	};

	const vAlong = car.velocity.x * dirX + car.velocity.z * dirZ;
	const vInto = car.velocity.x * nX + car.velocity.z * nZ;
	const impactSpeed = Math.max(vInto, 0);

	// Steepness: 0 = pure graze (vAlong dominates), 1 = pure head-on.
	// Used to scale up rebound and angular nudge so head-on hits don't
	// pin the car against the wall when the player keeps throttling.
	const steepness =
		impactSpeed / (impactSpeed + Math.abs(vAlong) + 0.001);

	const rebound = REBOUND + steepness * 0.5; // 0.4 → 0.9
	const vAlongNew = vAlong * SCRAPE_RETAIN;
	const vIntoNew = -impactSpeed * rebound;

	const velocity = {
		x: dirX * vAlongNew + nX * vIntoNew,
		z: dirZ * vAlongNew + nZ * vIntoNew,
	};

	// Angular nudge rotates the car toward wall-parallel. Sign falls back
	// to the player's angular velocity (i.e. active steer intent) when
	// vAlong is ~0, and to a constant otherwise — prevents the "stuck
	// facing the wall" case where sign(vAlong) = 0 = no rotation.
	const nudgeSign = Math.sign(vAlong) || Math.sign(car.angularVelocity) || 1;
	const angularNudge = nudgeSign * (NUDGE + steepness * 2);

	return {
		...car,
		position: newPos,
		velocity,
		speed: Math.hypot(velocity.x, velocity.z),
		angularVelocity: car.angularVelocity + angularNudge,
		isDrifting: false,
		grip: 1,
		driftExitTimer: 0,
	};
}
