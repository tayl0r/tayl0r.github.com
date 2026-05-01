import type { CarLook } from "../art/car";
import { DEFAULT_LOOK } from "../art/car";
import type { InputState } from "./input";

export const CAR_PHYSICS = {
	maxSpeed: 32,
	accel: 18,
	reverseAccel: 10,
	brakeFromForward: 28,
	dragLinear: 0.6,
	steerRate: 2.4, // rad/sec at speed
	steerSpeedRef: 18, // speed at which steerRate applies fully
};

export class Car {
	x = 0;
	y = 0;
	vx = 0;
	vy = 0;
	facing = 0; // radians; 0 = facing +x
	look: CarLook = DEFAULT_LOOK;

	get speed(): number {
		return Math.hypot(this.vx, this.vy);
	}

	get braking(): boolean {
		return this._braking;
	}

	private _braking = false;

	update(dt: number, input: InputState): void {
		// Forward unit vector
		const fx = Math.cos(this.facing);
		const fy = Math.sin(this.facing);
		const forwardSpeed = this.vx * fx + this.vy * fy;

		this._braking = false;
		if (input.throttle === 1) {
			this.vx += fx * CAR_PHYSICS.accel * dt;
			this.vy += fy * CAR_PHYSICS.accel * dt;
		} else if (input.throttle === -1) {
			if (forwardSpeed > 1) {
				const decel = CAR_PHYSICS.brakeFromForward * dt;
				this.vx -= fx * decel;
				this.vy -= fy * decel;
				this._braking = true;
			} else {
				this.vx -= fx * CAR_PHYSICS.reverseAccel * dt;
				this.vy -= fy * CAR_PHYSICS.reverseAccel * dt;
			}
		}
		this.vx *= 1 - CAR_PHYSICS.dragLinear * dt;
		this.vy *= 1 - CAR_PHYSICS.dragLinear * dt;

		const sp = this.speed;
		if (sp > CAR_PHYSICS.maxSpeed) {
			this.vx *= CAR_PHYSICS.maxSpeed / sp;
			this.vy *= CAR_PHYSICS.maxSpeed / sp;
		}

		if (input.steer !== 0) {
			const speedFactor = Math.min(1, this.speed / CAR_PHYSICS.steerSpeedRef);
			const sign = forwardSpeed >= 0 ? 1 : -1;
			this.facing +=
				input.steer * CAR_PHYSICS.steerRate * speedFactor * sign * dt;
		}

		// Snap velocity toward facing in GRIP mode (prevents banked-curve weirdness)
		const desiredVx = fx * forwardSpeed;
		const desiredVy = fy * forwardSpeed;
		this.vx += (desiredVx - this.vx) * Math.min(1, 12 * dt);
		this.vy += (desiredVy - this.vy) * Math.min(1, 12 * dt);

		this.x += this.vx * dt;
		this.y += this.vy * dt;
	}
}
