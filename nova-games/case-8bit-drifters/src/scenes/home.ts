import { Container } from "pixi.js";
import type { Scene, SceneFactory } from "../context";

export const createHomeScene: SceneFactory = () => {
	const root = new Container();
	const scene: Scene = {
		root,
		update: () => {},
		dispose: () => root.destroy({ children: true }),
	};
	return scene;
};
