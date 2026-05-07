import {
	createEmptyGrid,
	GRID_COLS,
	GRID_ROWS,
	type GridTrack,
} from "./grid-track";

const KEY = "case-8bit-drifters:grid-track";

function uint8ToBase64(arr: Uint8Array): string {
	// String.fromCharCode.apply has a stack-size limit on big arrays, so
	// chunk through it. The grid is 90 KB so this comfortably fits in localStorage
	// after Base64 expansion (~120 KB).
	let bin = "";
	const CHUNK = 8192;
	for (let i = 0; i < arr.length; i += CHUNK) {
		const slice = arr.subarray(i, i + CHUNK);
		bin += String.fromCharCode.apply(null, Array.from(slice));
	}
	return btoa(bin);
}

function base64ToUint8(b64: string): Uint8Array | null {
	try {
		const bin = atob(b64);
		const out = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
		return out;
	} catch {
		return null;
	}
}

export function saveGridTrack(grid: GridTrack): void {
	try {
		localStorage.setItem(KEY, uint8ToBase64(grid.cells));
	} catch {
		// quota / disabled — silently ignore
	}
}

export function loadGridTrack(): GridTrack {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return createEmptyGrid();
		const cells = base64ToUint8(raw);
		const expected = GRID_COLS * GRID_ROWS;
		if (!cells || cells.length !== expected) return createEmptyGrid();
		return { cells };
	} catch {
		return createEmptyGrid();
	}
}

export function hasSavedGridTrack(): boolean {
	try {
		return localStorage.getItem(KEY) !== null;
	} catch {
		return false;
	}
}
