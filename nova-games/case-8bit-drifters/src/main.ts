import { Application } from "pixi.js";
import type { GameContext, Scene, SceneFactory } from "./context";
import { loadTuning } from "./race/tuning";
import { createLoadingScene } from "./scenes/loading";
import { loadState } from "./storage";

const app = new Application();
await app.init({
	background: "#0a0a14",
	resizeTo: window,
	antialias: true,
});
document.body.appendChild(app.canvas);

// Wait for Press Start 2P to load before showing UI; otherwise text reflows
// when the font swaps in. Skip the wait if it doesn't resolve in 1500ms.
await Promise.race([
	document.fonts.ready,
	new Promise((r) => setTimeout(r, 1500)),
]);

// Apply persisted physics tuning before any scene boots so the very first
// race uses the player's saved tuning values.
loadTuning();

const stored = loadState();
let current: Scene | null = null;

const ctx: GameContext = {
	app,
	switchTo(next: SceneFactory) {
		if (current) {
			app.stage.removeChild(current.root);
			current.dispose();
		}
		current = next(ctx);
		app.stage.addChild(current.root);
	},
	profile: stored.profile,
	bests: stored.bests,
	settings: {},
};

ctx.switchTo(createLoadingScene);

app.ticker.add((time) => {
	if (current) current.update(time.deltaMS / 1000);
});
