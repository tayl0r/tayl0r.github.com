import type { CarInput, CarState, Vec2 } from "../types";
import { v2, v2dot, v2len } from "../types";

export const MAX_SPEED = 22.5;
export const DRIFT_SPEED_THRESHOLD = 18;
export const THROTTLE_FORCE = 30;
export const IDLE_DECAY = 4;
export const HARD_BRAKE_DECAY = 30;
export const REVERSE_FORCE = 18;
export const STEER_RATE = 6.5;
export const DRIFT_STEER_MULT = 1.9;
export const ANGULAR_DAMPING = 0.88;
export const GRIP_RECOVERY = 2.5;
export const GRIP_DECAY = 1.4;
export const MIN_GRIP = 0.3;
export const SPIN_OUT_ANGLE = (Math.PI * 2) / 3;
export const SPIN_OUT_DURATION = 0.8;
export const LATERAL_FRICTION = 5;
export const DRIFT_KICK_MAGNITUDE = 0;
export const DRIFT_EXIT_LATERAL = 1.5;
export const DRIFT_EXIT_DURATION = 0.15;
// Grace window after drift entry where the auto-release timer is offset
// negative — gives steering input time to build lateral velocity past the
// engagement threshold before the settle-and-release logic can fire.
export const DRIFT_ENGAGE_GRACE = 0.4;
export const DRIFT_EXIT_SPEED = DRIFT_SPEED_THRESHOLD * 0.6;
export const COUNTERSTEER_DAMP = 0.94;
// When drifting and the player releases steering, bleed lateral velocity
// aggressively so the car settles and the auto-release timer can trip.
// Load-bearing: with grip pinned at MIN_GRIP the default lateral friction
// alone is too weak to bring |vLateral| below DRIFT_EXIT_LATERAL in the
// DRIFT_EXIT_DURATION window.
export const DRIFT_SETTLE_DAMP = 0.92;

export function initialCarState(): CarState {
	return {
		position: v2(0, 0),
		velocity: v2(0, 0),
		heading: 0,
		angularVelocity: 0,
		speed: 0,
		grip: 1,
		isDrifting: false,
		spinOutTimer: 0,
		driftExitTimer: 0,
	};
}

function headingVec(heading: number): Vec2 {
	return v2(Math.sin(heading), Math.cos(heading));
}

export function updateCar(s: CarState, inp: CarInput, dt: number): CarState {
	if (dt <= 0) return s;

	const effectiveInput: CarInput =
		s.spinOutTimer > 0
			? { throttle: 0, reverse: 0, steer: 0, driftPress: false }
			: inp;

	const speedAtFrameStart = s.speed;
	const fwd = headingVec(s.heading);

	const rightX = Math.cos(s.heading);
	const rightZ = -Math.sin(s.heading);
	let vForward = v2dot(s.velocity, fwd);
	let vLateral = s.velocity.x * rightX + s.velocity.z * rightZ;

	let isDrifting = s.isDrifting;
	let driftExitTimer = s.driftExitTimer;
	let grip = s.grip;
	if (
		effectiveInput.driftPress &&
		!isDrifting &&
		s.speed > DRIFT_SPEED_THRESHOLD &&
		s.spinOutTimer === 0
	) {
		isDrifting = true;
		const kickSign = Math.sign(effectiveInput.steer) || 1;
		vLateral += kickSign * DRIFT_KICK_MAGNITUDE;
		grip = MIN_GRIP;
		driftExitTimer = -DRIFT_ENGAGE_GRACE;
	}

	if (isDrifting) {
		grip = MIN_GRIP;
	} else if (grip < 1) {
		grip = Math.min(1, grip + GRIP_RECOVERY * dt);
	}

	const steerMult = isDrifting ? DRIFT_STEER_MULT : 1;
	let angularVelocity =
		s.angularVelocity + effectiveInput.steer * STEER_RATE * steerMult * dt;
	angularVelocity *= ANGULAR_DAMPING ** (dt * 60);

	vForward += effectiveInput.throttle * THROTTLE_FORCE * dt;
	if (effectiveInput.throttle === 0) {
		const decay = IDLE_DECAY * dt;
		vForward =
			vForward > 0
				? Math.max(0, vForward - decay)
				: Math.min(0, vForward + decay);
	}
	if (effectiveInput.reverse > 0) {
		if (vForward > 0) {
			vForward = Math.max(0, vForward - HARD_BRAKE_DECAY * dt);
		} else {
			vForward -= effectiveInput.reverse * REVERSE_FORCE * dt;
		}
	}
	vForward = Math.max(-MAX_SPEED * 0.5, Math.min(MAX_SPEED, vForward));

	if (isDrifting) {
		// Negative sign: heading rotation naturally pushes velocity to lag
		// behind (e.g. right turn → velocity slides left of heading → vLateral
		// goes negative). The injection should reinforce that natural slip,
		// not oppose it.
		const driftInjection =
			(1 - grip) * angularVelocity * Math.abs(vForward) * dt * 0.6;
		vLateral -= driftInjection;
	}

	const lateralDecay = grip * LATERAL_FRICTION * dt;
	vLateral =
		vLateral > 0
			? Math.max(0, vLateral - lateralDecay)
			: Math.min(0, vLateral + lateralDecay);

	// When drifting and the driver isn't steering into the slide anymore,
	// bleed lateral velocity aggressively so the car settles and auto-releases.
	if (isDrifting && Math.abs(effectiveInput.steer) < 0.01) {
		vLateral *= DRIFT_SETTLE_DAMP ** (dt * 60);
	}

	// Lock total speed during drift: the entry kick, drift injection, and
	// throttle should rotate the velocity vector but not increase its magnitude.
	if (isDrifting) {
		const mag = Math.hypot(vForward, vLateral);
		if (mag > 0.001 && speedAtFrameStart > 0.001) {
			const scale = speedAtFrameStart / mag;
			vForward *= scale;
			vLateral *= scale;
		}
	}

	const velocity: Vec2 = {
		x: fwd.x * vForward + rightX * vLateral,
		z: fwd.z * vForward + rightZ * vLateral,
	};

	const heading = s.heading + angularVelocity * dt;
	const position: Vec2 = {
		x: s.position.x + velocity.x * dt,
		z: s.position.z + velocity.z * dt,
	};

	let spinOutTimer = Math.max(0, s.spinOutTimer - dt);
	const vMag = Math.hypot(velocity.x, velocity.z);
	if (spinOutTimer === 0 && isDrifting && vMag > 5) {
		const dot = (velocity.x * fwd.x + velocity.z * fwd.z) / vMag;
		const slip = Math.acos(Math.max(-1, Math.min(1, dot)));
		const counterSteering =
			Math.sign(effectiveInput.steer) !== 0 &&
			Math.sign(effectiveInput.steer) === -Math.sign(angularVelocity) &&
			Math.abs(effectiveInput.steer) > 0.5;
		if (slip > SPIN_OUT_ANGLE && !counterSteering) {
			spinOutTimer = SPIN_OUT_DURATION;
			angularVelocity = (Math.random() - 0.5) * 8;
			velocity.x *= 0.2;
			velocity.z *= 0.2;
			isDrifting = false;
		}
	}

	if (
		isDrifting &&
		Math.sign(effectiveInput.steer) !== 0 &&
		Math.sign(effectiveInput.steer) === -Math.sign(angularVelocity)
	) {
		angularVelocity *= COUNTERSTEER_DAMP ** (dt * 60);
	}

	if (isDrifting) {
		if (Math.abs(vLateral) < DRIFT_EXIT_LATERAL) {
			driftExitTimer += dt;
		} else {
			driftExitTimer = 0;
		}
		const speedNow = Math.hypot(velocity.x, velocity.z);
		if (driftExitTimer >= DRIFT_EXIT_DURATION || speedNow < DRIFT_EXIT_SPEED) {
			isDrifting = false;
			driftExitTimer = 0;
		}
	} else {
		driftExitTimer = 0;
	}

	return {
		position,
		velocity,
		heading,
		angularVelocity,
		speed: v2len(velocity),
		grip,
		isDrifting,
		spinOutTimer,
		driftExitTimer,
	};
}
