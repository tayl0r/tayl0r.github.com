import type { LevelConfig } from "./levels";
import { COLS, ROWS } from "./world";

const CELL = 22;
const HALL = 10;
const PAD = 6;
const PIXEL_PITCH = CELL + HALL;

export function minimapDimensions(): { width: number; height: number } {
	return {
		width: COLS * CELL + (COLS - 1) * HALL + PAD * 2,
		height: ROWS * CELL + (ROWS - 1) * HALL + PAD * 2,
	};
}

function cellTopLeft(row: number, col: number): { x: number; y: number } {
	return {
		x: PAD + col * PIXEL_PITCH,
		y: PAD + row * PIXEL_PITCH,
	};
}

export function renderMinimap(
	canvas: HTMLCanvasElement,
	level: LevelConfig,
	visited: ReadonlySet<number>,
	currentRoom: number | null,
): void {
	const ctx = canvas.getContext("2d");
	if (!ctx) return;
	const { width, height } = minimapDimensions();
	if (canvas.width !== width) canvas.width = width;
	if (canvas.height !== height) canvas.height = height;
	ctx.clearRect(0, 0, width, height);

	ctx.fillStyle = "#888888";
	for (const [a, b] of level.hallwayEdges) {
		if (!visited.has(a) || !visited.has(b)) continue;
		const lo = Math.min(a, b);
		const hi = Math.max(a, b);
		const rA = Math.floor(lo / COLS);
		const cA = lo % COLS;
		const rB = Math.floor(hi / COLS);
		const cB = hi % COLS;
		const tlA = cellTopLeft(rA, cA);
		const tlB = cellTopLeft(rB, cB);
		if (rA === rB) {
			const x1 = tlA.x + CELL;
			const x2 = tlB.x;
			const y = tlA.y + CELL / 2 - 2;
			ctx.fillRect(x1, y, x2 - x1, 4);
		} else {
			const y1 = tlA.y + CELL;
			const y2 = tlB.y;
			const x = tlA.x + CELL / 2 - 2;
			ctx.fillRect(x, y1, 4, y2 - y1);
		}
	}

	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			const idx = row * COLS + col;
			if (!visited.has(idx)) continue;
			const tl = cellTopLeft(row, col);
			ctx.fillStyle = idx === currentRoom ? "#ffdd44" : "#cccccc";
			ctx.fillRect(tl.x, tl.y, CELL, CELL);
			if (idx === level.boss) {
				ctx.fillStyle = "#cc2222";
				ctx.beginPath();
				ctx.arc(tl.x + CELL / 2, tl.y + CELL / 2, 4, 0, Math.PI * 2);
				ctx.fill();
			} else if (idx === level.spawn) {
				ctx.fillStyle = "#2299ff";
				ctx.beginPath();
				ctx.arc(tl.x + CELL / 2, tl.y + CELL / 2, 3, 0, Math.PI * 2);
				ctx.fill();
			}
		}
	}
}
