import { expect, test } from "vitest";
import {
	DEFAULT_DRIFT_CONFIG,
	type DriftConfig,
	stepDriftState,
} from "./drift";

const cfg: DriftConfig = DEFAULT_DRIFT_CONFIG;

test("GRIP → DRIFTING when shift pressed at speed with steering", () => {
	const next = stepDriftState({
		state: "GRIP",
		slip: 0,
		yawRate: 0,
		speed: 10,
		input: { drift: true, driftPressed: true, steer: 1 },
		cfg,
	});
	expect(next).toBe("DRIFTING");
});

test("GRIP stays GRIP when speed below minDriftSpeed", () => {
	const next = stepDriftState({
		state: "GRIP",
		slip: 0,
		yawRate: 0,
		speed: 2,
		input: { drift: true, driftPressed: true, steer: 1 },
		cfg,
	});
	expect(next).toBe("GRIP");
});

test("GRIP stays GRIP when not steering", () => {
	const next = stepDriftState({
		state: "GRIP",
		slip: 0,
		yawRate: 0,
		speed: 10,
		input: { drift: true, driftPressed: true, steer: 0 },
		cfg,
	});
	expect(next).toBe("GRIP");
});

test("DRIFTING → SPINNING when yawRate exceeds maxYawRate", () => {
	const next = stepDriftState({
		state: "DRIFTING",
		slip: 0.5,
		yawRate: cfg.maxYawRate + 0.1,
		speed: 10,
		input: { drift: true, driftPressed: false, steer: 1 },
		cfg,
	});
	expect(next).toBe("SPINNING");
});

test("DRIFTING → GRIP when shift released and slip below exit threshold", () => {
	const next = stepDriftState({
		state: "DRIFTING",
		slip: cfg.exitSlipThreshold - 0.001,
		yawRate: 0.1,
		speed: 10,
		input: { drift: false, driftPressed: false, steer: 0 },
		cfg,
	});
	expect(next).toBe("GRIP");
});

test("SPINNING → GRIP when yawRate falls below spinExitYawRate", () => {
	const next = stepDriftState({
		state: "SPINNING",
		slip: 0.5,
		yawRate: cfg.spinExitYawRate - 0.01,
		speed: 10,
		input: { drift: false, driftPressed: false, steer: 0 },
		cfg,
	});
	expect(next).toBe("GRIP");
});
