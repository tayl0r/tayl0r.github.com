import { Container, Graphics } from "pixi.js";
import { DEFAULT_LOOK, renderCar } from "../art/car";
import type { Scene, SceneFactory } from "../context";
import { TOKYO } from "../race/track-data";
import { buildWorld } from "../race/world";
import { pixelButton } from "../ui/button";
import { createHomeScene } from "./home";

export const createRaceScene: SceneFactory = (ctx) => {
	const root = new Container();
	const world = buildWorld(TOKYO);
	root.addChild(world.root);

	// Static car at start, facing along start tangent
	const carG = new Graphics();
	renderCar(carG, DEFAULT_LOOK);
	carG.position.set(world.track.startPos.x, world.track.startPos.y);
	carG.rotation = Math.atan2(
		world.track.startTangent.y,
		world.track.startTangent.x,
	);
	world.entityLayer.addChild(carG);
	world.entityLayer.sortableChildren = true;
	carG.zIndex = world.track.startPos.y;

	// Temporary back button (top-left in screen space, outside world)
	const ui = new Container();
	const back = pixelButton("BACK", () => ctx.switchTo(createHomeScene), 14);
	back.view.position.set(60, 24);
	ui.addChild(back.view);
	root.addChild(ui);

	const scene: Scene = {
		root,
		update: () => {
			world.updateCamera(ctx.app.screen.width, ctx.app.screen.height);
			world.updateOcclusion({
				x: world.track.startPos.x,
				y: world.track.startPos.y,
			});
		},
		dispose: () => {
			root.destroy({ children: true });
		},
	};
	return scene;
};
