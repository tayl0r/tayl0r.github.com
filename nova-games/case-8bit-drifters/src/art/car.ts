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

/** Draws a top-down-ish car centered on (0,0) facing right (+x). */
export function renderCar(
	g: Graphics,
	look: CarLook,
	opts: { brake?: boolean } = {},
): void {
	g.clear();
	// Body
	g.roundRect(-22, -12, 44, 24, 4).fill(look.bodyColor);
	// Hood split
	g.rect(-22, -1, 44, 2).fill({ color: 0x000000, alpha: 0.18 });
	// Windshield
	g.roundRect(-2, -10, 14, 20, 3).fill(look.windshieldColor);
	// Headlights (front, +x)
	g.rect(20, -9, 4, 4).fill(look.headlightColor);
	g.rect(20, 5, 4, 4).fill(look.headlightColor);
	// Taillights (rear, -x); brighten when braking
	const tailAlpha = opts.brake ? 1 : 0.7;
	g.rect(-24, -9, 3, 4).fill({ color: look.taillightColor, alpha: tailAlpha });
	g.rect(-24, 5, 3, 4).fill({ color: look.taillightColor, alpha: tailAlpha });
}
