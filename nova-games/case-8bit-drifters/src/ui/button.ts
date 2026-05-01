import { Container } from "pixi.js";
import { pixelText } from "./pixel-text";

export type PixelButton = {
	view: Container;
	setEnabled(b: boolean): void;
};

export function pixelButton(
	label: string,
	onClick: () => void,
	fontSize = 24,
): PixelButton {
	const view = new Container();
	const text = pixelText(label, { fontSize });
	view.addChild(text);
	// Don't set view.hitArea explicitly — it would be a snapshot of the
	// initial bounds and would not update on hover-scale or label change.
	// Pixi's default child-based hit test follows the live text bounds.
	view.eventMode = "static";
	view.cursor = "pointer";
	let enabled = true;
	view.on("pointertap", () => {
		if (enabled) onClick();
	});
	view.on("pointerover", () => {
		if (enabled) text.scale.set(1.1);
	});
	view.on("pointerout", () => text.scale.set(1));
	return {
		view,
		setEnabled(b) {
			enabled = b;
			text.alpha = b ? 1 : 0.4;
		},
	};
}
