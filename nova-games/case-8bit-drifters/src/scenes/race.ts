import { Container } from "pixi.js";
import type { Scene, SceneFactory } from "../context";
import { pixelButton } from "../ui/button";
import { pixelText } from "../ui/pixel-text";
import { createHomeScene } from "./home";

export const createRaceScene: SceneFactory = (ctx) => {
	const root = new Container();
	const t = pixelText("race scene (TODO)", { fontSize: 24 });
	const back = pixelButton("BACK", () => ctx.switchTo(createHomeScene), 16);
	const place = (): void => {
		t.position.set(ctx.app.screen.width / 2, ctx.app.screen.height / 2);
		back.view.position.set(
			ctx.app.screen.width / 2,
			ctx.app.screen.height / 2 + 40,
		);
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);
	root.addChild(t, back.view);
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
