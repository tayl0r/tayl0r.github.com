export type DriftState = "GRIP" | "DRIFTING" | "SPINNING";

export type DriftConfig = {
	minDriftSpeed: number;
	entryAngleThreshold: number;
	exitSlipThreshold: number;
	maxYawRate: number;
	spinExitYawRate: number;
	steerAuthorityGrip: number;
	steerAuthorityDrift: number;
	lateralGripGrip: number;
	lateralGripDrift: number;
	longitudinalGripDrift: number;
	gripRecoveryRate: number;
};

export const DEFAULT_DRIFT_CONFIG: DriftConfig = {
	minDriftSpeed: 6,
	entryAngleThreshold: 0.15,
	exitSlipThreshold: 0.05,
	maxYawRate: 4.0,
	spinExitYawRate: 0.5,
	steerAuthorityGrip: 1.0,
	steerAuthorityDrift: 2.5,
	lateralGripGrip: 12.0,
	lateralGripDrift: 2.5,
	longitudinalGripDrift: 0.85,
	gripRecoveryRate: 8.0,
};

export type StepArgs = {
	state: DriftState;
	slip: number;
	yawRate: number;
	speed: number;
	input: { drift: boolean; driftPressed: boolean; steer: -1 | 0 | 1 };
	cfg: DriftConfig;
};

export function stepDriftState(a: StepArgs): DriftState {
	switch (a.state) {
		case "GRIP":
			if (
				a.input.driftPressed &&
				a.input.steer !== 0 &&
				a.speed >= a.cfg.minDriftSpeed
			) {
				return "DRIFTING";
			}
			return "GRIP";
		case "DRIFTING":
			if (Math.abs(a.yawRate) > a.cfg.maxYawRate) return "SPINNING";
			if (!a.input.drift && a.slip < a.cfg.exitSlipThreshold) return "GRIP";
			return "DRIFTING";
		case "SPINNING":
			if (Math.abs(a.yawRate) < a.cfg.spinExitYawRate) return "GRIP";
			return "SPINNING";
	}
}
