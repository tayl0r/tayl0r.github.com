import { Container, Graphics } from "pixi.js";
import type { BuildingRect } from "../race/track-data";

export type BuildingSprite = {
	view: Container;
	footprint: { x: number; y: number; w: number; h: number };
	occlusionRect: { x: number; y: number; w: number; h: number };
};

/**
 * "Axonometric" — the camera doesn't tilt, but each building is drawn as a
 * roof polygon plus a south-facing facade extending downward (toward the
 * camera) by `height` pixels. The facade is what occludes the road in front.
 */
export function buildBuilding(rect: BuildingRect): BuildingSprite {
	const view = new Container();
	const g = new Graphics();
	const { x, y, w, h, height, color, neon, roofColor } = rect;

	// Facade (south wall): rectangle from (x, y+h) extending DOWN by `height`,
	// drawn first so the roof is on top.
	g.rect(x, y + h, w, height).fill(color);
	// Subtle facade highlight (right edge "lit" by neon city)
	g.rect(x + w - 4, y + h, 4, height).fill({ color: 0xffffff, alpha: 0.05 });
	// Lit windows pattern
	const cols = Math.max(2, Math.floor(w / 14));
	const rows = Math.max(2, Math.floor(height / 12));
	for (let cx = 0; cx < cols; cx++) {
		for (let cy = 0; cy < rows; cy++) {
			if (Math.random() > 0.55) {
				g.rect(
					x + 6 + cx * (w / cols),
					y + h + 4 + cy * (height / rows),
					6,
					6,
				).fill({ color: 0xffeebb, alpha: 0.35 + Math.random() * 0.4 });
			}
		}
	}
	// Roof
	g.rect(x, y, w, h).fill(roofColor ?? mix(color, 0xffffff, 0.18));
	g.rect(x, y, w, h).stroke({ color: 0x000000, width: 1, alpha: 0.4 });
	// Neon trim along south edge of roof
	if (neon !== undefined) {
		g.rect(x, y + h - 2, w, 2).fill({ color: neon, alpha: 0.85 });
	}

	view.addChild(g);
	return {
		view,
		footprint: { x, y, w, h },
		occlusionRect: { x, y, w, h: h + height },
	};
}

function mix(a: number, b: number, t: number): number {
	const ar = (a >> 16) & 0xff;
	const ag = (a >> 8) & 0xff;
	const ab = a & 0xff;
	const br = (b >> 16) & 0xff;
	const bg = (b >> 8) & 0xff;
	const bb = b & 0xff;
	const r = Math.round(ar + (br - ar) * t);
	const g = Math.round(ag + (bg - ag) * t);
	const bl = Math.round(ab + (bb - ab) * t);
	return (r << 16) | (g << 8) | bl;
}
