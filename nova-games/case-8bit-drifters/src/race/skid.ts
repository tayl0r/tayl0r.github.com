import { type Application, Graphics, RenderTexture, Sprite } from "pixi.js";

export type Skid = {
	sprite: Sprite;
	stamp(x: number, y: number, facing: number): void;
	dispose(): void;
};

export function createSkid(
	app: Application,
	worldW: number,
	worldH: number,
	originX: number,
	originY: number,
): Skid {
	const tex = RenderTexture.create({ width: worldW, height: worldH });
	const sprite = new Sprite(tex);
	sprite.position.set(originX, originY);

	const stampG = new Graphics();

	return {
		sprite,
		stamp(x, y, facing) {
			stampG.clear();
			const fx = Math.cos(facing);
			const fy = Math.sin(facing);
			for (const off of [-9, 9]) {
				const wx = x - fx * 14 + -fy * off - originX;
				const wy = y - fy * 14 + fx * off - originY;
				stampG
					.rect(wx - 1.5, wy - 1.5, 3, 3)
					.fill({ color: 0x111111, alpha: 0.5 });
			}
			app.renderer.render({ container: stampG, target: tex, clear: false });
		},
		dispose() {
			tex.destroy(true);
		},
	};
}
