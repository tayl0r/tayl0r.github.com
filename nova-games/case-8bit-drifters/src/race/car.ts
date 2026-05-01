import type { CarLook } from "../art/car";
import { DEFAULT_LOOK } from "../art/car";
import { DEFAULT_DRIFT_CONFIG, type DriftState, stepDriftState } from "./drift";
import type { InputState } from "./input";

export const CAR_PHYSICS = {
	maxSpeed: 240,
	accel: 160,
	reverseAccel: 80,
	brakeFromForward: 200,
	dragLinear: 0.35,
	steerRate: 2.0,
	steerSpeedRef: 80,
	driftEntryKick: 0.6, // fraction of forward speed kicked sideways on drift entry
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
		// Decompose current world velocity into car-local forward/lateral
		// components, BASED ON THE OLD FACING. We use this for accel/brake
		// (which act in car frame) and to compute slip for the drift state.
		const fx = Math.cos(this.facing);
		const fy = Math.sin(this.facing);
		let forwardSpeed = this.vx * fx + this.vy * fy;
		let lateralSpeed = -this.vx * fy + this.vy * fx;

		const slip = Math.atan2(
			Math.abs(lateralSpeed),
			Math.max(0.001, Math.abs(forwardSpeed)),
		);
		const yawRate = (this.facing - this.prevFacing) / Math.max(dt, 0.001);
		this.prevFacing = this.facing;

		const prevState = this.state;
		this.state = stepDriftState({
			state: this.state,
			slip,
			yawRate,
			speed: this.speed,
			input,
			cfg: DEFAULT_DRIFT_CONFIG,
		});

		const cfg = DEFAULT_DRIFT_CONFIG;

		// Drift entry kick: when transitioning GRIP → DRIFTING, push lateral
		// velocity in the steer direction so the slide is immediately visible.
		if (
			prevState === "GRIP" &&
			this.state === "DRIFTING" &&
			input.steer !== 0
		) {
			lateralSpeed +=
				input.steer * Math.abs(forwardSpeed) * CAR_PHYSICS.driftEntryKick;
		}

		// Throttle / brake — act in car frame
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

		// Longitudinal drag specific to drifting (bleed forward speed)
		if (this.state === "DRIFTING") {
			forwardSpeed *= cfg.longitudinalGripDrift ** dt;
		}

		// Speed cap (using combined magnitude)
		const totalSp = Math.hypot(forwardSpeed, lateralSpeed);
		if (totalSp > CAR_PHYSICS.maxSpeed) {
			const k = CAR_PHYSICS.maxSpeed / totalSp;
			forwardSpeed *= k;
			lateralSpeed *= k;
		}

		// Recompose to WORLD velocity using the OLD facing — at this point the
		// car has not yet rotated for this frame. The world-frame velocity
		// vector is what we want to preserve when the car then rotates: in
		// real drift, the car's heading rotates around its own momentum, not
		// with it. The previous bug was using the NEW facing here, which
		// effectively rotated the velocity vector along with the car and made
		// drift indistinguishable from a wider turn radius.
		this.vx = fx * forwardSpeed + -fy * lateralSpeed;
		this.vy = fy * forwardSpeed + fx * lateralSpeed;

		// Steering: rotate facing only. Velocity stays put in world frame.
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

		// Lateral grip in NEW car frame — pull world velocity toward whatever
		// the car is now facing. In GRIP this is fast (instant tracking).
		// In DRIFTING this is slow (visible sideways slide for ~1 second).
		const fx2 = Math.cos(this.facing);
		const fy2 = Math.sin(this.facing);
		const newForward = this.vx * fx2 + this.vy * fy2;
		let newLateral = -this.vx * fy2 + this.vy * fx2;
		const lateralGrip =
			this.state === "DRIFTING" || this.state === "SPINNING"
				? cfg.lateralGripDrift
				: cfg.lateralGripGrip;
		newLateral *= 1 - Math.min(1, lateralGrip * dt);
		this.vx = fx2 * newForward + -fy2 * newLateral;
		this.vy = fy2 * newForward + fx2 * newLateral;

		this.x += this.vx * dt;
		this.y += this.vy * dt;
	}
}
