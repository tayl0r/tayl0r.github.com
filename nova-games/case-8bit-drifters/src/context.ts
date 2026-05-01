import type { Application, Container } from "pixi.js";

export type Scene = {
	root: Container;
	update(dt: number): void;
	dispose(): void;
};

export type SceneFactory = (ctx: GameContext) => Scene;

export type Settings = Record<string, never>;

export type GameContext = {
	app: Application;
	switchTo(next: SceneFactory): void;
	profile: { name: string } | null;
	bests: Record<string, number>;
	settings: Settings;
};
