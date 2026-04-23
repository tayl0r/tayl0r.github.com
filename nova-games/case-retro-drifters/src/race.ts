import {
	AmbientLight,
	Box3,
	DirectionalLight,
	type Group,
	PerspectiveCamera,
	Ray,
	Scene,
	Vector3,
} from "three";
import { buildCar } from "./car/geometry";
import { initialCarState, updateCar } from "./car/physics";
import { HUD } from "./hud";
import { Input } from "./input";
import { createStartLights } from "./race/lights";
import type { GameScene, SceneContext, SceneFactory } from "./scene";
import { buildRoad } from "./track/geometry";
import { resolveWallCollision } from "./track/walls";
import { tokyoWaypoints } from "./track/waypoints";
import type { CarInput, CarState } from "./types";

const TOTAL_LAPS = 3;

export const createRaceScene: SceneFactory = (ctx: SceneContext): GameScene => {
	const scene = new Scene();
	scene.add(new AmbientLight(0x6060a0, 0.55));
	const dirLight = new DirectionalLight(0xffeeff, 0.75);
	dirLight.position.set(20, 40, 15);
	scene.add(dirLight);

	const camera = new PerspectiveCamera(40, ctx.width / ctx.height, 0.1, 1000);

	const track = buildRoad(tokyoWaypoints);
	scene.add(track.root);

	const lights = createStartLights(
		scene,
		track.startInfo.pos,
		track.startInfo.rightNormal,
		track.startInfo.halfWidth,
	);

	const buildings = track.buildings;
	// Make materials transparent-ready.
	for (const b of buildings) {
		const mat = b.material as {
			transparent: boolean;
			depthWrite: boolean;
			opacity: number;
		};
		mat.transparent = true;
		mat.depthWrite = false;
		mat.opacity = 1;
	}
	const buildingBoxes = buildings.map((b) => new Box3().setFromObject(b));
	const buildingTargetOpacity = new Float32Array(buildings.length).fill(1);
	const occlusionRay = new Ray();
	const camWorldPos = new Vector3();
	const carWorldPos = new Vector3();
	const rayHit = new Vector3();

	const carMesh: Group = buildCar("skyline");
	scene.add(carMesh);

	const input = new Input();
	const hud = new HUD();
	hud.show();
	hud.setLap(1, TOTAL_LAPS);
	hud.setTimes(0, null);
	hud.setSpeed(0, false);

	// Car state, pointed toward waypoint 1.
	let car: CarState = {
		...initialCarState(),
		position: { ...tokyoWaypoints[0].pos },
	};
	{
		const a = tokyoWaypoints[0].pos;
		const b = tokyoWaypoints[1].pos;
		car.heading = Math.atan2(b.x - a.x, b.z - a.z);
	}

	// Race progression.
	let countdown = 4.0;
	let raceTime = 0;
	let lapStart = 0;
	let lap = 1;
	let bestLap: number | null = null;
	let finished = false;
	let halfwayReached = false;

	// Start line direction (used as forward direction AND to derive its
	// left-perpendicular normal for side-of-line detection).
	const startA = tokyoWaypoints[0].pos;
	const startB = tokyoWaypoints[1].pos;
	const startDirX = startB.x - startA.x;
	const startDirZ = startB.z - startA.z;
	// Perpendicular to startDir (left-hand). Not normalized — we only use
	// signs and relative magnitudes.
	const startNormX = -startDirZ;
	const startNormZ = startDirX;

	// Camera smoothing.
	let camTargetX = car.position.x;
	let camTargetZ = car.position.z;

	// Esc / back handlers.
	const removeBackHandler = hud.onBack(() => goBack());
	const onKey = (e: KeyboardEvent): void => {
		if (e.code === "Escape") goBack();
	};
	window.addEventListener("keydown", onKey);
	let disposed = false;

	async function goBack(): Promise<void> {
		if (disposed) return;
		const { createMenuScene } = await import("./menu");
		ctx.switchTo(createMenuScene);
	}

	function detectLapCross(
		prev: { x: number; z: number },
		next: { x: number; z: number },
	): boolean {
		// Signed perpendicular distance from the infinite start-finish line.
		// Racing forward carries the car from prevSide < 0 to nextSide >= 0.
		const prevSide =
			(prev.x - startA.x) * startNormX + (prev.z - startA.z) * startNormZ;
		const nextSide =
			(next.x - startA.x) * startNormX + (next.z - startA.z) * startNormZ;
		// Guard: only count forward crossings (velocity has positive
		// component along startDir).
		const vDotDir =
			(next.x - prev.x) * startDirX + (next.z - prev.z) * startDirZ;
		return prevSide < 0 && nextSide >= 0 && vDotDir > 0;
	}

	return {
		scene,
		camera,
		update(dt: number) {
			// Countdown: freeze car, just animate camera.
			if (countdown > 0) {
				countdown -= dt;
				if (countdown >= 3) lights.setState("red1");
				else if (countdown >= 2) lights.setState("red2");
				else if (countdown >= 1) lights.setState("red3");
				else if (countdown > 0) lights.setState("green");
				else {
					lights.setState("off");
					hud.flash("GO", 700);
					countdown = 0;
				}
				carMesh.position.set(car.position.x, 0, car.position.z);
				carMesh.rotation.y = car.heading;
				camTargetX = car.position.x;
				camTargetZ = car.position.z;
				camera.position.set(camTargetX, 26, camTargetZ + 18);
				camera.lookAt(camTargetX, 0, camTargetZ);
				return;
			}

			if (finished) {
				// Keep rendering but ignore input.
				camera.position.set(camTargetX, 26, camTargetZ + 18);
				camera.lookAt(camTargetX, 0, camTargetZ);
				return;
			}

			const inp: CarInput = input.readCar();

			const prev = { ...car.position };
			car = updateCar(car, inp, dt);
			car = resolveWallCollision(car, tokyoWaypoints);

			raceTime += dt;
			const lapTime = raceTime - lapStart;

			// Track halfway state — lap only counts after car has been far
			// from the start/finish line.
			const distFromStart = Math.hypot(
				car.position.x - startA.x,
				car.position.z - startA.z,
			);
			if (distFromStart > 60) halfwayReached = true;

			if (halfwayReached && detectLapCross(prev, car.position)) {
				if (bestLap == null || lapTime < bestLap) bestLap = lapTime;
				if (lap < TOTAL_LAPS) {
					lap += 1;
					lapStart = raceTime;
					halfwayReached = false;
					hud.setLap(lap, TOTAL_LAPS);
					hud.flash(`LAP ${lap}`, 900);
				} else {
					finished = true;
					hud.setCenter(`FINISH\n${raceTime.toFixed(2)}s`);
					hud.showBack();
				}
			}

			// Camera: Hades-tilt follow, extra snap when drifting.
			const lag = car.isDrifting ? 0.08 : 0.2;
			const lerp = Math.min(1, dt / lag);
			camTargetX += (car.position.x - camTargetX) * lerp;
			camTargetZ += (car.position.z - camTargetZ) * lerp;
			camera.position.set(camTargetX, 26, camTargetZ + 18);
			camera.lookAt(camTargetX, 0, camTargetZ);

			// Occlusion transparency for buildings between camera and car.
			camWorldPos.copy(camera.position);
			carWorldPos.set(car.position.x, 1, car.position.z);
			occlusionRay.origin.copy(camWorldPos);
			occlusionRay.direction.copy(carWorldPos).sub(camWorldPos).normalize();
			const distToCar = camWorldPos.distanceTo(carWorldPos);
			for (let i = 0; i < buildings.length; i++) {
				const target = occlusionRay.intersectBox(buildingBoxes[i], rayHit);
				let blocking = false;
				if (target) {
					const d = camWorldPos.distanceTo(rayHit);
					if (d > 0.1 && d < distToCar) blocking = true;
				}
				buildingTargetOpacity[i] = blocking ? 0.25 : 1.0;
			}
			const opacityLerp = 1 - Math.exp(-dt / 0.3);
			for (let i = 0; i < buildings.length; i++) {
				const mat = buildings[i].material as { opacity: number };
				mat.opacity += (buildingTargetOpacity[i] - mat.opacity) * opacityLerp;
			}

			carMesh.position.set(car.position.x, 0, car.position.z);
			carMesh.rotation.y = car.heading;
			hud.setSpeed(car.speed, car.isDrifting);
			hud.setTimes(lapTime, bestLap);
		},
		dispose() {
			disposed = true;
			input.dispose();
			removeBackHandler();
			window.removeEventListener("keydown", onKey);
			hud.hide();
			hud.clearCenter();
			lights.dispose();
			scene.traverse((obj) => {
				const m = obj as {
					geometry?: { dispose(): void };
					material?: { dispose(): void } | { dispose(): void }[];
				};
				m.geometry?.dispose();
				if (Array.isArray(m.material)) {
					for (const mat of m.material) mat.dispose();
				} else m.material?.dispose();
			});
		},
	};
};
