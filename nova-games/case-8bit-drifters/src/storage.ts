const KEY = "case-8bit-drifters";

export type StoredState = {
	profile: { name: string } | null;
	bests: Record<string, number>;
};

export function loadState(): StoredState {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return { profile: null, bests: {} };
		const parsed = JSON.parse(raw) as Partial<StoredState>;
		return {
			profile: parsed.profile ?? null,
			bests: parsed.bests ?? {},
		};
	} catch {
		return { profile: null, bests: {} };
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
