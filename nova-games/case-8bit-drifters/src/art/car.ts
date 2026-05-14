import { Assets, Container, Rectangle, Sprite, Texture } from "pixi.js";
import { type CarDef, getCar, SHEET_URLS } from "./car-catalog";

// Target on-track car length in world units. The original procedural sprite
// had a 45×25 bounding box, so 45 keeps the existing physics + collision
// feel and matches the size of the headlight cones drawn in art/headlights.ts.
export const CAR_TARGET_LENGTH = 45;

// Headlight tint used by all cars now that procedural per-car colors are gone.
export const DEFAULT_HEADLIGHT_COLOR = 0xfff7c2;

const sheetTextureCache = new Map<string, Texture>();
const carTextureCache = new Map<string, Texture>();

/** Preload all car spritesheets and force nearest-neighbor scaling so the
 * pixel art stays crisp at any zoom. Call once at boot. */
export async function preloadCarSheets(): Promise<void> {
	for (const url of SHEET_URLS) {
		const tex = (await Assets.load(url)) as Texture;
		tex.source.scaleMode = "nearest";
		sheetTextureCache.set(url, tex);
	}
}

function getCarTexture(def: CarDef): Texture {
	const cached = carTextureCache.get(def.id);
	if (cached) return cached;
	const sheet = sheetTextureCache.get(def.sheet);
	if (!sheet) {
		throw new Error(
			`Car sheet "${def.sheet}" not preloaded. Call preloadCarSheets() at boot.`,
		);
	}
	const tex = new Texture({
		source: sheet.source,
		frame: new Rectangle(def.frame.x, def.frame.y, def.frame.w, def.frame.h),
	});
	carTextureCache.set(def.id, tex);
	return tex;
}

/** Returns the world-unit dimensions (length along facing, width across) for
 * a car after scaling to CAR_TARGET_LENGTH. */
export function carWorldSize(def: CarDef): { length: number; width: number } {
	const length = CAR_TARGET_LENGTH;
	const width = (def.frame.w / def.frame.h) * length;
	return { length, width };
}

export type CarView = {
	view: Container;
	setBraking(braking: boolean): void;
	dispose(): void;
};

/** Build a car display object: a Container at world position (0,0) holding the
 * sprite. The container's `rotation` should be set to `car.facing`; the inner
 * sprite carries a +π/2 baseline rotation so facing=0 (which means +X) renders
 * the car heading east, even though the source art faces -Y. */
export function makeCarView(carId: string | null | undefined): CarView {
	const def = getCar(carId);
	const tex = getCarTexture(def);
	const view = new Container();
	const sprite = new Sprite(tex);
	sprite.anchor.set(0.5);
	sprite.rotation = Math.PI / 2;
	const length = CAR_TARGET_LENGTH;
	const scale = length / def.frame.h;
	sprite.scale.set(scale);
	view.addChild(sprite);
	let braking = false;
	return {
		view,
		setBraking(next: boolean) {
			if (next === braking) return;
			braking = next;
			// Subtle red tint when braking — a wash that suggests glowing brake
			// lights without painting the entire car red.
			sprite.tint = braking ? 0xffaaaa : 0xffffff;
		},
		dispose() {
			view.destroy({ children: true });
		},
	};
}

/** Make a sprite for a car at its native pixel size, with no rotation —
 * used by UI surfaces (locker grid, home preview). The returned sprite is
 * anchored at center, so position it at the cell center and scale to taste. */
export function makeCarUiSprite(carId: string | null | undefined): Sprite {
	const def = getCar(carId);
	const tex = getCarTexture(def);
	const sprite = new Sprite(tex);
	sprite.anchor.set(0.5);
	return sprite;
}
