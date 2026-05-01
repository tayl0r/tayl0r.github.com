import { Container } from "pixi.js";
import { type BuildingSprite, buildBuilding } from "../art/buildings";
import { buildTrack, type Track } from "./track";
import type { TrackData, Vec2 } from "./track-data";

export type World = {
	root: Container; // add to scene root
	groundLayer: Container;
	entityLayer: Container; // car, particles
	buildingLayer: Container; // axonometric buildings
	track: Track;
	buildings: BuildingSprite[];
	camera: { target: Vec2; scale: number };
	updateCamera(screenW: number, screenH: number): void;
	updateOcclusion(carWorld: Vec2): void;
};

export function buildWorld(data: TrackData): World {
	const root = new Container();
	root.eventMode = "none";
	const groundLayer = new Container();
	const entityLayer = new Container();
	const buildingLayer = new Container();
	buildingLayer.sortableChildren = true;
	root.addChild(groundLayer, entityLayer, buildingLayer);

	const track = buildTrack(data);
	groundLayer.addChild(track.view);

	const buildings = data.buildings.map(buildBuilding);
	for (const b of buildings) {
		// zIndex by VISUAL bottom (footprint.y + footprint.h + facade height)
		// so a tall building's facade still sorts in front of cars that are
		// north of the visual bottom but south of the roof's south edge.
		b.view.zIndex = b.occlusionRect.y + b.occlusionRect.h;
		buildingLayer.addChild(b.view);
	}

	const camera = {
		target: { x: track.startPos.x, y: track.startPos.y },
		scale: 1.2,
	};

	return {
		root,
		groundLayer,
		entityLayer,
		buildingLayer,
		track,
		buildings,
		camera,
		updateCamera(screenW, screenH) {
			root.x = screenW / 2 - camera.target.x * camera.scale;
			root.y = screenH / 2 - camera.target.y * camera.scale;
			root.scale.set(camera.scale);
		},
		updateOcclusion(carWorld) {
			// World-space comparison: simpler and faster than projecting to
			// screen coordinates and back. The car's world (x,y) is checked
			// against each building's world-space occlusion rect (roof +
			// facade extension).
			for (const b of buildings) {
				const r = b.occlusionRect;
				const inside =
					carWorld.x >= r.x &&
					carWorld.x <= r.x + r.w &&
					carWorld.y >= r.y &&
					carWorld.y <= r.y + r.h;
				const target = inside ? 0.3 : 1.0;
				b.view.alpha += (target - b.view.alpha) * 0.18; // smooth lerp
			}
		},
	};
}
