import { Container, Text } from "pixi.js";
import type { Scene, SceneFactory } from "../context";

export const createLoadingScene: SceneFactory = (ctx) => {
	const root = new Container();
	const label = new Text({
		text: "loading…",
		style: { fill: 0xffffff, fontSize: 32, fontFamily: "monospace" },
	});
	label.anchor.set(0.5);
	const place = (): void => {
		label.position.set(ctx.app.screen.width / 2, ctx.app.screen.height / 2);
	};
	place();
	root.addChild(label);

	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	const scene: Scene = {
		root,
		update: () => {},
		dispose: () => {
			window.removeEventListener("resize", onResize);
			root.destroy({ children: true });
		},
	};
	return scene;
};
