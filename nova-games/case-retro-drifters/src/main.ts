import { WebGLRenderer } from "three";
import { createMenuScene } from "./menu";
import type { GameScene, SceneContext, SceneFactory } from "./scene";

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

let current: GameScene | null = null;

const ctx: SceneContext = {
	get width(): number {
		return window.innerWidth;
	},
	get height(): number {
		return window.innerHeight;
	},
	switchTo(next: SceneFactory): void {
		loadScene(next);
	},
};

function loadScene(factory: SceneFactory): void {
	if (current) current.dispose();
	current = factory(ctx);
}

loadScene(createMenuScene);

let last = performance.now();
function tick(now: number): void {
	const dt = Math.min((now - last) / 1000, 1 / 30);
	last = now;
	if (current) {
		current.update(dt);
		renderer.render(current.scene, current.camera);
	}
	requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

window.addEventListener("resize", () => {
	const w = window.innerWidth;
	const h = window.innerHeight;
	renderer.setSize(w, h);
	if (current) {
		current.camera.aspect = w / h;
		current.camera.updateProjectionMatrix();
	}
});
