import {
	AmbientLight,
	DirectionalLight,
	type Group,
	PerspectiveCamera,
	Scene,
} from "three";
import { buildCar } from "./car/geometry";
import { initialCarState, updateCar } from "./car/physics";
import { HUD } from "./hud";
import { Input } from "./input";
import type { GameScene, SceneContext, SceneFactory } from "./scene";
import { nearestSegment, offTrack, segmentDirection } from "./track/collision";
import { buildRoad } from "./track/geometry";
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
	let countdown = 3.0;
	hud.setCenter("3");
	let raceTime = 0;
	let lapStart = 0;
	let lap = 1;
	let bestLap: number | null = null;
	let finished = false;
	let halfwayReached = false;
	let penaltyTimer = 0;

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

	function applyOffTrackPenalty(): void {
		const hit = nearestSegment(car.position, tokyoWaypoints);
		const a = tokyoWaypoints[hit.segmentIndex].pos;
		const b =
			tokyoWaypoints[(hit.segmentIndex + 1) % tokyoWaypoints.length].pos;
		const dir = segmentDirection(a, b);
		car = {
			...car,
			position: { ...hit.closestPoint },
			velocity: { x: dir.x * car.speed * 0.5, z: dir.z * car.speed * 0.5 },
			heading: Math.atan2(dir.x, dir.z),
			angularVelocity: 0,
			speed: car.speed * 0.5,
			isDrifting: false,
			grip: 1,
		};
		penaltyTimer = 3;
		hud.setCenter("OFF TRACK");
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
				const n = Math.ceil(countdown);
				if (countdown <= 0) {
					hud.flash("GO", 700);
					countdown = 0;
				} else {
					hud.setCenter(String(n));
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

			let inp: CarInput = input.readCar();
			if (penaltyTimer > 0) {
				inp = { throttle: 0, brake: 0, steer: 0, driftPress: false };
				penaltyTimer -= dt;
				if (penaltyTimer <= 0) hud.clearCenter();
			}

			const prev = { ...car.position };
			car = updateCar(car, inp, dt);

			if (penaltyTimer <= 0 && offTrack(car.position, tokyoWaypoints)) {
				applyOffTrackPenalty();
			}

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
