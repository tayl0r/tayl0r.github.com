import { type Application, Container, Graphics, Text } from "pixi.js";

export function createMenu(
	app: Application,
	onStart: () => void,
): {
	container: Container;
	destroy: () => void;
} {
	const container = new Container();

	const title = new Text({
		text: "Teamwork Escape Room!",
		style: {
			fill: 0xffffff,
			fontSize: 48,
			fontFamily: "sans-serif",
			fontWeight: "bold",
		},
	});
	title.anchor.set(0.5);
	container.addChild(title);

	const triangle = new Graphics()
		.poly([0, -60, 70, 50, -70, 50])
		.fill(0xa56cf0);
	triangle.eventMode = "static";
	triangle.cursor = "pointer";
	triangle.on("pointertap", onStart);
	container.addChild(triangle);

	const startLabel = new Text({
		text: "START",
		style: {
			fill: 0xffffff,
			fontSize: 20,
			fontFamily: "sans-serif",
			fontWeight: "bold",
		},
	});
	startLabel.anchor.set(0.5);
	container.addChild(startLabel);

	const layout = () => {
		title.position.set(app.screen.width / 2, 120);
		triangle.position.set(app.screen.width / 2, app.screen.height / 2);
		startLabel.position.set(app.screen.width / 2, app.screen.height / 2 + 15);
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
