import type { CarLook } from "../art/car";
import { DEFAULT_LOOK } from "../art/car";
import { DEFAULT_DRIFT_CONFIG, type DriftState, stepDriftState } from "./drift";
import type { InputState } from "./input";

export const CAR_PHYSICS = {
	maxSpeed: 32,
	accel: 18,
	reverseAccel: 10,
	brakeFromForward: 28,
	dragLinear: 0.6,
	steerRate: 2.4,
	steerSpeedRef: 18,
};

export class Car {
	x = 0;
	y = 0;
	vx = 0;
	vy = 0;
	facing = 0;
	look: CarLook = DEFAULT_LOOK;
	state: DriftState = "GRIP";

	private prevFacing = 0;
	private _braking = false;

	get speed(): number {
		return Math.hypot(this.vx, this.vy);
	}

	get braking(): boolean {
		return this._braking;
	}

	snapToFacing(angle: number): void {
		this.facing = angle;
		this.prevFacing = angle;
	}

	update(dt: number, input: InputState): void {
		const fx = Math.cos(this.facing);
		const fy = Math.sin(this.facing);
		// Decompose current velocity along facing axes
		let forwardSpeed = this.vx * fx + this.vy * fy;
		let lateralSpeed = -this.vx * fy + this.vy * fx;

		const slip = Math.atan2(
			Math.abs(lateralSpeed),
			Math.max(0.001, Math.abs(forwardSpeed)),
		);
		const yawRate = (this.facing - this.prevFacing) / Math.max(dt, 0.001);
		this.prevFacing = this.facing;

		this.state = stepDriftState({
			state: this.state,
			slip,
			yawRate,
			speed: this.speed,
			input,
			cfg: DEFAULT_DRIFT_CONFIG,
		});

		const cfg = DEFAULT_DRIFT_CONFIG;

		// All velocity changes happen on forward/lateral, then we reconstruct
		// vx/vy at the end. Doing throttle on vx/vy directly is a bug because
		// the lateral/forward grip step below would discard those changes.
		this._braking = false;
		if (input.throttle === 1) {
			forwardSpeed += CAR_PHYSICS.accel * dt;
		} else if (input.throttle === -1) {
			if (forwardSpeed > 1) {
				forwardSpeed -= CAR_PHYSICS.brakeFromForward * dt;
				this._braking = true;
			} else {
				forwardSpeed -= CAR_PHYSICS.reverseAccel * dt;
			}
		}

		// Linear drag on both components
		const dragMul = 1 - CAR_PHYSICS.dragLinear * dt;
		forwardSpeed *= dragMul;
		lateralSpeed *= dragMul;

		// Speed cap (using combined magnitude)
		const totalSp = Math.hypot(forwardSpeed, lateralSpeed);
		if (totalSp > CAR_PHYSICS.maxSpeed) {
			const k = CAR_PHYSICS.maxSpeed / totalSp;
			forwardSpeed *= k;
			lateralSpeed *= k;
		}

		const steerAuthority =
			this.state === "DRIFTING"
				? cfg.steerAuthorityDrift
				: cfg.steerAuthorityGrip;
		if (input.steer !== 0) {
			const speedFactor = Math.min(1, totalSp / CAR_PHYSICS.steerSpeedRef);
			const sign = forwardSpeed >= 0 ? 1 : -1;
			this.facing +=
				input.steer *
				CAR_PHYSICS.steerRate *
				speedFactor *
				sign *
				steerAuthority *
				dt;
		}
		if (this.state === "SPINNING") {
			this.facing += yawRate * dt * 0.6;
		}

		// Lateral grip — bleed sideways speed back into the facing direction
		const lateralGrip =
			this.state === "DRIFTING" || this.state === "SPINNING"
				? cfg.lateralGripDrift
				: cfg.lateralGripGrip;
		lateralSpeed *= 1 - Math.min(1, lateralGrip * dt);
		// Longitudinal drag specific to drifting
		if (this.state === "DRIFTING") {
			forwardSpeed *= cfg.longitudinalGripDrift ** dt;
		}

		// Reconstruct vx/vy using CURRENT facing (which may have just rotated)
		const fx2 = Math.cos(this.facing);
		const fy2 = Math.sin(this.facing);
		this.vx = fx2 * forwardSpeed + -fy2 * lateralSpeed;
		this.vy = fy2 * forwardSpeed + fx2 * lateralSpeed;

		this.x += this.vx * dt;
		this.y += this.vy * dt;
	}
}
