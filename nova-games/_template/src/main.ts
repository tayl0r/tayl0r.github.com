import { Application, Graphics, Text } from "pixi.js";

// Dynamic import forces the full pixi.js module (including renderer extension
// registrations with side effects) to evaluate before we touch Application.
// Removing this makes app.init() hang silently in the production bundle.
await import("pixi.js");

const app = new Application();
await app.init({
	background: "#101820",
	resizeTo: window,
	antialias: true,
	// Force WebGL; Pixi v8's WebGPU auto-select has caused hangs in the past.
	preference: "webgl",
});
document.body.appendChild(app.canvas);

const square = new Graphics().roundRect(-60, -60, 120, 120, 16).fill(0xff3366);
square.position.set(app.screen.width / 2, app.screen.height / 2);
app.stage.addChild(square);

const label = new Text({
	text: "Hello, Nova!",
	style: { fill: 0xffffff, fontSize: 28, fontFamily: "sans-serif" },
});
label.anchor.set(0.5);
label.position.set(app.screen.width / 2, app.screen.height / 2 + 110);
app.stage.addChild(label);

app.ticker.add((time) => {
	square.rotation += 0.02 * time.deltaTime;
});

window.addEventListener("resize", () => {
	square.position.set(app.screen.width / 2, app.screen.height / 2);
	label.position.set(app.screen.width / 2, app.screen.height / 2 + 110);
});
