import { Container, Graphics } from "pixi.js";
import { renderCar } from "../art/car";
import type { Scene, SceneFactory } from "../context";
import { Car } from "../race/car";
import { createKeyboardInput } from "../race/input";
import { TOKYO } from "../race/track-data";
import { buildWorld } from "../race/world";
import { pixelButton } from "../ui/button";
import { createHomeScene } from "./home";

export const createRaceScene: SceneFactory = (ctx) => {
	const root = new Container();
	const world = buildWorld(TOKYO);
	world.root.eventMode = "none";
	root.addChild(world.root);

	const car = new Car();
	car.x = world.track.startPos.x;
	car.y = world.track.startPos.y;
	car.facing = Math.atan2(
		world.track.startTangent.y,
		world.track.startTangent.x,
	);

	const carG = new Graphics();
	// Put the car into the building layer so it sorts WITH buildings by world-y.
	// This is the correction to the M5b layer split (entityLayer + buildingLayer
	// were siblings, so cross-layer zIndex didn't matter). buildingLayer already
	// has sortableChildren = true.
	world.buildingLayer.addChild(carG);

	const input = createKeyboardInput();

	const ui = new Container();
	const back = pixelButton("BACK", () => ctx.switchTo(createHomeScene), 14);
	back.view.position.set(60, 24);
	ui.addChild(back.view);
	root.addChild(ui);

	const scene: Scene = {
		root,
		update(dt) {
			const state = input.read();
			car.update(dt, state);
			renderCar(carG, car.look, { brake: car.braking });
			carG.position.set(car.x, car.y);
			carG.rotation = car.facing;
			carG.zIndex = car.y;
			world.camera.target.x = car.x;
			world.camera.target.y = car.y;
			world.updateCamera(ctx.app.screen.width, ctx.app.screen.height);
			world.updateOcclusion({ x: car.x, y: car.y });
		},
		dispose() {
			input.dispose();
			root.destroy({ children: true });
		},
	};
	return scene;
};
