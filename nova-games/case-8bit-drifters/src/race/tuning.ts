import { CAR_PHYSICS } from "./car";
import { DEFAULT_DRIFT_CONFIG } from "./drift";

const KEY = "case-8bit-drifters:tuning";

// Capture defaults at module load — BEFORE loadTuning() can mutate the live
// objects. These are the source of truth for "reset to default".
const PHYSICS_DEFAULTS = { ...CAR_PHYSICS };
const DRIFT_DEFAULTS = { ...DEFAULT_DRIFT_CONFIG };

export function loadTuning(): void {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return;
		const data = JSON.parse(raw) as Partial<{
			physics: Partial<typeof CAR_PHYSICS>;
			drift: Partial<typeof DEFAULT_DRIFT_CONFIG>;
		}>;
		if (data.physics) Object.assign(CAR_PHYSICS, data.physics);
		if (data.drift) Object.assign(DEFAULT_DRIFT_CONFIG, data.drift);
	} catch {
		// corrupt or unavailable — silently ignore, keep code defaults
	}
}

export function saveTuning(): void {
	try {
		localStorage.setItem(
			KEY,
			JSON.stringify({
				physics: CAR_PHYSICS,
				drift: DEFAULT_DRIFT_CONFIG,
			}),
		);
	} catch {
		// quota or disabled — silently ignore
	}
}

export function resetAllTuning(): void {
	Object.assign(CAR_PHYSICS, PHYSICS_DEFAULTS);
	Object.assign(DEFAULT_DRIFT_CONFIG, DRIFT_DEFAULTS);
	saveTuning();
}

export function defaultPhysicsValue(key: keyof typeof CAR_PHYSICS): number {
	return PHYSICS_DEFAULTS[key];
}

export function defaultDriftValue(
	key: keyof typeof DEFAULT_DRIFT_CONFIG,
): number {
	return DRIFT_DEFAULTS[key];
}
