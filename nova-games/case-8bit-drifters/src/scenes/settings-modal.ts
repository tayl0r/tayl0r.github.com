import { Container, Graphics } from "pixi.js";
import type { GameContext, SceneFactory } from "../context";
import { pixelButton } from "../ui/button";
import { panel } from "../ui/panel";
import { pixelText } from "../ui/pixel-text";
import { createLoadingScene } from "./loading";

export type SettingsModalArgs = {
	onClose: () => void;
	currentSceneFactory: SceneFactory;
	ctx: GameContext;
};

export function createSettingsModal({
	onClose,
	currentSceneFactory,
	ctx,
}: SettingsModalArgs): Container {
	const root = new Container();
	root.eventMode = "static";

	const backdrop = new Graphics()
		.rect(0, 0, ctx.app.screen.width, ctx.app.screen.height)
		.fill({ color: 0x000000, alpha: 0.55 });
	backdrop.eventMode = "static";
	backdrop.on("pointertap", onClose);
	root.addChild(backdrop);

	const p = panel(360, 240);
	p.position.set(ctx.app.screen.width / 2, ctx.app.screen.height / 2);
	const title = pixelText("SETTINGS", { fontSize: 20 });
	title.position.set(0, -80);
	const restart = pixelButton(
		"RESTART",
		() => ctx.switchTo(currentSceneFactory),
		18,
	);
	restart.view.position.set(0, -10);
	const exit = pixelButton("EXIT", () => ctx.switchTo(createLoadingScene), 18);
	exit.view.position.set(0, 40);
	p.addChild(title, restart.view, exit.view);
	root.addChild(p);

	return root;
}
