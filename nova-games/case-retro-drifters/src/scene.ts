import type { PerspectiveCamera, Scene } from "three";

export type GameScene = {
	scene: Scene;
	camera: PerspectiveCamera;
	update: (dt: number) => void;
	dispose: () => void;
};

export type SceneContext = {
	readonly width: number;
	readonly height: number;
	switchTo: (next: SceneFactory) => void;
};

export type SceneFactory = (ctx: SceneContext) => GameScene;
