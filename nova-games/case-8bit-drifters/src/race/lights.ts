export type LightsPhase =
	| "COUNTDOWN_3"
	| "COUNTDOWN_2"
	| "COUNTDOWN_1"
	| "GO"
	| "HIDDEN";

export type LightsState = { phase: LightsPhase; t: number };

const COUNTDOWN_DURATION = 1.0;
const GO_DURATION = 1.5;

export function advanceLights(s: LightsState, dt: number): LightsState {
	const t = s.t + dt;
	switch (s.phase) {
		case "COUNTDOWN_3":
			return t >= COUNTDOWN_DURATION
				? { phase: "COUNTDOWN_2", t: t - COUNTDOWN_DURATION }
				: { phase: s.phase, t };
		case "COUNTDOWN_2":
			return t >= COUNTDOWN_DURATION
				? { phase: "COUNTDOWN_1", t: t - COUNTDOWN_DURATION }
				: { phase: s.phase, t };
		case "COUNTDOWN_1":
			return t >= COUNTDOWN_DURATION
				? { phase: "GO", t: t - COUNTDOWN_DURATION }
				: { phase: s.phase, t };
		case "GO":
			return t >= GO_DURATION
				? { phase: "HIDDEN", t: 0 }
				: { phase: s.phase, t };
		case "HIDDEN":
			return s;
	}
}

export function inputsEnabled(s: LightsState): boolean {
	return s.phase === "GO" || s.phase === "HIDDEN";
}
