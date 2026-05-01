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
	minDriftSpeed: 8,
	entryAngleThreshold: 0.15,
	exitSlipThreshold: 0.08,
	maxYawRate: 4.0,
	spinExitYawRate: 0.5,
	steerAuthorityGrip: 1.0,
	steerAuthorityDrift: 3.5,
	lateralGripGrip: 14.0,
	lateralGripDrift: 1.0,
	longitudinalGripDrift: 0.7,
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
			// Hold-Shift to engage drift (forgiving — players don't have to time
			// the tap with the turn). Exit on Shift-release in DRIFTING below.
			if (
				a.input.drift &&
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
