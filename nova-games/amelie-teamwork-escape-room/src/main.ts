import { Application, type Container } from "pixi.js";
import { createGame } from "./game.js";
import { createMenu } from "./menu.js";
import { createLevelComplete } from "./ui.js";

export type Scene = { container: Container; destroy: () => void };
export type SceneFactory = (app: Application, keys: Set<string>) => Scene;

const app = new Application();
await app.init({
	background: "#101820",
	resizeTo: window,
	antialias: true,
});
document.body.appendChild(app.canvas);

const keys = new Set<string>();
window.addEventListener("keydown", (e) => keys.add(e.key));
window.addEventListener("keyup", (e) => keys.delete(e.key));

let current: Scene | null = null;

export function setScene(factory: SceneFactory): void {
	if (current) {
		app.stage.removeChild(current.container);
		current.destroy();
	}
	current = factory(app, keys);
	app.stage.addChild(current.container);
}

function goToMenu(): void {
	setScene((app) => createMenu(app, goToGame));
}

function goToGame(): void {
	setScene((app, keys) =>
		createGame(
			app,
			keys,
			goToMenu, // onExit
			goToLevelComplete, // onComplete
		),
	);
}

function goToLevelComplete(): void {
	setScene((app) => createLevelComplete(app, goToGame, goToMenu));
}

goToMenu();
