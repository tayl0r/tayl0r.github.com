import { describe, expect, it } from "vitest";
import type { CarState } from "../types";
import { v2 } from "../types";
import { DRIFT_SPEED_THRESHOLD, initialCarState, updateCar } from "./physics";

const noInput = { throttle: 0, brake: 0, steer: 0, driftBtn: false };

describe("updateCar", () => {
	it("returns state with same position at rest with no input", () => {
		const s0 = initialCarState();
		const s1 = updateCar(s0, noInput, 0.016);
		expect(s1.position.x).toBeCloseTo(s0.position.x);
		expect(s1.position.z).toBeCloseTo(s0.position.z);
		expect(s1.speed).toBeCloseTo(0);
	});

	it("throttle accelerates the car forward", () => {
		let s = initialCarState();
		for (let i = 0; i < 60; i++) {
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		}
		expect(s.speed).toBeGreaterThan(5);
		expect(s.velocity.z).toBeGreaterThan(0);
	});

	it("throttle decays when released", () => {
		let s = initialCarState();
		for (let i = 0; i < 60; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		const peak = s.speed;
		for (let i = 0; i < 120; i++) s = updateCar(s, noInput, 0.016);
		expect(s.speed).toBeLessThan(peak - 3);
	});

	it("steering with speed rotates heading", () => {
		let s = initialCarState();
		for (let i = 0; i < 60; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		const h0 = s.heading;
		for (let i = 0; i < 60; i++) {
			s = updateCar(s, { ...noInput, throttle: 1, steer: 1 }, 0.016);
		}
		expect(Math.abs(s.heading - h0)).toBeGreaterThan(0.3);
	});
});

describe("drift & grip", () => {
	it("does not drift below speed threshold", () => {
		let s = initialCarState();
		for (let i = 0; i < 10; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		for (let i = 0; i < 10; i++) {
			s = updateCar(
				s,
				{ throttle: 1, brake: 0, steer: 1, driftBtn: true },
				0.016,
			);
		}
		expect(s.isDrifting).toBe(false);
		expect(s.grip).toBeGreaterThan(0.9);
	});

	it("drifts above speed threshold when shift + steer", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		expect(s.speed).toBeGreaterThan(DRIFT_SPEED_THRESHOLD);
		for (let i = 0; i < 30; i++) {
			s = updateCar(
				s,
				{ throttle: 1, brake: 0, steer: 1, driftBtn: true },
				0.016,
			);
		}
		expect(s.isDrifting).toBe(true);
		expect(s.grip).toBeLessThan(0.8);
	});

	it("grip recovers after drift released", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		for (let i = 0; i < 30; i++) {
			s = updateCar(
				s,
				{ throttle: 1, brake: 0, steer: 1, driftBtn: true },
				0.016,
			);
		}
		const dropped = s.grip;
		expect(dropped).toBeLessThan(0.8);
		for (let i = 0; i < 60; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		expect(s.grip).toBeGreaterThan(dropped + 0.1);
	});

	it("drifting creates lateral velocity (slip angle > 0)", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		for (let i = 0; i < 30; i++) {
			s = updateCar(
				s,
				{ throttle: 1, brake: 0, steer: 1, driftBtn: true },
				0.016,
			);
		}
		const hx = Math.sin(s.heading);
		const hz = Math.cos(s.heading);
		const vMag = Math.hypot(s.velocity.x, s.velocity.z);
		const dot = (s.velocity.x * hx + s.velocity.z * hz) / Math.max(vMag, 1e-5);
		const slip = Math.acos(Math.max(-1, Math.min(1, dot)));
		expect(slip).toBeGreaterThan(0.1);
	});
});

describe("spin-out", () => {
	it("slip angle exceeding threshold triggers spin-out when drifting", () => {
		// Construct a state where heading (0 = +Z) and velocity (-Z) differ by 180°.
		// driftBtn + steer + high speed ensures isDrifting is true this frame.
		const extreme: CarState = {
			...initialCarState(),
			velocity: v2(0, -20),
			speed: 20,
			grip: 0.3,
		};
		const next = updateCar(
			extreme,
			{ throttle: 0, brake: 0, steer: 1, driftBtn: true },
			0.016,
		);
		expect(next.spinOutTimer).toBeGreaterThan(0);
	});

	it("spin-out locks out input (throttle ignored)", () => {
		const stuck: CarState = {
			...initialCarState(),
			spinOutTimer: 0.5,
			velocity: v2(0, 10),
			speed: 10,
		};
		const next = updateCar(
			stuck,
			{ throttle: 1, brake: 0, steer: 0, driftBtn: false },
			0.016,
		);
		expect(next.spinOutTimer).toBeLessThan(0.5);
		expect(next.speed).toBeLessThanOrEqual(stuck.speed);
	});

	it("counter-steering prevents spin-out at high slip", () => {
		const extreme: CarState = {
			...initialCarState(),
			velocity: v2(0, -20),
			speed: 20,
			grip: 0.3,
			angularVelocity: 3,
		};
		// steer = -1 opposes angularVelocity > 0 → counter-steering active.
		const next = updateCar(
			extreme,
			{ throttle: 0, brake: 0, steer: -1, driftBtn: true },
			0.016,
		);
		expect(next.spinOutTimer).toBe(0);
	});
});
