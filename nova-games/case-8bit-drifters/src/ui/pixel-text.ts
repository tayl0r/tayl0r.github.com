import { Text, type TextStyleOptions } from "pixi.js";

export const PIXEL_FONT = '"Press Start 2P", monospace';

export function pixelText(
	text: string,
	opts: Partial<TextStyleOptions> = {},
): Text {
	const t = new Text({
		text,
		style: {
			fontFamily: PIXEL_FONT,
			fill: 0xffffff,
			fontSize: 16,
			letterSpacing: 1,
			...opts,
		},
	});
	t.anchor.set(0.5);
	return t;
}
