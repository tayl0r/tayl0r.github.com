import { Container } from "pixi.js";
import { createTire } from "../art/tire";
import type { Scene, SceneFactory } from "../context";
import { createParticles } from "../race/particles";
import { pixelButton } from "../ui/button";
import { pixelText } from "../ui/pixel-text";
import { createHomeScene } from "./home";
import { createNamePickerScene } from "./name-picker";

export const createLoadingScene: SceneFactory = (ctx) => {
	const root = new Container();
	const tire = createTire(80);
	const particles = createParticles(64);

	const button = pixelButton(
		"START",
		() => {
			const next = ctx.profile ? createHomeScene : createNamePickerScene;
			ctx.switchTo(next);
		},
		28,
	);

	const title = pixelText("8-BIT DRIFTERS", { fontSize: 36, fill: 0x00d2ff });

	root.addChild(particles.view, tire.view, button.view, title);

	const place = (): void => {
		const cx = ctx.app.screen.width / 2;
		const cy = ctx.app.screen.height / 2;
		title.position.set(cx, cy - 180);
		tire.view.position.set(cx, cy);
		particles.view.position.set(cx, cy);
		button.view.position.set(cx, cy + 160);
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	let smokeTimer = 0;
	const scene: Scene = {
		root,
		update(dt) {
			tire.update(dt);
			smokeTimer += dt;
			while (smokeTimer > 0.04) {
				smokeTimer -= 0.04;
				particles.spawn({
					x: 60 + Math.random() * 10,
					y: 0 + (Math.random() - 0.5) * 12,
					vx: 50 + Math.random() * 30,
					vy: -10 + (Math.random() - 0.5) * 20,
					ttl: 0.9 + Math.random() * 0.4,
				});
			}
			particles.update(dt);
		},
		dispose() {
			window.removeEventListener("resize", onResize);
			root.destroy({ children: true });
		},
	};
	return scene;
};
