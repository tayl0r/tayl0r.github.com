import { describe, expect, it } from "vitest";
import type { CarState } from "../types";
import { v2 } from "../types";
import { DRIFT_SPEED_THRESHOLD, initialCarState, updateCar } from "./physics";

const noInput = { throttle: 0, brake: 0, steer: 0, driftPress: false };

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
		expect(s.speed).toBeLessThan(DRIFT_SPEED_THRESHOLD);
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: true },
			0.016,
		);
		expect(s.isDrifting).toBe(false);
		expect(s.grip).toBeGreaterThan(0.9);
	});

	it("drifts on shift tap above speed threshold", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		expect(s.speed).toBeGreaterThan(DRIFT_SPEED_THRESHOLD);
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: true },
			0.016,
		);
		expect(s.isDrifting).toBe(true);
		expect(s.grip).toBeLessThanOrEqual(0.31);
		for (let i = 0; i < 10; i++) {
			s = updateCar(
				s,
				{ throttle: 1, brake: 0, steer: 1, driftPress: false },
				0.016,
			);
		}
		expect(s.isDrifting).toBe(true);
	});

	it("grip recovers after drift auto-releases", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: true },
			0.016,
		);
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		expect(s.isDrifting).toBe(false);
		expect(s.grip).toBeGreaterThan(0.8);
	});

	it("drifting creates lateral velocity", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: true },
			0.016,
		);
		const rightX = Math.cos(s.heading);
		const rightZ = -Math.sin(s.heading);
		const vLateral = Math.abs(s.velocity.x * rightX + s.velocity.z * rightZ);
		expect(vLateral).toBeGreaterThan(1);
	});
});

describe("spin-out", () => {
	it("slip angle exceeding threshold triggers spin-out when drifting", () => {
		// Construct a state where heading (0 = +Z) and velocity (-Z) differ by 180°.
		// Pre-set isDrifting: true because drift now engages on rising edge, not modally.
		const extreme: CarState = {
			...initialCarState(),
			velocity: v2(0, -20),
			speed: 20,
			grip: 0.3,
			isDrifting: true,
		};
		const next = updateCar(
			extreme,
			{ throttle: 0, brake: 0, steer: 1, driftPress: false },
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
			{ throttle: 1, brake: 0, steer: 0, driftPress: false },
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
			isDrifting: true,
		};
		// steer = -1 opposes angularVelocity > 0 → counter-steering active.
		const next = updateCar(
			extreme,
			{ throttle: 0, brake: 0, steer: -1, driftPress: false },
			0.016,
		);
		expect(next.spinOutTimer).toBe(0);
	});
});

describe("drift tap mechanics", () => {
	it("engages drift only on rising edge, not sustained press", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: true },
			0.016,
		);
		expect(s.isDrifting).toBe(true);
		const latAfterEngage = Math.abs(
			s.velocity.x * Math.cos(s.heading) + s.velocity.z * -Math.sin(s.heading),
		);
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: true },
			0.016,
		);
		const latAfterSecond = Math.abs(
			s.velocity.x * Math.cos(s.heading) + s.velocity.z * -Math.sin(s.heading),
		);
		expect(Math.abs(latAfterSecond - latAfterEngage)).toBeLessThan(3);
	});

	it("auto-releases drift when lateral velocity stays near zero", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: true },
			0.016,
		);
		expect(s.isDrifting).toBe(true);
		for (let i = 0; i < 60; i++) {
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		}
		expect(s.isDrifting).toBe(false);
	});

	it("auto-releases drift when speed drops below floor", () => {
		let s = initialCarState();
		for (let i = 0; i < 120; i++)
			s = updateCar(s, { ...noInput, throttle: 1 }, 0.016);
		s = updateCar(
			s,
			{ throttle: 1, brake: 0, steer: 1, driftPress: true },
			0.016,
		);
		expect(s.isDrifting).toBe(true);
		for (let i = 0; i < 200; i++) {
			s = updateCar(
				s,
				{ throttle: 0, brake: 1, steer: 0, driftPress: false },
				0.016,
			);
		}
		expect(s.speed).toBeLessThan(5);
		expect(s.isDrifting).toBe(false);
	});
});
