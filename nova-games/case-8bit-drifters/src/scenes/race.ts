import { Container, Graphics } from "pixi.js";
import { renderCar } from "../art/car";
import { renderHeadlights } from "../art/headlights";
import type { Scene, SceneFactory } from "../context";
import { Car } from "../race/car";
import { createKeyboardInput } from "../race/input";
import { createParticles } from "../race/particles";
import { createSkid } from "../race/skid";
import { TOKYO } from "../race/track-data";
import { buildWorld } from "../race/world";
import { pixelButton } from "../ui/button";
import { createHomeScene } from "./home";

export const createRaceScene: SceneFactory = (ctx) => {
	const root = new Container();
	const world = buildWorld(TOKYO);
	world.root.eventMode = "none";
	root.addChild(world.root);

	const smoke = createParticles(192);
	world.entityLayer.addChildAt(smoke.view, 0);

	const SKID_W = 2200;
	const SKID_H = 1400;
	const skid = createSkid(
		ctx.app,
		SKID_W,
		SKID_H,
		-SKID_W / 2 + 100,
		-SKID_H / 2,
	);
	world.groundLayer.addChild(skid.sprite);

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

	const headlights = new Graphics();
	// Below the car body in zIndex, but in the same buildingLayer so it
	// sorts correctly with buildings.
	world.buildingLayer.addChild(headlights);

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
			renderHeadlights(headlights, car.look.headlightColor);
			headlights.position.set(car.x, car.y);
			headlights.rotation = car.facing;
			headlights.zIndex = car.y - 0.1; // just below car so car body is on top
			renderCar(carG, car.look, { brake: car.braking });
			carG.position.set(car.x, car.y);
			carG.rotation = car.facing;
			carG.zIndex = car.y;
			world.camera.target.x = car.x;
			world.camera.target.y = car.y;
			world.updateCamera(ctx.app.screen.width, ctx.app.screen.height);
			world.updateOcclusion({ x: car.x, y: car.y });

			const drifting = car.state === "DRIFTING" || car.state === "SPINNING";
			if (drifting) {
				const fcx = Math.cos(car.facing);
				const fcy = Math.sin(car.facing);
				const rx = -fcx * 14;
				const ry = -fcy * 14;
				for (const off of [-9, 9]) {
					const wx = car.x + rx + -fcy * off;
					const wy = car.y + ry + fcx * off;
					smoke.spawn({
						x: wx,
						y: wy,
						vx: -fcx * 6 + (Math.random() - 0.5) * 8,
						vy: -fcy * 6 + (Math.random() - 0.5) * 8,
						ttl: 0.7 + Math.random() * 0.4,
					});
				}
				skid.stamp(car.x, car.y, car.facing);
			}
			smoke.update(dt);
		},
		dispose() {
			input.dispose();
			skid.dispose();
			root.destroy({ children: true });
		},
	};
	return scene;
};
