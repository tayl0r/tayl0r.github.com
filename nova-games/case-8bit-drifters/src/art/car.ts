import type { Graphics } from "pixi.js";

export type CarLook = {
	bodyColor: number;
	windshieldColor: number;
	headlightColor: number;
	taillightColor: number;
};

export const DEFAULT_LOOK: CarLook = {
	bodyColor: 0xe53935,
	windshieldColor: 0x1a1f2e,
	headlightColor: 0xfff7c2,
	taillightColor: 0xff3344,
};

// 8-bit pixel-art top-down car sprite.
// 12 columns × 6 rows; each cell renders as a hard-edged 4×4 world-unit square.
// Bounding box: 48 × 24 world units, centered at (0, 0). Faces +x (front-right).
//   '.' transparent  'B' body  'W' windshield  'D' darker body (panel split)
//   'H' headlight    'T' taillight
const CAR_SPRITE = [
	".BBBBBBBBBB.",
	"TBBBBBBBBBBH",
	"TBBBWWWWBBBH",
	"TBBBWWWWBBBH",
	"TBDBBBBBBDBH",
	".BBBBBBBBBB.",
];
const CELL = 4;
const W_CELLS = 12;
const H_CELLS = 6;
const ORIGIN_X = (-W_CELLS * CELL) / 2;
const ORIGIN_Y = (-H_CELLS * CELL) / 2;

function darken(rgb: number, factor: number): number {
	const r = Math.round(((rgb >> 16) & 0xff) * factor);
	const g = Math.round(((rgb >> 8) & 0xff) * factor);
	const b = Math.round((rgb & 0xff) * factor);
	return (r << 16) | (g << 8) | b;
}

/** Draws an 8-bit pixel-art top-down car centered at (0,0) facing +x. */
export function renderCar(
	g: Graphics,
	look: CarLook,
	opts: { brake?: boolean } = {},
): void {
	g.clear();
	const tailAlpha = opts.brake ? 1 : 0.65;
	const bodyDark = darken(look.bodyColor, 0.7);
	for (let row = 0; row < H_CELLS; row++) {
		const line = CAR_SPRITE[row];
		for (let col = 0; col < W_CELLS; col++) {
			const ch = line[col];
			if (ch === ".") continue;
			const px = ORIGIN_X + col * CELL;
			const py = ORIGIN_Y + row * CELL;
			if (ch === "T") {
				g.rect(px, py, CELL, CELL).fill({
					color: look.taillightColor,
					alpha: tailAlpha,
				});
			} else if (ch === "B") {
				g.rect(px, py, CELL, CELL).fill(look.bodyColor);
			} else if (ch === "D") {
				g.rect(px, py, CELL, CELL).fill(bodyDark);
			} else if (ch === "W") {
				g.rect(px, py, CELL, CELL).fill(look.windshieldColor);
			} else if (ch === "H") {
				g.rect(px, py, CELL, CELL).fill(look.headlightColor);
			}
		}
	}
}
