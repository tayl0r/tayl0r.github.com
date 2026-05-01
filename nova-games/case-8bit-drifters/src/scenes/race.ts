import { Container, Graphics } from "pixi.js";
import { renderCar } from "../art/car";
import { renderHeadlights } from "../art/headlights";
import type { Scene, SceneFactory } from "../context";
import { CAR_PHYSICS, Car } from "../race/car";
import { DEFAULT_DRIFT_CONFIG } from "../race/drift";
import { createHud, formatTime } from "../race/hud";
import { createKeyboardInput } from "../race/input";
import { LapTracker } from "../race/lap";
import { advanceLights, inputsEnabled, type LightsState } from "../race/lights";
import { createParticles } from "../race/particles";
import { createSkid } from "../race/skid";
import { TOKYO } from "../race/track-data";
import {
	defaultDriftValue,
	defaultPhysicsValue,
	resetAllTuning,
	saveTuning,
} from "../race/tuning";
import { buildWorld } from "../race/world";
import { persist } from "../storage";
import { pixelButton } from "../ui/button";
import { panel } from "../ui/panel";
import { pixelText } from "../ui/pixel-text";
import {
	createTuningPanel,
	type Knob,
	type KnobGroup,
} from "../ui/tuning-panel";
import { createHomeScene } from "./home";

const MAP_ID = "tokyo";
const DEFAULT_TOTAL_LAPS = 5;

export const createRaceScene: SceneFactory = (ctx) => {
	const params = new URLSearchParams(window.location.search);
	const TOTAL_LAPS =
		import.meta.env.DEV && params.has("laps")
			? Math.max(1, Number.parseInt(params.get("laps") ?? "5", 10))
			: DEFAULT_TOTAL_LAPS;

	const root = new Container();
	const world = buildWorld(TOKYO);
	world.root.eventMode = "none";
	root.addChild(world.root);

	// Skid into ground layer (under car/buildings)
	const SKID_W = 2400;
	const SKID_H = 1600;
	const skid = createSkid(
		ctx.app,
		SKID_W,
		SKID_H,
		-SKID_W / 2 + 100,
		-SKID_H / 2,
	);
	world.groundLayer.addChild(skid.sprite);

	// Smoke into entity layer (between ground and buildings)
	const smoke = createParticles(192);
	world.entityLayer.addChildAt(smoke.view, 0);

	// IMPORTANT: per M6 architectural correction, headlights + car go into
	// buildingLayer so they sort against buildings via zIndex.
	const headlights = new Graphics();
	world.buildingLayer.addChild(headlights);

	const carG = new Graphics();
	world.buildingLayer.addChild(carG);

	const car = new Car();
	car.x = world.track.startPos.x;
	car.y = world.track.startPos.y;
	car.snapToFacing(
		Math.atan2(world.track.startTangent.y, world.track.startTangent.x),
	);

	const input = createKeyboardInput();

	// Tuning panel — press T while racing to toggle. Slider edits mutate
	// CAR_PHYSICS / DEFAULT_DRIFT_CONFIG live and persist to localStorage.
	const physicsKnob = (
		key: keyof typeof CAR_PHYSICS,
		label: string,
		min: number,
		max: number,
		step: number,
	): Knob => ({
		label,
		min,
		max,
		step,
		get: () => CAR_PHYSICS[key],
		set: (v) => {
			CAR_PHYSICS[key] = v;
		},
		defaultValue: defaultPhysicsValue(key),
	});
	const driftKnob = (
		key: keyof typeof DEFAULT_DRIFT_CONFIG,
		label: string,
		min: number,
		max: number,
		step: number,
	): Knob => ({
		label,
		min,
		max,
		step,
		get: () => DEFAULT_DRIFT_CONFIG[key],
		set: (v) => {
			DEFAULT_DRIFT_CONFIG[key] = v;
		},
		defaultValue: defaultDriftValue(key),
	});
	const tuningGroups: KnobGroup[] = [
		{
			title: "CAR",
			knobs: [
				physicsKnob("maxSpeed", "Top speed", 50, 500, 5),
				physicsKnob("accel", "Acceleration", 20, 400, 5),
				physicsKnob("brakeFromForward", "Brake force", 50, 500, 5),
				physicsKnob("reverseAccel", "Reverse accel", 10, 200, 5),
				physicsKnob("dragLinear", "Linear drag", 0.05, 1.5, 0.05),
				physicsKnob("steerRate", "Turn rate (base)", 0.5, 5.0, 0.1),
				physicsKnob("steerSpeedRef", "Steer speed ref", 20, 200, 5),
			],
		},
		{
			title: "DRIFT",
			knobs: [
				driftKnob("steerAuthorityGrip", "Grip turn × ", 0.05, 2.0, 0.05),
				driftKnob("steerAuthorityDrift", "Drift turn × ", 0.5, 5.0, 0.1),
				driftKnob("lateralGripGrip", "Grip lateral hold", 1, 30, 0.5),
				driftKnob(
					"lateralGripDrift",
					"Drift slide (lower=slidier)",
					0.1,
					10,
					0.1,
				),
				driftKnob("longitudinalGripDrift", "Drift speed bleed", 0.1, 1.0, 0.05),
				physicsKnob("driftEntryKick", "Drift entry kick", 0, 1.5, 0.05),
				driftKnob("minDriftSpeed", "Min drift speed", 0, 30, 1),
				driftKnob("exitSlipThreshold", "Exit slip threshold", 0.01, 0.5, 0.01),
				driftKnob("maxYawRate", "Max yaw before spin", 1, 10, 0.5),
				driftKnob("spinExitYawRate", "Spin recover threshold", 0.1, 3, 0.1),
			],
		},
	];
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	const debouncedSave = (): void => {
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			saveTuning();
			saveTimer = null;
		}, 200);
	};
	const tuning = createTuningPanel(tuningGroups, debouncedSave, () => {
		resetAllTuning();
	});

	// Start lights graphics (3 circles near top of screen)
	const lightsView = new Container();
	const lightG: Graphics[] = [];
	for (let i = 0; i < 3; i++) {
		const g = new Graphics();
		g.circle(i * 48 - 48, 0, 18).fill(0x331111);
		lightsView.addChild(g);
		lightG.push(g);
	}
	const goText = pixelText("GO!", { fontSize: 56, fill: 0x00ff88 });
	goText.visible = false;
	lightsView.addChild(goText);
	root.addChild(lightsView);

	let lights: LightsState = { phase: "COUNTDOWN_3", t: 0 };

	const lap = new LapTracker({
		ax: world.track.startPos.x,
		ay: world.track.startPos.y,
		tx: world.track.startTangent.x,
		ty: world.track.startTangent.y,
	});
	let lapNum = 1;
	let lapStartMs = 0;
	let nowMs = 0;
	const lapTimes: number[] = [];

	const hud = createHud();
	root.addChild(hud.view);
	hud.setBest(ctx.bests[MAP_ID] ?? null);

	let finished = false;

	const place = (): void => {
		hud.place(ctx.app.screen.width);
		lightsView.position.set(ctx.app.screen.width / 2, 80);
		goText.position.set(0, 0);
	};
	place();
	const onResize = (): void => place();
	window.addEventListener("resize", onResize);

	function showEnd(): void {
		const p = panel(420, 320);
		p.position.set(ctx.app.screen.width / 2, ctx.app.screen.height / 2);
		const title = pixelText("RACE COMPLETE", { fontSize: 18 });
		title.position.set(0, -120);
		p.addChild(title);

		const best = Math.min(...lapTimes);
		for (let i = 0; i < lapTimes.length; i++) {
			const tx = pixelText(`L${i + 1}  ${formatTime(lapTimes[i])}`, {
				fontSize: 14,
				fill: lapTimes[i] === best ? 0x00ff88 : 0xffffff,
			});
			tx.position.set(0, -80 + i * 22);
			p.addChild(tx);
		}

		const again = pixelButton(
			"RACE AGAIN",
			() => ctx.switchTo(createRaceScene),
			14,
		);
		again.view.position.set(-90, 110);
		const home = pixelButton(
			"BACK TO MENU",
			() => ctx.switchTo(createHomeScene),
			14,
		);
		home.view.position.set(90, 110);
		p.addChild(again.view, home.view);
		root.addChild(p);
	}

	const scene: Scene = {
		root,
		update(dt) {
			const dtMs = dt * 1000;
			lights = advanceLights(lights, dt);
			for (let i = 0; i < 3; i++) {
				const lit =
					(lights.phase === "COUNTDOWN_3" && i < 1) ||
					(lights.phase === "COUNTDOWN_2" && i < 2) ||
					(lights.phase === "COUNTDOWN_1" && i < 3);
				const green = lights.phase === "GO";
				lightG[i].clear();
				const color = green ? 0x00ff66 : lit ? 0xff2222 : 0x331111;
				lightG[i].circle(i * 48 - 48, 0, 18).fill(color);
			}
			goText.visible = lights.phase === "GO";
			lightsView.visible = lights.phase !== "HIDDEN";

			const state = input.read();
			const allowInput = inputsEnabled(lights) && !finished;
			car.update(
				dt,
				allowInput
					? state
					: { throttle: 0, steer: 0, drift: false, driftPressed: false },
			);

			renderHeadlights(headlights, car.look.headlightColor);
			headlights.position.set(car.x, car.y);
			headlights.rotation = car.facing;
			headlights.zIndex = car.y - 0.1;

			renderCar(carG, car.look, { brake: car.braking });
			carG.position.set(car.x, car.y);
			carG.rotation = car.facing;
			carG.zIndex = car.y;

			const drifting = car.state === "DRIFTING" || car.state === "SPINNING";
			if (drifting && allowInput) {
				const fcx = Math.cos(car.facing);
				const fcy = Math.sin(car.facing);
				const rx = -fcx * 14;
				const ry = -fcy * 14;
				for (const off of [-9, 9]) {
					const wx = car.x + rx + -fcy * off;
					const wy = car.y + ry + fcx * off;
					smoke.spawn({
						x: wx,
						y: wy,
						vx: -fcx * 6 + (Math.random() - 0.5) * 8,
						vy: -fcy * 6 + (Math.random() - 0.5) * 8,
						ttl: 0.7 + Math.random() * 0.4,
					});
				}
				skid.stamp(car.x, car.y, car.facing);
			}
			smoke.update(dt);

			world.camera.target.x = car.x;
			world.camera.target.y = car.y;
			world.updateCamera(ctx.app.screen.width, ctx.app.screen.height);
			world.updateOcclusion({ x: car.x, y: car.y });

			if (lights.phase === "GO" && lapStartMs === 0) {
				lapStartMs = nowMs;
			}
			nowMs += dtMs;
			if (lapStartMs > 0 && !finished) {
				const cur = nowMs - lapStartMs;
				hud.setLap(lapNum, TOTAL_LAPS);
				hud.setCurrent(cur);
				const distFromStart = Math.hypot(
					car.x - world.track.startPos.x,
					car.y - world.track.startPos.y,
				);
				if (lap.update({ x: car.x, y: car.y }, distFromStart)) {
					const lapMs = nowMs - lapStartMs;
					lapTimes.push(lapMs);
					lapStartMs = nowMs;
					const best = ctx.bests[MAP_ID];
					if (best === undefined || lapMs < best) {
						ctx.bests[MAP_ID] = lapMs;
						persist(ctx);
						hud.setBest(lapMs);
					}
					if (lapNum >= TOTAL_LAPS) {
						finished = true;
						showEnd();
					} else {
						lapNum++;
					}
				}
			} else {
				hud.setLap(lapNum, TOTAL_LAPS);
				hud.setCurrent(0);
			}
		},
		dispose() {
			input.dispose();
			window.removeEventListener("resize", onResize);
			skid.dispose();
			tuning.dispose();
			if (saveTimer) {
				clearTimeout(saveTimer);
				saveTuning();
			}
			root.destroy({ children: true });
		},
	};
	return scene;
};
