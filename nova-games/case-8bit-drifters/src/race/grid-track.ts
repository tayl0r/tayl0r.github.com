// Grid-based custom track. The user paints cells in the editor; the racer
// drives over the painted cells. The world is centered at (0,0) so the
// existing car/camera math still applies — grid (col=150, row=150) is at
// world origin.

export const GRID_COLS = 300;
export const GRID_ROWS = 300;
export const CELL_SIZE = 20; // world units per cell
export const GRID_HALF_W = (GRID_COLS * CELL_SIZE) / 2;
export const GRID_HALF_H = (GRID_ROWS * CELL_SIZE) / 2;

export const CELL_EMPTY = 0;
export const CELL_TRACK = 1;
export const CELL_START = 2;

export type GridTrack = {
	cells: Uint8Array; // length GRID_COLS * GRID_ROWS
};

export function createEmptyGrid(): GridTrack {
	return { cells: new Uint8Array(GRID_COLS * GRID_ROWS) };
}

export function cellIndex(col: number, row: number): number {
	return row * GRID_COLS + col;
}

export function cellAt(grid: GridTrack, col: number, row: number): number {
	if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return 0;
	return grid.cells[cellIndex(col, row)];
}

/** World coords of cell center. */
export function cellCenter(col: number, row: number): { x: number; y: number } {
	return {
		x: col * CELL_SIZE - GRID_HALF_W + CELL_SIZE / 2,
		y: row * CELL_SIZE - GRID_HALF_H + CELL_SIZE / 2,
	};
}

/** Convert world coords to grid cell. May return out-of-range values. */
export function worldToCell(
	x: number,
	y: number,
): { col: number; row: number } {
	return {
		col: Math.floor((x + GRID_HALF_W) / CELL_SIZE),
		row: Math.floor((y + GRID_HALF_H) / CELL_SIZE),
	};
}

export function hasAnyStart(grid: GridTrack): boolean {
	for (let i = 0; i < grid.cells.length; i++) {
		if (grid.cells[i] === CELL_START) return true;
	}
	return false;
}

export function findFirstStart(
	grid: GridTrack,
): { col: number; row: number } | null {
	for (let i = 0; i < grid.cells.length; i++) {
		if (grid.cells[i] === CELL_START) {
			return { col: i % GRID_COLS, row: Math.floor(i / GRID_COLS) };
		}
	}
	return null;
}

/** Pick a starting facing angle (radians) by looking at TRACK cells adjacent
 * to the start cell. Drives the car AWAY from the start, INTO the track.
 * Falls back to facing +x if no adjacent track. */
export function startFacingAt(
	grid: GridTrack,
	col: number,
	row: number,
): number {
	const e = cellAt(grid, col + 1, row) === CELL_TRACK;
	const w = cellAt(grid, col - 1, row) === CELL_TRACK;
	const s = cellAt(grid, col, row + 1) === CELL_TRACK;
	const n = cellAt(grid, col, row - 1) === CELL_TRACK;
	if (e) return 0;
	if (w) return Math.PI;
	if (s) return Math.PI / 2;
	if (n) return -Math.PI / 2;
	return 0;
}
