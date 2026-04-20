import type { Group } from "three";
import {
	AmbientLight,
	DirectionalLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
} from "three";
import { buildCar } from "./car/geometry";
import type { GameScene, SceneContext, SceneFactory } from "./scene";

export const createMenuScene: SceneFactory = (ctx: SceneContext): GameScene => {
	const scene = new Scene();
	const camera = new PerspectiveCamera(40, ctx.width / ctx.height, 0.1, 1000);
	camera.position.set(0, 4, 9);
	camera.lookAt(0, 0.5, 0);

	scene.add(new AmbientLight(0x8060c0, 0.7));
	const key = new DirectionalLight(0xff80ff, 0.9);
	key.position.set(6, 8, 4);
	scene.add(key);
	const fill = new DirectionalLight(0x6040ff, 0.5);
	fill.position.set(-5, 6, 3);
	scene.add(fill);

	const floor = new Mesh(
		new PlaneGeometry(30, 30),
		new MeshStandardMaterial({ color: 0x1a0a2a }),
	);
	floor.rotation.x = -Math.PI / 2;
	scene.add(floor);

	const car: Group = buildCar("skyline");
	car.position.set(0, 0, 0);
	scene.add(car);

	const menuUI = document.getElementById("menu-ui") as HTMLDivElement;
	const startBtn = document.getElementById("menu-start") as HTMLButtonElement;
	menuUI.style.display = "flex";

	const onStart = async (): Promise<void> => {
		const { createRaceScene } = await import("./race");
		ctx.switchTo(createRaceScene);
	};
	startBtn.addEventListener("click", onStart);

	return {
		scene,
		camera,
		update(dt: number) {
			car.rotation.y += dt * 0.6;
		},
		dispose() {
			menuUI.style.display = "none";
			startBtn.removeEventListener("click", onStart);
			floor.geometry.dispose();
			(floor.material as MeshStandardMaterial).dispose();
			car.traverse((obj) => {
				const mesh = obj as {
					geometry?: { dispose(): void };
					material?: { dispose(): void };
				};
				mesh.geometry?.dispose();
				mesh.material?.dispose();
			});
		},
	};
};
