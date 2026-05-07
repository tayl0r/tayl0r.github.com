// Convert a painted grid into a TrackData polyline that the existing race
// renderer can consume. Pipeline:
//   1. Mask painted cells (TRACK + START treated equally as "road area")
//   2. Find the centroid of the START cells (this is the start position)
//   3. Distance-transform the painted region (so we can estimate road width)
//   4. Zhang–Suen thinning → 1-cell-wide skeleton
//   5. Walk the skeleton from the start cell, preferring continuity
//   6. Sample every Nth skeleton cell into a polyline
//   7. Use the median distance-transform value × 2 × CELL_SIZE as road width
//
// Returns null if there's no START, the connected component is too small,
// or the resulting polyline is too short to make a sensible track.

import {
	CELL_EMPTY,
	CELL_SIZE,
	CELL_START,
	cellIndex,
	GRID_COLS,
	GRID_HALF_H,
	GRID_HALF_W,
	GRID_ROWS,
	type GridTrack,
} from "./grid-track";
import type { TrackData, Vec2 } from "./track-data";

const N = GRID_COLS * GRID_ROWS;

// 8-neighbor offsets ordered N, NE, E, SE, S, SW, W, NW. Walk preference
// uses this same order for tie-breaking, so a horizontally-painted track
// will tend to start the car heading east (E comes before W).
const NB: ReadonlyArray<readonly [number, number]> = [
	[0, -1], // N
	[1, -1], // NE
	[1, 0], // E
	[1, 1], // SE
	[0, 1], // S
	[-1, 1], // SW
	[-1, 0], // W
	[-1, -1], // NW
];

export function gridToTrackData(grid: GridTrack): TrackData | null {
	// 1. Painted mask + 2. Start centroid
	const painted = new Uint8Array(N);
	let sx = 0;
	let sy = 0;
	let sn = 0;
	for (let row = 0; row < GRID_ROWS; row++) {
		for (let col = 0; col < GRID_COLS; col++) {
			const idx = cellIndex(col, row);
			const v = grid.cells[idx];
			if (v !== CELL_EMPTY) painted[idx] = 1;
			if (v === CELL_START) {
				sx += col;
				sy += row;
				sn++;
			}
		}
	}
	if (sn === 0) return null;
	const startCol = sx / sn;
	const startRow = sy / sn;

	// 3. Distance transform (Chebyshev): each painted cell stores the
	// distance in cells to the nearest unpainted cell.
	const dist = computeDistanceTransform(painted);

	// 4. Skeletonize
	const skel = zhangSuenThin(painted);

	// 5a. Find skeleton cell closest to the start centroid.
	let startIdx = -1;
	let bestStartDist = Number.POSITIVE_INFINITY;
	for (let i = 0; i < N; i++) {
		if (skel[i] !== 1) continue;
		const col = i % GRID_COLS;
		const row = Math.floor(i / GRID_COLS);
		const d = (col - startCol) ** 2 + (row - startRow) ** 2;
		if (d < bestStartDist) {
			bestStartDist = d;
			startIdx = i;
		}
	}
	if (startIdx === -1) return null;

	// 5b. Walk the skeleton from start.
	const startCell = {
		col: startIdx % GRID_COLS,
		row: Math.floor(startIdx / GRID_COLS),
	};
	const path = walkSkeleton(skel, startCell);
	if (path.length < 8) return null;

	// 6. Sample every Nth skeleton cell into a polyline. SAMPLE chosen so
	// that segments are roughly 100 world units long — short enough to
	// resolve corners, long enough to keep the waypoint count manageable.
	const SAMPLE = 5;
	const centerline: Vec2[] = [];
	for (let i = 0; i < path.length; i += SAMPLE) {
		const { col, row } = path[i];
		centerline.push({
			x: col * CELL_SIZE - GRID_HALF_W + CELL_SIZE / 2,
			y: row * CELL_SIZE - GRID_HALF_H + CELL_SIZE / 2,
		});
	}
	if (centerline.length < 4) return null;

	// 7. Width = median distance-transform value along the skeleton, doubled
	// (radius → diameter), in world units. Floored at 40 so a single-cell-wide
	// painted line still becomes a drivable road.
	const widths: number[] = [];
	for (const p of path) widths.push(dist[cellIndex(p.col, p.row)]);
	widths.sort((a, b) => a - b);
	const median = widths[Math.floor(widths.length / 2)] || 1;
	const width = Math.max(40, median * 2 * CELL_SIZE);

	return {
		width,
		startIndex: 0, // we walked starting from the start cell
		centerline,
		buildings: [],
	};
}

function computeDistanceTransform(painted: Uint8Array): Uint16Array {
	// Two-pass Chebyshev distance transform. Each painted cell ends up
	// holding the distance (in cells) to the nearest unpainted neighbor.
	const dist = new Uint16Array(N);
	const MAX = 0xffff;
	for (let i = 0; i < N; i++) dist[i] = painted[i] ? MAX : 0;

	// Forward pass: top-to-bottom, left-to-right.
	for (let row = 0; row < GRID_ROWS; row++) {
		for (let col = 0; col < GRID_COLS; col++) {
			const idx = cellIndex(col, row);
			if (dist[idx] === 0) continue;
			let d = dist[idx];
			if (row > 0) {
				d = Math.min(d, dist[cellIndex(col, row - 1)] + 1);
				if (col > 0) d = Math.min(d, dist[cellIndex(col - 1, row - 1)] + 1);
				if (col < GRID_COLS - 1)
					d = Math.min(d, dist[cellIndex(col + 1, row - 1)] + 1);
			}
			if (col > 0) d = Math.min(d, dist[cellIndex(col - 1, row)] + 1);
			dist[idx] = d;
		}
	}
	// Backward pass: bottom-to-top, right-to-left.
	for (let row = GRID_ROWS - 1; row >= 0; row--) {
		for (let col = GRID_COLS - 1; col >= 0; col--) {
			const idx = cellIndex(col, row);
			if (dist[idx] === 0) continue;
			let d = dist[idx];
			if (row < GRID_ROWS - 1) {
				d = Math.min(d, dist[cellIndex(col, row + 1)] + 1);
				if (col > 0) d = Math.min(d, dist[cellIndex(col - 1, row + 1)] + 1);
				if (col < GRID_COLS - 1)
					d = Math.min(d, dist[cellIndex(col + 1, row + 1)] + 1);
			}
			if (col < GRID_COLS - 1)
				d = Math.min(d, dist[cellIndex(col + 1, row)] + 1);
			dist[idx] = d;
		}
	}
	return dist;
}

function zhangSuenThin(input: Uint8Array): Uint8Array {
	// Standard Zhang–Suen thinning. Iteratively erodes the boundary while
	// preserving connectivity until nothing more can be removed. A 1-cell-
	// wide line is invariant under this algorithm.
	const work = new Uint8Array(input);
	let changed = true;
	while (changed) {
		changed = false;
		for (let pass = 0; pass < 2; pass++) {
			const toRemove: number[] = [];
			for (let row = 1; row < GRID_ROWS - 1; row++) {
				for (let col = 1; col < GRID_COLS - 1; col++) {
					const idx = cellIndex(col, row);
					if (work[idx] !== 1) continue;
					const p2 = work[cellIndex(col, row - 1)];
					const p3 = work[cellIndex(col + 1, row - 1)];
					const p4 = work[cellIndex(col + 1, row)];
					const p5 = work[cellIndex(col + 1, row + 1)];
					const p6 = work[cellIndex(col, row + 1)];
					const p7 = work[cellIndex(col - 1, row + 1)];
					const p8 = work[cellIndex(col - 1, row)];
					const p9 = work[cellIndex(col - 1, row - 1)];
					const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
					if (B < 2 || B > 6) continue;
					let A = 0;
					if (p2 === 0 && p3 === 1) A++;
					if (p3 === 0 && p4 === 1) A++;
					if (p4 === 0 && p5 === 1) A++;
					if (p5 === 0 && p6 === 1) A++;
					if (p6 === 0 && p7 === 1) A++;
					if (p7 === 0 && p8 === 1) A++;
					if (p8 === 0 && p9 === 1) A++;
					if (p9 === 0 && p2 === 1) A++;
					if (A !== 1) continue;
					if (pass === 0) {
						if (p2 * p4 * p6 !== 0) continue;
						if (p4 * p6 * p8 !== 0) continue;
					} else {
						if (p2 * p4 * p8 !== 0) continue;
						if (p2 * p6 * p8 !== 0) continue;
					}
					toRemove.push(idx);
				}
			}
			if (toRemove.length > 0) {
				for (const idx of toRemove) work[idx] = 0;
				changed = true;
			}
		}
	}
	return work;
}

function walkSkeleton(
	skel: Uint8Array,
	start: { col: number; row: number },
): { col: number; row: number }[] {
	// Walks the 1-cell-wide skeleton starting at `start`, preferring the
	// neighbor that's most aligned with the previous step's direction
	// (greedy continuity). For a closed loop, the walk ends when the only
	// remaining neighbor is the start cell itself (already visited).
	const path = [start];
	const visited = new Uint8Array(N);
	visited[cellIndex(start.col, start.row)] = 1;
	let cur = start;
	let prevDx = 0;
	let prevDy = 0;
	while (true) {
		const candidates: { col: number; row: number; dx: number; dy: number }[] =
			[];
		for (const [dc, dr] of NB) {
			const c = cur.col + dc;
			const r = cur.row + dr;
			if (c < 0 || c >= GRID_COLS || r < 0 || r >= GRID_ROWS) continue;
			const idx = cellIndex(c, r);
			if (skel[idx] === 1 && visited[idx] === 0) {
				candidates.push({ col: c, row: r, dx: dc, dy: dr });
			}
		}
		if (candidates.length === 0) break;
		let best = candidates[0];
		if (prevDx !== 0 || prevDy !== 0) {
			let bestDot = -Number.POSITIVE_INFINITY;
			for (const cand of candidates) {
				const dot = cand.dx * prevDx + cand.dy * prevDy;
				if (dot > bestDot) {
					bestDot = dot;
					best = cand;
				}
			}
		}
		path.push({ col: best.col, row: best.row });
		visited[cellIndex(best.col, best.row)] = 1;
		prevDx = best.dx;
		prevDy = best.dy;
		cur = { col: best.col, row: best.row };
	}
	return path;
}
