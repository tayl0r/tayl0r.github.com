import { type Application, Container, Graphics, Text } from "pixi.js";

export type UiButton = {
	container: Container;
};

export function makeButton(opts: {
	label: string;
	width: number;
	height: number;
	fill: number;
	hoverFill: number;
	textColor: number;
	onClick: () => void;
}): UiButton {
	const container = new Container();
	container.eventMode = "static";
	container.cursor = "pointer";

	const bg = new Graphics()
		.roundRect(0, 0, opts.width, opts.height, 8)
		.fill(opts.fill);
	container.addChild(bg);

	const label = new Text({
		text: opts.label,
		style: { fill: opts.textColor, fontSize: 18, fontFamily: "sans-serif" },
	});
	label.anchor.set(0.5);
	label.position.set(opts.width / 2, opts.height / 2);
	container.addChild(label);

	container.on("pointerover", () => {
		bg.clear().roundRect(0, 0, opts.width, opts.height, 8).fill(opts.hoverFill);
	});
	container.on("pointerout", () => {
		bg.clear().roundRect(0, 0, opts.width, opts.height, 8).fill(opts.fill);
	});
	container.on("pointertap", opts.onClick);

	return { container };
}

export function createLevelComplete(
	app: Application,
	onNext: () => void,
	onMenu: () => void,
): { container: Container; destroy: () => void } {
	const container = new Container();

	const bg = new Graphics()
		.rect(0, 0, app.screen.width, app.screen.height)
		.fill({ color: 0x000000, alpha: 0.6 });
	container.addChild(bg);

	const title = new Text({
		text: "Level Complete!",
		style: {
			fill: 0xffffff,
			fontSize: 56,
			fontFamily: "sans-serif",
			fontWeight: "bold",
		},
	});
	title.anchor.set(0.5);
	container.addChild(title);

	const nextBtn = makeButton({
		label: "Next Level",
		width: 160,
		height: 44,
		fill: 0x44cc66,
		hoverFill: 0x5fe07f,
		textColor: 0x102010,
		onClick: onNext,
	});
	container.addChild(nextBtn.container);

	const menuBtn = makeButton({
		label: "Menu",
		width: 120,
		height: 44,
		fill: 0x333b47,
		hoverFill: 0x4b5666,
		textColor: 0xffffff,
		onClick: onMenu,
	});
	container.addChild(menuBtn.container);

	const layout = () => {
		bg.clear()
			.rect(0, 0, app.screen.width, app.screen.height)
			.fill({ color: 0x000000, alpha: 0.6 });
		title.position.set(app.screen.width / 2, app.screen.height / 2 - 60);
		nextBtn.container.position.set(
			app.screen.width / 2 - 170,
			app.screen.height / 2 + 20,
		);
		menuBtn.container.position.set(
			app.screen.width / 2 + 10,
			app.screen.height / 2 + 20,
		);
	};
	layout();
	const onResize = () => layout();
	window.addEventListener("resize", onResize);

	return {
		container,
		destroy: () => {
			window.removeEventListener("resize", onResize);
			container.destroy({ children: true });
		},
	};
}
