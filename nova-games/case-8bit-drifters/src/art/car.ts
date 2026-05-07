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

// 8-bit pixel-art top-down car sprite (itch.io "180 Top Down Vehicles" style).
// 18 columns × 10 rows; each cell renders as a hard-edged 2.5×2.5 world-unit
// square. Bounding box: 45 × 25 world units, centered at (0, 0). Faces +x.
//
// Layout, rear (col 0) → front (col 17):
//   col 0     rear bumper / taillight band
//   col 1-3   trunk (body color)
//   col 4-5   rear windshield
//   col 6-11  roof (lighter body shade)
//   col 12-13 front windshield
//   col 14-16 hood (darker body shade)
//   col 17    front bumper / headlight band, grille in center
//
// Side rows 0 and 9 are mostly transparent except for wheel cells (K) at the
// front and rear axles, which poke 1 cell beyond the main body silhouette.
//
// Cell legend:
//   '.' transparent
//   'B' body color
//   'D' darker body (hood)
//   'R' lighter body (roof)
//   'W' windshield
//   'T' taillight   'H' headlight
//   'G' grille      'K' wheel (near-black)
const CAR_SPRITE = [
	"..KK.........KK...",
	".BBBBBBBBBBBBBBBB.",
	"TBBBWWRRRRRRWWDDDH",
	"TBBBWWRRRRRRWWDDDH",
	"TBBBWWRRRRRRWWDDDG",
	"TBBBWWRRRRRRWWDDDG",
	"TBBBWWRRRRRRWWDDDH",
	"TBBBWWRRRRRRWWDDDH",
	".BBBBBBBBBBBBBBBB.",
	"..KK.........KK...",
];
const CELL = 2.5;
const W_CELLS = 18;
const H_CELLS = 10;
const ORIGIN_X = (-W_CELLS * CELL) / 2;
const ORIGIN_Y = (-H_CELLS * CELL) / 2;

const GRILLE_COLOR = 0x1a1a1a;
const WHEEL_COLOR = 0x101010;

function shade(rgb: number, factor: number): number {
	const r = Math.min(255, Math.round(((rgb >> 16) & 0xff) * factor));
	const g = Math.min(255, Math.round(((rgb >> 8) & 0xff) * factor));
	const b = Math.min(255, Math.round((rgb & 0xff) * factor));
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
	const bodyDark = shade(look.bodyColor, 0.72);
	const bodyLight = shade(look.bodyColor, 1.18);
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
			} else if (ch === "R") {
				g.rect(px, py, CELL, CELL).fill(bodyLight);
			} else if (ch === "W") {
				g.rect(px, py, CELL, CELL).fill(look.windshieldColor);
			} else if (ch === "H") {
				g.rect(px, py, CELL, CELL).fill(look.headlightColor);
			} else if (ch === "G") {
				g.rect(px, py, CELL, CELL).fill(GRILLE_COLOR);
			} else if (ch === "K") {
				g.rect(px, py, CELL, CELL).fill(WHEEL_COLOR);
			}
		}
	}
}
