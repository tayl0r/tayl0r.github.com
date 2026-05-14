const KEY = "case-8bit-drifters";

export type StoredState = {
	profile: { name: string } | null;
	bests: Record<string, number>;
	carId: string | null;
};

export function loadState(): StoredState {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return { profile: null, bests: {}, carId: null };
		const parsed = JSON.parse(raw) as Partial<StoredState>;
		return {
			profile: parsed.profile ?? null,
			bests: parsed.bests ?? {},
			carId: parsed.carId ?? null,
		};
	} catch {
		return { profile: null, bests: {}, carId: null };
	}
}

export function saveState(state: StoredState): void {
	try {
		localStorage.setItem(KEY, JSON.stringify(state));
	} catch {
		// quota or disabled — silently ignore; nothing precious here
	}
}

/** Persist whatever's currently in the GameContext. Lives here (not main.ts)
 * to avoid circular imports between scenes and main. */
export function persist(state: StoredState): void {
	saveState(state);
}
