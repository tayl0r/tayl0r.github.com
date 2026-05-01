import type { Graphics } from "pixi.js";

/** Two overlapping cones extending forward from the car. Drawn additive. */
export function renderHeadlights(g: Graphics, color: number): void {
	g.clear();
	g.blendMode = "add";
	const tip = 70;
	const half = 26;
	g.poly([22, -8, tip, -half, tip, half, 22, 8]).fill({ color, alpha: 0.18 });
	g.poly([22, -8, tip + 14, -half - 4, tip + 14, half + 4, 22, 8]).fill({
		color,
		alpha: 0.08,
	});
}
