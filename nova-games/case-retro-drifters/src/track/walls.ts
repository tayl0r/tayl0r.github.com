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

	const vAlongNew = vAlong * SCRAPE_RETAIN;
	const vIntoNew = -Math.max(vInto, 0) * REBOUND;

	const velocity = {
		x: dirX * vAlongNew + nX * vIntoNew,
		z: dirZ * vAlongNew + nZ * vIntoNew,
	};

	return {
		...car,
		position: newPos,
		velocity,
		speed: Math.hypot(velocity.x, velocity.z),
		angularVelocity: car.angularVelocity + Math.sign(vAlong) * NUDGE,
		isDrifting: false,
		grip: 1,
		driftExitTimer: 0,
	};
}
