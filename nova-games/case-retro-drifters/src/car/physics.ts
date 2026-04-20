import type { CarInput, CarState, Vec2 } from "../types";
import { v2, v2dot, v2len } from "../types";

export const MAX_SPEED = 30;
export const DRIFT_SPEED_THRESHOLD = 18;
export const THROTTLE_FORCE = 40;
export const IDLE_DECAY = 4;
export const HARD_BRAKE_DECAY = 30;
export const STEER_RATE = 3.0;
export const DRIFT_STEER_MULT = 1.6;
export const ANGULAR_DAMPING = 0.9;
export const GRIP_RECOVERY = 2.5;
export const GRIP_DECAY = 1.4;
export const MIN_GRIP = 0.3;
export const SPIN_OUT_ANGLE = (Math.PI * 2) / 3;
export const SPIN_OUT_DURATION = 0.8;
export const LATERAL_FRICTION = 5;

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
	};
}

function headingVec(heading: number): Vec2 {
	return v2(Math.sin(heading), Math.cos(heading));
}

export function updateCar(s: CarState, inp: CarInput, dt: number): CarState {
	if (dt <= 0) return s;

	const effectiveInput: CarInput =
		s.spinOutTimer > 0
			? { throttle: 0, brake: 0, steer: 0, driftBtn: false }
			: inp;

	const fwd = headingVec(s.heading);

	// Drift state.
	const wantsDrift =
		effectiveInput.driftBtn &&
		Math.abs(effectiveInput.steer) > 0.01 &&
		s.speed > DRIFT_SPEED_THRESHOLD;
	const isDrifting = wantsDrift;
	const gripTarget = isDrifting ? MIN_GRIP : 1;
	const gripRate = isDrifting ? GRIP_DECAY : GRIP_RECOVERY;
	let grip = s.grip;
	if (grip < gripTarget) grip = Math.min(gripTarget, grip + gripRate * dt);
	else if (grip > gripTarget) grip = Math.max(gripTarget, grip - gripRate * dt);

	// Angular velocity.
	const steerMult = isDrifting ? DRIFT_STEER_MULT : 1;
	let angularVelocity =
		s.angularVelocity + effectiveInput.steer * STEER_RATE * steerMult * dt;
	// Framerate-independent exponential damping (reference rate: 60Hz).
	angularVelocity *= ANGULAR_DAMPING ** (dt * 60);

	// Decompose velocity into forward and lateral (right-vector) components.
	const rightX = Math.cos(s.heading);
	const rightZ = -Math.sin(s.heading);
	let vForward = v2dot(s.velocity, fwd);
	let vLateral = s.velocity.x * rightX + s.velocity.z * rightZ;

	// Throttle.
	vForward += effectiveInput.throttle * THROTTLE_FORCE * dt;
	if (effectiveInput.throttle === 0) {
		const decay = IDLE_DECAY * dt;
		vForward =
			vForward > 0
				? Math.max(0, vForward - decay)
				: Math.min(0, vForward + decay);
	}
	if (effectiveInput.brake > 0) {
		const decay = HARD_BRAKE_DECAY * dt;
		vForward =
			vForward > 0
				? Math.max(0, vForward - decay)
				: Math.min(0, vForward + decay);
	}
	vForward = Math.max(-MAX_SPEED * 0.5, Math.min(MAX_SPEED, vForward));

	// Drift: inject lateral velocity proportional to how much heading is
	// rotating vs how much grip we have left.
	const driftInjection =
		(1 - grip) * angularVelocity * Math.abs(vForward) * dt * 0.6;
	vLateral += driftInjection;

	// Lateral friction — stronger with more grip.
	const lateralDecay = grip * LATERAL_FRICTION * dt;
	vLateral =
		vLateral > 0
			? Math.max(0, vLateral - lateralDecay)
			: Math.min(0, vLateral + lateralDecay);

	const velocity: Vec2 = {
		x: fwd.x * vForward + rightX * vLateral,
		z: fwd.z * vForward + rightZ * vLateral,
	};

	const heading = s.heading + angularVelocity * dt;
	const position: Vec2 = {
		x: s.position.x + velocity.x * dt,
		z: s.position.z + velocity.z * dt,
	};

	// Spin-out detection.
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
		}
	}

	// Counter-steer reward: extra damping on angular velocity.
	if (
		isDrifting &&
		Math.sign(effectiveInput.steer) !== 0 &&
		Math.sign(effectiveInput.steer) === -Math.sign(angularVelocity)
	) {
		angularVelocity *= 0.85 ** (dt * 60);
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
	};
}
