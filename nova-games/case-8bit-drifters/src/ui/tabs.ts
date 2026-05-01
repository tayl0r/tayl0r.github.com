import { Container } from "pixi.js";
import { pixelText } from "./pixel-text";

export type TabsApi = {
	view: Container;
	width: number;
};

export function createTabs(
	tabs: { id: string; label: string; enabled: boolean }[],
	active: string,
	onClick: (id: string) => void,
): TabsApi {
	const view = new Container();
	let x = 0;
	const SPACING = 32;
	for (const tab of tabs) {
		const isActive = tab.id === active;
		const t = pixelText(tab.label.toUpperCase(), {
			fontSize: isActive ? 22 : 16,
			fill: !tab.enabled ? 0x444a55 : isActive ? 0x00d2ff : 0x8a92a3,
		});
		t.anchor.set(0, 0);
		t.position.set(x, isActive ? 0 : 6);
		t.eventMode = "static";
		t.cursor = tab.enabled ? "pointer" : "not-allowed";
		t.on("pointertap", () => onClick(tab.id));
		view.addChild(t);
		x += t.width + SPACING;
	}
	return { view, width: x - SPACING };
}
